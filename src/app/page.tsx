"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/auth/ConnectWallet";
import {
  Search,
  Clock,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  List,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Droplets,
  Timer,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface Market {
  id: string;
  conditionId: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  endDate: string;
  image: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  priceChange: number;
  spread: number;
  daysLeft: number;
}

const sortOptions = [
  { value: "Trending", label: "热门", Icon: Flame },
  { value: "Volume", label: "成交量", Icon: BarChart3 },
  { value: "Newest", label: "最新", Icon: Clock },
  { value: "Ending Soon", label: "即将结束", Icon: Timer },
] as const;

const PAGE_SIZE = 12;
const CACHE_KEY = "pmpn_markets_cache";
const CACHE_TTL = 5 * 60 * 1000;
const PROXY_URL = "https://api.codetabs.com/v1/proxy/?quest=";

function stableHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash & 0x7fffffff) / 0x7fffffff;
}

function categorizeMarket(question: string): string {
  const q = question.toLowerCase();
  if (/trump|biden|election|president|senate|congress/.test(q)) return "政治";
  if (/crypto|bitcoin|ethereum|btc|eth|token/.test(q)) return "加密";
  if (/sport|nba|nfl|soccer|football|tennis/.test(q)) return "体育";
  return "其他";
}

function calculateDaysLeft(endDate: string): number {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
}

function formatMoney(vol: number): string {
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `$${Math.round(vol / 1e3)}K`;
  return `$${Math.round(vol)}`;
}

interface CacheData {
  markets: Market[];
  timestamp: number;
}

function getCache(): CacheData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data: CacheData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(markets: Market[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ markets, timestamp: Date.now() }));
    for (const market of markets) {
      if (market.conditionId) {
        localStorage.setItem(`market_${market.conditionId}`, JSON.stringify(market));
      }
    }
  } catch {}
}

function getFallbackMarkets(): Market[] {
  const data = [
    { id: "demo1", title: "Will Trump win the 2024 election?", volume24h: 15000000, totalVolume: 89000000, yesPrice: 0.52, endDate: "2024-11-05" },
    { id: "demo2", title: "Will Bitcoin reach $100K in 2024?", volume24h: 8500000, totalVolume: 45000000, yesPrice: 0.35, endDate: "2024-12-31" },
    { id: "demo3", title: "Will the Fed cut rates in March?", volume24h: 6200000, totalVolume: 28000000, yesPrice: 0.12, endDate: "2024-03-20" },
    { id: "demo4", title: "Will AI stocks outperform the S&P 500?", volume24h: 4800000, totalVolume: 22000000, yesPrice: 0.68, endDate: "2024-12-31" },
    { id: "demo5", title: "Will Ethereum ETF be approved?", volume24h: 3900000, totalVolume: 18000000, yesPrice: 0.75, endDate: "2024-05-31" },
    { id: "demo6", title: "Will OpenAI IPO in 2024?", volume24h: 3200000, totalVolume: 15000000, yesPrice: 0.15, endDate: "2024-12-31" },
    { id: "demo7", title: "Will Apple exceed $4T market cap?", volume24h: 2800000, totalVolume: 12000000, yesPrice: 0.42, endDate: "2024-12-31" },
    { id: "demo8", title: "Will Musk acquire another company?", volume24h: 2100000, totalVolume: 9000000, yesPrice: 0.38, endDate: "2024-12-31" },
  ];

  return data.map((m, i) => ({
    id: m.id,
    conditionId: m.id,
    title: m.title,
    description: "",
    slug: `market-${m.id}`,
    category: i < 2 ? "政治" : "加密",
    endDate: m.endDate,
    image: "",
    yesPrice: m.yesPrice,
    noPrice: 1 - m.yesPrice,
    volume24h: m.volume24h,
    totalVolume: m.totalVolume,
    liquidity: m.volume24h * 0.3,
    priceChange: (stableHash(m.id + "p") - 0.3) * 10,
    spread: stableHash(m.id + "s") * 3,
    daysLeft: calculateDaysLeft(m.endDate),
  }));
}

// ─── Memoized Components ────────────────────────────────────────────

