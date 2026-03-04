import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";

export interface PriceHistoryPoint {
  t: number;
  p: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market");
    const interval = searchParams.get("interval") || "1h";
    const fidelity = searchParams.get("fidelity") || "1";
    const startTs = searchParams.get("startTs");
    const endTs = searchParams.get("endTs");

    if (!market) {
      return NextResponse.json(
        { error: "Missing required parameter: market (token_id)" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.set("market", market);
    params.set("interval", interval);
    params.set("fidelity", fidelity);
    if (startTs) params.set("startTs", startTs);
    if (endTs) params.set("endTs", endTs);

    const url = `${POLYMARKET_ENDPOINTS.clob}/prices-history?${params.toString()}`;
    const data = await fetchPolymarketAPI<{ history: PriceHistoryPoint[] }>(url);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Price History API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
