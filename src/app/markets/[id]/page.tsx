"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { OrderBook } from "@/components/trading/OrderBook";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { PositionsPanel } from "@/components/trading/PositionsPanel";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { Time, CandlestickData } from "lightweight-charts";

interface MarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

interface MarketData {
  id: string;
  title: string;
  titleOriginal: string;
  description: string;
  slug: string;
  endDate: string;
  image: string;
  tokens: MarketToken[];
  orderBooks: Array<{
    outcome: string;
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
  }>;
  negRisk?: boolean;
  tickSize?: string;
}

const timeframes = ["1M", "5M", "15M", "1H", "4H", "1D"];

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [selectedTimeframe, setSelectedTimeframe] = useState("1H");
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<CandlestickData<Time>[]>([]);

  useEffect(() => {
    fetchMarket();
  }, [resolvedParams.id]);

  const fetchMarket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets/${resolvedParams.id}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }
      
      if (!res.ok) {
        throw new Error("Market not found");
      }
      
      setMarket(data);

      // 获取价格历史
      if (data.tokens && data.tokens.length > 0) {
        const yesToken = data.tokens.find((t: MarketToken) => t.outcome === "Yes");
        if (yesToken) {
          fetchPriceHistory(yesToken.token_id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market");
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceHistory = async (tokenId: string) => {
    try {
      const res = await fetch(`/api/markets/${resolvedParams.id}/history?tokenId=${tokenId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          const candlesticks = data.candles.map((c: { time: number; open: number; high: number; low: number; close: number }) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          setPriceHistory(candlesticks);
        } else {
          setPriceHistory([]);
        }
      }
    } catch {
      setPriceHistory([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4AA] mx-auto mb-4" />
          <p className="text-[#666]">加载市场数据...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#FF6B6B] mb-4">{error || "市场不存在"}</p>
          <Link href="/" className="text-[#00D4AA] hover:underline">
            ← 返回市场列表
          </Link>
        </div>
      </div>
    );
  }

  const yesToken = market.tokens?.find(t => t.outcome === "Yes");
  const noToken = market.tokens?.find(t => t.outcome === "No");
  const yesPrice = yesToken?.price || 0.5;
  const noPrice = noToken?.price || 0.5;

  const yesOrderBook = market.orderBooks?.find(ob => ob.outcome === "Yes");
  const formattedBids = yesOrderBook?.bids?.map(b => ({
    price: parseFloat(b.price),
    size: parseFloat(b.size),
  })) || [];
  const formattedAsks = yesOrderBook?.asks?.map(a => ({
    price: parseFloat(a.price),
    size: parseFloat(a.size),
  })) || [];

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white">
      {/* Header */}
      <header className="border-b border-[#222] bg-[#0d0d0f]">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-bold text-[#00D4AA]">
                Tectonic
              </Link>
              <Link href="/" className="text-[#666] hover:text-white text-sm">
                ← 返回市场
              </Link>
            </div>
            <WalletButton />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Market Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-[#666] mb-2">
            <span>截止 {new Date(market.endDate).toLocaleDateString('zh-CN')}</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            {market.image && (
              <img 
                src={market.image} 
                alt="" 
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white">
                {market.title}
              </h1>
              {market.titleOriginal !== market.title && (
                <p className="text-sm text-[#666]">
                  {market.titleOriginal}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="text-sm text-[#666]">Yes 价格</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#00D4AA]">${yesPrice.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <span className="text-sm text-[#666]">No 价格</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#FF6B6B]">${noPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 space-y-4">
            {/* Timeframe Selector */}
            <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
              <div className="flex gap-2 mb-4">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      selectedTimeframe === tf
                        ? "bg-[#00D4AA] text-black"
                        : "bg-[#2a2a2f] text-[#666] hover:text-white"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <CandlestickChart
                data={priceHistory}
                height={400}
              />
            </div>

            {/* Description */}
            {market.description && (
              <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
                <h3 className="font-semibold mb-2 text-white">市场描述</h3>
                <p className="text-sm text-[#666]">
                  {market.description}
                </p>
              </div>
            )}

            {/* Token Info */}
            <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
              <h3 className="font-semibold mb-4 text-white">代币信息</h3>
              <div className="space-y-3">
                {market.tokens?.map((token) => (
                  <div key={token.token_id} className="flex items-center justify-between p-3 rounded-lg bg-[#0d0d0f]">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        token.outcome === "Yes" 
                          ? "bg-[#00D4AA]/20 text-[#00D4AA]" 
                          : "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                      }`}>
                        {token.outcome}
                      </span>
                      <span className="text-xs font-mono text-[#666]">
                        {token.token_id.slice(0, 20)}...
                      </span>
                    </div>
                    <span className="font-bold text-white">${token.price.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trading Sidebar */}
          <div className="space-y-4">
            <QuickTradePanel
              marketTitle={market.title}
              yesPrice={yesPrice}
              noPrice={noPrice}
              yesTokenId={yesToken?.token_id}
              noTokenId={noToken?.token_id}
              tickSize={market.tickSize || "0.01"}
              negRisk={market.negRisk || false}
            />

            {/* Positions & Orders */}
            <PositionsPanel />

            {/* Order Book */}
            <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
              <h3 className="font-semibold mb-4 text-white">订单簿 (Yes)</h3>
              {formattedBids.length > 0 || formattedAsks.length > 0 ? (
                <OrderBook bids={formattedBids} asks={formattedAsks} />
              ) : (
                <p className="text-sm text-[#666] text-center py-4">
                  暂无订单簿数据
                </p>
              )}
            </div>

            {/* Market Info */}
            <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
              <h3 className="font-semibold mb-4 text-white">市场信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666]">市场 ID</span>
                  <span className="font-mono text-xs text-white">{market.id.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">结算日期</span>
                  <span className="text-white">{new Date(market.endDate).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">Slug</span>
                  <span className="font-mono text-xs text-white">{market.slug}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

