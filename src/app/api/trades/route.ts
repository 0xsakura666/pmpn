import { NextRequest, NextResponse } from "next/server";

const DATA_API = "https://data-api.polymarket.com";
const CORS_PROXY = "https://api.codetabs.com/v1/proxy/?quest=";

export interface TradeRecord {
  proxyWallet: string;
  side: "BUY" | "SELL";
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  name: string;
  pseudonym: string;
  bio: string;
  profileImage: string;
  transactionHash: string;
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
    const user = searchParams.get("user");
    const market = searchParams.get("market");
    const eventId = searchParams.get("eventId");
    const side = searchParams.get("side");
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";
    const takerOnly = searchParams.get("takerOnly") || "true";

    const params = new URLSearchParams();
    params.set("limit", limit);
    params.set("offset", offset);
    params.set("takerOnly", takerOnly);

    if (user) params.set("user", user);
    if (market) params.set("market", market);
    if (eventId) params.set("eventId", eventId);
    if (side) params.set("side", side);

    const url = `${DATA_API}/trades?${params.toString()}`;
    const trades = await fetchWithProxy<TradeRecord[]>(url);

    return NextResponse.json({
      trades,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: trades.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Trades API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
