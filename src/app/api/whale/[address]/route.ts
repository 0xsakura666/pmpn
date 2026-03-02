import { NextRequest, NextResponse } from "next/server";
import { chainIndexer } from "@/lib/indexer";
import { getWhaleScoreTier } from "@/lib/indexer/whale-scorer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const stats = chainIndexer.getWalletStats(address.toLowerCase());

  if (!stats) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  const tier = getWhaleScoreTier(stats.whaleScore);

  // Get recent trades for this wallet
  const recentTrades = chainIndexer
    .getRecentTrades(100)
    .filter((t) => t.trader === address.toLowerCase())
    .slice(0, 20)
    .map((t) => ({
      id: t.txHash,
      txHash: t.txHash,
      timestamp: t.timestamp,
      marketId: t.marketId,
      side: t.side,
      outcome: t.outcome,
      price: t.price,
      size: t.size,
      total: t.total,
    }));

  return NextResponse.json({
    address: stats.address,
    whaleScore: stats.whaleScore,
    tier: tier.tier,
    tierLabel: tier.label,
    tierIcon: tier.icon,
    tierColor: tier.color,
    stats: {
      totalPnl: stats.totalPnl,
      realizedPnl: stats.realizedPnl,
      unrealizedPnl: stats.unrealizedPnl,
      winRate: stats.winRate,
      winCount: stats.winCount,
      lossCount: stats.lossCount,
      totalTrades: stats.totalTrades,
      totalVolume: stats.totalVolume,
      avgTradeSize: stats.avgTradeSize,
      lastActiveAt: stats.lastActiveAt,
    },
    positions: stats.positions,
    recentTrades,
  });
}
