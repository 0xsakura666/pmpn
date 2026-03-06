"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, TrendingUp, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Button, LoadingOverlay, SkeletonCard, SkeletonRow } from "@/components/ui";
import {
  EventCard,
  EventRow,
  MarketToolbar,
  type EventGroup,
  type SortOption,
  type ViewMode,
  PAGE_SIZE,
} from "@/components/market";
import { calculateDaysLeft, isExpiredByDate } from "@/lib/utils";

const CACHE_KEY = "pmpn_events_cache_v5";
const CACHE_TTL = 3 * 60 * 1000;
const DEFAULT_FETCH_LIMIT = 500;
const SEARCH_FETCH_LIMIT = 200;

interface CacheData {
  events: EventGroup[];
  timestamp: number;
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

function setCache(events: EventGroup[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ events, timestamp: Date.now() }));
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

function categorizeMarket(question: string): string {
  const q = question.toLowerCase();
  if (/trump|biden|election|president|senate|congress|vote|poll|governor|republican|democrat|kamala|harris|iran|iranian|israel|gaza|ukraine|russia|war|regime|military|sanctions|geopolitics|china|taiwan/.test(q)) return "政治";
  if (/crypto|bitcoin|ethereum|btc|eth|token|solana|sol|xrp|doge|coin|defi|nft/.test(q)) return "加密";
  if (/sport|nba|nfl|soccer|football|tennis|championship|playoffs|game|match|team|player|lebron|curry/.test(q)) return "体育";
  if (/ai|openai|google|apple|microsoft|nvidia|tesla|meta|amazon|tech|software|startup|ipo/.test(q)) return "科技";
  if (/fed|rate|inflation|gdp|stock|market|economy|recession|unemployment|oil|gold/.test(q)) return "经济";
  if (/movie|oscar|grammy|music|celebrity|tv|show|netflix|disney|streaming/.test(q)) return "娱乐";
  return "其他";
}

function MarketsPageContent({ initialSearch }: { initialSearch: string }) {
  const [events, setEvents] = useState<EventGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("Trending");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

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

  const fetchFromAPI = useCallback(async (query: string): Promise<EventGroup[]> => {
    const params = new URLSearchParams({
      limit: query.trim() ? String(SEARCH_FETCH_LIMIT) : String(DEFAULT_FETCH_LIMIT),
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
    if (!Array.isArray(data)) {
      throw new Error("Invalid events response");
    }
    return data as EventGroup[];
  }, [fetchWithTimeout]);

  const fetchEvents = useCallback(
    async (query: string, useCache = true) => {
      const normalizedQuery = query.trim();
      const shouldUseCache = useCache && normalizedQuery === "";
      const cached = shouldUseCache ? getCache() : null;

      if (cached && cached.events.length > 0) {
        setEvents(cached.events);
        setLoading(false);
        setIsRefreshing(true);
        try {
          const fresh = await fetchFromAPI("");
          if (fresh.length > 0) {
            setEvents(fresh);
            setCache(fresh);
          }
        } catch {}
        setIsRefreshing(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const fresh = await fetchFromAPI(normalizedQuery);
        setEvents(fresh);
        if (normalizedQuery === "") {
          setCache(fresh);
        }
      } catch {
        setError("无法连接到 Polymarket API，请检查网络或稍后重试");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [fetchFromAPI]
  );

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    fetchEvents(searchQuery, true);
  }, [fetchEvents, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, categoryFilter]);

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

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      switch (sortBy) {
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

  const totalPages = Math.ceil(sortedEvents.length / PAGE_SIZE);

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

  return (
    <PageContainer>
      {/* Toolbar */}
      <div className="mb-4 border-b border-[var(--border-muted)] pb-4">
        <MarketToolbar
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          categoryCounts={categoryCounts}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isRefreshing={isRefreshing}
          onRefresh={() => fetchEvents(searchQuery, false)}
        />
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--text-disabled)]">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            共 {sortedEvents.length} 个事件
          </span>
          {categoryFilter !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]">
              {categoryFilter}
              <button onClick={() => setCategoryFilter("all")} className="hover:text-[var(--text-primary)]">×</button>
            </span>
          )}
          {searchQuery && <span>搜索：&quot;{searchQuery}&quot;</span>}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingOverlay message="正在加载市场数据" />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24">
          <AlertCircle className="mb-4 h-12 w-12 text-[var(--color-down)]" />
          <p className="mb-2 text-lg font-semibold text-[var(--color-down)]">加载失败</p>
          <p className="mb-6 text-sm text-[var(--text-disabled)]">{error}</p>
          <Button onClick={() => fetchEvents(searchQuery, false)}>重新加载</Button>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginatedEvents.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
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

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-6 pt-4 border-t border-[var(--border-muted)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-[var(--text-disabled)]">
              第 {currentPage}/{totalPages} 页
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline">下一页</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
