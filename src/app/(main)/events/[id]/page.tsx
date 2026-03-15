"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
import { RealtimeOrderBook } from "@/components/trading/RealtimeOrderBook";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, DollarSign, Check } from "lucide-react";
import { Time, CandlestickData } from "lightweight-charts";
import {
  getHistoryParamsForTimeframe,
  type CandleInterval,
  type TimeframeType,
} from "@/lib/chart-timeframe";
import {
  getAvailableChartTimeframes,
  getRecommendedChartTimeframe,
  getShortTermStartTs,
} from "@/lib/short-term-chart";

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

function normalizeCandleTime(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const normalized = raw > 10_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw);
  return normalized > 0 ? normalized : null;
}

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
  const [historyBaseInterval, setHistoryBaseInterval] = useState<CandleInterval>("1m");
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyCacheRef = useRef<Map<string, { candles: CandlestickData<Time>[]; interval: CandleInterval }>>(
    new Map()
  );

  useEffect(() => {
    if (!selectedMarket?.endDate) return;
    setSelectedTimeframe((current) => {
      if (current !== "5M") return current;
      return getRecommendedChartTimeframe(selectedMarket.endDate);
    });
  }, [selectedMarket?.endDate]);

  useEffect(() => {
    let cancelled = false;
    let hasCache = false;

    const cached = localStorage.getItem(`event_${resolvedParams.id}`);
    if (cached) {
      try {
        const data = JSON.parse(cached) as EventData;
        hasCache = true;
        setEvent(data);
        if (data.markets && data.markets.length > 0) {
          setSelectedMarket(data.markets[0]);
        }
        setLoading(false);
      } catch {
        localStorage.removeItem(`event_${resolvedParams.id}`);
      }
    }

    const fetchFresh = async () => {
      try {
        const res = await fetch(`/api/events/${resolvedParams.id}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("事件未找到");
        }
        const data = (await res.json()) as EventData;
        if (cancelled) return;

        setEvent(data);
        if (data.markets && data.markets.length > 0) {
          setSelectedMarket((prev) => {
            if (!prev) return data.markets[0];
            const matched = data.markets.find((m) => m.conditionId === prev.conditionId);
            return matched || data.markets[0];
          });
        }
        localStorage.setItem(`event_${resolvedParams.id}`, JSON.stringify(data));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if (!hasCache) {
          setError(err instanceof Error ? err.message : "事件未找到，请从首页进入");
        }
      } finally {
        if (!cancelled && !hasCache) {
          setLoading(false);
        }
      }
    };

    void fetchFresh();

    return () => {
      cancelled = true;
    };
  }, [resolvedParams.id]);

  const fetchPriceHistory = useCallback(async (
    tokenId: string,
    timeframe: TimeframeType,
    signal?: AbortSignal
  ) => {
    if (!tokenId) {
      setPriceHistory([]);
      return;
    }

    const startTs = getShortTermStartTs(selectedMarket?.endDate, timeframe);
    const cacheKey = `${tokenId}:${timeframe}:${startTs || "default"}`;
    const cached = historyCacheRef.current.get(cacheKey);
    if (cached) {
      setPriceHistory(cached.candles);
      setHistoryBaseInterval(cached.interval);
      return;
    }

    setHistoryLoading(true);
    const { historyInterval } = getHistoryParamsForTimeframe(timeframe);

    try {
      const params = new URLSearchParams({
        market: tokenId,
        timeframe,
      });
      if (startTs) {
        params.set("startTs", String(startTs));
      }
      const res = await fetch(`/api/price-history?${params.toString()}`, { signal });

      if (res.ok) {
        const data = await res.json();
        const resolvedInterval = (data.historyInterval || historyInterval) as CandleInterval;

        if (data.candles && Array.isArray(data.candles) && data.candles.length > 0) {
          type RawCandle = { time: number; open: number; high: number; low: number; close: number };
          const normalized: Array<CandlestickData<Time> | null> = (data.candles as RawCandle[])
            .map((c: { time: number; open: number; high: number; low: number; close: number }) => {
              const normalizedTime = normalizeCandleTime(c.time);
              if (
                normalizedTime === null ||
                !Number.isFinite(c.open) ||
                !Number.isFinite(c.high) ||
                !Number.isFinite(c.low) ||
                !Number.isFinite(c.close)
              ) {
                return null;
              }

              return {
                time: normalizedTime as Time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
              };
            });
          const candles = normalized.filter((c): c is CandlestickData<Time> => c !== null);

          historyCacheRef.current.set(cacheKey, {
            candles,
            interval: resolvedInterval,
          });

          if (signal?.aborted) return;
          setPriceHistory(candles);
          setHistoryBaseInterval(resolvedInterval);
        } else {
          if (signal?.aborted) return;
          setPriceHistory([]);
          setHistoryBaseInterval(resolvedInterval);
        }
      } else {
        if (signal?.aborted) return;
        setPriceHistory([]);
        setHistoryBaseInterval(historyInterval);
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Failed to fetch price history:", err);
      setPriceHistory([]);
      setHistoryBaseInterval(historyInterval);
    } finally {
      if (!signal?.aborted) {
        setHistoryLoading(false);
      }
    }
  }, [selectedMarket?.endDate]);

  useEffect(() => {
    if (selectedMarket?.yesTokenId) {
      const controller = new AbortController();
      fetchPriceHistory(selectedMarket.yesTokenId, selectedTimeframe, controller.signal);
      return () => controller.abort();
    } else {
      setPriceHistory([]);
      setHistoryBaseInterval("1m");
    }
  }, [selectedMarket, selectedTimeframe, fetchPriceHistory]);

  const allowedTimeframes = getAvailableChartTimeframes(selectedMarket?.endDate);

  const marketIdLabel = selectedMarket?.conditionId ? `${selectedMarket.conditionId.slice(0, 12)}...` : "--";
  const settlementLabel = selectedMarket?.endDate
    ? new Date(selectedMarket.endDate).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";
  const yesPrice = selectedMarket?.yesPrice || 0.5;
  const noPrice = selectedMarket?.noPrice || 0.5;
  const allowedTimeframes = getAvailableChartTimeframes(selectedMarket?.endDate);

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
    <div className="h-full bg-[#0d0d0f] text-white">
      <main className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <section className="order-1 flex min-w-0 flex-col lg:flex-1 lg:border-r lg:border-[#222]">
            <div className="block space-y-3 p-3 lg:hidden">
              <div className="rounded-xl border border-[#222] bg-[#111214] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-[#777]">Yes 价格</div>
                    <div className="text-4xl font-semibold tracking-tight text-[#00D4AA]">{Math.round(yesPrice * 100)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#777]">No 价格</div>
                    <div className="text-2xl font-semibold text-[#FF6B6B]">{Math.round(noPrice * 100)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-[#1a1a1f] px-3 py-2">
                    <div className="text-[#777]">市场</div>
                    <div className="mt-1 font-medium text-white">{selectedMarket ? 1 : 0}</div>
                  </div>
                  <div className="rounded-lg bg-[#1a1a1f] px-3 py-2">
                    <div className="text-[#777]">事件市场数</div>
                    <div className="mt-1 font-medium text-white">{event.markets?.length || 0}</div>
                  </div>
                  <div className="rounded-lg bg-[#1a1a1f] px-3 py-2">
                    <div className="text-[#777]">结算</div>
                    <div className="mt-1 font-medium text-white">{settlementLabel}</div>
                  </div>
                  <div className="rounded-lg bg-[#1a1a1f] px-3 py-2">
                    <div className="text-[#777]">Market ID</div>
                    <div className="mt-1 font-medium text-white">{marketIdLabel}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#222] bg-[#1a1a1f] p-2">
                <div className="h-[380px]">
                  {historyLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#00D4AA]" />
                    </div>
                  ) : (
                    <RealtimeCandlestickChart
                      tokenId={selectedMarket?.yesTokenId}
                      initialData={priceHistory}
                      historyBaseInterval={historyBaseInterval}
                      height={0}
                      defaultTimeframe={selectedTimeframe}
                      onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                      defaultChartMode="candle"
                      allowedTimeframes={allowedTimeframes}
                      enableRealtime={false}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[#222] bg-[#1a1a1f] p-3">
                <h3 className="mb-2 text-sm font-semibold text-white">订单簿</h3>
                {selectedMarket?.yesTokenId ? (
                  <RealtimeOrderBook tokenId={selectedMarket.yesTokenId} maxDepth={6} showHeader />
                ) : (
                  <p className="py-2 text-center text-xs text-[#666]">暂无数据</p>
                )}
              </div>

              <QuickTradePanelCompact
                marketTitle={selectedMarket?.question || event.title}
                yesPrice={yesPrice}
                noPrice={noPrice}
                yesTokenId={selectedMarket?.yesTokenId}
                noTokenId={selectedMarket?.noTokenId}
                tickSize="0.01"
                negRisk={false}
              />

              <PositionsPanelCompact />

              <div className="rounded-xl border border-[#222] bg-[#1a1a1f] p-3 text-xs text-[#999]">
                {event.description && <div>{event.description}</div>}
              </div>
            </div>

            <div className="hidden lg:flex lg:flex-1 lg:min-h-0 lg:flex-col">
              <div className="p-3 lg:flex-1 lg:min-h-0">
                <div className="h-full rounded-lg border border-[#222] bg-[#1a1a1f] p-2">
                  {historyLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#00D4AA]" />
                    </div>
                  ) : (
                    <RealtimeCandlestickChart
                      tokenId={selectedMarket?.yesTokenId}
                      initialData={priceHistory}
                      historyBaseInterval={historyBaseInterval}
                      height={0}
                      defaultTimeframe={selectedTimeframe}
                      onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                      defaultChartMode="candle"
                      allowedTimeframes={allowedTimeframes}
                      enableRealtime={false}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="order-2 hidden w-full border-t border-[#222] lg:block lg:w-80 lg:shrink-0 lg:border-t-0 lg:overflow-y-auto">
            <div className="grid grid-cols-1 gap-3 p-3">
              <QuickTradePanelCompact
                marketTitle={selectedMarket?.question || event.title}
                yesPrice={yesPrice}
                noPrice={noPrice}
                yesTokenId={selectedMarket?.yesTokenId}
                noTokenId={selectedMarket?.noTokenId}
                tickSize="0.01"
                negRisk={false}
              />

              <div className="rounded-lg border border-[#222] bg-[#1a1a1f] p-3">
                <h3 className="mb-2 text-sm font-semibold text-white">订单簿</h3>
                {selectedMarket?.yesTokenId ? (
                  <RealtimeOrderBook tokenId={selectedMarket.yesTokenId} maxDepth={6} showHeader />
                ) : (
                  <p className="py-2 text-center text-xs text-[#666]">暂无数据</p>
                )}
              </div>

              <PositionsPanelCompact />

              <div className="rounded-lg border border-[#222] bg-[#1a1a1f] p-3">
                <h3 className="mb-2 text-sm font-semibold text-white">事件信息</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-[#666]">市场ID</span>
                    <span className="font-mono text-[#888]">{marketIdLabel}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#666]">结算</span>
                    <span className="text-white">{settlementLabel}</span>
                  </div>
                  {event.description && (
                    <div className="border-t border-[#222] pt-2 text-[#888]">
                      {event.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </main>
    </div>
  );
}
