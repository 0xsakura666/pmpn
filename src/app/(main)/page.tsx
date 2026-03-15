"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, TrendingUp, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Button, LoadingOverlay } from "@/components/ui";
import {
  EventCard,
  EventRow,
  MarketToolbar,
  type CategoryFilter,
  type EventGroup,
  type SortOption,
  type ViewMode,
  PAGE_SIZE,
} from "@/components/market";

const CACHE_KEY = "pmpn_events_cache_v9";
const CACHE_TTL = 3 * 60 * 1000;
const INITIAL_FETCH_LIMIT = 48;
const SEARCH_FETCH_LIMIT = 48;

interface CacheData {
  events: EventGroup[];
  hasMore: boolean;
  nextOffset: number | null;
  timestamp: number;
}

interface EventsResponse {
  items: EventGroup[];
  hasMore: boolean;
  nextOffset: number | null;
}

function getCache(): CacheData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data: CacheData = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(events: EventGroup[], hasMore: boolean, nextOffset: number | null) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ events, hasMore, nextOffset, timestamp: Date.now() }));
    for (const ev of events) {
      localStorage.setItem(`event_${ev.id}`, JSON.stringify(ev));
      for (const m of ev.markets) {
        if (m.conditionId) {
          localStorage.setItem(
            `market_${m.conditionId}`,
            JSON.stringify({
              id: m.conditionId,
              conditionId: m.conditionId,
              title: m.question,
              description: ev.description,
              slug: m.slug,
              category: ev.category,
              endDate: m.endDate,
              image: ev.image,
              yesPrice: m.yesPrice,
              noPrice: m.noPrice,
              yesLabel: m.yesLabel,
              noLabel: m.noLabel,
              volume24h: ev.volume24h,
              totalVolume: ev.totalVolume,
              liquidity: ev.liquidity,
              daysLeft: m.daysLeft,
              yesTokenId: m.yesTokenId,
              noTokenId: m.noTokenId,
            })
          );
        }
      }
    }
  } catch {}
}