const MarketCard = memo(function MarketCard({ market }: { market: Market }) {
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const isUp = market.priceChange >= 0;
  const link = market.conditionId ? `/markets/${market.conditionId}` : "#";

  return (
    <Link href={link} className="block h-full">
      <div className="group relative h-full flex flex-col rounded-2xl border border-[#1e1e28] bg-[#13131a] p-5 transition-all duration-200 hover:border-[#2d2d3a] hover:bg-[#16161f] hover:shadow-lg hover:shadow-black/20">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#1e1e28] px-2.5 py-1 text-[11px] text-[#8888a0]">
            <Clock className="h-3 w-3" />
            {market.daysLeft}天
          </span>
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}
          >
            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(market.priceChange).toFixed(1)}%
          </span>
        </div>

        <h3 className="mb-4 flex-1 text-[15px] font-semibold leading-snug text-[#e4e4f0] line-clamp-2 group-hover:text-white transition-colors">
          {market.title}
        </h3>

        <div className="mb-4">
          <div className="mb-1.5 flex justify-between text-xs font-medium">
            <span className="text-[#00D4AA]">Yes {yesPercent}¢</span>
            <span className="text-[#FF6B6B]">No {noPercent}¢</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-[#1e1e28]">
            <div
              className="rounded-full bg-gradient-to-r from-[#00D4AA] to-[#00b892] transition-[width] duration-500"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        <div className="mb-4 flex items-center gap-3 text-xs text-[#6b6b80]">
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            {formatMoney(market.volume24h)}
          </span>
          <span className="h-3 w-px bg-[#1e1e28]" />
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3 w-3" />
            {formatMoney(market.liquidity)}
          </span>
        </div>

        <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
          <button className="flex-1 rounded-xl bg-[#00D4AA]/10 py-2.5 text-sm font-semibold text-[#00D4AA] transition-colors hover:bg-[#00D4AA]/20 active:scale-[.97]">
            买入 Yes
          </button>
          <button className="flex-1 rounded-xl bg-[#FF6B6B]/10 py-2.5 text-sm font-semibold text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20 active:scale-[.97]">
            买入 No
          </button>
        </div>
      </div>
    </Link>
  );
});

