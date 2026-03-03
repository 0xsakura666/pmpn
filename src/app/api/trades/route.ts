import { NextRequest, NextResponse } from "next/server";

const DATA_API = "https://data-api.polymarket.com";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");
    const market = searchParams.get("market");
    const eventId = searchParams.get("eventId");
    const side = searchParams.get("side");
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";

    const params = new URLSearchParams();
    params.set("limit", limit);
    params.set("offset", offset);

    if (user) params.set("user", user);
    if (market) params.set("market", market);
    if (eventId) params.set("eventId", eventId);
    if (side) params.set("side", side);

    console.log(`[Trades API] Fetching for user: ${user}`);
    
    const response = await fetch(`${DATA_API}/trades?${params.toString()}`, {
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Trades API] Error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Data API error: ${response.status}`, trades: [] },
        { status: response.status }
      );
    }

    const trades: TradeRecord[] = await response.json();
    console.log(`[Trades API] Found ${trades.length} trades`);

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
      { error: error instanceof Error ? error.message : "Failed to fetch trades", trades: [] },
      { status: 500 }
    );
  }
}
