"use client";

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
import { RealtimeOrderBook } from "@/components/trading/RealtimeOrderBook";
import { Time, CandlestickData } from "lightweight-charts";
import { usePolymarket, usePolymarketTrade, usePolymarketPositions, usePolymarketOrders } from "@/hooks/usePolymarket";
import { useAccount, useConnect, useDisconnect } from "wagmi";
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
  return `${Math.round(value * 100)}`;
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

function QuickTradePanelCompact({
  marketTitle,
  yesPrice,
  noPrice,
  yesLabel = "Yes",
  noLabel = "No",
  yesTokenId,
  noTokenId,
  tickSize = "0.01",
  negRisk = false,
  selectedSide: controlledSelectedSide,
  onSelectedSideChange,
}: {
  marketTitle: string;
  yesPrice: number;
  noPrice: number;
  yesLabel?: string;
  noLabel?: string;
  yesTokenId?: string;
  noTokenId?: string;
  tickSize?: string;
  negRisk?: boolean;
  selectedSide?: "yes" | "no";
  onSelectedSideChange?: (side: "yes" | "no") => void;
}) {
  const [internalSelectedSide, setInternalSelectedSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedSide = controlledSelectedSide ?? internalSelectedSide;
  const setSelectedSide = (side: "yes" | "no") => {
    if (controlledSelectedSide === undefined) {
      setInternalSelectedSide(side);
    }
    onSelectedSideChange?.(side);
  };

  const { isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, isAuthenticating, authenticate } = usePolymarket();
  const { placeOrder, isSubmitting, isReady } = usePolymarketTrade();

  const normalizedYesLabel = normalizeOutcomeLabel(yesLabel, "Yes");
  const normalizedNoLabel = normalizeOutcomeLabel(noLabel, "No");
  const compactYesLabel = getCompactOutcomeLabel(normalizedYesLabel, 9);
  const compactNoLabel = getCompactOutcomeLabel(normalizedNoLabel, 9);

  const price =
    orderType === "limit" && limitPrice
      ? parseFloat(limitPrice)
      : selectedSide === "yes"
        ? yesPrice
        : noPrice;
  const shares = amount && price ? parseFloat(amount) / price : 0;
  const potentialReturn = shares * 1;
  const potentialProfit = potentialReturn - parseFloat(amount || "0");

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setError(null);
    setSuccess(null);
    const tokenId = selectedSide === "yes" ? yesTokenId : noTokenId;
    if (!tokenId) {
      setError("Token ID not available");
      return;
    }
    const result = await placeOrder({
      tokenId,
      price: orderType === "limit" ? parseFloat(limitPrice) : price,
      size: shares,
      side: "BUY",
      tickSize,
      negRisk,
      orderType: orderType === "market" ? "FOK" : "GTC",
    });
    if (result.success) {
      setSuccess("下单成功");
      setAmount("");
    } else {
      setError(result.errorMsg || "下单失败");
    }
  };

  return (
    <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">交易</h3>
          <p className="mt-1 truncate text-xs text-[#8b8d98]">{marketTitle}</p>
        </div>
        <div className="rounded-full border border-[#2a2d38] bg-[#0f1015] px-2.5 py-1 text-[11px] text-[#a9adb8]">
          Tick {tickSize}
        </div>
      </div>

      {!isConnected ? (
        <button
          onClick={() => connectors[0] && connect({ connector: connectors[0] })}
          disabled={isConnecting || connectors.length === 0}
          className="w-full rounded-2xl bg-[#0ECB81] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
        >
          {isConnecting ? "连接中..." : "连接钱包"}
        </button>
      ) : !isAuthenticated ? (
        <div className="space-y-2">
          <button
            onClick={authenticate}
            disabled={isAuthenticating}
            className="w-full rounded-2xl bg-[#0ECB81] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {isAuthenticating ? "签名中..." : "签名验证"}
          </button>
          <button
            onClick={() => disconnect()}
            className="w-full rounded-2xl border border-[#2a2d38] bg-[#0f1015] px-4 py-2.5 text-xs text-[#a9adb8]"
          >
            断开连接
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#0f1015] p-1">
            <button
              onClick={() => setOrderType("market")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                orderType === "market" ? "bg-[#1d2028] text-white" : "text-[#707480]"
              }`}
            >
              市价
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                orderType === "limit" ? "bg-[#1d2028] text-white" : "text-[#707480]"
              }`}
            >
              限价
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedSide("yes")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedSide === "yes"
                  ? "bg-[#0ECB81] text-black"
                  : "bg-[#1b1d25] text-[#a9adb8] hover:bg-[#0ECB81]/15"
              }`}
            >
              买 {compactYesLabel} {formatPriceInt(yesPrice)}
            </button>
            <button
              onClick={() => setSelectedSide("no")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedSide === "no"
                  ? "bg-[#F6465D] text-white"
                  : "bg-[#1b1d25] text-[#a9adb8] hover:bg-[#F6465D]/15"
              }`}
            >
              买 {noLabel} {formatPriceInt(noPrice)}
            </button>
          </div>

          {orderType === "limit" && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#7b7f8a]">限价</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#666b76]">$</span>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={price.toFixed(3)}
                  className="w-full rounded-2xl border border-[#2a2d38] bg-[#0f1015] py-3 pl-8 pr-3 text-sm font-mono text-white outline-none transition focus:border-[#0ECB81]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-[#7b7f8a]">金额 (USDC)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#666b76]">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="金额"
                className="w-full rounded-2xl border border-[#2a2d38] bg-[#0f1015] py-3 pl-8 pr-3 text-sm font-mono text-white outline-none transition focus:border-[#0ECB81]"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 50, 100, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v.toString())}
                  className="rounded-xl border border-[#242733] bg-[#111319] px-2 py-2 text-[11px] text-[#b1b5c0]"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="space-y-2 rounded-2xl bg-[#0f1015] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#747886]">份额</span>
                <span className="font-mono text-white">{shares.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#747886]">均价</span>
                <span className="font-mono text-white">${price.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#747886]">潜在收益</span>
                <span className={`font-mono ${potentialProfit >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                  ${potentialReturn.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[#F6465D]">{error}</p>}
          {success && <p className="text-xs text-[#0ECB81]">{success}</p>}

          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isSubmitting || !isReady}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              selectedSide === "yes" ? "bg-[#0ECB81] text-black" : "bg-[#F6465D] text-white"
            } disabled:opacity-50`}
          >
            {isSubmitting ? "提交中..." : `买入 ${selectedSide === "yes" ? yesLabel : noLabel}`}
          </button>
        </div>
      )}
    </div>
  );
}

