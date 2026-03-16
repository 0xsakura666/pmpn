"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

interface OrderLevel {
  price: string;
  size: string;
}

interface OrderBookData {
  market: string;
  asset_id: string;
  bids: OrderLevel[];
  asks: OrderLevel[];
  timestamp: string;
  last_trade_price: string;
  tick_size: string;
}

interface RealtimeOrderBookProps {
  tokenId: string;
  maxDepth?: number;
  showHeader?: boolean;
  layout?: "stacked" | "split";
  onQuoteChange?: (quote: {
    tokenId: string;
    bestBid: number | null;
    bestAsk: number | null;
    lastTradePrice: number | null;
  }) => void;
}

function formatCents(price: number | null) {
  if (price == null || !Number.isFinite(price)) return "--";
  const cents = price * 100;
  return Number.isInteger(cents) ? `${cents}` : cents.toFixed(1).replace(/\.0$/, "");
}

function normalizeLevels(levels: OrderLevel[] | undefined, descending: boolean, maxDepth: number) {
  return (levels || [])
    .map((level) => ({ price: parseFloat(level.price), size: parseFloat(level.size) }))
    .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.size) && level.size > 0)
    .sort((a, b) => (descending ? b.price - a.price : a.price - b.price))
    .slice(0, maxDepth);
}

export function RealtimeOrderBook({
  tokenId,
  maxDepth = 8,
  showHeader = false,
  layout = "stacked",
  onQuoteChange,
}: RealtimeOrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [clockTs, setClockTs] = useState(() => Date.now());

  useEffect(() => {
    const tick = window.setInterval(() => setClockTs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!tokenId) {
      setOrderBook(null);
      return;
    }

    let cancelled = false;

    const fetchOrderBook = async () => {
      try {
        const res = await fetch(`/api/orderbook?token_id=${encodeURIComponent(tokenId)}&_ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("订单簿加载失败");
        }
        const data = (await res.json()) as OrderBookData;
        if (cancelled) return;
        setOrderBook(data);
        setError(null);
        setLastSyncAt(Date.now());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "订单簿加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchOrderBook();
    const interval = window.setInterval(fetchOrderBook, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tokenId]);

  const bids = useMemo(() => normalizeLevels(orderBook?.bids, true, maxDepth), [orderBook?.bids, maxDepth]);
  const asks = useMemo(() => normalizeLevels(orderBook?.asks, false, maxDepth), [orderBook?.asks, maxDepth]);

  const maxSize = Math.max(...bids.map((b) => b.size), ...asks.map((a) => a.size), 1);
  const bestBidPrice = bids.length > 0 ? bids[0].price : null;
  const bestAskPrice = asks.length > 0 ? asks[0].price : null;
  const lastPrice = orderBook?.last_trade_price ? parseFloat(orderBook.last_trade_price) : null;
  const spread = bestAskPrice != null && bestBidPrice != null ? bestAskPrice - bestBidPrice : null;

  useEffect(() => {
    onQuoteChange?.({
      tokenId,
      bestBid: bestBidPrice,
      bestAsk: bestAskPrice,
      lastTradePrice: lastPrice,
    });
  }, [onQuoteChange, tokenId, bestBidPrice, bestAskPrice, lastPrice]);

  if (loading && !orderBook) {
    return (
      <div className="flex items-center justify-center py-8 text-[#6b6b80]">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        加载中...
      </div>
    );
  }

  if (error && !orderBook) {
    return (
      <div className="py-8 text-center text-[#FF6B6B]">
        <WifiOff className="mx-auto mb-2 h-6 w-6" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="mb-2 flex items-center justify-between text-xs text-[#6b6b80]">
          <span className="flex items-center gap-1">
            {error ? <WifiOff className="h-3 w-3 text-[#FF6B6B]" /> : <Wifi className="h-3 w-3 text-[#0ECB81]" />}
            {error ? "异常" : "实时"}
          </span>
          <span className="font-mono">最新: {formatCents(lastPrice)}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 px-1 text-[11px] text-[#6b6b80]">
        <span>
          买一: <span className="font-mono text-[#0ECB81]">{formatCents(bestBidPrice)}</span>
        </span>
        <span className="text-center">
          卖一: <span className="font-mono text-[#FF6B6B]">{formatCents(bestAskPrice)}</span>
        </span>
        <span className="text-right font-mono">
          {lastSyncAt ? `${Math.max(0, Math.floor((clockTs - lastSyncAt) / 1000))}s` : "--"}
        </span>
      </div>

      {spread != null && (
        <div className="rounded-xl bg-[#111319] px-2 py-1 text-center text-[10px] text-[#8a8e99]">
          价差 {formatCents(spread)}¢
        </div>
      )}

      {layout === "split" ? (
        <div className="grid grid-cols-2 gap-3">
          <OrderColumn title="卖盘" levels={asks.slice().reverse()} maxSize={maxSize} type="ask" />
          <OrderColumn title="买盘" levels={bids} maxSize={maxSize} type="bid" />
        </div>
      ) : (
        <div className="space-y-2">
          <OrderColumn title="卖盘" levels={asks.slice().reverse()} maxSize={maxSize} type="ask" compact />
          <OrderColumn title="买盘" levels={bids} maxSize={maxSize} type="bid" compact />
        </div>
      )}
    </div>
  );
}

function OrderColumn({
  title,
  levels,
  maxSize,
  type,
  compact = false,
}: {
  title: string;
  levels: Array<{ price: number; size: number }>;
  maxSize: number;
  type: "bid" | "ask";
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#111319] p-2">
      <div className="mb-2 flex items-center justify-between text-[10px] text-[#8a8e99]">
        <span>{title}</span>
        <span>价格 / 数量</span>
      </div>
      <div className="space-y-0.5">
        {levels.length === 0 ? (
          <div className="py-4 text-center text-[10px] text-[#6b6b80]">暂无数据</div>
        ) : (
          levels.map((level, index) => (
            <OrderRow
              key={`${title}-${level.price}-${index}`}
              price={level.price}
              size={level.size}
              maxSize={maxSize}
              type={type}
              compact={compact}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrderRow({
  price,
  size,
  maxSize,
  type,
  compact = false,
}: {
  price: number;
  size: number;
  maxSize: number;
  type: "bid" | "ask";
  compact?: boolean;
}) {
  const percentage = Math.max(8, (size / maxSize) * 100);
  const bgColor = type === "bid" ? "#0ECB81" : "#FF6B6B";
  const textColor = type === "bid" ? "text-[#0ECB81]" : "text-[#FF6B6B]";

  return (
    <div className={`relative flex items-center justify-between rounded px-1 py-${compact ? "0.5" : "1"} text-xs font-mono`}>
      <div
        className="absolute inset-y-0 left-0 rounded"
        style={{
          width: `${percentage}%`,
          background: bgColor,
          opacity: 0.12,
        }}
      />
      <span className={`relative z-10 ${textColor}`}>{formatCents(price)}</span>
      <span className="relative z-10 text-white">{size.toFixed(1)}</span>
    </div>
  );
}

export default RealtimeOrderBook;
