"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface SmartMoneyTrader {
  address: string;
  volume: number;
  profit: number;
  winRate: number;
  trades: number;
  lastActive: string;
}

export interface SmartMoneyTrade {
  id: string;
  trader: string;
  market: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
  timestamp: string;
  outcome?: "yes" | "no";
}

const TRADERS_QUERY_KEY = ["smart-money", "traders"];
const TRADES_QUERY_KEY = ["smart-money", "trades"];

async function fetchTopTraders(limit = 50): Promise<SmartMoneyTrader[]> {
  const res = await fetch(`/api/smart-money/traders?limit=${limit}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

async function fetchRecentTrades(limit = 100): Promise<SmartMoneyTrade[]> {
  const res = await fetch(`/api/smart-money/trades?limit=${limit}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

export function useTopTraders(limit = 50) {
  return useQuery({
    queryKey: [...TRADERS_QUERY_KEY, limit],
    queryFn: () => fetchTopTraders(limit),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function useRecentTrades(limit = 100) {
  return useQuery({
    queryKey: [...TRADES_QUERY_KEY, limit],
    queryFn: () => fetchRecentTrades(limit),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

export function usePrefetchSmartMoney() {
  const queryClient = useQueryClient();

  return {
    prefetchTraders: (limit = 50) => {
      queryClient.prefetchQuery({
        queryKey: [...TRADERS_QUERY_KEY, limit],
        queryFn: () => fetchTopTraders(limit),
        staleTime: 2 * 60 * 1000,
      });
    },
    prefetchTrades: (limit = 100) => {
      queryClient.prefetchQuery({
        queryKey: [...TRADES_QUERY_KEY, limit],
        queryFn: () => fetchRecentTrades(limit),
        staleTime: 30 * 1000,
      });
    },
  };
}
