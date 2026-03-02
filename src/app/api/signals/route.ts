import { NextRequest, NextResponse } from "next/server";

// Mock signals - in production would come from websocket/indexer
const mockSignals = [
  {
    id: "sig-1",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    name: "Whale Alpha",
    action: "buy",
    outcome: "yes",
    marketId: "trump-2024",
    marketTitle: "Will Trump win 2024 election?",
    price: 0.65,
    size: 50000,
    total: 32500,
    whaleScore: 95,
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "sig-2",
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    name: "Smart Trader",
    action: "sell",
    outcome: "yes",
    marketId: "btc-100k",
    marketTitle: "Will BTC reach $100k by end of 2024?",
    price: 0.42,
    size: 25000,
    total: 10500,
    whaleScore: 92,
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "sig-3",
    address: "0x9876543210fedcba9876543210fedcba98765432",
    name: "DeFi Degen",
    action: "buy",
    outcome: "no",
    marketId: "fed-rate",
    marketTitle: "Will Fed cut rates in March?",
    price: 0.72,
    size: 18000,
    total: 12960,
    whaleScore: 88,
    timestamp: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "sig-4",
    address: "0xfedcba9876543210fedcba9876543210fedcba98",
    name: "Prediction Pro",
    action: "buy",
    outcome: "yes",
    marketId: "trump-2024",
    marketTitle: "Will Trump win 2024 election?",
    price: 0.64,
    size: 75000,
    total: 48000,
    whaleScore: 85,
    timestamp: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: "sig-5",
    address: "0x5678901234abcdef5678901234abcdef56789012",
    name: null,
    action: "sell",
    outcome: "no",
    marketId: "eth-merge",
    marketTitle: "Will ETH hit $5k before BTC halving?",
    price: 0.35,
    size: 30000,
    total: 10500,
    whaleScore: 82,
    timestamp: new Date(Date.now() - 1200000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20");
  const minScore = parseInt(searchParams.get("minScore") || "0");
  const action = searchParams.get("action"); // "buy" or "sell"
  const marketId = searchParams.get("marketId");

  let signals = [...mockSignals];

  // Filter
  if (minScore > 0) {
    signals = signals.filter((s) => s.whaleScore >= minScore);
  }
  if (action) {
    signals = signals.filter((s) => s.action === action);
  }
  if (marketId) {
    signals = signals.filter((s) => s.marketId === marketId);
  }

  // Sort by timestamp (newest first)
  signals.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json(signals.slice(0, limit));
}
