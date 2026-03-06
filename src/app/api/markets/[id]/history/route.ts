import { NextRequest, NextResponse } from "next/server";
import {
  getHistoryParamsForTimeframe,
  normalizeTimeframe,
  type CandleInterval,
  type TimeframeType,
} from "@/lib/chart-timeframe";
import { getCachedValue, setCachedValue } from "@/lib/server-memory-cache";

const CLOB_API = "https://clob.polymarket.com";
const CACHE_TTL_MS = 15_000;

interface HistoryPoint {
  t: number;
  p: number;
}

interface CandlestickPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface HistoryPayload {
  history: HistoryPoint[];
  candles: CandlestickPoint[];
  timeframe: TimeframeType;
  interval: string;
  fidelity: number;
  historyInterval: CandleInterval;
  tokenId: string;
}

function normalizeHistoryPayload(data: unknown): HistoryPoint[] {
  if (Array.isArray(data)) {
    return data as HistoryPoint[];
  }

  if (data && typeof data === "object" && "history" in data) {
    const history = (data as { history?: unknown }).history;
    if (Array.isArray(history)) return history as HistoryPoint[];
  }

  return [];
}

function toCandles(history: HistoryPoint[]): CandlestickPoint[] {
  return history.map((point, index, arr) => {
    const open = index > 0 ? arr[index - 1].p : point.p;
    const close = point.p;

    return {
      time: point.t,
      open,
      high: Math.max(close, open),
      low: Math.min(close, open),
      close,
    };
  });
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
    const interval = searchParams.get("interval") || timeframeConfig.interval;
    const fidelity = Number(searchParams.get("fidelity") || timeframeConfig.fidelity);
    const historyInterval = timeframeConfig.historyInterval;
    let tokenId = searchParams.get("tokenId");

    console.log(
      `[Price History] Request market=${id} tokenId=${tokenId} timeframe=${timeframe} interval=${interval} fidelity=${fidelity}`
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
          const yesToken = market.tokens?.find((t: { outcome: string }) => t.outcome === "Yes");
          if (yesToken) {
            tokenId = yesToken.token_id;
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
        interval,
        fidelity,
        historyInterval,
        tokenId: "",
      });
    }

    const cacheKey = `market-history:${id}:${tokenId}:${interval}:${fidelity}`;
    const cached = getCachedValue<HistoryPayload>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
        },
      });
    }

    // Fetch price history directly from CLOB API
    const url = `${CLOB_API}/prices-history?market=${encodeURIComponent(
      tokenId
    )}&interval=${encodeURIComponent(interval)}&fidelity=${fidelity}`;
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
        interval,
        fidelity,
        historyInterval,
        tokenId,
      });
    }

    const data: unknown = await response.json();
    const history = normalizeHistoryPayload(data);

    if (history.length === 0) {
      console.log("[Price History] No history data returned");
      return NextResponse.json({
        history: [],
        candles: [],
        timeframe,
        interval,
        fidelity,
        historyInterval,
        tokenId,
      });
    }

    console.log(`[Price History] Got ${history.length} data points`);

    const payload: HistoryPayload = {
      history,
      candles: toCandles(history),
      timeframe,
      interval,
      fidelity,
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
