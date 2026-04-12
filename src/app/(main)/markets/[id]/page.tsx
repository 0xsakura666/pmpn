"use client";

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { RealtimeOrderBook } from "@/components/trading/RealtimeOrderBook";
import { RecentTradesPanel } from "@/components/trading/RecentTradesPanel";
import { MarketAnalyticsPanel } from "@/components/trading/MarketAnalyticsPanel";
import { QuickTradePanel } from "@/components/trading/QuickTradePanel";
import { PositionsPanel } from "@/components/trading/PositionsPanel";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
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
import { getSafeMarketDisplayPrice } from "@/lib/market-display-price";
import { clearLegacyPayloadStorage, marketDetailQueryKey } from "@/lib/client-payload-cache";

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

function toSafePrice(value: unknown, fallback = 0.5): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMarketData(raw: Partial<MarketData> & { id?: unknown; title?: unknown }): MarketData {
  const tokens = Array.isArray(raw.tokens)
    ? raw.tokens
        .map((token) => ({
          token_id: typeof token?.token_id === "string" ? token.token_id : "",
          outcome: typeof token?.outcome === "string" ? token.outcome : "",
          price: toSafePrice(token?.price),
          winner: Boolean(token?.winner),
        }))
        .filter((token) => token.token_id && token.outcome)
    : [];

  return {
    id: typeof raw.id === "string" ? raw.id : "",
    title: typeof raw.title === "string" ? raw.title : "",
    titleOriginal:
      typeof raw.titleOriginal === "string"
        ? raw.titleOriginal
        : typeof raw.title === "string"
          ? raw.title
          : "",
    description: typeof raw.description === "string" ? raw.description : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    endDate: typeof raw.endDate === "string" ? raw.endDate : "",
    image: typeof raw.image === "string" ? raw.image : "",
    tokens,
    orderBooks: Array.isArray(raw.orderBooks) ? raw.orderBooks : [],
    negRisk: Boolean(raw.negRisk),
    tickSize: typeof raw.tickSize === "string" ? raw.tickSize : "0.01",
  };
}

function formatCompactId(value: string, size = 12) {
  if (!value) return "--";
  return value.length <= size ? value : `${value.slice(0, size)}...`;
}

function formatPriceInt(value: number) {
  if (!Number.isFinite(value)) return "--";
  const cents = value * 100;
  return Number.isInteger(cents) ? `${cents}` : cents.toFixed(1).replace(/\.0$/, "");
}

