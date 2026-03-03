"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
import { RealtimeOrderBook } from "@/components/trading/RealtimeOrderBook";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, DollarSign, BarChart3, ChevronRight } from "lucide-react";
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
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>("1M");
  const [priceHistory, setPriceHistory] = useState<CandlestickData<Time>[]>([]);

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
    if (!tokenId) return;
    try {
      const res = await fetch(`/api/price-history?market=${tokenId}&interval=max&fidelity=60`);
      if (res.ok) {
        const data = await res.json();
        if (data.history && data.history.length > 0) {
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
      }
    } catch {
      setPriceHistory([]);
    }
  }, []);

  useEffect(() => {
    if (selectedMarket?.yesTokenId) {
      fetchPriceHistory(selectedMarket.yesTokenId);
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
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xl font-bold text-[#00D4AA]">
                Tectonic
              </Link>
              <Link href="/" className="flex items-center gap-1 text-[#666] hover:text-white text-sm">
                <ArrowLeft className="w-4 h-4" />
                返回市场
              </Link>
            </div>
            <WalletButton />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Event Header */}
        <div className="mb-6">
          <div className="flex items-start gap-4 mb-4">
            {event.image && (
              <img
                src={event.image}
                alt=""
                className="w-20 h-20 rounded-xl object-cover border border-[#222]"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs bg-[#7B61FF]/20 text-[#7B61FF]">
                  {event.category}
                </span>
                <span className="text-xs text-[#666]">
                  {event.markets.length} 个市场
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
                {event.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-[#666]">
                  <DollarSign className="w-4 h-4" />
                  <span>24h成交量: <span className="text-white font-medium">{formatMoney(event.volume24h)}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-[#666]">
                  <BarChart3 className="w-4 h-4" />
                  <span>总成交量: <span className="text-white font-medium">{formatMoney(event.totalVolume)}</span></span>
                </div>
              </div>
            </div>
          </div>

          {event.description && (
            <p className="text-sm text-[#888] bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
              {event.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Markets List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#1a1a1f] rounded-xl border border-[#222] overflow-hidden">
              <div className="p-4 border-b border-[#222]">
                <h2 className="font-semibold text-white">选择市场</h2>
                <p className="text-xs text-[#666] mt-1">点击查看该市场的K线和交易</p>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {event.markets.map((market) => {
                  const isSelected = selectedMarket?.conditionId === market.conditionId;
                  const isUp = market.yesPrice > 0.5;

                  return (
                    <button
                      key={market.conditionId}
                      onClick={() => setSelectedMarket(market)}
                      className={`w-full p-4 text-left border-b border-[#222] last:border-b-0 transition-all ${
                        isSelected
                          ? "bg-[#00D4AA]/10 border-l-2 border-l-[#00D4AA]"
                          : "hover:bg-[#222]/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium mb-2 ${isSelected ? "text-white" : "text-[#ccc]"}`}>
                            {market.question}
                          </p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              {isUp ? (
                                <TrendingUp className="w-3 h-3 text-[#00D4AA]" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-[#FF6B6B]" />
                              )}
                              <span className={`text-lg font-bold ${isUp ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}>
                                {Math.round(market.yesPrice * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-[#666]">
                              <Clock className="w-3 h-3" />
                              <span>{market.daysLeft}天</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 mt-1 ${isSelected ? "text-[#00D4AA]" : "text-[#444]"}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Chart & Trading */}
          <div className="lg:col-span-2 space-y-4">
            {selectedMarket ? (
              <>
                {/* Selected Market Info */}
                <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white mb-1">{selectedMarket.question}</h3>
                      <div className="flex items-center gap-2 text-xs text-[#666]">
                        <span>截止 {new Date(selectedMarket.endDate).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-[#00D4AA]/10 border border-[#00D4AA]/20">
                      <span className="text-xs text-[#666]">Yes 价格</span>
                      <div className="text-2xl font-bold text-[#00D4AA]">
                        ${selectedMarket.yesPrice.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/20">
                      <span className="text-xs text-[#666]">No 价格</span>
                      <div className="text-2xl font-bold text-[#FF6B6B]">
                        ${selectedMarket.noPrice.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
                  <RealtimeCandlestickChart
                    tokenId={selectedMarket.yesTokenId}
                    initialData={priceHistory}
                    height={400}
                    defaultTimeframe={selectedTimeframe}
                    onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                    enableSimulation={true}
                    defaultChartMode="line"
                  />
                </div>

                {/* Order Book & Trade */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
                    <h3 className="font-semibold text-white mb-3">订单簿</h3>
                    <RealtimeOrderBook
                      tokenId={selectedMarket.yesTokenId}
                      maxDepth={6}
                    />
                  </div>
                  <div className="bg-[#1a1a1f] rounded-xl p-4 border border-[#222]">
                    <h3 className="font-semibold text-white mb-3">快速交易</h3>
                    <QuickTradePanel
                      yesTokenId={selectedMarket.yesTokenId}
                      noTokenId={selectedMarket.noTokenId}
                      marketTitle={selectedMarket.question}
                      yesPrice={selectedMarket.yesPrice}
                      noPrice={selectedMarket.noPrice}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#1a1a1f] rounded-xl p-8 border border-[#222] text-center">
                <BarChart3 className="w-12 h-12 text-[#444] mx-auto mb-4" />
                <p className="text-[#666]">请从左侧选择一个市场查看详情</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