function PositionsPanelCompact() {
  const [activeTab, setActiveTab] = useState<"positions" | "orders">("positions");
  const { isAuthenticated, address } = usePolymarket();
  const { positions, isLoading: positionsLoading } = usePolymarketPositions();
  const { orders, isLoading: ordersLoading, cancelOrder } = usePolymarketOrders();

  if (!address) {
    return (
      <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
        <h3 className="text-sm font-semibold text-white">持仓 / 订单</h3>
        <p className="mt-2 text-xs text-[#8b8d98]">连接钱包后查看当前持仓与挂单。</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
      <div className="mb-3 flex rounded-2xl bg-[#0f1015] p-1 text-xs">
        <button
          onClick={() => setActiveTab("positions")}
          className={`flex-1 rounded-xl px-3 py-2 font-medium transition ${
            activeTab === "positions" ? "bg-[#1d2028] text-white" : "text-[#7d818d]"
          }`}
        >
          持仓 ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 rounded-xl px-3 py-2 font-medium transition ${
            activeTab === "orders" ? "bg-[#1d2028] text-white" : "text-[#7d818d]"
          }`}
        >
          订单 ({orders.length})
        </button>
      </div>

      {activeTab === "positions" && (
        <div className="space-y-2">
          {positionsLoading ? (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
            </div>
          ) : positions.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">暂无持仓</p>
          ) : (
            positions.slice(0, 4).map((pos) => (
              <div key={pos.asset} className="rounded-2xl bg-[#0f1015] p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{pos.title}</div>
                    <div className={pos.outcome === "Yes" ? "text-[#0ECB81]" : "text-[#F6465D]"}>{pos.outcome}</div>
                  </div>
                  <div className="text-right text-[#c9ccd5]">
                    <div className="font-mono">{pos.size.toFixed(2)}</div>
                    <div className="text-[#757985]">@ ${pos.avgPrice.toFixed(3)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[#757985]">
                  <span>P&L</span>
                  <span className={pos.cashPnl >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}>
                    {pos.cashPnl >= 0 ? "+" : ""}${pos.cashPnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-2">
          {!isAuthenticated ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">需要先签名验证</p>
          ) : ordersLoading ? (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">暂无挂单</p>
          ) : (
            orders.slice(0, 4).map((order) => (
              <div key={order.id} className="rounded-2xl bg-[#0f1015] p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className={order.side === "BUY" ? "text-[#0ECB81]" : "text-[#F6465D]"}>
                    {order.side} {order.outcome}
                  </span>
                  <button onClick={() => cancelOrder(order.id)} className="text-[#F6465D]">
                    取消
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-[#757985]">
                  <span>${order.price}</span>
                  <span>{(parseFloat(order.original_size) / 1e6).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
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

  useEffect(() => {
    if (selectedMarket?.yesTokenId) {
      const controller = new AbortController();
      fetchPriceHistory(selectedMarket.yesTokenId, selectedTimeframe, controller.signal);
      return () => controller.abort();
    }
    setPriceHistory([]);
    setHistoryBaseInterval("1m");
  }, [selectedMarket, selectedTimeframe, fetchPriceHistory]);

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

  const priceStats = useMemo(() => {
    if (priceHistory.length === 0) {
      return {
        high: yesPrice,
        low: yesPrice,
        last: yesPrice,
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
  }, [priceHistory, yesPrice]);

  const heroSide = mobileTradeSide;
  const heroPrice = heroSide === "yes" ? yesPrice : noPrice;
  const heroColor = heroSide === "yes" ? "text-[#0ECB81]" : "text-[#F6465D]";

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
              <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#252833] bg-[#14161d] text-[#cdd1db] transition hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              {event.image && <img src={event.image} alt="" className="h-8 w-8 rounded-full object-cover" />}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{event.title}</div>
                <div className="mt-1 text-xs text-[#7d818d]">{event.category || "Event"} · {event.markets.length} markets</div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-[#252833] bg-[#14161d] px-3 py-1.5 text-sm">
              <span className="text-[#8a8f9c]">{yesLabel}</span>
              <span className="font-semibold text-[#0ECB81]">{formatPriceInt(yesPrice)}</span>
              <span className="text-[#333845]">/</span>
              <span className="text-[#8a8f9c]">{noLabel}</span>
              <span className="font-semibold text-[#F6465D]">{formatPriceInt(noPrice)}</span>
            </div>
          </div>

          <div className="px-3 py-3 lg:hidden">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#252833] bg-[#14161d] text-[#d7dbe5]">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-white">{event.title}</div>
                <div className="mt-1 text-xs text-[#7d818d]">{event.category || "Event"} · {event.markets.length} 个子市场</div>
              </div>
              <div className="rounded-full border border-[#252833] bg-[#14161d] px-3 py-1.5 text-[11px] text-[#b7bbc6]">
                {formatPriceInt(yesPrice)}/{formatPriceInt(noPrice)}
              </div>
            </div>

            <div className="mt-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-1 rounded-full bg-[#11151b] p-1 text-xs">
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
                      className={`border-b-2 px-0.5 py-2 transition ${active ? "border-[#0ECB81] text-[#0ECB81]" : "border-transparent text-[#c3c7d1]"}`}
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
                        className={`min-w-[220px] rounded-[22px] border px-4 py-3 text-left transition ${
                          active
                            ? "border-[#0ECB81]/35 bg-[#1a1c24] shadow-[0_10px_24px_rgba(14,203,129,0.10)]"
                            : "border-[#232632] bg-[#14161c]"
                        }`}
                      >
                        <div className="line-clamp-2 text-sm font-medium text-white">{market.question}</div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#0ECB81]/12 px-2 py-1 text-[#0ECB81]">{market.yesLabel || "Yes"} {formatPriceInt(market.yesPrice)}</span>
                            <span className="rounded-full bg-[#F6465D]/12 px-2 py-1 text-[#F6465D]">{market.noLabel || "No"} {formatPriceInt(market.noPrice)}</span>
                          </div>
                          <span className="text-[#7d818d]">{market.daysLeft}d</span>
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
                        <div className={`mt-1 text-[42px] font-semibold leading-none tracking-tight ${heroColor}`}>
                          {formatPriceInt(heroPrice)}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className="font-medium text-white">${heroPrice.toFixed(3)}</span>
                          <span className={priceStats.changePct >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}>
                            {priceStats.changePct >= 0 ? "+" : ""}{priceStats.changePct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 rounded-2xl bg-[#0d1015] px-3 py-2 text-right text-[11px]">
                        <div className="text-[#6f7682]">市场</div>
                        <div className="mt-1 text-white">{event.markets.length}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#9aa0aa]">
                      <span className="rounded-full bg-[#0d1015] px-2.5 py-1">高 {formatPriceInt(priceStats.high)}</span>
                      <span className="rounded-full bg-[#0d1015] px-2.5 py-1">低 {formatPriceInt(priceStats.low)}</span>
                      <span className="rounded-full bg-[#0d1015] px-2.5 py-1">{event.category || "--"}</span>
                      <span className="rounded-full bg-[#0d1015] px-2.5 py-1">ID {marketIdLabel}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-[#20242d] p-px">
                    <button
                      onClick={() => setMobileTradeSide("yes")}
                      className={`px-4 py-2.5 text-left transition ${mobileTradeSide === "yes" ? "bg-[#10251d]" : "bg-[#11151b]"}`}
                    >
                      <div className="text-[11px] text-[#79808d]">{yesLabel}</div>
                      <div className="mt-1 text-[26px] font-semibold leading-none text-[#0ECB81]">{formatPriceInt(yesPrice)}</div>
                    </button>
                    <button
                      onClick={() => setMobileTradeSide("no")}
                      className={`px-4 py-3 text-left transition ${mobileTradeSide === "no" ? "bg-[#2a171d]" : "bg-[#11151b]"}`}
                    >
                      <div className="text-[11px] text-[#79808d]">{noLabel}</div>
                      <div className="mt-1 text-[26px] font-semibold leading-none text-[#F6465D]">{formatPriceInt(noPrice)}</div>
                    </button>
                  </div>
                </div>

                <div className="mt-2 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-transparent">
                  <div className="h-full min-h-[72dvh]">
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
                        enableRealtime={false}
                        compactMobile
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {mobileTab === "info" && (
              <div className="p-3">
                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">事件信息</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Category</span>
                      <span className="text-white">{event.category || "--"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">24h Volume</span>
                      <span className="text-white">{formatMoney(event.volume24h)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Total Volume</span>
                      <span className="text-white">{formatMoney(event.totalVolume)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Liquidity</span>
                      <span className="text-white">{formatMoney(event.liquidity)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Market ID</span>
                      <span className="font-mono text-[#c8ccd5]">{marketIdLabel}</span>
                    </div>
                    {event.description && (
                      <div className="mt-3 rounded-2xl bg-[#0f1015] p-3 text-[#a3a8b3]">{event.description}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mobileTab === "trade-data" && (
              <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto p-3 pb-28">
                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">买卖区</h3>
                    <span className="text-[11px] text-[#7c818d]">{yesLabel} 深度</span>
                  </div>
                  {selectedMarket?.yesTokenId ? (
                    <RealtimeOrderBook tokenId={selectedMarket.yesTokenId} maxDepth={6} showHeader />
                  ) : (
                    <p className="py-3 text-center text-xs text-[#8b8d98]">暂无盘口数据</p>
                  )}
                </div>
                <PositionsPanelCompact />
              </div>
            )}

            {mobileTab === "trade" && (
              <div className="h-full overflow-y-auto p-3 pb-28">
                <QuickTradePanelCompact
                  marketTitle={selectedMarket?.question || event.title}
                  yesPrice={yesPrice}
                  noPrice={noPrice}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                  yesTokenId={selectedMarket?.yesTokenId}
                  noTokenId={selectedMarket?.noTokenId}
                  tickSize="0.01"
                  negRisk={false}
                  selectedSide={mobileTradeSide}
                  onSelectedSideChange={setMobileTradeSide}
                />
              </div>
            )}
          </div>

          <div className="hidden lg:flex lg:flex-1 lg:overflow-hidden">
            <section className="flex min-w-0 flex-col lg:flex-1 lg:border-r lg:border-[#1d2028]">
              <div className="px-3 pt-3">
                <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-max gap-2">
                    {event.markets.map((market) => {
                      const active = selectedMarket?.conditionId === market.conditionId;
                      return (
                        <button
                          key={market.conditionId}
                          onClick={() => setSelectedMarket(market)}
                          className={`min-w-[220px] rounded-[22px] border px-4 py-3 text-left transition ${
                            active
                              ? "border-[#0ECB81]/35 bg-[#1a1c24] shadow-[0_10px_24px_rgba(14,203,129,0.10)]"
                              : "border-[#232632] bg-[#14161c]"
                          }`}
                        >
                          <div className="line-clamp-2 text-sm font-medium text-white">{market.question}</div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-[#0ECB81]/12 px-2 py-1 text-[#0ECB81]">{market.yesLabel || "Yes"} {formatPriceInt(market.yesPrice)}</span>
                              <span className="rounded-full bg-[#F6465D]/12 px-2 py-1 text-[#F6465D]">{market.noLabel || "No"} {formatPriceInt(market.noPrice)}</span>
                            </div>
                            <span className="text-[#7d818d]">{market.daysLeft}d</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="px-3 pt-3 lg:flex-1 lg:min-h-0">
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
                        enableRealtime={false}
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
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">买卖区</h3>
                    <span className="text-[11px] text-[#7c818d]">{yesLabel} 深度</span>
                  </div>
                  {selectedMarket?.yesTokenId ? (
                    <RealtimeOrderBook tokenId={selectedMarket.yesTokenId} maxDepth={6} showHeader />
                  ) : (
                    <p className="py-3 text-center text-xs text-[#8b8d98]">暂无盘口数据</p>
                  )}
                </div>

                <QuickTradePanelCompact
                  marketTitle={selectedMarket?.question || event.title}
                  yesPrice={yesPrice}
                  noPrice={noPrice}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                  yesTokenId={selectedMarket?.yesTokenId}
                  noTokenId={selectedMarket?.noTokenId}
                  tickSize="0.01"
                  negRisk={false}
                  selectedSide={mobileTradeSide}
                  onSelectedSideChange={setMobileTradeSide}
                />

                <PositionsPanelCompact />

                <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">事件信息</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Category</span>
                      <span className="text-white">{event.category || "--"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">24h Volume</span>
                      <span className="text-white">{formatMoney(event.volume24h)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Total Volume</span>
                      <span className="text-white">{formatMoney(event.totalVolume)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Liquidity</span>
                      <span className="text-white">{formatMoney(event.liquidity)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#7b7f8a]">Market ID</span>
                      <span className="font-mono text-[#c8ccd5]">{marketIdLabel}</span>
                    </div>
                    {event.description && (
                      <div className="mt-3 rounded-2xl bg-[#0f1015] p-3 text-[#a3a8b3]">{event.description}</div>
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
              className="rounded-2xl bg-[#0ECB81] px-4 py-3 text-sm font-semibold text-black"
            >
              买入 {yesCompactLabel} · {formatPriceInt(yesPrice)}
            </button>
            <button
              onClick={() => jumpToTradePanel("no")}
              className="rounded-2xl bg-[#F6465D] px-4 py-3 text-sm font-semibold text-white"
            >
              买入 {noCompactLabel} · {formatPriceInt(noPrice)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
