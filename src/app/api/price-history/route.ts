import { NextRequest, NextResponse } from "next/server";
import { POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";
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

interface PriceHistoryPayload {
  history: Array<{ t: number; p: number }>;
  candles: CandlePoint[];
  timeframe: TimeframeType;
  interval: string;
  fidelity: number;
  historyInterval: CandleInterval;
}

const CACHE_TTL_MS = 15_000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market");
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

    if (!market) {
      return NextResponse.json(
        { error: "Missing required parameter: market (token_id)" },
        { status: 400 }
      );
    }

    if (supportsIntradayCollector(timeframe)) {
      try {
        const intradayCandles = await getIntradayCandles(market, {
          timeframe,
          startTs: Number.isFinite(resolvedStartTs) ? resolvedStartTs : undefined,
          endTs: Number.isFinite(resolvedEndTs) ? resolvedEndTs : undefined,
        });

        if (intradayCandles.length > 0) {
          const payload: PriceHistoryPayload = {
            history: candlesToHistory(intradayCandles),
            candles: intradayCandles,
            timeframe,
            interval: requestedInterval,
            fidelity: requestedFidelity,
            historyInterval,
          };

          return NextResponse.json(payload, {
            headers: {
              "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=10",
              "X-PMPN-History-Source": "intraday-db",
            },
          });
        }
      } catch (intradayError) {
        console.warn("[Price History] Intraday DB fallback failed:", intradayError);
      }
    }

    const cacheKey = `price-history:${market}:${timeframe}:${historyInterval}:${effectiveStartTs}:${endTs || ""}`;
    const cached = getCachedValue<PriceHistoryPayload>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
        },
      });
    }

    const params = new URLSearchParams();
    params.set("market", market);
    // Upstream fidelity is not guaranteed to match strict bucket size.
    // Always fetch high-resolution data then aggregate server-side.
    params.set("interval", "max");
    params.set("fidelity", "1");
    params.set("startTs", effectiveStartTs);
    if (endTs) params.set("endTs", endTs);

    const url = `${POLYMARKET_ENDPOINTS.clob}/prices-history?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 15 },
    });

    if (!response.ok) {
      throw new Error(`Price history upstream failed: ${response.status}`);
    }

    const data: unknown = await response.json();
    const rawHistory = normalizeHistoryPayload(data);
    const candles = aggregatePriceHistoryToCandles(rawHistory, historyInterval);
    const payload: PriceHistoryPayload = {
      history: candlesToHistory(candles),
      candles,
      timeframe,
      interval: requestedInterval,
      fidelity: requestedFidelity,
      historyInterval,
    };

    setCachedValue(cacheKey, payload, CACHE_TTL_MS);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Price History API error:", error);
    const timeframe = normalizeTimeframe(request.nextUrl.searchParams.get("timeframe"));
    const fallback = getHistoryParamsForTimeframe(timeframe);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch price history",
        history: [],
        candles: [],
        timeframe,
        interval: fallback.interval,
        fidelity: fallback.fidelity,
        historyInterval: fallback.historyInterval,
      },
      { status: 500 }
    );
  }
}
