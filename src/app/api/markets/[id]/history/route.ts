import { NextRequest, NextResponse } from "next/server";
import {
  getHistoryParamsForTimeframe,
  normalizeTimeframe,
  type CandleInterval,
  type TimeframeType,
} from "@/lib/chart-timeframe";
import { getCachedValue, setCachedValue } from "@/lib/server-memory-cache";
import {
  aggregatePriceHistoryToCandles,
  candlesToHistory,
  normalizeHistoryPayload,
  type CandlePoint,
} from "@/lib/candle-aggregation";
import { getIntradayCandles, supportsIntradayCollector } from "@/lib/intraday-bars";

const CLOB_API = "https://clob.polymarket.com";
const CACHE_TTL_MS = 15_000;


function getMaxIntradayStalenessSeconds(historyInterval: CandleInterval, fidelity: number) {
  const fidelityLag = Number.isFinite(fidelity) && fidelity > 0 ? fidelity * 3 : 0;
  const intervalLag = historyInterval === "1d"
    ? 6 * 60 * 60
    : historyInterval === "4h"
      ? 2 * 60 * 60
      : historyInterval === "1h"
        ? 30 * 60
        : 15 * 60;

  return Math.max(intervalLag, fidelityLag);
}

interface HistoryPayload {
  history: Array<{ t: number; p: number }>;
  candles: CandlePoint[];
  timeframe: TimeframeType;
  interval: string;
  fidelity: number;
  historyInterval: CandleInterval;
  tokenId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const timeframe = normalizeTimeframe(searchParams.get("timeframe"));
    const timeframeConfig = getHistoryParamsForTimeframe(timeframe);
    const requestedInterval = searchParams.get("interval") || timeframeConfig.interval;
    const requestedFidelity = Number(searchParams.get("fidelity") || timeframeConfig.fidelity);
    const startTs = searchParams.get("startTs");
    const endTs = searchParams.get("endTs");
    const historyInterval = timeframeConfig.historyInterval;
    const nowSec = Math.floor(Date.now() / 1000);
    const effectiveStartTs = startTs || String(nowSec - timeframeConfig.lookbackSeconds);
    const resolvedStartTs = Number(effectiveStartTs);
    const resolvedEndTs = endTs ? Number(endTs) : nowSec;
    let tokenId = searchParams.get("tokenId");

    console.log(
      `[Price History] Request market=${id} tokenId=${tokenId} timeframe=${timeframe} interval=${requestedInterval} fidelity=${requestedFidelity}`
    );

    if (!tokenId) {
      const cachedTokenId = getCachedValue<string>(`market-token:${id}`);
      if (cachedTokenId) {
        tokenId = cachedTokenId;
      }
    }

    // If no tokenId provided, try to get it from CLOB API
    if (!tokenId) {
      try {
        const marketRes = await fetch(`${CLOB_API}/markets/${id}`, {
          headers: { Accept: "application/json" },
          next: { revalidate: 30 },
        });
        if (marketRes.ok) {
          const market = await marketRes.json();
          const primaryToken = Array.isArray(market.tokens) ? market.tokens[0] : null;
          if (primaryToken?.token_id) {
            tokenId = primaryToken.token_id;
            setCachedValue(`market-token:${id}`, tokenId, 60_000);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch market for token ID:", e);
      }
    }

    if (!tokenId) {
      console.warn("[Price History] No tokenId available");
      return NextResponse.json({
        history: [],
        candles: [],
        timeframe,
        interval: requestedInterval,
        fidelity: requestedFidelity,
        historyInterval,
        tokenId: "",
      });
    }

    if (supportsIntradayCollector(timeframe)) {
      try {
        const intradayCandles = await getIntradayCandles(tokenId, {
          timeframe,
          startTs: Number.isFinite(resolvedStartTs) ? resolvedStartTs : undefined,
          endTs: Number.isFinite(resolvedEndTs) ? resolvedEndTs : undefined,
        });

        if (intradayCandles.length > 0) {
          const lastIntradayCandle = intradayCandles[intradayCandles.length - 1];
          const lastIntradayTime = lastIntradayCandle?.time ?? null;
          const maxIntradayLag = getMaxIntradayStalenessSeconds(historyInterval, requestedFidelity);
          const intradayIsFresh = lastIntradayTime !== null && nowSec - lastIntradayTime <= maxIntradayLag;

          if (intradayIsFresh) {
            const payload: HistoryPayload = {
              history: candlesToHistory(intradayCandles),
              candles: intradayCandles,
              timeframe,
              interval: requestedInterval,
              fidelity: requestedFidelity,
              historyInterval,
              tokenId,
            };

            return NextResponse.json(payload, {
              headers: {
                "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=10",
                "X-PMPN-History-Source": "intraday-db",
              },
            });
          }

          console.warn(
            `[Price History] Intraday DB stale market=${id} tokenId=${tokenId} last=${lastIntradayTime} lag=${lastIntradayTime ? nowSec - lastIntradayTime : "unknown"}s max=${maxIntradayLag}s; falling back to CLOB`
          );
        }
      } catch (intradayError) {
        console.warn("[Price History] Intraday DB fallback failed:", intradayError);
      }
    }

    const cacheKey = `market-history:${id}:${tokenId}:${timeframe}:${historyInterval}:${effectiveStartTs}:${endTs || ""}`;
    const cached = getCachedValue<HistoryPayload>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
        },
      });
    }

    // Fetch price history directly from CLOB API
    // Upstream fidelity is not a strict bucket size. Fetch high-resolution data,
    // then enforce deterministic bucketing on our side.
    const url = `${CLOB_API}/prices-history?market=${encodeURIComponent(
      tokenId
    )}&interval=max&fidelity=1&startTs=${encodeURIComponent(effectiveStartTs)}${
      endTs ? `&endTs=${encodeURIComponent(endTs)}` : ""
    }`;
    console.log(`[Price History] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 15 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Price History] API error: ${response.status} - ${errorText}`);
      return NextResponse.json({
        history: [],
        candles: [],
        timeframe,
        interval: requestedInterval,
        fidelity: requestedFidelity,
        historyInterval,
        tokenId,
      });
    }

    const data: unknown = await response.json();
    const rawHistory = normalizeHistoryPayload(data);
    const candles = aggregatePriceHistoryToCandles(rawHistory, historyInterval);

    if (candles.length === 0) {
      console.log("[Price History] No history data returned");
      return NextResponse.json({
        history: [],
        candles: [],
        timeframe,
        interval: requestedInterval,
        fidelity: requestedFidelity,
        historyInterval,
        tokenId,
      });
    }

    console.log(
      `[Price History] Raw points=${rawHistory.length} Aggregated candles=${candles.length} interval=${historyInterval}`
    );

    const payload: HistoryPayload = {
      history: candlesToHistory(candles),
      candles,
      timeframe,
      interval: requestedInterval,
      fidelity: requestedFidelity,
      historyInterval,
      tokenId,
    };

    setCachedValue(cacheKey, payload, CACHE_TTL_MS);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Price history API error:", error);
    const timeframe = normalizeTimeframe(request.nextUrl.searchParams.get("timeframe"));
    const { interval, fidelity, historyInterval } = getHistoryParamsForTimeframe(timeframe);
    return NextResponse.json({
      history: [],
      candles: [],
      timeframe,
      interval,
      fidelity,
      historyInterval,
      tokenId: "",
    });
  }
}