function appendUniqueEvents(current: EventGroup[], incoming: EventGroup[]) {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function MarketsPageContent({ initialSearch }: { initialSearch: string }) {
  const [events, setEvents] = useState<EventGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("Trending");
  const [marketScope, setMarketScope] = useState<"all" | "short-term">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchWithTimeout = useCallback(async (url: string, timeout = 12000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }, []);

  const fetchFromAPI = useCallback(
    async (query: string, scope: "all" | "short-term", offset = 0): Promise<EventsResponse> => {
      const params = new URLSearchParams({
        limit: query.trim() ? String(SEARCH_FETCH_LIMIT) : String(INITIAL_FETCH_LIMIT),
        offset: String(offset),
        scope,
      });
      if (query.trim()) {
        params.set("search", query.trim());
      }

      const res = await fetchWithTimeout(`/api/events?${params.toString()}`, 20000);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `API error: ${res.status}`);
      }

      const data = await res.json();
      if (!data || !Array.isArray(data.items)) {
        throw new Error("Invalid events response");
      }

      return {
        items: data.items as EventGroup[],
        hasMore: Boolean(data.hasMore),
        nextOffset: typeof data.nextOffset === "number" ? data.nextOffset : null,
      };
    },
    [fetchWithTimeout]
  );

  const resetAndFetch = useCallback(
    async (query: string, scope: "all" | "short-term", useCache = true) => {
      const normalizedQuery = query.trim();
      const shouldUseCache = useCache && normalizedQuery === "" && scope === "all";
      const cached = shouldUseCache ? getCache() : null;

      if (cached && cached.events.length > 0) {
        setEvents(cached.events);
        setHasMore(cached.hasMore);
        setNextOffset(cached.nextOffset);
        setLoading(false);
        setError(null);
        setIsRefreshing(true);
        try {
          const fresh = await fetchFromAPI("", "all", 0);
          setEvents(fresh.items);
          setHasMore(fresh.hasMore);
          setNextOffset(fresh.nextOffset);
          setCache(fresh.items, fresh.hasMore, fresh.nextOffset);
        } catch {}
        setIsRefreshing(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const fresh = await fetchFromAPI(normalizedQuery, scope, 0);
        setEvents(fresh.items);
        setHasMore(fresh.hasMore);
        setNextOffset(fresh.nextOffset);
        if (normalizedQuery === "" && scope === "all") {
          setCache(fresh.items, fresh.hasMore, fresh.nextOffset);
        }
      } catch {
        setError("无法连接到 Polymarket API，请检查网络或稍后重试");
        setEvents([]);
        setHasMore(false);
        setNextOffset(null);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchFromAPI]
  );

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || nextOffset === null) return false;

    setLoadingMore(true);
    try {
      const response = await fetchFromAPI(searchQuery, marketScope, nextOffset);
      setEvents((prev) => {
        const merged = appendUniqueEvents(prev, response.items);
        if (searchQuery.trim() === "" && marketScope === "all") {
          setCache(merged, response.hasMore, response.nextOffset);
        }
        return merged;
      });
      setHasMore(response.hasMore);
      setNextOffset(response.nextOffset);
      return response.items.length > 0;
    } catch {
      return false;
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, nextOffset, fetchFromAPI, searchQuery, marketScope]);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setCurrentPage(1);
    void resetAndFetch(searchQuery, marketScope, true);
  }, [resetAndFetch, searchQuery, marketScope]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, categoryFilter]);

  const filteredEvents = useMemo(() => {
    let result = events;

    if (categoryFilter !== "all") {
      result = result.filter((ev) => ev.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) ||
          ev.markets.some((m) => m.question.toLowerCase().includes(q))
      );
    }

    return result;
  }, [events, searchQuery, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: events.length };
    for (const ev of events) {
      counts[ev.category] = (counts[ev.category] || 0) + 1;
    }
    return counts;
  }, [events]);

  const categoryOptions = useMemo<CategoryFilter[]>(() => {
    const dynamic = Object.entries(categoryCounts)
      .filter(([value]) => value !== "all")
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 12)
      .map(([value]) => ({ value, label: value }));

    return [{ value: "all", label: "全部" }, ...dynamic];
  }, [categoryCounts]);

  const shortTermCount = useMemo(() => events.filter((ev) => Boolean(ev.isShortTerm)).length, [events]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      switch (sortBy) {
        case "Trending": {
          const rankA = a.trendingRank ?? Number.MAX_SAFE_INTEGER;
          const rankB = b.trendingRank ?? Number.MAX_SAFE_INTEGER;
          if (rankA !== rankB) {
            return rankA - rankB;
          }
          return b.volume24h - a.volume24h;
        }
        case "Volume":
          return b.volume24h - a.volume24h;
        case "Newest":
          return b.daysLeft - a.daysLeft;
        case "Ending Soon":
          return a.daysLeft - b.daysLeft;
        default:
          return b.volume24h - a.volume24h;
      }
    });
  }, [filteredEvents, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / PAGE_SIZE));

  const paginatedEvents = useMemo(
    () => sortedEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedEvents, currentPage]
  );

  const pageNumbers = (current: number, total: number): number[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, -1, total];
    if (current >= total - 2) return [1, -1, total - 3, total - 2, total - 1, total];
    return [1, -1, current - 1, current, current + 1, -1, total];
  };

  const handleNextPage = useCallback(async () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
      return;
    }

    if (hasMore) {
      const nextPage = totalPages + 1;
      const loaded = await loadMore();
      if (loaded) {
        setCurrentPage(nextPage);
      }
    }
  }, [currentPage, totalPages, hasMore, loadMore]);

  useEffect(() => {
    if (!hasMore) return;
    if (currentPage < totalPages - 1) return;
    void loadMore();
  }, [currentPage, totalPages, hasMore, loadMore]);

  useEffect(() => {
    if (viewMode !== "card") return;
    if (!loadMoreRef.current) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [viewMode, hasMore, loadMore, paginatedEvents.length]);

  return (
    <PageContainer>
      <div className="mb-4 border-b border-[var(--border-muted)] pb-4">
        <MarketToolbar
          marketScope={marketScope}
          onMarketScopeChange={setMarketScope}
          totalCount={events.length}
          shortTermCount={shortTermCount}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categoryCounts={categoryCounts}
          categoryOptions={categoryOptions}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isRefreshing={isRefreshing}
          onRefresh={() => resetAndFetch(searchQuery, marketScope, false)}
        />
      </div>

      {!loading && !error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--text-disabled)]">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            已加载 {sortedEvents.length} 个事件{hasMore ? " · 继续滚动会自动加载更多" : ""}
          </span>
          {marketScope === "short-term" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]">
              短期市场
              <button onClick={() => setMarketScope("all")} className="hover:text-[var(--text-primary)]">×</button>
            </span>
          )}
          {categoryFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]">
              {categoryFilter}
              <button onClick={() => setCategoryFilter("all")} className="hover:text-[var(--text-primary)]">×</button>
            </span>
          )}
          {searchQuery && <span>搜索：&quot;{searchQuery}&quot;</span>}
        </div>
      )}

      {loading ? (
        <LoadingOverlay message="正在加载市场数据" />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="mb-4 h-12 w-12 text-[var(--color-down)]" />
          <p className="mb-2 text-lg font-semibold text-[var(--color-down)]">加载失败</p>
          <p className="mb-6 text-sm text-[var(--text-disabled)]">{error}</p>
          <Button onClick={() => resetAndFetch(searchQuery, marketScope, false)}>重新加载</Button>
        </div>
      ) : paginatedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Search className="mb-4 h-10 w-10 text-[var(--text-disabled)]" />
          <p className="mb-2 text-[var(--text-subtle)]">未找到匹配的事件</p>
          {searchQuery && (
            <Button variant="secondary" onClick={() => setSearchQuery("")} className="mt-2">
              清除搜索
            </Button>
          )}
        </div>
      ) : viewMode === "card" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
          <div ref={loadMoreRef} className="h-8" />
        </>
      ) : (
        <>
          <div className="mb-1 hidden md:grid grid-cols-[1fr_100px_100px_100px_140px] gap-4 px-4 text-[11px] font-medium uppercase tracking-wider text-[var(--text-placeholder)]">
            <span>事件</span>
            <span>概率</span>
            <span className="text-right">24h 量</span>
            <span className="text-right">总成交</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-[var(--border-muted)]">
            {paginatedEvents.map((ev) => (
              <EventRow key={ev.id} event={ev} />
            ))}
          </div>
        </>
      )}

      {!loading && !error && totalPages > 0 && (
        <div className="mt-6 pt-4 border-t border-[var(--border-muted)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-[var(--text-disabled)]">
              第 {currentPage}/{totalPages} 页{hasMore ? " · 后面还有更多" : ""}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">上一页</span>
              </Button>
              <div className="hidden sm:flex items-center gap-1">
                {pageNumbers(currentPage, totalPages).map((n, idx) =>
                  n === -1 ? (
                    <span key={`dot-${idx}`} className="px-1 text-[var(--text-placeholder)]">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setCurrentPage(n)}
                      className={`h-8 w-8 rounded-[var(--radius-lg)] text-sm font-medium transition-colors ${
                        currentPage === n
                          ? "bg-[var(--brand-primary)] text-black"
                          : "text-[var(--text-subtle)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleNextPage()}
                disabled={!hasMore && currentPage === totalPages}
              >
                <span className="hidden sm:inline">下一页</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loadingMore && (
            <div className="mt-3 text-center text-xs text-[var(--text-disabled)]">正在加载更多市场…</div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function SearchParamsWrapper() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  return <MarketsPageContent initialSearch={initialSearch} />;
}

export default function MarketsPage() {
  return (
    <Suspense fallback={<LoadingOverlay message="加载中..." />}>
      <SearchParamsWrapper />
    </Suspense>
  );
}
