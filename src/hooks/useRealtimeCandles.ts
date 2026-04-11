"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Time } from "lightweight-charts";

export interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TickData {
  price: number;
  timestamp: number;
}

export type IntervalType = "1s" | "5s" | "15s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

const INTERVAL_SECONDS: Record<IntervalType, number> = {
  "1s": 1,
  "5s": 5,
  "15s": 15,
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

const ALL_INTERVALS: IntervalType[] = ["1s", "5s", "15s", "1m", "5m", "15m", "1h", "4h", "1d"];

export interface MultiTimeframeCandlesOptions {
  tokenId: string;
  initialData?: CandleData[];
  maxCandlesPerInterval?: number;
  wsUrl?: string;
}

type RealtimeTransportMode = "idle" | "connecting" | "ws" | "polling";

interface CandleStore {
  candles: Map<number, CandleData>;
  currentCandle: CandleData | null;
}

interface ProcessPriceOptions {
  recordTick?: boolean;
}

function parseUnitPrice(value: unknown): number | null {
  const price = Number(value);
  if (!Number.isFinite(price)) return null;
  if (price <= 0 || price > 1) return null;
  return price;
}

function isReasonablePriceJump(nextPrice: number, previousPrice: number | null, maxDeviation = 0.35): boolean {
  if (previousPrice === null || previousPrice <= 0) return true;
  const deviation = Math.abs(nextPrice - previousPrice) / previousPrice;
  return deviation <= maxDeviation;
}

function getTopBookPrice(levels: Array<{ price?: unknown }> | undefined, mode: "bestBid" | "bestAsk"): number | null {
  if (!Array.isArray(levels) || levels.length === 0) return null;

  let selected: number | null = null;
  for (const level of levels) {
    const price = parseUnitPrice(level?.price);
    if (price === null) continue;
    if (selected === null) {
      selected = price;
      continue;
    }
    if (mode === "bestBid") {
      selected = Math.max(selected, price);
    } else {
      selected = Math.min(selected, price);
    }
  }

  return selected;
}

function parseWsTimestampToMs(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input > 1e12 ? input : input * 1000;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return Date.now();

    // CLOB often sends numeric timestamps as strings.
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric > 1e12 ? numeric : numeric * 1000;
      }
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

export function useMultiTimeframeCandles({
  tokenId,
  initialData = [],
  maxCandlesPerInterval = 500,
  wsUrl = "wss://ws-subscriptions-clob.polymarket.com/ws/market",
}: MultiTimeframeCandlesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [activeInterval, setActiveInterval] = useState<IntervalType>("1s");
  const [transportMode, setTransportMode] = useState<RealtimeTransportMode>(tokenId ? "connecting" : "idle");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const ticksRef = useRef<TickData[]>([]);
  const candleStoresRef = useRef<Map<IntervalType, CandleStore>>(new Map());
  const lastPriceRef = useRef<number | null>(null);
  const reconnectRef = useRef<() => void>(() => {});
  
  const initializeStores = useCallback(() => {
    ALL_INTERVALS.forEach((interval) => {
      if (!candleStoresRef.current.has(interval)) {
        candleStoresRef.current.set(interval, {
          candles: new Map(),
          currentCandle: null,
        });
      }
    });
  }, []);

  useEffect(() => {
    initializeStores();
  }, [initializeStores]);

  useEffect(() => {
    if (lastPriceRef.current !== null) return;
    if (!initialData.length) return;
    const latest = initialData[initialData.length - 1];
    if (!latest || typeof latest.close !== "number") return;
    lastPriceRef.current = latest.close;
    setLastPrice(latest.close);
  }, [initialData]);

  useEffect(() => {
    // Avoid cross-market contamination when tokenId changes.
    ticksRef.current = [];
    lastPriceRef.current = null;
    setLastPrice(null);
    setLastUpdate(Date.now());
    setTransportMode(tokenId ? "connecting" : "idle");

    ALL_INTERVALS.forEach((interval) => {
      candleStoresRef.current.set(interval, {
        candles: new Map(),
        currentCandle: null,
      });
    });
  }, [tokenId]);

  const getTimeKey = useCallback((timestamp: number, intervalSeconds: number) => {
    return Math.floor(timestamp / 1000 / intervalSeconds) * intervalSeconds;
  }, []);

  const updateCandleForInterval = useCallback(
    (interval: IntervalType, price: number, timestamp: number) => {
      const store = candleStoresRef.current.get(interval);
      if (!store) return;

      const intervalSeconds = INTERVAL_SECONDS[interval];
      const timeKey = getTimeKey(timestamp, intervalSeconds);
      const existing = store.candles.get(timeKey);

      if (!existing) {
        // Use the first observed price in this bucket as the open.
        const openPrice = price;

        const newCandle: CandleData = {
          time: timeKey as Time,
          open: openPrice,
          high: price,
          low: price,
          close: price,
        };

        store.candles.set(timeKey, newCandle);
        store.currentCandle = newCandle;

        if (store.candles.size > maxCandlesPerInterval) {
          const keys = Array.from(store.candles.keys()).sort((a, b) => a - b);
          store.candles.delete(keys[0]);
        }
      } else {
        existing.high = Math.max(existing.high, price);
        existing.low = Math.min(existing.low, price);
        existing.close = price;
        store.candles.set(timeKey, existing);
        store.currentCandle = { ...existing };
      }
    },
    [getTimeKey, maxCandlesPerInterval]
  );

  const processPrice = useCallback(
    (
      price: number,
      timestamp: number = Date.now(),
      options: ProcessPriceOptions = {}
    ) => {
      if (!Number.isFinite(price) || price <= 0) return;
      if (!Number.isFinite(timestamp)) return;

      const { recordTick = true } = options;
      setLastPrice(price);
      lastPriceRef.current = price;

      if (recordTick) {
        ticksRef.current.push({ price, timestamp });
        const maxTicks = 10000;
        if (ticksRef.current.length > maxTicks) {
          ticksRef.current = ticksRef.current.slice(-maxTicks);
        }
      }

      ALL_INTERVALS.forEach((interval) => {
        updateCandleForInterval(interval, price, timestamp);
      });

      setLastUpdate(Date.now());
    },
    [updateCandleForInterval]
  );

  const processTradePrice = useCallback(
    (price: number, timestamp: number) => {
      const last = lastPriceRef.current;
      if (!isReasonablePriceJump(price, last, 0.4)) return;
      processPrice(price, timestamp);
    },
    [processPrice]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!tokenId) return;

    setTransportMode((current) => (current === "polling" || current === "ws" ? current : "connecting"));

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setTransportMode("ws");
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
            // New schema: batched changes under price_changes[]
            if (msg.event_type === "price_change" && Array.isArray(msg.price_changes)) {
              const timestamp = parseWsTimestampToMs(msg.timestamp);

              for (const change of msg.price_changes) {
                if (change.asset_id !== tokenId) continue;
                const price = parseUnitPrice(change.price);
                if (price === null) continue;
                processTradePrice(price, timestamp);
              }
            }

            // Legacy schema: single change
            if (msg.event_type === "price_change" && msg.asset_id === tokenId) {
              const price = parseUnitPrice(msg.price);
              if (price === null) continue;
              const timestamp = parseWsTimestampToMs(msg.timestamp);
              processTradePrice(price, timestamp);
            }

            // Orderbook snapshot updates should prefer mid-price from top of book.
            if (msg.event_type === "book" && msg.asset_id === tokenId) {
              const timestamp = parseWsTimestampToMs(msg.timestamp);
              const lastTrade = parseUnitPrice(msg.last_trade_price);
              if (lastTrade !== null) {
                processTradePrice(lastTrade, timestamp);
              }
            }

            if (msg.event_type === "last_trade_price" && msg.asset_id === tokenId) {
              const price = parseUnitPrice(msg.price);
              if (price !== null) {
                const timestamp = parseWsTimestampToMs(msg.timestamp);
                processPrice(price, timestamp);
              }
            }

            if (msg.event_type === "tick" && msg.price) {
              const price = parseFloat(msg.price);
              if (!isNaN(price) && price > 0) {
                processPrice(price);
              }
            }
          }
        } catch (e) {
          console.debug("WebSocket message parse error:", e);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setTransportMode((current) => (current === "polling" ? "polling" : tokenId ? "connecting" : "idle"));
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectRef.current();
        }, 3000);
      };

      wsRef.current.onerror = () => {
        wsRef.current?.close();
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  }, [tokenId, wsUrl, processPrice, processTradePrice]);

  useEffect(() => {
    reconnectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setTransportMode("idle");
  }, []);

  useEffect(() => {
    if (tokenId) {
      connect();
    }
    return () => disconnect();
  }, [tokenId, connect, disconnect]);

  useEffect(() => {
    if (!tokenId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const pollOrderBook = async () => {
      if (isConnected) return;

      try {
        const response = await fetch(`/api/orderbook?token_id=${encodeURIComponent(tokenId)}&_ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as {
          bids?: Array<{ price?: string }>;
          asks?: Array<{ price?: string }>;
          last_trade_price?: string;
        };

        if (cancelled) return;

        const lastTradePrice = parseUnitPrice(data.last_trade_price);
        const bestBid = getTopBookPrice(data.bids, "bestBid");
        const bestAsk = getTopBookPrice(data.asks, "bestAsk");
        const midpoint =
          bestBid !== null && bestAsk !== null && bestAsk >= bestBid && bestAsk - bestBid <= 0.03
            ? (bestBid + bestAsk) / 2
            : null;

        const fallbackPrice = lastTradePrice ?? midpoint;
        if (fallbackPrice === null) return;

        setTransportMode("polling");
        processTradePrice(fallbackPrice, Date.now());
      } catch {
        // Keep silent; websocket reconnect loop remains the primary transport.
      }
    };

    pollOrderBook();
    pollIntervalRef.current = setInterval(pollOrderBook, 3000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [tokenId, isConnected, processTradePrice]);

  const getCandles = useCallback((interval: IntervalType): CandleData[] => {
    const store = candleStoresRef.current.get(interval);
    if (!store) return [];
    return Array.from(store.candles.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
  }, []);

  const getCurrentCandle = useCallback((interval: IntervalType): CandleData | null => {
    const store = candleStoresRef.current.get(interval);
    return store?.currentCandle || null;
  }, []);

  const addPrice = useCallback(
    (price: number) => {
      processPrice(price);
    },
    [processPrice]
  );

  const aggregateFromTicks = useCallback(
    (interval: IntervalType, fromTimestamp?: number): CandleData[] => {
      const intervalSeconds = INTERVAL_SECONDS[interval];
      const ticks = fromTimestamp
        ? ticksRef.current.filter((t) => t.timestamp >= fromTimestamp)
        : ticksRef.current;

      if (ticks.length === 0) return [];

      const candleMap = new Map<number, CandleData>();

      ticks.forEach((tick) => {
        const timeKey = getTimeKey(tick.timestamp, intervalSeconds);
        const existing = candleMap.get(timeKey);

        if (!existing) {
          candleMap.set(timeKey, {
            time: timeKey as Time,
            open: tick.price,
            high: tick.price,
            low: tick.price,
            close: tick.price,
          });
        } else {
          existing.high = Math.max(existing.high, tick.price);
          existing.low = Math.min(existing.low, tick.price);
          existing.close = tick.price;
        }
      });

      return Array.from(candleMap.values()).sort(
        (a, b) => (a.time as number) - (b.time as number)
      );
    },
    [getTimeKey]
  );

  return {
    isConnected,
    lastPrice,
    lastUpdate,
    activeInterval,
    setActiveInterval,
    getCandles,
    getCurrentCandle,
    addPrice,
    disconnect,
    reconnect: connect,
    aggregateFromTicks,
    tickCount: ticksRef.current.length,
    transportMode,
  };
}

export function useMultiTimeframeCandlesWithState(
  options: MultiTimeframeCandlesOptions & { interval: IntervalType }
) {
  const {
    isConnected,
    lastPrice,
    lastUpdate,
    getCandles,
    getCurrentCandle,
    addPrice,
    disconnect,
    reconnect,
  } = useMultiTimeframeCandles(options);

  const candles = useMemo(() => {
    return getCandles(options.interval);
  }, [getCandles, options.interval, lastUpdate]);

  const currentCandle = useMemo(() => {
    return getCurrentCandle(options.interval);
  }, [getCurrentCandle, options.interval, lastUpdate]);

  return {
    candles,
    currentCandle,
    isConnected,
    lastPrice,
    addPrice,
    disconnect,
    reconnect,
  };
}

export interface SimulatedMultiTimeframeOptions {
  initialPrice?: number;
  volatility?: number;
  updateInterval?: number;
}

export function useSimulatedMultiTimeframeCandles({
  initialPrice = 0.5,
  volatility = 0.002,
  updateInterval = 100,
}: SimulatedMultiTimeframeOptions = {}) {
  const [lastPrice, setLastPrice] = useState(initialPrice);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const priceRef = useRef(initialPrice);
  const candleStoresRef = useRef<Map<IntervalType, CandleStore>>(new Map());
  const ticksRef = useRef<TickData[]>([]);

  const initializeStores = useCallback(() => {
    ALL_INTERVALS.forEach((interval) => {
      if (!candleStoresRef.current.has(interval)) {
        candleStoresRef.current.set(interval, {
          candles: new Map(),
          currentCandle: null,
        });
      }
    });
  }, []);

  const getTimeKey = useCallback((timestamp: number, intervalSeconds: number) => {
    return Math.floor(timestamp / 1000 / intervalSeconds) * intervalSeconds;
  }, []);

  const updateAllIntervals = useCallback(
    (price: number, timestamp: number) => {
      ALL_INTERVALS.forEach((interval) => {
        const store = candleStoresRef.current.get(interval);
        if (!store) return;

        const intervalSeconds = INTERVAL_SECONDS[interval];
        const timeKey = getTimeKey(timestamp, intervalSeconds);
        const existing = store.candles.get(timeKey);

        if (!existing) {
          const sortedCandles = Array.from(store.candles.values()).sort(
            (a, b) => (a.time as number) - (b.time as number)
          );
          const lastCandle = sortedCandles[sortedCandles.length - 1];
          const openPrice = lastCandle ? lastCandle.close : price;

          const newCandle: CandleData = {
            time: timeKey as Time,
            open: openPrice,
            high: price,
            low: price,
            close: price,
          };

          store.candles.set(timeKey, newCandle);
          store.currentCandle = newCandle;

          if (store.candles.size > 200) {
            const keys = Array.from(store.candles.keys()).sort((a, b) => a - b);
            store.candles.delete(keys[0]);
          }
        } else {
          existing.high = Math.max(existing.high, price);
          existing.low = Math.min(existing.low, price);
          existing.close = price;
          store.candles.set(timeKey, existing);
          store.currentCandle = { ...existing };
        }
      });
    },
    [getTimeKey]
  );

  useEffect(() => {
    initializeStores();

    const now = Date.now();
    const startTime = now - 3600 * 1000;
    
    for (let t = startTime; t < now; t += 1000) {
      const change = (Math.random() - 0.5) * 2 * volatility * 2;
      priceRef.current = Math.max(0.01, Math.min(0.99, priceRef.current + change));
      updateAllIntervals(priceRef.current, t);
      ticksRef.current.push({ price: priceRef.current, timestamp: t });
    }

    setLastUpdate(Date.now());
  }, [initializeStores, updateAllIntervals, volatility]);

  useEffect(() => {
    const timer = setInterval(() => {
      const change = (Math.random() - 0.5) * 2 * volatility;
      priceRef.current = Math.max(0.01, Math.min(0.99, priceRef.current + change));
      
      const timestamp = Date.now();
      setLastPrice(priceRef.current);
      
      ticksRef.current.push({ price: priceRef.current, timestamp });
      if (ticksRef.current.length > 5000) {
        ticksRef.current = ticksRef.current.slice(-5000);
      }

      updateAllIntervals(priceRef.current, timestamp);
      setLastUpdate(timestamp);
    }, updateInterval);

    return () => clearInterval(timer);
  }, [volatility, updateInterval, updateAllIntervals]);

  const getCandles = useCallback((interval: IntervalType): CandleData[] => {
    const store = candleStoresRef.current.get(interval);
    if (!store) return [];
    return Array.from(store.candles.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
  }, []);

  const getCurrentCandle = useCallback((interval: IntervalType): CandleData | null => {
    const store = candleStoresRef.current.get(interval);
    return store?.currentCandle || null;
  }, []);

  return {
    isConnected: true,
    lastPrice,
    lastUpdate,
    getCandles,
    getCurrentCandle,
    tickCount: ticksRef.current.length,
  };
}

export function aggregateCandlesToHigherTimeframe(
  sourceCandles: CandleData[],
  sourceInterval: IntervalType,
  targetInterval: IntervalType
): CandleData[] {
  const sourceSeconds = INTERVAL_SECONDS[sourceInterval];
  const targetSeconds = INTERVAL_SECONDS[targetInterval];

  if (targetSeconds <= sourceSeconds) {
    return sourceCandles;
  }

  const ratio = targetSeconds / sourceSeconds;
  const aggregatedMap = new Map<number, CandleData>();

  sourceCandles.forEach((candle) => {
    const sourceTime = candle.time as number;
    const targetTime = Math.floor(sourceTime / targetSeconds) * targetSeconds;

    const existing = aggregatedMap.get(targetTime);
    if (!existing) {
      aggregatedMap.set(targetTime, {
        time: targetTime as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    } else {
      existing.high = Math.max(existing.high, candle.high);
      existing.low = Math.min(existing.low, candle.low);
      existing.close = candle.close;
    }
  });

  return Array.from(aggregatedMap.values()).sort(
    (a, b) => (a.time as number) - (b.time as number)
  );
}

export { INTERVAL_SECONDS, ALL_INTERVALS };
