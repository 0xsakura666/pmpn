"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventGroup } from "@/components/market/types";

const EVENTS_QUERY_KEY = ["events"];

async function fetchEvents(limit = 100): Promise<EventGroup[]> {
  const res = await fetch(`/api/events?limit=${limit}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid response format");
  }
  return data;
}

export function useEvents(limit = 100) {
  return useQuery({
    queryKey: [...EVENTS_QUERY_KEY, limit],
    queryFn: () => fetchEvents(limit),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function usePrefetchEvents() {
  const queryClient = useQueryClient();

  return (limit = 100) => {
    queryClient.prefetchQuery({
      queryKey: [...EVENTS_QUERY_KEY, limit],
      queryFn: () => fetchEvents(limit),
      staleTime: 60 * 1000,
    });
  };
}

export function useInvalidateEvents() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
  };
}
