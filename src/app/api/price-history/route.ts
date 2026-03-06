import { NextRequest, NextResponse } from "next/server";
import { POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";
import {
  getHistoryParamsForTimeframe,
  normalizeTimeframe,
  type CandleInterval,
  type TimeframeType,
} from "@/lib/chart-timeframe";
import { getCachedValue, setCachedValue } from "@/lib/server-memory-cache";

export interface PriceHistoryPoint {
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

interface PriceHistoryPayload {
  history: PriceHistoryPoint[];
  candles: CandlestickPoint[];
  timeframe: TimeframeType;
  interval: string;
  fidelity: number;
  historyInterval: CandleInterval;
}

const CACHE_TTL_MS = 15_000;

function normalizeHistoryPayload(data: unknown): PriceHistoryPoint[] {
  if (Array.isArray(data)) {
    return data as PriceHistoryPoint[];
  }

  if (data && typeof data === "object" && "history" in data) {
    const history = (data as { history?: unknown }).history;
    if (Array.isArray(history)) return history as PriceHistoryPoint[];
  }

  return [];
}

function toCandles(history: PriceHistoryPoint[]): CandlestickPoint[] {
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market");
    const timeframe = normalizeTimeframe(searchParams.get("timeframe"));
    const timeframeConfig = getHistoryParamsForTimeframe(timeframe);
    const interval = searchParams.get("interval") || timeframeConfig.interval;
    const fidelity = Number(searchParams.get("fidelity") || timeframeConfig.fidelity);
    const startTs = searchParams.get("startTs");
    const endTs = searchParams.get("endTs");
    const historyInterval = timeframeConfig.historyInterval;

    if (!market) {
      return NextResponse.json(
        { error: "Missing required parameter: market (token_id)" },
        { status: 400 }
      );
    }

    const cacheKey = `price-history:${market}:${interval}:${fidelity}:${startTs || ""}:${endTs || ""}`;
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
    params.set("interval", interval);
    params.set("fidelity", String(fidelity));
    if (startTs) params.set("startTs", startTs);
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
    const history = normalizeHistoryPayload(data);
    const payload: PriceHistoryPayload = {
      history,
      candles: toCandles(history),
      timeframe,
      interval,
      fidelity,
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