function normalizeCandleTime(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const normalized = raw > 10_000_000_000 ? Math.floor(raw / 1000) : Math.floor(raw);
  return normalized > 0 ? normalized : null;
}

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const queryClient = useQueryClient();
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>("1M");
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    clearLegacyPayloadStorage();
  }, []);

  useEffect(() => {
    fetchMarket();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (!market?.endDate) return;
    setSelectedTimeframe((current) => {
      if (current !== "1M") return current;
      return getRecommendedChartTimeframe(market.endDate);
    });
  }, [market?.endDate]);

  const fetchMarket = async () => {
    setLoading(true);
    setError(null);
    let hasCache = false;
    try {
      const cached = queryClient.getQueryData<MarketData>(marketDetailQueryKey(resolvedParams.id));
      if (cached) {
        hasCache = true;
        setMarket(cached);
        setLoading(false);
      }

      const res = await fetch(`/api/markets/${resolvedParams.id}`, { cache: "no-store" });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.message || data.error);
      }

      if (!res.ok) {
        throw new Error("Market not found");
      }

      const normalizedData = normalizeMarketData(data);
      if (!normalizedData.id || !normalizedData.title) {
        throw new Error("Market payload is incomplete");
      }

      setMarket(normalizedData);
      queryClient.setQueryData(marketDetailQueryKey(resolvedParams.id), normalizedData);
    } catch (err) {
      if (!hasCache) {
        setError(err instanceof Error ? err.message : "Failed to load market");
      }
    } finally {
      if (!hasCache) {
        setLoading(false);
      }
    }
  };

  const fetchPriceHistory = useCallback(
    async (tokenId: string, timeframe: TimeframeType, signal?: AbortSignal) => {
      if (!tokenId) {
        setPriceHistory([]);
        return;
      }

      const startTs = getShortTermStartTs(market?.endDate, timeframe);
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
          tokenId,
          timeframe,
        });
        if (startTs) {
          params.set("startTs", String(startTs));
        }
        const res = await fetch(`/api/markets/${resolvedParams.id}/history?${params.toString()}`, { signal });
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
            const candlesticks = normalized.filter((c): c is CandlestickData<Time> => c !== null);

            historyCacheRef.current.set(cacheKey, {
              candles: candlesticks,
              interval: resolvedInterval,
            });

            if (signal?.aborted) return;
            setPriceHistory(candlesticks);
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
    [resolvedParams.id, market?.endDate]
  );

  const jumpToTradePanel = (side: "yes" | "no") => {
    setMobileTradeSide(side);
    setMobileTab("trade");
  };

  const yesToken = market?.tokens?.[0];
  const noToken = market?.tokens?.[1];
  const currentToken = mobileTradeSide === "yes" ? yesToken : noToken;
  const yesLabel = normalizeOutcomeLabel(yesToken?.outcome, "Yes");
  const noLabel = normalizeOutcomeLabel(noToken?.outcome, "No");
  const yesCompactLabel = getCompactOutcomeLabel(yesLabel, 10);
  const noCompactLabel = getCompactOutcomeLabel(noLabel, 10);
  const yesPrice = yesToken?.price || 0.5;
  const noPrice = noToken?.price || 0.5;
  const currentLabel = mobileTradeSide === "yes" ? yesLabel : noLabel;
  const currentStaticPrice = mobileTradeSide === "yes" ? yesPrice : noPrice;
  const allowedTimeframes: TimeframeType[] = market?.endDate
    ? getAvailableChartTimeframes(market.endDate)
    : ["1M"];
  const marketIdLabel = market?.id ? formatCompactId(market.id, 12) : "--";
  const settlementLabel = market?.endDate ? new Date(market.endDate).toLocaleDateString("zh-CN") : "--";
  const settlementDetailLabel = market?.endDate
    ? new Date(market.endDate).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";

  useEffect(() => {
    const tokenId = currentToken?.token_id;
    if (!tokenId) {
      setPriceHistory([]);
      setHistoryBaseInterval("1m");
      return;
    }

    const controller = new AbortController();
    fetchPriceHistory(tokenId, selectedTimeframe, controller.signal);
    return () => controller.abort();
  }, [currentToken?.token_id, selectedTimeframe, fetchPriceHistory]);

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
  const safeLiveDisplay = useMemo(() => getSafeMarketDisplayPrice({
    bestBid: liveQuote.bestBid,
    bestAsk: liveQuote.bestAsk,
    lastTradePrice: liveQuote.lastTradePrice,
    tickSize: market?.tickSize,
  }), [liveQuote.bestBid, liveQuote.bestAsk, liveQuote.lastTradePrice, market?.tickSize]);
  const orderBookDrivenPrice = safeLiveDisplay.displayPrice ?? priceStats.last ?? currentStaticPrice;
  const heroPrice = orderBookDrivenPrice;
  const displayYesPrice = heroSide === "yes" ? orderBookDrivenPrice : 1 - orderBookDrivenPrice;
  const displayNoPrice = heroSide === "no" ? orderBookDrivenPrice : 1 - orderBookDrivenPrice;
  const heroLabel = currentLabel;
  const heroColor = heroSide === "yes" ? "text-[#0ECB81]" : "text-[#F6465D]";
  const combinedPrice = displayYesPrice + displayNoPrice;
  const marketBiasLabel = displayYesPrice >= displayNoPrice ? yesLabel : noLabel;
  const marketBiasGap = Math.abs(displayYesPrice - displayNoPrice) * 100;
  const edgeToOne = (1 - combinedPrice) * 100;
  const marketOverviewStats = [
    { label: "结算时间", value: settlementDetailLabel },
    { label: "主导方向", value: marketBiasLabel },
    { label: "组合价格", value: `${formatPriceInt(combinedPrice)}¢` },
    { label: "偏离 1.00", value: `${edgeToOne >= 0 ? "+" : ""}${edgeToOne.toFixed(1)}¢` },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d0f]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
          <p className="text-[#666]">加载市场数据...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d0f]">
        <div className="text-center">
          <p className="mb-4 text-[#F6465D]">{error || "市场不存在"}</p>
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
                <div className="flex flex-1 items-center justify-center font-mono text-[9px] font-medium text-[#cdd1db]">{formatCompactId(market.id, 4)}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-white tracking-tight">{market.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#7d818d]">
                  <span className="font-mono text-[#6f7682]">ID {marketIdLabel}</span>
                  <span>·</span>
                  <span>截止 <span className="text-[#a3a8b3]">{settlementDetailLabel}</span></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#252833] bg-[#14161d] px-3.5 py-1.5 text-sm shadow-sm">
              <span className="text-[#8a8f9c]">{yesLabel}</span>
              <span className="font-semibold text-[#0ECB81]">{formatPriceInt(yesPrice)}</span>
              <span className="text-[#333845]">/</span>
              <span className="text-[#8a8f9c]">{noLabel}</span>
              <span className="font-semibold text-[#F6465D]">{formatPriceInt(noPrice)}</span>
            </div>
          </div>

          <div className="px-3 py-3 lg:hidden">
            <div className="flex items-start gap-3">
              <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#252833] bg-[#14161d] text-[#d7dbe5] shadow-sm transition hover:text-white hover:bg-[#1a1d24]">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold text-white tracking-tight">{market.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[#7d818d]">
                  <span className="font-mono text-[#6f7682]">ID {marketIdLabel}</span>
                  <span>·</span>
                  <span>截止 <span className="text-[#a3a8b3]">{settlementDetailLabel}</span></span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {market.image && <img src={market.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/10 shadow-sm" />}
                <div className="flex h-10 w-10 shrink-0 flex-col overflow-hidden rounded-xl border border-[#252833] bg-[#14161d] shadow-sm">
                  <div className="flex h-[14px] items-center justify-center bg-[#1d2028] text-[8px] font-semibold uppercase tracking-wider text-[#8a8f9c]">ID</div>
                  <div className="flex flex-1 items-center justify-center font-mono text-[9px] font-medium text-[#cdd1db]">{formatCompactId(market.id, 4)}</div>
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
            {mobileTab === "price" && (
              <div className="flex h-full flex-col overflow-hidden px-3 pt-2 pb-28">
                <div className="overflow-hidden rounded-[22px] border border-[#20242d] bg-[#12161c]">
                  <div className="border-b border-[#20242d] px-4 py-3">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#6f7682]">{heroLabel}</div>
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
                        <div className="text-[#6f7682] uppercase tracking-wider text-[9px] font-semibold">结算</div>
                        <div className="mt-1 font-mono text-[13px] font-medium text-white">{settlementLabel}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-medium text-[#9aa0aa]">
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5">高 {formatPriceInt(priceStats.high)}</span>
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5">低 {formatPriceInt(priceStats.low)}</span>
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5">Tick {market.tickSize || "0.01"}</span>
                      <span className="rounded-md bg-[#0d1015] px-2.5 py-1 ring-1 ring-white/5">{market.negRisk ? "Neg Risk" : "标准盘"}</span>
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
                          tokenId={currentToken?.token_id}
                          initialData={priceHistory}
                          historyBaseInterval={historyBaseInterval}
                          height={0}
                          defaultTimeframe={selectedTimeframe}
                          onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                          defaultChartMode="candle"
                          allowedTimeframes={allowedTimeframes}
                          enableRealtime={Boolean(currentToken?.token_id)}
                          displayPrice={orderBookDrivenPrice}
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
                        currentToken?.token_id ? (
                          <RealtimeOrderBook
                            tokenId={currentToken.token_id}
                            maxDepth={10}
                            layout="split"
                            showHeader
                            onQuoteChange={({ bestBid, bestAsk, lastTradePrice }) => setLiveQuote({ bestBid, bestAsk, lastTradePrice })}
                          />
                        ) : (
                          <p className="py-6 text-center text-xs text-[#8b8d98]">暂无盘口数据</p>
                        )
                      ) : (
                        <RecentTradesPanel tokenId={currentToken?.token_id} limit={10} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mobileTab === "info" && (
              <div className="h-full overflow-y-auto p-3 pb-28">
                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">市场信息</h3>
                  <div className="space-y-2 text-xs">
                    {marketOverviewStats.map((stat, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-[#7b7f8a]">{stat.label}</span>
                        <span className="font-mono text-[#c8ccd5]">{stat.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Market ID</span>
                      <span className="font-mono text-[#c8ccd5]">{marketIdLabel}</span>
                    </div>
                    {market.description && (
                      <div className="mt-3 rounded-2xl bg-[#0f1015] p-3 text-[#a3a8b3] leading-relaxed">{market.description}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mobileTab === "trade-data" && (
              <MarketAnalyticsPanel
                marketTitle={market.title}
                summaryItems={[
                  {
                    label: "领先方向",
                    value: marketBiasLabel,
                    helper: `优势 ${marketBiasGap.toFixed(1)}¢`,
                    valueClassName: "text-white",
                  },
                  {
                    label: "组合价格",
                    value: `${formatPriceInt(combinedPrice)}¢`,
                    helper: `距 1.00 ${edgeToOne >= 0 ? "+" : ""}${edgeToOne.toFixed(1)}¢`,
                    valueClassName: edgeToOne >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]",
                  },
                  {
                    label: "Tick Size",
                    value: market.tickSize || "0.01",
                    helper: "最小价格跳动",
                  },
                  {
                    label: "市场类型",
                    value: market.negRisk ? "Neg Risk" : "Standard",
                    helper: `到期 ${settlementLabel}`,
                  },
                ]}
              />
            )}

            {mobileTab === "trade" && (
              <div className="h-full overflow-y-auto p-3 pb-28">
                <QuickTradePanel
                  marketTitle={market.title}
                  yesPrice={yesPrice}
                  noPrice={noPrice}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                  yesTokenId={yesToken?.token_id}
                  noTokenId={noToken?.token_id}
                  tickSize={market.tickSize || "0.01"}
                  negRisk={market.negRisk || false}
                />
              </div>
            )}
          </div>

          <div className="hidden lg:flex lg:flex-1 lg:overflow-hidden">
            <section className="flex min-w-0 flex-col lg:flex-1 lg:border-r lg:border-[#1d2028]">
              <div className="px-3 pt-3 lg:flex-1 lg:min-h-0">
                <div className="overflow-hidden rounded-[24px] bg-transparent lg:h-full">
                  <div className="h-[460px] lg:h-full">
                    {historyLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
                      </div>
                    ) : (
                        <RealtimeCandlestickChart
                          tokenId={currentToken?.token_id}
                          initialData={priceHistory}
                          historyBaseInterval={historyBaseInterval}
                          height={0}
                        defaultTimeframe={selectedTimeframe}
                        onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                          defaultChartMode="candle"
                          allowedTimeframes={allowedTimeframes}
                          enableRealtime={Boolean(currentToken?.token_id)}
                          displayPrice={orderBookDrivenPrice}
                          compactMobile
                        />
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden shrink-0 px-3 pb-3 lg:block">
                <div className="flex items-center gap-3 text-xs">
                  {market.tokens?.map((token, index) => {
                    const alignedPrice = token.token_id === yesToken?.token_id
                      ? displayYesPrice
                      : token.token_id === noToken?.token_id
                        ? displayNoPrice
                        : toSafePrice(token.price);

                    return (
                      <div key={token.token_id} className="flex items-center gap-2 rounded-xl bg-[#15161c] px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            index === 0
                              ? "bg-[#0ECB81]/15 text-[#0ECB81]"
                              : "bg-[#F6465D]/15 text-[#F6465D]"
                          }`}
                        >
                          {token.outcome}
                        </span>
                        <span className="font-mono text-[10px] text-[#666]">{formatCompactId(token.token_id, 10)}</span>
                        <span className="font-bold text-white">{formatPriceInt(alignedPrice)}</span>
                      </div>
                    );
                  })}
                  {market.description && (
                    <span className="ml-2 truncate text-[#666]" title={market.description}>
                      {market.description.slice(0, 80)}...
                    </span>
                  )}
                </div>
              </div>
            </section>

            <aside className="w-[360px] shrink-0 border-t border-[#1d2028] lg:border-t-0 lg:overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 p-3">
                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">买卖区</h3>
                    <span className="rounded-full bg-[#1a2029] px-3 py-1 text-[11px] font-medium text-[#7c818d]">{currentLabel} 深度</span>
                  </div>
                  {currentToken?.token_id ? (
                    <RealtimeOrderBook
                      tokenId={currentToken.token_id}
                      maxDepth={6}
                      showHeader
                      onQuoteChange={({ bestBid, bestAsk, lastTradePrice }) => setLiveQuote({ bestBid, bestAsk, lastTradePrice })}
                    />
                  ) : (
                    <p className="py-3 text-center text-xs text-[#8b8d98]">暂无盘口数据</p>
                  )}
                </div>

                <QuickTradePanel
                  marketTitle={market.title}
                  yesPrice={yesPrice}
                  noPrice={noPrice}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                  yesTokenId={yesToken?.token_id}
                  noTokenId={noToken?.token_id}
                  tickSize={market.tickSize || "0.01"}
                  negRisk={market.negRisk || false}
                />

                <PositionsPanel />

                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">市场信息</h3>
                  <div className="space-y-2 text-xs">
                    {marketOverviewStats.map((stat, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-[#7b7f8a]">{stat.label}</span>
                        <span className="font-mono text-[#c8ccd5]">{stat.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Market ID</span>
                      <span className="font-mono text-[#c8ccd5]">{marketIdLabel}</span>
                    </div>
                    {market.description && (
                      <div className="mt-3 rounded-2xl bg-[#0f1015] p-3 text-[#a3a8b3] leading-relaxed">{market.description}</div>
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
