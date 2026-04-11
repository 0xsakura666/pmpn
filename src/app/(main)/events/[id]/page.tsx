"use client";

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
import { RealtimeOrderBook } from "@/components/trading/RealtimeOrderBook";
import { RecentTradesPanel } from "@/components/trading/RecentTradesPanel";
import { MarketAnalyticsPanel } from "@/components/trading/MarketAnalyticsPanel";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { PositionsPanel } from "@/components/trading/PositionsPanel";
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
import { getCompactOutcomeLabel, normalizeOutcomeLabel } from "@/lib/outcome-label";

interface SubMarket {
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesLabel: string;
  noLabel: string;
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

function formatPriceInt(value: number) {
  if (!Number.isFinite(value)) return "--";
  const cents = value * 100;
  return Number.isInteger(cents) ? `${cents}` : cents.toFixed(1).replace(/\.0$/, "");
}

function formatCompactId(value: string, size = 12) {
  if (!value) return "--";
  return value.length <= size ? value : `${value.slice(0, size)}...`;
}

function formatMoney(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `$${Math.round(vol / 1e3)}K`;
  return `$${Math.round(vol)}`;
}

function normalizeCandleTime(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const normalized = raw > 10_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw);
  return normalized > 0 ? normalized : null;
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
  const [mobileTradeSide, setMobileTradeSide] = useState<"yes" | "no">("yes");
  const [mobileTab, setMobileTab] = useState<"price" | "info" | "trade-data" | "trade">("price");
  const [mobilePricePanel, setMobilePricePanel] = useState<"orderbook" | "trades">("orderbook");
  const [liveQuote, setLiveQuote] = useState<{ bestBid: number | null; bestAsk: number | null; lastTradePrice: number | null }>({
    bestBid: null,
    bestAsk: null,
    lastTradePrice: null,
  });
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

