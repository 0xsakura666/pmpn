"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { OrderBook } from "@/components/trading/OrderBook";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { PositionsPanel } from "@/components/trading/PositionsPanel";
import { Time, CandlestickData } from "lightweight-charts";

// Mock market data
const mockMarket = {
  id: "will-trump-win-2024",
  title: "Will Donald Trump win the 2024 Presidential Election?",
  description:
    "This market will resolve to Yes if Donald Trump wins the 2024 Presidential Election.",
  category: "Politics",
  volume: 125000000,
  liquidity: 8500000,
  yesPrice: 0.65,
  noPrice: 0.35,
  endDate: "2024-11-05",
  yesTokenId: "", // Fill with actual token ID from Polymarket API
  noTokenId: "",  // Fill with actual token ID from Polymarket API
  tickSize: "0.01",
  negRisk: false,
  priceHistory: generateMockCandlestick(),
  volumeHistory: generateMockVolume(),
  orderBook: {
    bids: Array.from({ length: 10 }, (_, i) => ({
      price: 0.65 - i * 0.01,
      size: Math.floor(Math.random() * 50000) + 10000,
    })),
    asks: Array.from({ length: 10 }, (_, i) => ({
      price: 0.65 + (i + 1) * 0.01,
      size: Math.floor(Math.random() * 50000) + 10000,
    })),
  },
  recentTrades: [
    { side: "buy", price: 0.65, size: 5000, time: "2分钟前" },
    { side: "sell", price: 0.64, size: 3200, time: "5分钟前" },
    { side: "buy", price: 0.65, size: 12000, time: "8分钟前" },
    { side: "sell", price: 0.63, size: 1800, time: "15分钟前" },
    { side: "buy", price: 0.64, size: 8500, time: "22分钟前" },
  ],
  whaleActivity: [
    {
      address: "0x1234...abcd",
      action: "买入 YES",
      amount: "$125,000",
      price: 0.64,
      time: "1小时前",
      whaleScore: 92,
    },
    {
      address: "0x5678...efgh",
      action: "卖出 YES",
      amount: "$85,000",
      price: 0.66,
      time: "3小时前",
      whaleScore: 88,
    },
    {
      address: "0x9abc...ijkl",
      action: "买入 YES",
      amount: "$200,000",
      price: 0.62,
      time: "5小时前",
      whaleScore: 95,
    },
  ],
};

function generateMockCandlestick(): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  let price = 0.45;
  const now = Date.now();
  
  for (let i = 200; i >= 0; i--) {
    const timestamp = Math.floor((now - i * 3600000) / 1000) as Time;
    const change = (Math.random() - 0.48) * 0.03;
    const high = price + Math.random() * 0.02;
    const low = price - Math.random() * 0.02;
    const close = price + change;
    
    data.push({
      time: timestamp,
      open: price,
      high: Math.max(price, close, high),
      low: Math.min(price, close, low),
      close: Math.max(0.01, Math.min(0.99, close)),
    });
    
    price = Math.max(0.01, Math.min(0.99, close));
  }
  
  return data;
}

function generateMockVolume() {
  return Array.from({ length: 200 }, (_, i) => ({
    time: (Math.floor(Date.now() / 1000) - (200 - i) * 3600) as Time,
    value: Math.floor(Math.random() * 1000000) + 100000,
    color: Math.random() > 0.5 ? "#00D4AA40" : "#FF6B6B40",
  }));
}

const timeframes = ["1M", "5M", "15M", "1H", "4H", "1D"];

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [selectedTimeframe, setSelectedTimeframe] = useState("1H");

  const market = mockMarket;
  const priceChange = ((market.yesPrice - 0.45) / 0.45) * 100;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))]">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-2xl font-['Space_Grotesk'] font-bold">
              <span className="text-gradient">Tectonic</span>
            </Link>
            <Link href="/markets" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
              ← 返回市场
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Market Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] mb-2">
            <span className="px-2 py-0.5 rounded bg-[hsl(var(--muted))]">{market.category}</span>
            <span>•</span>
            <span>Ends {market.endDate}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-['Space_Grotesk'] font-bold mb-4">
            {market.title}
          </h1>
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Yes 价格</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--up)]">${market.yesPrice.toFixed(2)}</span>
                <span className={`text-sm ${priceChange >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                  {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">成交量 (24h)</span>
              <div className="text-xl font-semibold">${(market.volume / 1e6).toFixed(1)}M</div>
            </div>
            <div>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">流动性</span>
              <div className="text-xl font-semibold">${(market.liquidity / 1e6).toFixed(1)}M</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 space-y-4">
            {/* Timeframe Selector */}
            <div className="glass rounded-xl p-4">
              <div className="flex gap-2 mb-4">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      selectedTimeframe === tf
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <CandlestickChart
                data={market.priceHistory}
                volumeData={market.volumeHistory}
                height={400}
              />
            </div>

            {/* Recent Trades */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4">最近成交</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-4 text-xs text-[hsl(var(--muted-foreground))] pb-2 border-b border-[hsl(var(--border))]">
                  <span>方向</span>
                  <span>价格</span>
                  <span>数量</span>
                  <span>时间</span>
                </div>
                {market.recentTrades.map((trade, i) => (
                  <div key={i} className="grid grid-cols-4 text-sm py-1">
                    <span className={trade.side === "buy" ? "text-[var(--up)]" : "text-[var(--down)]"}>
                      {trade.side.toUpperCase()}
                    </span>
                    <span className="font-mono">${trade.price.toFixed(3)}</span>
                    <span className="font-mono">{trade.size.toLocaleString()}</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{trade.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Whale Activity */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4 flex items-center gap-2">
                <span className="text-[var(--whale)]">🐋</span> 巨鲸动态
              </h3>
              <div className="space-y-3">
                {market.whaleActivity.map((activity, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--whale)] to-[hsl(var(--primary))] flex items-center justify-center">
                        <span className="text-xs font-bold">{activity.whaleScore}</span>
                      </div>
                      <div>
                        <div className="font-mono text-sm">{activity.address}</div>
                        <div className={`text-sm ${activity.action.includes("买入") ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                          {activity.action} @ ${activity.price}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{activity.amount}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trading Sidebar */}
          <div className="space-y-4">
            <QuickTradePanel
              marketTitle={market.title}
              yesPrice={market.yesPrice}
              noPrice={market.noPrice}
              yesTokenId={market.yesTokenId}
              noTokenId={market.noTokenId}
              tickSize={market.tickSize}
              negRisk={market.negRisk}
            />

            {/* Positions & Orders */}
            <PositionsPanel />

            {/* Order Book */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4">订单簿</h3>
              <OrderBook bids={market.orderBook.bids} asks={market.orderBook.asks} />
            </div>

            {/* Market Info */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4">市场信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">市场 ID</span>
                  <span className="font-mono">{resolvedParams.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">结算日期</span>
                  <span>{market.endDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">总成交量</span>
                  <span>${(market.volume / 1e6).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">流动性</span>
                  <span>${(market.liquidity / 1e6).toFixed(1)}M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
