import type { WalletStats } from "./types";

// Whale Score calculation algorithm
// Score ranges from 0-100 based on multiple factors

interface ScoreWeights {
  volume: number;      // Total trading volume
  winRate: number;     // Win rate percentage
  pnl: number;         // Total P&L
  consistency: number; // Trading consistency
  avgSize: number;     // Average trade size
  experience: number;  // Number of trades
}

const WEIGHTS: ScoreWeights = {
  volume: 0.25,
  winRate: 0.20,
  pnl: 0.20,
  consistency: 0.10,
  avgSize: 0.15,
  experience: 0.10,
};

// Thresholds for scoring
const THRESHOLDS = {
  volume: {
    legendary: 10_000_000, // $10M+
    whale: 1_000_000,      // $1M+
    dolphin: 100_000,      // $100K+
    fish: 10_000,          // $10K+
  },
  winRate: {
    legendary: 80,
    whale: 70,
    dolphin: 60,
    fish: 50,
  },
  pnl: {
    legendary: 500_000,
    whale: 100_000,
    dolphin: 10_000,
    fish: 1_000,
  },
  avgSize: {
    legendary: 50_000,
    whale: 10_000,
    dolphin: 1_000,
    fish: 100,
  },
  trades: {
    legendary: 1000,
    whale: 500,
    dolphin: 100,
    fish: 20,
  },
};

export function calculateWhaleScore(stats: WalletStats): number {
  const volumeScore = scoreVolume(stats.totalVolume);
  const winRateScore = scoreWinRate(stats.winRate);
  const pnlScore = scorePnl(stats.totalPnl);
  const consistencyScore = scoreConsistency(stats);
  const avgSizeScore = scoreAvgSize(stats.avgTradeSize);
  const experienceScore = scoreExperience(stats.totalTrades);

  const rawScore =
    volumeScore * WEIGHTS.volume +
    winRateScore * WEIGHTS.winRate +
    pnlScore * WEIGHTS.pnl +
    consistencyScore * WEIGHTS.consistency +
    avgSizeScore * WEIGHTS.avgSize +
    experienceScore * WEIGHTS.experience;

  // Apply multipliers
  let finalScore = rawScore;

  // Bonus for consistent profitability
  if (stats.totalPnl > 0 && stats.winRate > 60) {
    finalScore *= 1.1;
  }

  // Penalty for high loss rate
  if (stats.winRate < 40 && stats.totalTrades > 20) {
    finalScore *= 0.8;
  }

  // Recent activity bonus
  const daysSinceActive = (Date.now() - stats.lastActiveAt) / (1000 * 60 * 60 * 24);
  if (daysSinceActive < 7) {
    finalScore *= 1.05;
  } else if (daysSinceActive > 30) {
    finalScore *= 0.9;
  }

  return Math.min(100, Math.max(0, Math.round(finalScore)));
}

function scoreVolume(volume: number): number {
  if (volume >= THRESHOLDS.volume.legendary) return 100;
  if (volume >= THRESHOLDS.volume.whale) return 75 + (volume - THRESHOLDS.volume.whale) / (THRESHOLDS.volume.legendary - THRESHOLDS.volume.whale) * 25;
  if (volume >= THRESHOLDS.volume.dolphin) return 50 + (volume - THRESHOLDS.volume.dolphin) / (THRESHOLDS.volume.whale - THRESHOLDS.volume.dolphin) * 25;
  if (volume >= THRESHOLDS.volume.fish) return 25 + (volume - THRESHOLDS.volume.fish) / (THRESHOLDS.volume.dolphin - THRESHOLDS.volume.fish) * 25;
  return (volume / THRESHOLDS.volume.fish) * 25;
}

function scoreWinRate(winRate: number): number {
  if (winRate >= THRESHOLDS.winRate.legendary) return 100;
  if (winRate >= THRESHOLDS.winRate.whale) return 75 + (winRate - THRESHOLDS.winRate.whale) / (THRESHOLDS.winRate.legendary - THRESHOLDS.winRate.whale) * 25;
  if (winRate >= THRESHOLDS.winRate.dolphin) return 50 + (winRate - THRESHOLDS.winRate.dolphin) / (THRESHOLDS.winRate.whale - THRESHOLDS.winRate.dolphin) * 25;
  if (winRate >= THRESHOLDS.winRate.fish) return 25 + (winRate - THRESHOLDS.winRate.fish) / (THRESHOLDS.winRate.dolphin - THRESHOLDS.winRate.fish) * 25;
  return (winRate / THRESHOLDS.winRate.fish) * 25;
}

