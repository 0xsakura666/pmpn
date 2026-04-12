import type { QueryClient } from "@tanstack/react-query";
import type { EventGroup } from "@/components/market/types";

export interface HomeEventsCacheData {
  events: EventGroup[];
  hasMore: boolean;
  nextOffset: number | null;
  timestamp: number;
}

const HOME_EVENTS_QUERY_KEY = ["page-cache", "events-home"] as const;
const HOME_EVENTS_CACHE_TTL_MS = 3 * 60 * 1000;

let didClearLegacyPayloadStorage = false;

export function eventDetailQueryKey(id: string) {
  return ["page-cache", "event-detail", id] as const;
}

export function marketDetailQueryKey(id: string) {
  return ["page-cache", "market-detail", id] as const;
}

export function getHomeEventsCache(queryClient: QueryClient): HomeEventsCacheData | null {
  const cached = queryClient.getQueryData<HomeEventsCacheData>(HOME_EVENTS_QUERY_KEY);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > HOME_EVENTS_CACHE_TTL_MS) {
    queryClient.removeQueries({ queryKey: HOME_EVENTS_QUERY_KEY, exact: true });
    return null;
  }

  return cached;
}

export function setHomeEventsCache(
  queryClient: QueryClient,
  events: EventGroup[],
  hasMore: boolean,
  nextOffset: number | null
) {
  queryClient.setQueryData<HomeEventsCacheData>(HOME_EVENTS_QUERY_KEY, {
    events,
    hasMore,
    nextOffset,
    timestamp: Date.now(),
  });

  for (const event of events) {
    queryClient.setQueryData(eventDetailQueryKey(event.id), event);
  }
}

export function clearLegacyPayloadStorage() {
  if (didClearLegacyPayloadStorage || typeof window === "undefined") return;
  didClearLegacyPayloadStorage = true;

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key === "pmpn_events_cache_v9" || key.startsWith("event_") || key.startsWith("market_")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage cleanup failures; the new implementation no longer depends on localStorage.
  }
}