  const fetchPriceHistory = useCallback(
    async (tokenId: string, timeframe: TimeframeType, signal?: AbortSignal) => {
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
              .map((c) => {
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
      } catch {
        if (signal?.aborted) return;
        setPriceHistory([]);
        setHistoryBaseInterval(historyInterval);
      } finally {
        if (!signal?.aborted) {
          setHistoryLoading(false);
        }
      }
    },
    [selectedMarket?.endDate]
  );

  const currentTokenId = mobileTradeSide === "yes" ? selectedMarket?.yesTokenId : selectedMarket?.noTokenId;

  useEffect(() => {
    if (currentTokenId) {
      const controller = new AbortController();
      fetchPriceHistory(currentTokenId, selectedTimeframe, controller.signal);
      return () => controller.abort();
    }
    setPriceHistory([]);
    setHistoryBaseInterval("1m");
  }, [currentTokenId, selectedTimeframe, fetchPriceHistory]);

  const jumpToTradePanel = (side: "yes" | "no") => {
    setMobileTradeSide(side);
    setMobileTab("trade");
  };

  const yesPrice = selectedMarket?.yesPrice || 0.5;
  const noPrice = selectedMarket?.noPrice || 0.5;
  const yesLabel = normalizeOutcomeLabel(selectedMarket?.yesLabel, "Yes");
  const noLabel = normalizeOutcomeLabel(selectedMarket?.noLabel, "No");
  const yesCompactLabel = getCompactOutcomeLabel(yesLabel, 10);
  const noCompactLabel = getCompactOutcomeLabel(noLabel, 10);
  const allowedTimeframes: TimeframeType[] = selectedMarket?.endDate
    ? getAvailableChartTimeframes(selectedMarket.endDate)
    : ["5M"];
  const marketIdLabel = selectedMarket?.conditionId ? formatCompactId(selectedMarket.conditionId, 12) : "--";
  const settlementDetailLabel = selectedMarket?.endDate
    ? new Date(selectedMarket.endDate).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";
  const currentStaticPrice = mobileTradeSide === "yes" ? yesPrice : noPrice;

  const priceStats = useMemo(() => {
    if (priceHistory.length === 0) {
      return {
        high: currentStaticPrice,
        low: currentStaticPrice,
        last: currentStaticPrice,
        changePct: 0,
      };
    }

    const first = priceHistory[0];
    const last = priceHistory[priceHistory.length - 1];
    const high = Math.max(...priceHistory.map((c) => c.high));
    const low = Math.min(...priceHistory.map((c) => c.low));
    const base = first.open || 1;

    return {
      high,
      low,
      last: last.close,
      changePct: ((last.close - first.open) / base) * 100,
    };
  }, [priceHistory, currentStaticPrice]);

  const heroSide = mobileTradeSide;
  const liveCurrentPrice = liveQuote.lastTradePrice ?? priceStats.last ?? currentStaticPrice;
  const displayYesPrice = heroSide === "yes" && liveQuote.lastTradePrice != null ? liveCurrentPrice : yesPrice;
  const displayNoPrice = heroSide === "no" && liveQuote.lastTradePrice != null ? liveCurrentPrice : noPrice;
  const heroPrice = liveCurrentPrice;
  const heroColor = heroSide === "yes" ? "text-[#0ECB81]" : "text-[#F6465D]";
  const marketBiasLabel = displayYesPrice >= displayNoPrice ? yesLabel : noLabel;
  const marketBiasGap = Math.abs(displayYesPrice - displayNoPrice) * 100;
  const combinedPrice = displayYesPrice + displayNoPrice;
  
  const eventOverviewStats = event ? [
    { label: "24h 成交", value: formatMoney(event.volume24h) },
    { label: "流动性", value: formatMoney(event.liquidity) },
    { label: "结算时间", value: settlementDetailLabel },
    { label: "主导方向", value: marketBiasLabel },
  ] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0ECB81] mx-auto mb-4" />
          <p className="text-[#666]">加载事件数据...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#F6465D] mb-4">{error || "事件不存在"}</p>
          <Link href="/" className="text-[#0ECB81] hover:underline">
            ← 返回市场列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-locked h-[100dvh] overflow-hidden bg-[#0d0d0f] text-white">
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-20 shrink-0 border-b border-[#1d2028] bg-[#0d0d0f]/95 backdrop-blur">
          <div className="hidden items-center justify-between gap-4 px-4 py-3 lg:flex">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#252833] bg-[#14161d] text-[#d7dbe5] shadow-sm transition hover:text-white hover:bg-[#1a1d24]">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex h-10 w-10 shrink-0 flex-col overflow-hidden rounded-xl border border-[#252833] bg-[#14161d] shadow-sm">
                <div className="flex h-[14px] items-center justify-center bg-[#1d2028] text-[8px] font-semibold uppercase tracking-wider text-[#8a8f9c]">ID</div>
                <div className="flex flex-1 items-center justify-center font-mono text-[9px] font-medium text-[#cdd1db]">{formatCompactId(event.id, 4)}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-white tracking-tight">{event.title}</div>
                <div className="mt-1 text-xs text-[#7d818d]">{event.category || "Event"} · <span className="text-[#a3a8b3]">{event.markets.length}</span> 个子市场</div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#252833] bg-[#14161d] px-3.5 py-1.5 text-sm shadow-sm">
              <span className="text-[#8a8f9c]">{yesLabel}</span>
              <span className="font-semibold text-[#0ECB81]">{formatPriceInt(yesPrice)}</span>
              <span className="text-[#333845]">/</span>
              <span className="text-[#8a8f9c]">{noLabel}</span>
              <button onClick={() => setMobileTradeSide("no")} className="font-semibold text-[#F6465D]">{formatPriceInt(displayNoPrice)}</button>
            </div>
          </div>

          <div className="px-3 py-3 lg:hidden">
            <div className="flex items-start gap-3">
              <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#252833] bg-[#14161d] text-[#d7dbe5] shadow-sm transition hover:text-white hover:bg-[#1a1d24]">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold text-white tracking-tight">{event.title}</div>
                <div className="mt-1 text-[12px] text-[#7d818d]">{event.category || "Event"} · <span className="text-[#a3a8b3]">{event.markets.length}</span> 个子市场</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {event.image && <img src={event.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10 shadow-sm" />}
                <div className="flex h-10 w-10 shrink-0 flex-col overflow-hidden rounded-xl border border-[#252833] bg-[#14161d] shadow-sm">
                  <div className="flex h-[14px] items-center justify-center bg-[#1d2028] text-[8px] font-semibold uppercase tracking-wider text-[#8a8f9c]">ID</div>
                  <div className="flex flex-1 items-center justify-center font-mono text-[9px] font-medium text-[#cdd1db]">{formatCompactId(event.id, 4)}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-1 rounded-xl bg-[#11151b] p-1 text-[13px] font-medium">
                {[
                  ["price", "价格"],
                  ["info", "信息"],
                  ["trade-data", "交易数据"],
                  ["trade", "交易"],
                ].map(([id, label]) => {
                  const active = mobileTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setMobileTab(id as "price" | "info" | "trade-data" | "trade")}
                      className={`flex-1 rounded-lg px-3 py-1.5 transition-colors ${active ? "bg-[#1d222b] text-white shadow-sm" : "text-[#8a8e99] hover:text-white"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden pb-24 lg:flex lg:pb-0">
          <div className="h-full lg:hidden">
            <div className="px-3 pt-2.5">
              <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-1.5">
                  {event.markets.map((market) => {
                    const active = selectedMarket?.conditionId === market.conditionId;
                    return (
                      <button
                        key={market.conditionId}
                        onClick={() => setSelectedMarket(market)}
                        className={`group min-w-[220px] shrink-0 rounded-[16px] border p-3.5 text-left transition-all ${
                          active
                            ? "border-[#0ECB81]/40 bg-gradient-to-b from-[#121c17] to-[#12161c] shadow-[0_4px_24px_rgba(14,203,129,0.12)]"
                            : "border-[#20242d] bg-[#12161c] hover:border-[#2d323e] hover:bg-[#151a21]"
                        }`}
                      >
                        <div className="line-clamp-2 min-h-[40px] text-[13px] font-medium leading-relaxed text-white/90 group-hover:text-white transition-colors">{market.question}</div>
                        <div className="mt-4 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[#0ECB81]/10 px-2 py-1 font-mono text-[#0ECB81] font-semibold">{market.yesLabel || "Yes"} <span className="opacity-90">{formatPriceInt(market.yesPrice)}¢</span></span>
                            <span className="rounded bg-[#F6465D]/10 px-2 py-1 font-mono text-[#F6465D] font-semibold">{market.noLabel || "No"} <span className="opacity-90">{formatPriceInt(market.noPrice)}¢</span></span>
                          </div>
                          <span className="font-mono text-[#6f7682]">ID {formatCompactId(market.conditionId, 4)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {mobileTab === "price" && (
              <div className="flex h-full flex-col overflow-hidden px-3 pt-2 pb-28">
                <div className="overflow-hidden rounded-[22px] border border-[#20242d] bg-[#12161c]">
                  <div className="border-b border-[#20242d] px-4 py-3">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#6f7682]">{heroSide === "yes" ? yesLabel : noLabel}</div>
                        <div className={`mt-1 text-[44px] font-bold tracking-tight leading-[1.1] ${heroColor}`}>
                          {formatPriceInt(heroPrice)}
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="font-mono text-sm font-semibold text-white/90">{formatPriceInt(heroPrice)}¢</span>
                          <span className={`font-mono text-xs font-semibold ${priceStats.changePct >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                            {priceStats.changePct >= 0 ? "+" : ""}{priceStats.changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-[14px] bg-[#0d1015] px-3.5 py-2.5 text-right text-[11px] shadow-inner ring-1 ring-white/5">
                        <div className="text-[#6f7682] uppercase tracking-wider text-[9px] font-semibold">市场</div>
                        <div className="mt-1 font-mono text-[13px] font-medium text-white">{event.markets.length}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#9aa0aa]">
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5">高 {formatPriceInt(priceStats.high)}</span>
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5">低 {formatPriceInt(priceStats.low)}</span>
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5">{event.category || "--"}</span>
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5 font-mono">ID {marketIdLabel}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-[#20242d] p-px">
                    <button
                      onClick={() => setMobileTradeSide("yes")}
                      className={`px-3 py-2 text-left transition ${mobileTradeSide === "yes" ? "bg-[#10251d]" : "bg-[#11151b] hover:bg-[#1a2029]"}`}
                    >
                      <div className="text-[11px] text-[#79808d]">{yesLabel}</div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <div className="text-[20px] font-semibold leading-none text-[#0ECB81]">{formatPriceInt(yesPrice)}¢</div>
                        <div className="text-[10px] text-[#0ECB81]/60">Buy</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setMobileTradeSide("no")}
                      className={`px-3 py-2 text-left transition ${mobileTradeSide === "no" ? "bg-[#2a171d]" : "bg-[#11151b] hover:bg-[#1a2029]"}`}
                    >
                      <div className="text-[11px] text-[#79808d]">{noLabel}</div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <div className="text-[20px] font-semibold leading-none text-[#F6465D]">{formatPriceInt(noPrice)}¢</div>
                        <div className="text-[10px] text-[#F6465D]/60">Buy</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="mt-2 min-h-0 flex flex-1 flex-col overflow-hidden rounded-[24px] bg-transparent">
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <div className="h-full min-h-[54dvh]">
                      {historyLoading ? (
                        <div className="flex h-full items-center justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
                        </div>
                      ) : (
                        <RealtimeCandlestickChart
                          tokenId={currentTokenId}
                          initialData={priceHistory}
                          historyBaseInterval={historyBaseInterval}
                          height={0}
                          defaultTimeframe={selectedTimeframe}
                          onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                          defaultChartMode="candle"
                          allowedTimeframes={allowedTimeframes}
                          enableRealtime={Boolean(selectedMarket?.yesTokenId)}
                          compactMobile
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 overflow-hidden rounded-[20px] border border-[#20242d] bg-[#12161c]">
                    <div className="flex gap-4 border-b border-[#20242d] px-3 pt-2 text-[13px] font-medium">
                      {[
                        ["orderbook", "委托订单"],
                        ["trades", "最新成交"],
                      ].map(([id, label]) => {
                        const active = mobilePricePanel === id;
                        return (
                          <button
                            key={id}
                            onClick={() => setMobilePricePanel(id as "orderbook" | "trades")}
                            className={`border-b-2 pb-2.5 px-1 transition ${active ? "border-[#0ECB81] text-[#0ECB81]" : "border-transparent text-[#8a8e99] hover:text-[#cdd1db]"}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="max-h-[28dvh] overflow-y-auto p-3">
                      {mobilePricePanel === "orderbook" ? (
                        currentTokenId ? (
                          <RealtimeOrderBook tokenId={currentTokenId} maxDepth={10} layout="split" showHeader onQuoteChange={({ bestBid, bestAsk, lastTradePrice }) => setLiveQuote({ bestBid, bestAsk, lastTradePrice })} />
                        ) : (
                          <p className="py-6 text-center text-xs text-[#8b8d98]">暂无盘口数据</p>
                        )
                      ) : (
                        <RecentTradesPanel tokenId={currentTokenId} limit={10} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mobileTab === "info" && (
              <div className="p-3">
                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">事件信息</h3>
                  <div className="space-y-2 text-xs">
                    {eventOverviewStats.map((stat, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-[#7b7f8a]">{stat.label}</span>
                        <span className="font-mono text-[#c8ccd5]">{stat.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Event ID</span>
                      <span className="font-mono text-[#c8ccd5]">{formatCompactId(event.id, 12)}</span>
                    </div>
                    {event.description && (
                      <div className="mt-3 rounded-2xl bg-[#0f1015] p-3 text-[#a3a8b3] leading-relaxed">{event.description}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mobileTab === "trade-data" && (
              <MarketAnalyticsPanel
                marketTitle={selectedMarket?.question || event.title}
                summaryItems={[
                  {
                    label: "24h Volume",
                    value: formatMoney(event.volume24h),
                    helper: "近 24h 成交额",
                  },
                  {
                    label: "Liquidity",
                    value: formatMoney(event.liquidity),
                    helper: "当前流动性",
                  },
                  {
                    label: "领先方向",
                    value: marketBiasLabel,
                    helper: `领先 ${marketBiasGap.toFixed(1)}¢`,
                  },
                  {
                    label: "组合价格",
                    value: `${formatPriceInt(combinedPrice)}¢`,
                    helper: "Yes + No",
                  },
                ]}
              />
            )}

            {mobileTab === "trade" && (
              <div className="h-full overflow-y-auto p-3 pb-28">
                <QuickTradePanel
                  marketTitle={selectedMarket?.question || event.title}
                  yesPrice={yesPrice}
                  noPrice={noPrice}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                  yesTokenId={selectedMarket?.yesTokenId}
                  noTokenId={selectedMarket?.noTokenId}
                  tickSize="0.01"
                  negRisk={false}
                />
              </div>
            )}
          </div>

          <div className="hidden lg:flex lg:flex-1 lg:overflow-hidden">
            <section className="flex min-w-0 flex-col lg:flex-1 lg:border-r lg:border-[#1d2028]">
              <div className="px-3 pt-3 lg:flex-none">
                <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-max gap-2">
                    {event.markets.map((market) => {
                      const active = selectedMarket?.conditionId === market.conditionId;
                      return (
                        <button
                          key={market.conditionId}
                          onClick={() => setSelectedMarket(market)}
                          className={`group min-w-[240px] shrink-0 rounded-[16px] border p-4 text-left transition-all ${
                            active
                              ? "border-[#0ECB81]/40 bg-gradient-to-b from-[#121c17] to-[#12161c] shadow-[0_8px_32px_rgba(14,203,129,0.15)]"
                              : "border-[#20242d] bg-[#12161c] hover:border-[#2d323e] hover:bg-[#151a21]"
                          }`}
                        >
                          <div className="line-clamp-2 min-h-[44px] text-[14px] font-medium leading-relaxed text-white/90 group-hover:text-white transition-colors">{market.question}</div>
                          <div className="mt-4 flex items-center justify-between text-[12px]">
                            <div className="flex items-center gap-2">
                              <span className="rounded-lg bg-[#0ECB81]/10 px-2 py-1 font-mono text-[#0ECB81] font-semibold">{market.yesLabel || "Yes"} <span className="opacity-90">{formatPriceInt(market.yesPrice)}¢</span></span>
                              <span className="rounded-lg bg-[#F6465D]/10 px-2 py-1 font-mono text-[#F6465D] font-semibold">{market.noLabel || "No"} <span className="opacity-90">{formatPriceInt(market.noPrice)}¢</span></span>
                            </div>
                            <span className="font-mono text-[11px] text-[#6f7682]">ID {formatCompactId(market.conditionId, 4)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="hidden shrink-0 px-3 pb-3 lg:block">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {event.markets.map((market) => {
                    const isActive = selectedMarket?.conditionId === market.conditionId;
                    return (
                      <button
                        key={market.conditionId}
                        onClick={() => setSelectedMarket(market)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                          isActive ? "bg-[#1d222b] shadow-inner text-white" : "bg-[#15161c] hover:bg-[#1a1d24] text-white/60"
                        }`}
                      >
                        <span className="truncate max-w-[120px] font-medium" title={market.question}>{market.question}</span>
                        <div className="h-3 w-px bg-[#2a2d36]" />
                        <span className={`font-bold ${isActive ? "text-[#0ECB81]" : "text-[#0ECB81]/60"}`}>{formatPriceInt(market.yesPrice)}</span>
                        <span className={`font-bold ${isActive ? "text-[#F6465D]" : "text-[#F6465D]/60"}`}>{formatPriceInt(market.noPrice)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-3 pt-3 pb-3 lg:flex-1 lg:min-h-0">
                <div className="overflow-hidden rounded-[24px] bg-transparent lg:h-full">
                  <div className="h-[460px] lg:h-full">
                    {historyLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
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
                          enableRealtime={Boolean(selectedMarket?.yesTokenId)}
                        compactMobile
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>

            <aside className="w-[360px] shrink-0 border-t border-[#1d2028] lg:border-t-0 lg:overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 p-3">
                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">买卖区</h3>
                    <span className="rounded-full bg-[#1a2029] px-3 py-1 text-[11px] font-medium text-[#7c818d]">{yesLabel} 深度</span>
                  </div>
                  {currentTokenId ? (
                    <RealtimeOrderBook
                      tokenId={currentTokenId}
                      maxDepth={10}
                      layout="split"
                      showHeader
                      onQuoteChange={({ bestBid, bestAsk, lastTradePrice }) => setLiveQuote({ bestBid, bestAsk, lastTradePrice })}
                    />
                  ) : (
                    <p className="py-3 text-center text-xs text-[#8b8d98]">暂无盘口数据</p>
                  )}
                </div>

                <QuickTradePanel
                  marketTitle={selectedMarket?.question || event.title}
                  yesPrice={yesPrice}
                  noPrice={noPrice}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                  yesTokenId={selectedMarket?.yesTokenId}
                  noTokenId={selectedMarket?.noTokenId}
                  tickSize="0.01"
                  negRisk={false}
                />

                <PositionsPanel />

                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">事件信息</h3>
                  <div className="space-y-2 text-xs">
                    {eventOverviewStats.map((stat, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-[#7b7f8a]">{stat.label}</span>
                        <span className="font-mono text-[#c8ccd5]">{stat.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Event ID</span>
                      <span className="font-mono text-[#c8ccd5]">{formatCompactId(event.id, 12)}</span>
                    </div>
                    {event.description && (
                      <div className="mt-3 rounded-2xl bg-[#0f1015] p-3 text-[#a3a8b3] leading-relaxed">{event.description}</div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>

        <div className="sticky bottom-0 z-20 border-t border-[#1f222b] bg-[#0d0d0f]/95 p-3 backdrop-blur lg:hidden">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => jumpToTradePanel("yes")}
              className="rounded-xl bg-[#0ECB81] px-4 py-3.5 text-[15px] font-semibold text-black shadow-lg shadow-[#0ECB81]/20 active:scale-95 transition-transform"
            >
              买入 {yesLabel} · {formatPriceInt(yesPrice)}¢
            </button>
            <button
              onClick={() => jumpToTradePanel("no")}
              className="rounded-xl bg-[#F6465D] px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#F6465D]/20 active:scale-95 transition-transform"
            >
              买入 {noCompactLabel} · {formatPriceInt(noPrice)}¢
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
