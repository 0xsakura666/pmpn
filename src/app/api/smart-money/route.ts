import { NextRequest, NextResponse } from "next/server";

// Mock smart money data - in production would come from indexer
const mockWhales = [
  {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    name: "Whale Alpha",
    whaleScore: 95,
    winRate: 78.5,
    totalPnl: 1250000,
    totalTrades: 342,
    avgTradeSize: 25000,
    topMarkets: ["Politics", "Crypto"],
    recentActivity: "2h ago",
  },
  {
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    name: "Smart Trader",
    whaleScore: 92,
    winRate: 72.3,
    totalPnl: 890000,
    totalTrades: 518,
    avgTradeSize: 15000,
    topMarkets: ["Sports", "Politics"],
    recentActivity: "30m ago",
  },
  {
    address: "0x9876543210fedcba9876543210fedcba98765432",
    name: "DeFi Degen",
    whaleScore: 88,
    winRate: 68.9,
    totalPnl: 650000,
    totalTrades: 892,
    avgTradeSize: 8000,
    topMarkets: ["Crypto", "Economy"],
    recentActivity: "5m ago",
  },
  {
    address: "0xfedcba9876543210fedcba9876543210fedcba98",
    name: "Prediction Pro",
    whaleScore: 85,
    winRate: 65.2,
    totalPnl: 520000,
    totalTrades: 423,
    avgTradeSize: 12000,
    topMarkets: ["Politics"],
    recentActivity: "1h ago",
  },
  {
    address: "0x5678901234abcdef5678901234abcdef56789012",
    name: null,
    whaleScore: 82,
    winRate: 71.8,
    totalPnl: 380000,
    totalTrades: 267,
    avgTradeSize: 18000,
    topMarkets: ["Sports", "Crypto"],
    recentActivity: "15m ago",
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy") || "whaleScore";
  const limit = parseInt(searchParams.get("limit") || "20");
  const minScore = parseInt(searchParams.get("minScore") || "0");

  let whales = [...mockWhales].filter((w) => w.whaleScore >= minScore);

  // Sort
  whales.sort((a, b) => {
    switch (sortBy) {
      case "pnl":
        return b.totalPnl - a.totalPnl;
      case "winRate":
        return b.winRate - a.winRate;
      case "trades":
        return b.totalTrades - a.totalTrades;
      default:
        return b.whaleScore - a.whaleScore;
    }
  });

  return NextResponse.json(whales.slice(0, limit));
}
