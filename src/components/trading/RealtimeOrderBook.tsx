"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
}

interface PriceChange {
  asset_id?: string;
  side?: string;
  price?: string;
  size?: string;
  best_bid?: string;
  best_ask?: string;
}

interface BestQuote {
  bid: number | null;
  ask: number | null;
}

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const SNAPSHOT_SYNC_MS = 1500;
const FLASH_MS = 900;

export function RealtimeOrderBook({
  tokenId,
  maxDepth = 8,
  showHeader = false,
}: RealtimeOrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bestQuote, setBestQuote] = useState<BestQuote>({ bid: null, ask: null });
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const [flashMap, setFlashMap] = useState<Record<string, number>>({});
  const [clockTs, setClockTs] = useState(() => Date.now());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectRef = useRef<() => void>(() => {});
  const shouldReconnectRef = useRef(true);

  const markLevelChanged = useCallback((side: "bid" | "ask", price?: string) => {
    if (!price) return;
    const normalizedPrice = normalizePrice(price);
    const key = `${side}:${normalizedPrice}`;

    setFlashMap((prev) => ({ ...prev, [key]: Date.now() }));

    const existingTimer = flashTimersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      setFlashMap((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      flashTimersRef.current.delete(key);
    }, FLASH_MS);

    flashTimersRef.current.set(key, timer);
  }, []);

  const updateBestQuoteFromSnapshot = useCallback((data: OrderBookData) => {
    const bestBid = data.bids
      ?.map((b) => parseFloat(b.price))
      .filter((p) => Number.isFinite(p))
      .sort((a, b) => b - a)[0] ?? null;
    const bestAsk = data.asks
      ?.map((a) => parseFloat(a.price))
      .filter((p) => Number.isFinite(p))
      .sort((a, b) => a - b)[0] ?? null;

    setBestQuote({ bid: bestBid, ask: bestAsk });
  }, []);

  const fetchInitialOrderBook = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/orderbook?token_id=${encodeURIComponent(tokenId)}&_ts=${Date.now()}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = (await res.json()) as OrderBookData;
        setOrderBook(data);
        updateBestQuoteFromSnapshot(data);
        setLastMessageAt(Date.now());
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch orderbook:", err);
    }
  }, [tokenId, updateBestQuoteFromSnapshot]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!tokenId) return;

    try {
      shouldReconnectRef.current = true;
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        void fetchInitialOrderBook();
        
        wsRef.current?.send(
          JSON.stringify({
            type: "market",
            assets_ids: [tokenId],
            custom_feature_enabled: true,
          })
        );
      };

      wsRef.current.onmessage = (event) => {
        try {
          const messages = JSON.parse(event.data);
          const messageArray = Array.isArray(messages) ? messages : [messages];

          for (const msg of messageArray) {
            if (msg.event_type === "book" && msg.asset_id === tokenId) {
              const nextBook: OrderBookData = {
                market: msg.market,
                asset_id: msg.asset_id,
                bids: msg.bids || [],
                asks: msg.asks || [],
                timestamp: msg.timestamp,
                last_trade_price: msg.last_trade_price || "",
                tick_size: msg.tick_size || "0.01",
              };
              setOrderBook(nextBook);
              updateBestQuoteFromSnapshot(nextBook);
              setLastMessageAt(Date.now());
            }

            if (msg.event_type === "price_change" && Array.isArray(msg.price_changes)) {
              const relevantChanges = (msg.price_changes as PriceChange[]).filter(
                (c) => c.asset_id === tokenId
              );
              if (relevantChanges.length > 0) {
                let latestBestBid: number | null = null;
                let latestBestAsk: number | null = null;

                setOrderBook((prev) => {
                  if (!prev) return prev;

                  const newBids = [...prev.bids];
                  const newAsks = [...prev.asks];

                  for (const change of relevantChanges) {
                    const side = String(change.side || "").toUpperCase();
                    if (side === "BUY" || side === "BID") {
                      updateLevel(newBids, change.price || "0", change.size || "0", true);
                      markLevelChanged("bid", change.price);
                    } else {
                      updateLevel(newAsks, change.price || "0", change.size || "0", false);
                      markLevelChanged("ask", change.price);
                    }

                    if (change.best_bid != null) {
                      const parsed = parseFloat(change.best_bid);
                      if (Number.isFinite(parsed)) {
                        latestBestBid = parsed;
                      }
                    }
                    if (change.best_ask != null) {
                      const parsed = parseFloat(change.best_ask);
                      if (Number.isFinite(parsed)) {
                        latestBestAsk = parsed;
                      }
                    }
                  }

                  return {
                    ...prev,
                    bids: newBids,
                    asks: newAsks,
                    timestamp: msg.timestamp,
                  };
                });

                if (latestBestBid != null || latestBestAsk != null) {
                  setBestQuote((prev) => ({
                    bid: latestBestBid ?? prev.bid,
                    ask: latestBestAsk ?? prev.ask,
                  }));
                }

                setLastMessageAt(Date.now());
              }
            }

            if (msg.event_type === "last_trade_price" && msg.asset_id === tokenId) {
              setOrderBook((prev) => {
                if (!prev) return prev;
                return { ...prev, last_trade_price: msg.price };
              });
              setLastMessageAt(Date.now());
            }
          }
        } catch (e) {
          console.debug("WebSocket message parse error:", e);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        if (!shouldReconnectRef.current) return;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectRef.current();
        }, delay);
      };

      wsRef.current.onerror = () => {
        setError("WebSocket 连接失败");
        wsRef.current?.close();
      };
    } catch (err) {
      console.error("WebSocket connection error:", err);
      setError("连接失败");
    }
  }, [fetchInitialOrderBook, markLevelChanged, tokenId, updateBestQuoteFromSnapshot]);

  useEffect(() => {
    reconnectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    for (const timer of flashTimersRef.current.values()) {
      clearTimeout(timer);
    }
    flashTimersRef.current.clear();
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!tokenId) {
      return () => disconnect();
    }

    const startTimer = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(startTimer);
      disconnect();
    };
  }, [tokenId, connect, disconnect]);

  useEffect(() => {
    if (!tokenId) return;
    if (!isConnected) return;

    // Periodic snapshot sync keeps the visible top levels accurate even if
    // incremental updates are sparse or temporarily missed.
    snapshotIntervalRef.current = setInterval(() => {
      void fetchInitialOrderBook();
    }, SNAPSHOT_SYNC_MS);

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
        snapshotIntervalRef.current = null;
      }
    };
  }, [tokenId, isConnected, fetchInitialOrderBook]);

  const bids = orderBook?.bids
    .map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }))
    .filter((b) => b.size > 0)
    .sort((a, b) => b.price - a.price)
    .slice(0, maxDepth) || [];

  const asks = orderBook?.asks
    .map((a) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
    .filter((a) => a.size > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, maxDepth) || [];

  const maxSize = Math.max(
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size),
    1
  );

  const bestBidPrice = bestQuote.bid ?? (bids.length > 0 ? bids[0].price : null);
  const bestAskPrice = bestQuote.ask ?? (asks.length > 0 ? asks[0].price : null);

  const spread = bestAskPrice != null && bestBidPrice != null
    ? bestAskPrice - bestBidPrice
    : 0;

  const lastPrice = orderBook?.last_trade_price
    ? parseFloat(orderBook.last_trade_price)
    : null;

  if (!orderBook && !error) {
    return (
      <div className="flex items-center justify-center py-8 text-[#6b6b80]">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
        加载中...
      </div>
    );
  }

  if (error && !orderBook) {
    return (
      <div className="text-center py-8 text-[#FF6B6B]">
        <WifiOff className="h-6 w-6 mx-auto mb-2" />
        <p className="text-sm">{error}</p>
        <button
          onClick={() => {
            disconnect();
            connect();
          }}
          className="mt-2 text-xs text-[#00D4AA] hover:underline"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between text-xs text-[#6b6b80] mb-2">
          <span className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-[#00D4AA]" />
            ) : (
              <WifiOff className="h-3 w-3 text-[#FF6B6B]" />
            )}
            {isConnected ? "实时" : "离线"}
          </span>
          {lastPrice && (
            <span className="font-mono">
              最新: {Math.round(lastPrice * 100)}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-[11px] text-[#6b6b80] px-1">
        <span>
          买一:{" "}
          <span className="font-mono text-[#00D4AA]">
            {bestBidPrice != null ? `${Math.round(bestBidPrice * 100)}` : "--"}
          </span>
        </span>
        <span className="text-center">
          卖一:{" "}
          <span className="font-mono text-[#FF6B6B]">
            {bestAskPrice != null ? `${Math.round(bestAskPrice * 100)}` : "--"}
          </span>
        </span>
        <span className="text-right font-mono">
          {lastMessageAt ? `${Math.max(0, Math.floor((clockTs - lastMessageAt) / 1000))}s` : "--"}
        </span>
      </div>

      <div className="flex justify-between text-xs text-[#6b6b80] px-1">
        <span>价格</span>
        <span>数量</span>
      </div>

      {/* Asks */}
      <div className="space-y-0.5">
        {asks.slice().reverse().map((ask, i) => (
          <OrderRow
            key={`ask-${ask.price}-${i}`}
            price={ask.price}
            size={ask.size}
            maxSize={maxSize}
            type="ask"
            flashing={Boolean(flashMap[`ask:${normalizePrice(String(ask.price))}`])}
          />
        ))}
      </div>

      {/* Spread */}
      {spread > 0 && (
        <div className="text-center py-1.5 text-xs text-[#6b6b80] border-y border-[#1e1e28]">
          价差: {Math.round(spread * 100)}
        </div>
      )}

      {/* Bids */}
      <div className="space-y-0.5">
        {bids.map((bid, i) => (
          <OrderRow
            key={`bid-${bid.price}-${i}`}
            price={bid.price}
            size={bid.size}
            maxSize={maxSize}
            type="bid"
            flashing={Boolean(flashMap[`bid:${normalizePrice(String(bid.price))}`])}
          />
        ))}
      </div>
    </div>
  );
}

function OrderRow({
  price,
  size,
  maxSize,
  type,
  flashing,
}: {
  price: number;
  size: number;
  maxSize: number;
  type: "bid" | "ask";
  flashing?: boolean;
}) {
  const percentage = (size / maxSize) * 100;
  const bgColor = type === "bid" ? "#00D4AA" : "#FF6B6B";
  const textColor = type === "bid" ? "text-[#00D4AA]" : "text-[#FF6B6B]";

  return (
    <div className={`relative flex justify-between items-center px-1 py-0.5 text-xs font-mono rounded transition-colors ${
      flashing ? "bg-white/10" : ""
    }`}>
      <div
        className="absolute inset-0 opacity-15 rounded"
        style={{
          background: bgColor,
          width: `${Math.min(percentage, 100)}%`,
          [type === "bid" ? "left" : "right"]: 0,
        }}
      />
      <span className={`relative ${textColor}`}>{Math.round(price * 100)}</span>
      <span className="relative text-white/80">
        {size >= 1000 ? `${(size / 1000).toFixed(1)}K` : size.toFixed(0)}
      </span>
    </div>
  );
}

function updateLevel(
  levels: OrderLevel[],
  price: string,
  size: string,
  isBid: boolean
) {
  const normalizedPrice = normalizePrice(price);
  const normalizedSize = String(Math.max(parseFloat(size), 0));
  const idx = levels.findIndex((l) => normalizePrice(l.price) === normalizedPrice);
  
  if (parseFloat(size) === 0) {
    if (idx !== -1) {
      levels.splice(idx, 1);
    }
  } else {
    if (idx !== -1) {
      levels[idx].size = normalizedSize;
      levels[idx].price = normalizedPrice;
    } else {
      levels.push({ price: normalizedPrice, size: normalizedSize });
      levels.sort((a, b) => {
        const diff = parseFloat(b.price) - parseFloat(a.price);
        return isBid ? diff : -diff;
      });
    }
  }
}

function normalizePrice(value: string): string {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return value;
  return num.toFixed(6).replace(/\.?0+$/, "");
}

export default RealtimeOrderBook;
