// Polygon/Polymarket chain event types

export interface TradeEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  trader: string;
  marketId: string;
  tokenId: string;
  side: "buy" | "sell";
  outcome: "yes" | "no";
  price: number;
  size: number;
  total: number;
}

export interface PositionSnapshot {
  address: string;
  marketId: string;
  outcome: "yes" | "no";
  shares: number;
  avgCost: number;
  currentValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface WalletStats {
  address: string;
  totalTrades: number;
  totalVolume: number;
  winCount: number;
  lossCount: number;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number;
  avgTradeSize: number;
  whaleScore: number;
  lastActiveAt: number;
  positions: PositionSnapshot[];
}

export interface WhaleAlert {
  id: string;
  address: string;
  name?: string;
  event: TradeEvent;
  significance: "high" | "medium" | "low";
  whaleScore: number;
  message: string;
  timestamp: number;
}

export interface MarketFlow {
  marketId: string;
  whaleVolume: number;
  retailVolume: number;
  netFlow: number;
  buyVolume: number;
  sellVolume: number;
  topBuyers: string[];
  topSellers: string[];
}
