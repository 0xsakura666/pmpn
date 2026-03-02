import { NextRequest, NextResponse } from "next/server";
import { chainIndexer } from "@/lib/indexer";
import { getWhaleScoreTier } from "@/lib/indexer/whale-scorer";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20");
  const sortBy = searchParams.get("sortBy") || "whaleScore";
  const minScore = parseInt(searchParams.get("minScore") || "0");

  let whales = chainIndexer.getTopWhales(100);

  // Filter by minimum score
  if (minScore > 0) {
    whales = whales.filter((w) => w.whaleScore >= minScore);
  }

  // Sort by different criteria
  switch (sortBy) {
    case "pnl":
      whales.sort((a, b) => b.totalPnl - a.totalPnl);
      break;
    case "winRate":
      whales.sort((a, b) => b.winRate - a.winRate);
      break;
    case "volume":
      whales.sort((a, b) => b.totalVolume - a.totalVolume);
      break;
    case "trades":
      whales.sort((a, b) => b.totalTrades - a.totalTrades);
      break;
    default:
      whales.sort((a, b) => b.whaleScore - a.whaleScore);
  }

  // Map to response format
  const response = whales.slice(0, limit).map((whale, rank) => {
    const tier = getWhaleScoreTier(whale.whaleScore);
    return {
      rank: rank + 1,
      address: whale.address,
      whaleScore: whale.whaleScore,
      tier: tier.tier,
      tierLabel: tier.label,
      tierIcon: tier.icon,
      tierColor: tier.color,
      totalPnl: whale.totalPnl,
      realizedPnl: whale.realizedPnl,
      unrealizedPnl: whale.unrealizedPnl,
      winRate: whale.winRate,
      totalTrades: whale.totalTrades,
      totalVolume: whale.totalVolume,
      avgTradeSize: whale.avgTradeSize,
      lastActiveAt: whale.lastActiveAt,
    };
  });

  return NextResponse.json(response);
}