const MarketRow = memo(function MarketRow({ market }: { market: Market }) {
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = 100 - yesPercent;
  const isUp = market.priceChange >= 0;
  const link = market.conditionId ? `/markets/${market.conditionId}` : "#";

  return (
    <Link href={link} className="block">
      <div className="group grid grid-cols-[1fr_130px_90px_100px_90px_140px] items-center gap-4 rounded-xl border border-transparent px-4 py-3.5 transition-all hover:border-[#1e1e28] hover:bg-[#13131a]">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#e4e4f0] group-hover:text-white transition-colors">
            {market.title}
          </p>
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#6b6b80]">
            <Clock className="h-3 w-3 shrink-0" />
            {market.daysLeft}天后截止
          </span>
        </div>

        <div>
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[#00D4AA]">{yesPercent}%</span>
            <span className="text-[11px] text-[#6b6b80]">Yes</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1e1e28]">
            <div className="h-full rounded-full bg-[#00D4AA]" style={{ width: `${yesPercent}%` }} />
          </div>
        </div>

        <div className="text-right">
          <span className={`text-sm font-medium ${isUp ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}>
            {isUp ? "+" : ""}
            {market.priceChange.toFixed(1)}%
          </span>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-[#c0c0d0]">{formatMoney(market.volume24h)}</p>
          <p className="text-[11px] text-[#6b6b80]">24h 量</p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-[#c0c0d0]">{formatMoney(market.liquidity)}</p>
        </div>

        <div className="flex items-center justify-end gap-2" onClick={(e) => e.preventDefault()}>
          <button className="rounded-lg bg-[#00D4AA]/10 px-3 py-1.5 text-xs font-semibold text-[#00D4AA] transition-colors hover:bg-[#00D4AA]/20">
            Yes {yesPercent}¢
          </button>
          <button className="rounded-lg bg-[#FF6B6B]/10 px-3 py-1.5 text-xs font-semibold text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20">
            No {noPercent}¢
          </button>
        </div>
      </div>
    </Link>
  );
});

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#1e1e28] bg-[#13131a] p-5">
      <div className="mb-3 flex justify-between">
        <div className="h-5 w-16 animate-pulse rounded-full bg-[#1e1e28]" />
        <div className="h-4 w-10 animate-pulse rounded bg-[#1e1e28]" />
      </div>
      <div className="mb-2 h-5 w-full animate-pulse rounded bg-[#1e1e28]" />
      <div className="mb-4 h-5 w-2/3 animate-pulse rounded bg-[#1e1e28]" />
      <div className="mb-4 h-2 animate-pulse rounded-full bg-[#1e1e28]" />
      <div className="mb-4 flex gap-3">
        <div className="h-4 w-16 animate-pulse rounded bg-[#1e1e28]" />
        <div className="h-4 w-16 animate-pulse rounded bg-[#1e1e28]" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 flex-1 animate-pulse rounded-xl bg-[#1e1e28]" />
        <div className="h-10 flex-1 animate-pulse rounded-xl bg-[#1e1e28]" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[1fr_130px_90px_100px_90px_140px] items-center gap-4 px-4 py-3.5">
      <div className="space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[#1e1e28]" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-[#1e1e28]" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-14 animate-pulse rounded bg-[#1e1e28]" />
        <div className="h-1.5 animate-pulse rounded-full bg-[#1e1e28]" />
      </div>
      <div className="ml-auto h-4 w-10 animate-pulse rounded bg-[#1e1e28]" />
      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-[#1e1e28]" />
      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-[#1e1e28]" />
      <div className="flex justify-end gap-2">
        <div className="h-7 w-16 animate-pulse rounded-lg bg-[#1e1e28]" />
        <div className="h-7 w-16 animate-pulse rounded-lg bg-[#1e1e28]" />
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function Home() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("Trending");
  const [viewMode, setViewMode] = useState<"list" | "card">("card");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

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

  const processEvents = useCallback((events: unknown[]): Market[] => {
    const out: Market[] = [];
    for (const event of events as Record<string, unknown>[]) {
      const eventMarkets = event.markets as Record<string, unknown>[] | undefined;
      if (!Array.isArray(eventMarkets)) continue;

      for (const m of eventMarkets) {
        let yesPrice = 0.5;
        try {
          if (m.outcomePrices) yesPrice = parseFloat(JSON.parse(m.outcomePrices as string)[0]) || 0.5;
        } catch {}

        const conditionId = (m.conditionId || m.condition_id || "") as string;
        const title = (m.question || event.title || "") as string;
        const endDate = (m.endDate || event.endDate || "") as string;
        const volume24h = parseFloat((event.volume24hr as string) || "0");

        out.push({
          id: conditionId,
          conditionId,
          title,
          description: (m.description || event.description || "") as string,
          slug: (m.slug || event.slug || "") as string,
          category: categorizeMarket(title),
          endDate,
          image: (event.image || "") as string,
          yesPrice,
          noPrice: 1 - yesPrice,
          volume24h,
          totalVolume: parseFloat((event.volume as string) || "0"),
          liquidity: parseFloat((event.liquidity as string) || "0"),
          priceChange: (stableHash(conditionId + "p") - 0.3) * 15,
          spread: stableHash(conditionId + "s") * 5,
          daysLeft: calculateDaysLeft(endDate),
        });
      }
    }
    return out;
  }, []);

  const fetchFromProxy = useCallback(async (): Promise<Market[]> => {
    const apiUrl = "https://gamma-api.polymarket.com/events?limit=50&active=true&closed=false";
    const res = await fetchWithTimeout(PROXY_URL + encodeURIComponent(apiUrl), 8000);
    if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
    const text = await res.text();
    if (!text || text.length < 10) throw new Error("Empty response");
    const events = JSON.parse(text);
    if (!Array.isArray(events) || events.length === 0) throw new Error("No events data");
    const result = processEvents(events);
    if (result.length === 0) throw new Error("No markets processed");
    return result;
  }, [fetchWithTimeout, processEvents]);

  const fetchMarkets = useCallback(
    async (useCache = true) => {
      const cached = useCache ? getCache() : null;

      if (cached && cached.markets.length > 0) {
        setMarkets(cached.markets);
        setLoading(false);
        setIsRefreshing(true);
        try {
          const fresh = await fetchFromProxy();
          if (fresh.length > 0) {
            setMarkets(fresh);
            setCache(fresh);
          }
        } catch {}
        setIsRefreshing(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const fresh = await fetchFromProxy();
        if (fresh.length > 0) {
          setMarkets(fresh);
          setCache(fresh);
        } else {
          throw new Error("No data");
        }
      } catch {
        const fallback = getFallbackMarkets();
        setMarkets(fallback);
        if (fallback.length === 0) {
          setError("无法连接到 Polymarket API，请检查网络或稍后重试");
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchFromProxy],
  );

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  // ── derived state (memoized) ──

  const filteredMarkets = useMemo(() => {
    if (!searchQuery.trim()) return markets;
    const q = searchQuery.toLowerCase();
    return markets.filter((m) => m.title.toLowerCase().includes(q));
  }, [markets, searchQuery]);

  const sortedMarkets = useMemo(() => {
    return [...filteredMarkets].sort((a, b) => {
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
  }, [filteredMarkets, sortBy]);

  const totalPages = Math.ceil(sortedMarkets.length / PAGE_SIZE);

  const paginatedMarkets = useMemo(
    () => sortedMarkets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedMarkets, currentPage],
  );

  const currentSort = sortOptions.find((o) => o.value === sortBy) ?? sortOptions[0];

  // ── render ──

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0c0c10] text-white">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-[#1a1a22] bg-[#0c0c10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-gradient">Tectonic</span>
              <span className="rounded bg-[#1e1e28] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b80]">
                Pro
              </span>
            </Link>
            <nav className="hidden items-center gap-5 text-sm md:flex">
              <Link href="/" className="font-medium text-white">
                市场
              </Link>
              <Link href="#" className="text-[#6b6b80] transition-colors hover:text-white">
                交易
              </Link>
              <Link href="#" className="text-[#6b6b80] transition-colors hover:text-white">
                钱包
              </Link>
              <Link href="/smart-money" className="text-[#6b6b80] transition-colors hover:text-white">
                排行榜
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl bg-[#13131a] px-3.5 py-2 ring-1 ring-[#1e1e28] focus-within:ring-[#00D4AA]/40 md:flex transition-shadow">
              <Search className="h-4 w-4 text-[#6b6b80]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索市场..."
                className="w-44 bg-transparent text-sm text-white placeholder-[#6b6b80] outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-[#6b6b80] hover:text-white">
                  ×
                </button>
              )}
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="shrink-0 border-b border-[#1a1a22] bg-[#0c0c10]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            {sortOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setSortBy(value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  sortBy === value
                    ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                    : "text-[#6b6b80] hover:bg-[#13131a] hover:text-[#c0c0d0]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isRefreshing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#00D4AA]">
                <RefreshCw className="h-3 w-3 animate-spin" />
                更新中
              </span>
            )}
            <button
              onClick={() => fetchMarkets(false)}
              className="rounded-lg p-2 text-[#6b6b80] transition-colors hover:bg-[#13131a] hover:text-white"
              title="刷新"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-[#1e1e28]" />
            <div className="flex rounded-lg bg-[#13131a] p-0.5">
              <button
                onClick={() => setViewMode("card")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "card" ? "bg-[#1e1e28] text-white" : "text-[#6b6b80] hover:text-white"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "list" ? "bg-[#1e1e28] text-white" : "text-[#6b6b80] hover:text-white"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1440px] px-6 py-5">
          {/* stats bar */}
          {!loading && !error && (
            <div className="mb-4 flex items-center gap-4 text-xs text-[#6b6b80]">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                共 {sortedMarkets.length} 个市场
              </span>
              {searchQuery && (
                <span>
                  搜索：&quot;{searchQuery}&quot;
                </span>
              )}
            </div>
          )}

          {loading ? (
            viewMode === "card" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24">
              <AlertCircle className="mb-4 h-12 w-12 text-[#FF6B6B]" />
              <p className="mb-2 text-lg font-semibold text-[#FF6B6B]">加载失败</p>
              <p className="mb-6 text-sm text-[#6b6b80]">{error}</p>
              <button
                onClick={() => fetchMarkets(false)}
                className="rounded-xl bg-[#00D4AA] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#00b892]"
              >
                重新加载
              </button>
            </div>
          ) : paginatedMarkets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Search className="mb-4 h-10 w-10 text-[#6b6b80]" />
              <p className="mb-2 text-[#8888a0]">未找到匹配的市场</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 rounded-lg bg-[#1e1e28] px-4 py-2 text-sm text-white transition-colors hover:bg-[#2a2a36]"
                >
                  清除搜索
                </button>
              )}
            </div>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedMarkets.map((m) => (
                <MarketCard key={m.conditionId || m.id} market={m} />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-1 grid grid-cols-[1fr_130px_90px_100px_90px_140px] gap-4 px-4 text-[11px] font-medium uppercase tracking-wider text-[#5a5a70]">
                <span>事件</span>
                <span>概率</span>
                <span className="text-right">24h</span>
                <span className="text-right">成交量</span>
                <span className="text-right">流动性</span>
                <span className="text-right">操作</span>
              </div>
              <div className="divide-y divide-[#1a1a22]">
                {paginatedMarkets.map((m) => (
                  <MarketRow key={m.conditionId || m.id} market={m} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Pagination ── */}
      {!loading && !error && totalPages > 1 && (
        <div className="shrink-0 border-t border-[#1a1a22] bg-[#0c0c10]">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3">
            <span className="text-xs text-[#6b6b80]">
              第 {currentPage}/{totalPages} 页
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[#8888a0] transition-colors hover:bg-[#13131a] hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </button>
              {pageNumbers(currentPage, totalPages).map((n, idx) =>
                n === -1 ? (
                  <span key={`dot-${idx}`} className="px-1 text-[#5a5a70]">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === n
                        ? "bg-[#00D4AA] text-black"
                        : "text-[#8888a0] hover:bg-[#13131a] hover:text-white"
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-[#8888a0] transition-colors hover:bg-[#13131a] hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, -1, total];
  if (current >= total - 2) return [1, -1, total - 3, total - 2, total - 1, total];
  return [1, -1, current - 1, current, current + 1, -1, total];
}
