import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";

export interface LeaderboardEntry {
  rank: number;
  address: string;
  name: string;
  pseudonym: string;
  profileImage: string;
  volume: number;
  profit: number;
  profitPercent: number;
  marketsTraded: number;
  numTrades: number;
  lastTradeTimestamp: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";
    const window = searchParams.get("window") || "all";

    const params = new URLSearchParams();
    params.set("limit", limit);
    params.set("offset", offset);
    if (window !== "all") params.set("window", window);

    const url = `${POLYMARKET_ENDPOINTS.data}/leaderboard?${params.toString()}`;
    const data = await fetchPolymarketAPI<LeaderboardEntry[]>(url);

    return NextResponse.json({
      leaderboard: data,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: data.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Leaderboard API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