function scorePnl(pnl: number): number {
  if (pnl <= 0) return Math.max(0, 25 + (pnl / 10000) * 25); // Negative PnL reduces score
  if (pnl >= THRESHOLDS.pnl.legendary) return 100;
  if (pnl >= THRESHOLDS.pnl.whale) return 75 + (pnl - THRESHOLDS.pnl.whale) / (THRESHOLDS.pnl.legendary - THRESHOLDS.pnl.whale) * 25;
  if (pnl >= THRESHOLDS.pnl.dolphin) return 50 + (pnl - THRESHOLDS.pnl.dolphin) / (THRESHOLDS.pnl.whale - THRESHOLDS.pnl.dolphin) * 25;
  if (pnl >= THRESHOLDS.pnl.fish) return 25 + (pnl - THRESHOLDS.pnl.fish) / (THRESHOLDS.pnl.dolphin - THRESHOLDS.pnl.fish) * 25;
  return (pnl / THRESHOLDS.pnl.fish) * 25;
}

function scoreConsistency(stats: WalletStats): number {
  if (stats.totalTrades < 10) return 30; // Not enough data
  
  // Check if wins are distributed across different markets
  const uniqueMarkets = new Set(stats.positions.map(p => p.marketId)).size;
  const diversityScore = Math.min(100, uniqueMarkets * 10);
  
  // Check P&L volatility (lower is better for consistency)
  const avgPnlPerTrade = stats.totalPnl / stats.totalTrades;
  const volatilityPenalty = Math.abs(avgPnlPerTrade) > stats.avgTradeSize ? 20 : 0;
  
  return Math.max(0, diversityScore - volatilityPenalty);
}

function scoreAvgSize(avgSize: number): number {
  if (avgSize >= THRESHOLDS.avgSize.legendary) return 100;
  if (avgSize >= THRESHOLDS.avgSize.whale) return 75 + (avgSize - THRESHOLDS.avgSize.whale) / (THRESHOLDS.avgSize.legendary - THRESHOLDS.avgSize.whale) * 25;
  if (avgSize >= THRESHOLDS.avgSize.dolphin) return 50 + (avgSize - THRESHOLDS.avgSize.dolphin) / (THRESHOLDS.avgSize.whale - THRESHOLDS.avgSize.dolphin) * 25;
  if (avgSize >= THRESHOLDS.avgSize.fish) return 25 + (avgSize - THRESHOLDS.avgSize.fish) / (THRESHOLDS.avgSize.dolphin - THRESHOLDS.avgSize.fish) * 25;
  return (avgSize / THRESHOLDS.avgSize.fish) * 25;
}

function scoreExperience(trades: number): number {
  if (trades >= THRESHOLDS.trades.legendary) return 100;
  if (trades >= THRESHOLDS.trades.whale) return 75 + (trades - THRESHOLDS.trades.whale) / (THRESHOLDS.trades.legendary - THRESHOLDS.trades.whale) * 25;
  if (trades >= THRESHOLDS.trades.dolphin) return 50 + (trades - THRESHOLDS.trades.dolphin) / (THRESHOLDS.trades.whale - THRESHOLDS.trades.dolphin) * 25;
  if (trades >= THRESHOLDS.trades.fish) return 25 + (trades - THRESHOLDS.trades.fish) / (THRESHOLDS.trades.dolphin - THRESHOLDS.trades.fish) * 25;
  return (trades / THRESHOLDS.trades.fish) * 25;
}

export function getWhaleScoreTier(score: number): {
  tier: "legendary" | "whale" | "dolphin" | "fish" | "shrimp";
  label: string;
  icon: string;
  color: string;
} {
  if (score >= 90) return { tier: "legendary", label: "Mega Whale", icon: "🐋", color: "#FFD700" };
  if (score >= 75) return { tier: "whale", label: "Whale", icon: "🐳", color: "#3B82F6" };
  if (score >= 50) return { tier: "dolphin", label: "Dolphin", icon: "🐬", color: "#06B6D4" };
  if (score >= 25) return { tier: "fish", label: "Fish", icon: "🐟", color: "#22C55E" };
  return { tier: "shrimp", label: "Shrimp", icon: "🦐", color: "#6B7280" };
}
