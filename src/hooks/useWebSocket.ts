"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        onClose?.();

        if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current.onerror = (error) => {
        onError?.(error);
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket is not connected");
    }
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    send({ type: "subscribe", channels });
  }, [send]);

  const unsubscribe = useCallback((channels: string[]) => {
    send({ type: "unsubscribe", channels });
  }, [send]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

// Hook for market price updates
export function useMarketPrices(marketIds: string[]) {
  const [prices, setPrices] = useState<Record<string, { yes: number; no: number }>>({});

  const { isConnected, subscribe } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || "wss://ws-subscriptions-clob.polymarket.com/ws/market",
    onMessage: (message) => {
      if (message.type === "price_update") {
        setPrices((prev) => ({
          ...prev,
          [message.data.market_id]: {
            yes: message.data.yes_price,
            no: message.data.no_price,
          },
        }));
      }
    },
  });

  useEffect(() => {
    if (isConnected && marketIds.length > 0) {
      subscribe(marketIds.map((id) => `market:${id}`));
    }
  }, [isConnected, marketIds, subscribe]);

  return { prices, isConnected };
}

// Hook for whale signals
export function useWhaleSignals(minScore: number = 70) {
  const [signals, setSignals] = useState<any[]>([]);

  useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL || "wss://ws.tectonic.trade/signals",
    onMessage: (message) => {
      if (message.type === "whale_signal" && message.data.whaleScore >= minScore) {
        setSignals((prev) => [message.data, ...prev].slice(0, 50));
      }
    },
  });

  return signals;
}
