import { NextRequest, NextResponse } from "next/server";
import { chainIndexer } from "@/lib/indexer";
import { getWhaleScoreTier } from "@/lib/indexer/whale-scorer";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20");
  const minScore = parseInt(searchParams.get("minScore") || "70");
  const marketId = searchParams.get("marketId");
  const side = searchParams.get("side"); // "buy" or "sell"

  let trades = chainIndexer.getWhaleTrades(minScore, 100);

  // Filter by market
  if (marketId) {
    trades = trades.filter((t) => t.marketId === marketId);
  }

  // Filter by side
  if (side === "buy" || side === "sell") {
    trades = trades.filter((t) => t.side === side);
  }

  // Map to response format with wallet stats
  const response = trades.slice(0, limit).map((trade) => {
    const stats = chainIndexer.getWalletStats(trade.trader);
    const tier = stats ? getWhaleScoreTier(stats.whaleScore) : null;

    return {
      id: trade.txHash,
      txHash: trade.txHash,
      blockNumber: trade.blockNumber,
      timestamp: trade.timestamp,
      trader: {
        address: trade.trader,
        whaleScore: stats?.whaleScore || 0,
        tier: tier?.tier || "shrimp",
        tierLabel: tier?.label || "Unknown",
        tierIcon: tier?.icon || "🦐",
        winRate: stats?.winRate || 0,
        totalPnl: stats?.totalPnl || 0,
      },
      market: {
        id: trade.marketId,
        title: getMarketTitle(trade.marketId),
      },
      action: trade.side,
      outcome: trade.outcome,
      price: trade.price,
      size: trade.size,
      total: trade.total,
      significance: getTradeSignificance(trade.total, stats?.whaleScore || 0),
    };
  });

  return NextResponse.json(response);
}

function getMarketTitle(marketId: string): string {
  const titles: Record<string, string> = {
    "trump-2024": "Will Trump win 2024 election?",
    "btc-100k": "Will BTC reach $100k?",
    "fed-rate": "Will Fed cut rates?",
    "eth-5k": "Will ETH reach $5k?",
  };
  return titles[marketId] || `Market ${marketId}`;
}

function getTradeSignificance(
  total: number,
  whaleScore: number
): "high" | "medium" | "low" {
  if (total >= 50000 || whaleScore >= 90) return "high";
  if (total >= 10000 || whaleScore >= 75) return "medium";
  return "low";
}
