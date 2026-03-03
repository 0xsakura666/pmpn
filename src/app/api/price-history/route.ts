import { NextRequest, NextResponse } from "next/server";

const CLOB_API = "https://clob.polymarket.com";
const CORS_PROXY = "https://api.codetabs.com/v1/proxy/?quest=";

export interface PriceHistoryPoint {
  t: number;
  p: number;
}

async function fetchWithProxy<T>(url: string): Promise<T> {
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
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

    const url = `${CLOB_API}/prices-history?${params.toString()}`;
    const data = await fetchWithProxy<{ history: PriceHistoryPoint[] }>(url);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Price History API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch price history" },
      { status: 500 }
    );
  }
}
