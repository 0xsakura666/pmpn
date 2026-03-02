import { createPublicClient, http, parseAbiItem, type Address, type Log } from "viem";
import { polygon } from "viem/chains";
import type { TradeEvent, WalletStats, PositionSnapshot, MarketFlow } from "./types";
import { calculateWhaleScore } from "./whale-scorer";

// Polymarket CTF Exchange contract on Polygon
const CTF_EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as Address;
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as Address;

// Event signatures
const TRADE_EVENT = parseAbiItem(
  "event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled)"
);

// In-memory storage (in production, use database)
const walletStats = new Map<string, WalletStats>();
const recentTrades: TradeEvent[] = [];
const marketFlows = new Map<string, MarketFlow>();

// Create Polygon client
const client = createPublicClient({
  chain: polygon,
  transport: http(process.env.POLYGON_RPC_URL || "https://polygon-rpc.com"),
});

export class ChainIndexer {
  private isRunning = false;
  private lastProcessedBlock = 0;

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("[Indexer] Starting chain indexer...");

    // Get current block
    const currentBlock = await client.getBlockNumber();
    this.lastProcessedBlock = Number(currentBlock) - 1000; // Start from 1000 blocks ago

    // Start polling for new blocks
    this.pollBlocks();
  }

  stop() {
    this.isRunning = false;
    console.log("[Indexer] Stopping chain indexer...");
  }

  private async pollBlocks() {
    while (this.isRunning) {
      try {
        const currentBlock = await client.getBlockNumber();
        const from = this.lastProcessedBlock + 1;
        const to = Math.min(Number(currentBlock), from + 100); // Process max 100 blocks at a time

        if (from <= to) {
          await this.processBlockRange(from, to);
          this.lastProcessedBlock = to;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error("[Indexer] Error polling blocks:", error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async processBlockRange(from: number, to: number) {
    try {
      const logs = await client.getLogs({
        address: CTF_EXCHANGE_ADDRESS,
        event: TRADE_EVENT,
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
      });

      for (const log of logs) {
        await this.processTradeLog(log);
      }

      if (logs.length > 0) {
        console.log(`[Indexer] Processed ${logs.length} trades from blocks ${from}-${to}`);
      }
    } catch (error) {
      console.error(`[Indexer] Error processing blocks ${from}-${to}:`, error);
    }
  }

  private async processTradeLog(log: Log) {
    const { args, transactionHash, blockNumber } = log as any;
    if (!args) return;

    const { maker, taker, makerAssetId, takerAssetId, makerAmountFilled, takerAmountFilled } = args;

    // Determine trade direction
    const isBuy = makerAssetId === BigInt(0); // USDC is asset 0
    const trader = isBuy ? taker : maker;
    const tokenId = isBuy ? takerAssetId.toString() : makerAssetId.toString();
    const usdcAmount = isBuy ? Number(makerAmountFilled) / 1e6 : Number(takerAmountFilled) / 1e6;
    const tokenAmount = isBuy ? Number(takerAmountFilled) / 1e6 : Number(makerAmountFilled) / 1e6;

    const trade: TradeEvent = {
      txHash: transactionHash,
      blockNumber: Number(blockNumber),
      timestamp: Date.now(),
      trader: trader.toLowerCase(),
      marketId: tokenId.slice(0, 16), // Simplified market ID
      tokenId,
      side: isBuy ? "buy" : "sell",
      outcome: "yes", // Simplified
      price: usdcAmount / tokenAmount,
      size: tokenAmount,
      total: usdcAmount,
    };

    // Update stats
    this.updateWalletStats(trade);
    this.updateMarketFlow(trade);

    // Store recent trade
    recentTrades.unshift(trade);
    if (recentTrades.length > 1000) {
      recentTrades.pop();
    }
  }

  private updateWalletStats(trade: TradeEvent) {
    const existing = walletStats.get(trade.trader) || {
      address: trade.trader,
      totalTrades: 0,
      totalVolume: 0,
      winCount: 0,
      lossCount: 0,
      totalPnl: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      winRate: 0,
      avgTradeSize: 0,
      whaleScore: 0,
      lastActiveAt: 0,
      positions: [],
    };

    existing.totalTrades++;
    existing.totalVolume += trade.total;
    existing.avgTradeSize = existing.totalVolume / existing.totalTrades;
    existing.lastActiveAt = trade.timestamp;

    // Simplified P&L calculation (would need price tracking in production)
    if (trade.side === "sell") {
      const pnl = trade.total * 0.1; // Mock 10% profit on sells
      existing.realizedPnl += pnl;
      existing.totalPnl = existing.realizedPnl + existing.unrealizedPnl;
      existing.winCount++;
    }

    existing.winRate = (existing.winCount / existing.totalTrades) * 100;
    existing.whaleScore = calculateWhaleScore(existing);

    walletStats.set(trade.trader, existing);
  }

  private updateMarketFlow(trade: TradeEvent) {
    const existing = marketFlows.get(trade.marketId) || {
      marketId: trade.marketId,
      whaleVolume: 0,
      retailVolume: 0,
      netFlow: 0,
      buyVolume: 0,
      sellVolume: 0,
      topBuyers: [],
      topSellers: [],
    };

    const stats = walletStats.get(trade.trader);
    const isWhale = stats && stats.whaleScore >= 70;

    if (isWhale) {
      existing.whaleVolume += trade.total;
    } else {
      existing.retailVolume += trade.total;
    }

    if (trade.side === "buy") {
      existing.buyVolume += trade.total;
      existing.netFlow += trade.total;
    } else {
      existing.sellVolume += trade.total;
      existing.netFlow -= trade.total;
    }

    marketFlows.set(trade.marketId, existing);
  }

  // Public API methods
  getWalletStats(address: string): WalletStats | undefined {
    return walletStats.get(address.toLowerCase());
  }

  getTopWhales(limit: number = 20): WalletStats[] {
    return Array.from(walletStats.values())
      .sort((a, b) => b.whaleScore - a.whaleScore)
      .slice(0, limit);
  }

  getRecentTrades(limit: number = 50): TradeEvent[] {
    return recentTrades.slice(0, limit);
  }

  getWhaleTrades(minScore: number = 70, limit: number = 20): TradeEvent[] {
    return recentTrades
      .filter((trade) => {
        const stats = walletStats.get(trade.trader);
        return stats && stats.whaleScore >= minScore;
      })
      .slice(0, limit);
  }

  getMarketFlow(marketId: string): MarketFlow | undefined {
    return marketFlows.get(marketId);
  }

  getAllMarketFlows(): MarketFlow[] {
    return Array.from(marketFlows.values());
  }
}

// Singleton instance
export const chainIndexer = new ChainIndexer();

// Mock data for development (when not connected to chain)
export function initMockData() {
  const mockAddresses = [
    "0x1234567890abcdef1234567890abcdef12345678",
    "0xabcdef1234567890abcdef1234567890abcdef12",
    "0x9876543210fedcba9876543210fedcba98765432",
    "0xfedcba9876543210fedcba9876543210fedcba98",
    "0x5678901234abcdef5678901234abcdef56789012",
  ];

  mockAddresses.forEach((address, i) => {
    const stats: WalletStats = {
      address,
      totalTrades: 100 + Math.floor(Math.random() * 900),
      totalVolume: 100000 + Math.random() * 9900000,
      winCount: Math.floor(Math.random() * 500),
      lossCount: Math.floor(Math.random() * 500),
      totalPnl: (Math.random() - 0.3) * 1000000,
      realizedPnl: (Math.random() - 0.3) * 800000,
      unrealizedPnl: (Math.random() - 0.3) * 200000,
      winRate: 50 + Math.random() * 40,
      avgTradeSize: 1000 + Math.random() * 49000,
      whaleScore: 0,
      lastActiveAt: Date.now() - Math.random() * 86400000 * 7,
      positions: [],
    };
    stats.whaleScore = calculateWhaleScore(stats);
    walletStats.set(address, stats);
  });

  // Mock recent trades
  for (let i = 0; i < 50; i++) {
    const address = mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
    recentTrades.push({
      txHash: `0x${Math.random().toString(16).slice(2)}`,
      blockNumber: 50000000 + i,
      timestamp: Date.now() - i * 60000,
      trader: address,
      marketId: ["trump-2024", "btc-100k", "fed-rate"][Math.floor(Math.random() * 3)],
      tokenId: `token-${i}`,
      side: Math.random() > 0.5 ? "buy" : "sell",
      outcome: Math.random() > 0.5 ? "yes" : "no",
      price: 0.3 + Math.random() * 0.4,
      size: 100 + Math.random() * 10000,
      total: 100 + Math.random() * 50000,
    });
  }
}

// Initialize mock data for development
initMockData();
