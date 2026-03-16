"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { RealtimeOrderBook } from "@/components/trading/RealtimeOrderBook";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
import {
  ArrowLeft,
  Search,
  TrendingUp,
  Clock,
  BarChart3,
  RefreshCw,
  ChevronDown,
  Star,
  Activity,
} from "lucide-react";

interface Market {
  conditionId: string;
  question: string;
  slug: string;
  image: string;
  yesPrice: number;
  noPrice: number;
  yesLabel: string;
  noLabel: string;
  volume24h: number;
  totalVolume: number;
  endDate: string;
  yesTokenId?: string;
  noTokenId?: string;
  tickSize?: string;
  negRisk?: boolean;
}

interface ApiMarketResponse {
  id?: string;
  conditionId?: string;
  question?: string;
  title?: string;
  slug?: string;
  image?: string;
  yesPrice?: number | string;
  noPrice?: number | string;
  yesLabel?: string;
  noLabel?: string;
  volume24h?: number | string;
  totalVolume?: number | string;
  endDate?: string;
  yesTokenId?: string;
  noTokenId?: string;
  tickSize?: string;
  negRisk?: boolean;
}

function formatPriceCents(value: number) {
  if (!Number.isFinite(value)) return "--";
  const cents = value * 100;
  return Number.isInteger(cents) ? `${cents}` : cents.toFixed(1).replace(/\.0$/, "");
}

