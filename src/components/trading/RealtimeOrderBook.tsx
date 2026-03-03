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

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export function RealtimeOrderBook({
  tokenId,
  maxDepth = 8,
  showHeader = false,
}: RealtimeOrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const fetchInitialOrderBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/orderbook?token_id=${encodeURIComponent(tokenId)}`);
      if (res.ok) {
        const data = await res.json();
        setOrderBook(data);
        setLastUpdate(Date.now());
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch orderbook:", err);
    }
  }, [tokenId]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!tokenId) return;

    try {
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        
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
              setOrderBook({
                market: msg.market,
                asset_id: msg.asset_id,
                bids: msg.bids || [],
                asks: msg.asks || [],
                timestamp: msg.timestamp,
                last_trade_price: msg.last_trade_price || "",
                tick_size: msg.tick_size || "0.01",
              });
              setLastUpdate(Date.now());
            }

            if (msg.event_type === "price_change" && msg.price_changes) {
              const change = msg.price_changes.find(
                (c: any) => c.asset_id === tokenId
              );
              if (change) {
                setOrderBook((prev) => {
                  if (!prev) return prev;

                  const newBids = [...prev.bids];
                  const newAsks = [...prev.asks];

                  if (change.side === "BUY") {
                    updateLevel(newBids, change.price, change.size, true);
                  } else {
                    updateLevel(newAsks, change.price, change.size, false);
                  }

                  return {
                    ...prev,
                    bids: newBids,
                    asks: newAsks,
                    timestamp: msg.timestamp,
                  };
                });
                setLastUpdate(Date.now());
              }
            }

            if (msg.event_type === "last_trade_price" && msg.asset_id === tokenId) {
              setOrderBook((prev) => {
                if (!prev) return prev;
                return { ...prev, last_trade_price: msg.price };
              });
            }
          }
        } catch (e) {
          console.debug("WebSocket message parse error:", e);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
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
  }, [tokenId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (tokenId) {
      fetchInitialOrderBook();
      connect();
    }
    return () => disconnect();
  }, [tokenId, fetchInitialOrderBook, connect, disconnect]);

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

  const spread = asks.length > 0 && bids.length > 0
    ? asks[0].price - bids[0].price
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
              最新: ${lastPrice.toFixed(3)}
            </span>
          )}
        </div>
      )}

      <div className="flex justify-between text-xs text-[#6b6b80] px-1">
        <span>价格</span>
        <span>数量</span>
      </div>

      {/* Asks */}
      <div className="space-y-0.5">
        {asks.slice().reverse().map((ask, i) => (
          <OrderRow
            key={`ask-${i}`}
            price={ask.price}
            size={ask.size}
            maxSize={maxSize}
            type="ask"
          />
        ))}
      </div>

      {/* Spread */}
      {spread > 0 && (
        <div className="text-center py-1.5 text-xs text-[#6b6b80] border-y border-[#1e1e28]">
          价差: ${spread.toFixed(4)} ({(spread * 100).toFixed(2)}%)
        </div>
      )}

      {/* Bids */}
      <div className="space-y-0.5">
        {bids.map((bid, i) => (
          <OrderRow
            key={`bid-${i}`}
            price={bid.price}
            size={bid.size}
            maxSize={maxSize}
            type="bid"
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
}: {
  price: number;
  size: number;
  maxSize: number;
  type: "bid" | "ask";
}) {
  const percentage = (size / maxSize) * 100;
  const bgColor = type === "bid" ? "#00D4AA" : "#FF6B6B";
  const textColor = type === "bid" ? "text-[#00D4AA]" : "text-[#FF6B6B]";

  return (
    <div className="relative flex justify-between items-center px-1 py-0.5 text-xs font-mono rounded">
      <div
        className="absolute inset-0 opacity-15 rounded"
        style={{
          background: bgColor,
          width: `${Math.min(percentage, 100)}%`,
          [type === "bid" ? "left" : "right"]: 0,
        }}
      />
      <span className={`relative ${textColor}`}>${price.toFixed(3)}</span>
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
  const idx = levels.findIndex((l) => l.price === price);
  
  if (parseFloat(size) === 0) {
    if (idx !== -1) {
      levels.splice(idx, 1);
    }
  } else {
    if (idx !== -1) {
      levels[idx].size = size;
    } else {
      levels.push({ price, size });
      levels.sort((a, b) => {
        const diff = parseFloat(b.price) - parseFloat(a.price);
        return isBid ? diff : -diff;
      });
    }
  }
}

export default RealtimeOrderBook;
