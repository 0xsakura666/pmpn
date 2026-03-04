"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
import { RealtimeOrderBook } from "@/components/trading/RealtimeOrderBook";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, DollarSign, BarChart3, Check } from "lucide-react";
import { Time, CandlestickData } from "lightweight-charts";

interface SubMarket {
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  endDate: string;
  slug: string;
  daysLeft: number;
  yesTokenId: string;
  noTokenId: string;
}

interface EventData {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  markets: SubMarket[];
}

type TimeframeType = "1S" | "5S" | "15S" | "1M" | "5M" | "15M" | "1H" | "4H" | "1D";

function formatMoney(vol: number): string {
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `$${Math.round(vol / 1e3)}K`;
  return `$${Math.round(vol)}`;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<SubMarket | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>("5M");
  const [priceHistory, setPriceHistory] = useState<CandlestickData<Time>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const cached = localStorage.getItem(`event_${resolvedParams.id}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setEvent(data);
        if (data.markets && data.markets.length > 0) {
          setSelectedMarket(data.markets[0]);
        }
        setLoading(false);
      } catch {
        setError("无法加载事件数据");
        setLoading(false);
      }
    } else {
      setError("事件未找到，请从首页进入");
      setLoading(false);
    }
  }, [resolvedParams.id]);

  const fetchPriceHistory = useCallback(async (tokenId: string) => {
    if (!tokenId) {
      setPriceHistory([]);
      return;
    }
    
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/price-history?market=${tokenId}&interval=max&fidelity=60`);
      if (res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          const candles = data.history.map((point: { t: number; p: number }, index: number, arr: { t: number; p: number }[]) => {
            const prevPrice = index > 0 ? arr[index - 1].p : point.p;
            return {
              time: point.t as Time,
              open: prevPrice,
              high: Math.max(point.p, prevPrice),
              low: Math.min(point.p, prevPrice),
              close: point.p,
            };
          });
          setPriceHistory(candles);
        } else {
          setPriceHistory([]);
        }
      } else {
        setPriceHistory([]);
      }
    } catch (err) {
      console.error("Failed to fetch price history:", err);
      setPriceHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMarket?.yesTokenId) {
      fetchPriceHistory(selectedMarket.yesTokenId);
    } else {
      setPriceHistory([]);
    }
  }, [selectedMarket, fetchPriceHistory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4AA] mx-auto mb-4" />
          <p className="text-[#666]">加载事件数据...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#FF6B6B] mb-4">{error || "事件不存在"}</p>
          <Link href="/" className="text-[#00D4AA] hover:underline">
            ← 返回市场列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white">
      {/* Header */}
      <header className="border-b border-[#222] bg-[#0d0d0f] sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold text-[#00D4AA]">
                Tectonic
              </Link>
              <Link href="/" className="flex items-center gap-1 text-[#666] hover:text-white text-sm">
                <ArrowLeft className="w-4 h-4" />
                返回
              </Link>
            </div>
            <WalletButton />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Event Header - Compact */}
        <div className="flex items-center gap-4 mb-6">
          {event.image && (
            <img
              src={event.image}
              alt=""
              className="w-14 h-14 rounded-xl object-cover border border-[#222]"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-xs bg-[#7B61FF]/20 text-[#7B61FF]">
                {event.category}
              </span>
              <span className="text-xs text-[#666]">{event.markets.length} 个市场</span>
              <span className="text-xs text-[#666]">·</span>
              <span className="text-xs text-[#666]">Vol {formatMoney(event.totalVolume)}</span>
            </div>
            <h1 className="text-xl font-bold text-white truncate">{event.title}</h1>
          </div>
        </div>

        {/* Market Tabs - Horizontal */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {event.markets.map((market) => {
              const isSelected = selectedMarket?.conditionId === market.conditionId;
              const probability = Math.round(market.yesPrice * 100);
              
              return (
                <button
                  key={market.conditionId}
                  onClick={() => setSelectedMarket(market)}
                  className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-[#00D4AA]/10 border-[#00D4AA] text-white"
                      : "bg-[#1a1a1f] border-[#222] text-[#888] hover:border-[#333] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="text-sm font-medium max-w-[200px] truncate">
                        {market.question.length > 30 ? market.question.slice(0, 30) + "..." : market.question}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-lg font-bold ${probability > 50 ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}>
                          {probability}%
                        </span>
                        <span className="text-xs text-[#666]">{market.daysLeft}天</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#00D4AA]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedMarket && (
          <>
            {/* Price Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[#00D4AA]/5 border border-[#00D4AA]/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#888]">Yes</span>
                  <TrendingUp className="w-4 h-4 text-[#00D4AA]" />
                </div>
                <div className="text-3xl font-bold text-[#00D4AA] mt-1">
                  {Math.round(selectedMarket.yesPrice * 100)}¢
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#FF6B6B]/5 border border-[#FF6B6B]/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#888]">No</span>
                  <TrendingDown className="w-4 h-4 text-[#FF6B6B]" />
                </div>
                <div className="text-3xl font-bold text-[#FF6B6B] mt-1">
                  {Math.round(selectedMarket.noPrice * 100)}¢
                </div>
              </div>
            </div>

            {/* Chart - Full Width */}
            <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222] mb-6">
              {historyLoading ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4AA]" />
                </div>
              ) : (
                <RealtimeCandlestickChart
                  tokenId={selectedMarket.yesTokenId}
                  initialData={priceHistory}
                  height={400}
                  defaultTimeframe={selectedTimeframe}
                  onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                  defaultChartMode="line"
                />
              )}
            </div>

            {/* Order Book & Trade - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1a1a1f] rounded-xl border border-[#222] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#222]">
                  <h3 className="font-semibold text-white">订单簿</h3>
                </div>
                <div className="p-4">
                  <RealtimeOrderBook
                    tokenId={selectedMarket.yesTokenId}
                    maxDepth={8}
                  />
                </div>
              </div>
              
              <div className="bg-[#1a1a1f] rounded-xl border border-[#222] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#222]">
                  <h3 className="font-semibold text-white">快速交易</h3>
                </div>
                <div className="p-4">
                  <QuickTradePanel
                    yesTokenId={selectedMarket.yesTokenId}
                    noTokenId={selectedMarket.noTokenId}
                    marketTitle={selectedMarket.question}
                    yesPrice={selectedMarket.yesPrice}
                    noPrice={selectedMarket.noPrice}
                  />
                </div>
              </div>
            </div>

            {/* Market Info */}
            <div className="mt-6 p-4 bg-[#1a1a1f] rounded-xl border border-[#222]">
              <div className="flex items-center gap-4 text-sm text-[#666]">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>截止 {new Date(selectedMarket.endDate).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span>24h成交量 {formatMoney(event.volume24h)}</span>
                </div>
              </div>
              {event.description && (
                <p className="mt-3 text-sm text-[#888]">{event.description}</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