function TradePageContent() {
  const searchParams = useSearchParams();
  const initialMarketId = searchParams.get("market");
  
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showMarketSelector, setShowMarketSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch("/api/markets?limit=1200");
      if (res.ok) {
        const data = await res.json();
        const parsed: Market[] = Array.isArray(data)
          ? data
              .map((market: ApiMarketResponse) => ({
                conditionId: market.conditionId || market.id || "",
                question: market.question || market.title || "",
                slug: market.slug || "",
                image: market.image || "",
                yesPrice: Number(market.yesPrice ?? 0.5),
                noPrice: Number(market.noPrice ?? (1 - Number(market.yesPrice ?? 0.5))),
                yesLabel: market.yesLabel || "Yes",
                noLabel: market.noLabel || "No",
                volume24h: Number(market.volume24h ?? 0),
                totalVolume: Number(market.totalVolume ?? 0),
                endDate: market.endDate || "",
                yesTokenId: market.yesTokenId || "",
                noTokenId: market.noTokenId || "",
                tickSize: market.tickSize || "0.01",
                negRisk: Boolean(market.negRisk),
              }))
              .filter((m: Market) => Boolean(m.conditionId))
          : [];
        setMarkets(parsed);
        
        if (initialMarketId) {
          const found = parsed.find((m) => m.conditionId === initialMarketId);
          if (found) {
            setSelectedMarket(found);
            return;
          }
        }

        setSelectedMarket((prev) => {
          if (prev) {
            const updated = parsed.find((m) => m.conditionId === prev.conditionId);
            if (updated) return updated;
          }
          return parsed[0] || null;
        });
      }
    } catch (err) {
      console.error("Failed to fetch markets:", err);
    } finally {
      setLoading(false);
    }
  }, [initialMarketId]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setShowMarketSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMarkets = markets.filter((m) =>
    m.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMoney = (val: number) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-[#0c0c10] text-white">
      {/* Header */}
      <header className="border-b border-[#1a1a22] bg-[#0c0c10]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-[#6b6b80] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-xl font-bold text-gradient">交易</span>
          </div>

          {/* Market Selector */}
          <div className="relative flex-1 max-w-xl mx-8" ref={selectorRef}>
            <button
              onClick={() => setShowMarketSelector(!showMarketSelector)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-[#13131a] border border-[#1e1e28] hover:border-[#2d2d3a] transition-colors"
            >
              {selectedMarket ? (
                <div className="flex items-center gap-3 min-w-0">
                  {selectedMarket.image && (
                    <img
                      src={selectedMarket.image}
                      alt=""
                      className="h-6 w-6 rounded-md object-cover"
                    />
                  )}
                  <span className="truncate text-sm">{selectedMarket.question}</span>
                </div>
              ) : (
                <span className="text-[#6b6b80]">选择市场...</span>
              )}
              <ChevronDown className={`h-4 w-4 text-[#6b6b80] transition-transform ${showMarketSelector ? "rotate-180" : ""}`} />
            </button>

            {showMarketSelector && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-[#13131a] border border-[#1e1e28] shadow-2xl max-h-96 overflow-hidden z-50">
                <div className="p-3 border-b border-[#1e1e28]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b80]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索市场..."
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0c0c10] border border-[#1e1e28] text-sm focus:outline-none focus:border-[#00D4AA]"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {filteredMarkets.map((market) => (
                    <button
                      key={market.conditionId}
                      onClick={() => {
                        setSelectedMarket(market);
                        setShowMarketSelector(false);
                        setSearchQuery("");
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1e1e28] transition-colors ${
                        selectedMarket?.conditionId === market.conditionId
                          ? "bg-[#00D4AA]/10"
                          : ""
                      }`}
                    >
                      {market.image && (
                        <img
                          src={market.image}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm truncate">{market.question}</p>
                        <p className="text-xs text-[#6b6b80]">
                          Vol {formatMoney(market.totalVolume)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-[#00D4AA]">
                          {formatPriceCents(market.yesPrice)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="h-8 w-8 animate-spin text-[#00D4AA]" />
        </div>
      ) : !selectedMarket ? (
        <div className="flex flex-col items-center justify-center py-32">
          <BarChart3 className="h-16 w-16 text-[#6b6b80] mb-6" />
          <h2 className="text-xl font-semibold mb-2">选择一个市场开始交易</h2>
          <p className="text-[#6b6b80]">从上方选择器中选择一个市场</p>
        </div>
      ) : (
        <main className="mx-auto max-w-[1600px] px-4 py-4">
          {/* Market Info Bar */}
          <div className="mb-4 flex items-center justify-between rounded-xl bg-[#13131a] border border-[#1e1e28] px-4 py-3">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-[#6b6b80]">{selectedMarket.yesLabel} 价格</span>
                <p className="text-lg font-bold text-[#00D4AA]">
                  {formatPriceCents(selectedMarket.yesPrice)}
                </p>
              </div>
              <div>
                <span className="text-xs text-[#6b6b80]">{selectedMarket.noLabel} 价格</span>
                <p className="text-lg font-bold text-[#FF6B6B]">
                  {formatPriceCents(selectedMarket.noPrice)}
                </p>
              </div>
              <div className="h-8 w-px bg-[#1e1e28]" />
              <div>
                <span className="text-xs text-[#6b6b80]">24h 交易量</span>
                <p className="font-mono">{formatMoney(selectedMarket.volume24h)}</p>
              </div>
              <div>
                <span className="text-xs text-[#6b6b80]">总交易量</span>
                <p className="font-mono">{formatMoney(selectedMarket.totalVolume)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-[#1e1e28] text-[#6b6b80] hover:text-white transition-colors">
                <Star className="h-4 w-4" />
              </button>
              <Link
                href={`/markets/${selectedMarket.conditionId}`}
                className="px-3 py-1.5 rounded-lg text-sm bg-[#1e1e28] hover:bg-[#2d2d3a] transition-colors"
              >
                详情
              </Link>
            </div>
          </div>

          {/* Main Trading Layout */}
          <div className="grid grid-cols-12 gap-4">
            {/* Chart */}
            <div className="col-span-8 rounded-xl bg-[#13131a] border border-[#1e1e28] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e1e28] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#00D4AA]" />
                  <span className="text-sm font-medium">价格走势</span>
                </div>
              </div>
              <div className="h-[400px]">
                {selectedMarket.yesTokenId ? (
                  <RealtimeCandlestickChart
                    tokenId={selectedMarket.yesTokenId}
                    height={400}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[#6b6b80]">
                    Token ID 不可用
                  </div>
                )}
              </div>
            </div>

            {/* Order Book + Trade Panel */}
            <div className="col-span-4 space-y-4">
              {/* Order Book */}
              <div className="rounded-xl bg-[#13131a] border border-[#1e1e28] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e1e28]">
                  <span className="text-sm font-medium">订单簿</span>
                </div>
                <div className="p-4 max-h-[240px] overflow-y-auto">
                  {selectedMarket.yesTokenId ? (
                    <RealtimeOrderBook tokenId={selectedMarket.yesTokenId} />
                  ) : (
                    <div className="text-center text-[#6b6b80] py-8">
                      订单簿不可用
                    </div>
                  )}
                </div>
              </div>

              {/* Trade Panel */}
              <QuickTradePanel
                marketTitle={selectedMarket.question}
                yesPrice={selectedMarket.yesPrice}
                noPrice={selectedMarket.noPrice}
                yesLabel={selectedMarket.yesLabel}
                noLabel={selectedMarket.noLabel}
                yesTokenId={selectedMarket.yesTokenId}
                noTokenId={selectedMarket.noTokenId}
                tickSize={selectedMarket.tickSize}
                negRisk={selectedMarket.negRisk}
              />
            </div>
          </div>

          {/* Hot Markets */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-[#00D4AA]" />
              <span className="font-medium">热门市场</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {markets.slice(0, 8).map((market) => (
                <button
                  key={market.conditionId}
                  onClick={() => setSelectedMarket(market)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedMarket?.conditionId === market.conditionId
                      ? "border-[#00D4AA] bg-[#00D4AA]/5"
                      : "border-[#1e1e28] bg-[#13131a] hover:border-[#2d2d3a]"
                  }`}
                >
                  <p className="text-sm truncate mb-2">{market.question}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-[#00D4AA]">
                      {formatPriceCents(market.yesPrice)}
                    </span>
                    <span className="text-xs text-[#6b6b80]">
                      {formatMoney(market.volume24h)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0c10] flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-[#00D4AA]" />
        </div>
      }
    >
      <TradePageContent />
    </Suspense>
  );
}
