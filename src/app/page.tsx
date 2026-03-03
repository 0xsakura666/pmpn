"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Timer,
  TrendingUp,
  AlertCircle,
  Bookmark,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface SubMarket {
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  endDate: string;
  slug: string;
  daysLeft: number;
  yesTokenId: string;
  noTokenId: string;
}

interface EventGroup {
  id: string;
  title: string;
  description: string;
  image: string;
  slug: string;
  category: string;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  markets: SubMarket[];
  daysLeft: number;
}

// ─── Constants ──────────────────────────────────────────────────────

const navItems = [
  { href: "/", label: "市场" },
  { href: "/trade", label: "交易" },
  { href: "/wallet", label: "钱包" },
  { href: "/smart-money", label: "排行榜" },
] as const;

const sortOptions = [
  { value: "Trending", label: "热门", Icon: Flame },
  { value: "Volume", label: "成交量", Icon: BarChart3 },
  { value: "Newest", label: "最新", Icon: Clock },
  { value: "Ending Soon", label: "即将结束", Icon: Timer },
] as const;

const categoryFilters = [
  { value: "all", label: "全部" },
  { value: "政治", label: "政治" },
  { value: "加密", label: "加密" },
  { value: "体育", label: "体育" },
  { value: "科技", label: "科技" },
  { value: "经济", label: "经济" },
  { value: "娱乐", label: "娱乐" },
  { value: "其他", label: "其他" },
] as const;

const PAGE_SIZE = 12;
const CACHE_KEY = "pmpn_events_cache_v3";
const CACHE_TTL = 3 * 60 * 1000;
const PROXY_URL = "https://api.codetabs.com/v1/proxy/?quest=";

// ─── Helpers ────────────────────────────────────────────────────────

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

function calculateDaysLeft(endDate: string): number {
  if (!endDate) return -1;
  const endTime = new Date(endDate).getTime();
  if (isNaN(endTime)) return -1;
  return Math.ceil((endTime - Date.now()) / 86400000);
}

function isExpiredEvent(title: string, endDate: string): boolean {
  const currentYear = new Date().getFullYear();
  
  // Check if title contains a past year (2010-2025 when current year is 2026)
  const yearMatch = title.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year < currentYear) return true;
  }
  
  // Check if endDate has passed
  if (endDate) {
    const endTime = new Date(endDate).getTime();
    if (!isNaN(endTime) && endTime < Date.now()) return true;
  }
  
  return false;
}

function formatMoney(vol: number): string {
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `$${Math.round(vol / 1e3)}K`;
  return `$${Math.round(vol)}`;
}

function getSubMarketLabel(question: string, eventTitle: string): string {
  if (!question || question === eventTitle) return "";
  const titleBase = eventTitle
    .replace(/[.…?!]+$/g, "")
    .trim()
    .toLowerCase();
  const qClean = question.replace(/\?$/, "").trim();
  const qLower = qClean.toLowerCase();
  if (titleBase.length > 5 && qLower.startsWith(titleBase)) {
    const suffix = qClean.slice(titleBase.length).trim();
    if (suffix) return suffix;
  }
  if (qClean.length > 28) return qClean.slice(0, 25) + "...";
  return qClean;
}

// ─── Cache ──────────────────────────────────────────────────────────

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
      // Cache event data for event detail page
      localStorage.setItem(
        `event_${ev.id}`,
        JSON.stringify({
          id: ev.id,
          title: ev.title,
          description: ev.description,
          image: ev.image,
          category: ev.category,
          volume24h: ev.volume24h,
          totalVolume: ev.totalVolume,
          liquidity: ev.liquidity,
          markets: ev.markets,
        }),
      );
      // Cache individual market data
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
              priceChange: 0,
              spread: 0,
              daysLeft: m.daysLeft,
              yesTokenId: m.yesTokenId,
              noTokenId: m.noTokenId,
            }),
          );
        }
      }
    }
  } catch {}
}

// ─── Fallback Data ──────────────────────────────────────────────────

function getFallbackEvents(): EventGroup[] {
  return [
    {
      id: "evt1",
      title: "Will Trump win the 2024 election?",
      description: "",
      image: "",
      slug: "trump-2024",
      category: "政治",
      volume24h: 15000000,
      totalVolume: 89000000,
      liquidity: 4500000,
      daysLeft: 245,
      markets: [
        { conditionId: "d1m1", question: "Will Trump win the 2024 election?", yesPrice: 0.52, noPrice: 0.48, endDate: "2024-11-05", slug: "trump-win", daysLeft: 245, yesTokenId: "", noTokenId: "" },
      ],
    },
    {
      id: "evt2",
      title: "Bitcoin price milestones in 2024",
      description: "",
      image: "",
      slug: "btc-2024",
      category: "加密",
      volume24h: 8500000,
      totalVolume: 45000000,
      liquidity: 2500000,
      daysLeft: 300,
      markets: [
        { conditionId: "d2m1", question: "Will Bitcoin reach $100K in 2024?", yesPrice: 0.35, noPrice: 0.65, endDate: "2024-12-31", slug: "btc-100k", daysLeft: 300, yesTokenId: "", noTokenId: "" },
        { conditionId: "d2m2", question: "Will Bitcoin reach $75K in 2024?", yesPrice: 0.62, noPrice: 0.38, endDate: "2024-12-31", slug: "btc-75k", daysLeft: 300, yesTokenId: "", noTokenId: "" },
        { conditionId: "d2m3", question: "Will Bitcoin reach $50K in 2024?", yesPrice: 0.88, noPrice: 0.12, endDate: "2024-12-31", slug: "btc-50k", daysLeft: 300, yesTokenId: "", noTokenId: "" },
      ],
    },
    {
      id: "evt3",
      title: "Fed rate cuts in 2024",
      description: "",
      image: "",
      slug: "fed-rates",
      category: "其他",
      volume24h: 6200000,
      totalVolume: 28000000,
      liquidity: 1800000,
      daysLeft: 18,
      markets: [
        { conditionId: "d3m1", question: "Will the Fed cut rates in March?", yesPrice: 0.12, noPrice: 0.88, endDate: "2024-03-20", slug: "fed-march", daysLeft: 18, yesTokenId: "", noTokenId: "" },
        { conditionId: "d3m2", question: "Will the Fed cut rates in June?", yesPrice: 0.55, noPrice: 0.45, endDate: "2024-06-12", slug: "fed-june", daysLeft: 100, yesTokenId: "", noTokenId: "" },
      ],
    },
    {
      id: "evt4",
      title: "Will AI stocks outperform the S&P 500?",
      description: "",
      image: "",
      slug: "ai-stocks",
      category: "其他",
      volume24h: 4800000,
      totalVolume: 22000000,
      liquidity: 1400000,
      daysLeft: 300,
      markets: [
        { conditionId: "d4m1", question: "Will AI stocks outperform the S&P 500?", yesPrice: 0.68, noPrice: 0.32, endDate: "2024-12-31", slug: "ai-sp500", daysLeft: 300, yesTokenId: "", noTokenId: "" },
      ],
    },
    {
      id: "evt5",
      title: "Ethereum ETF approval",
      description: "",
      image: "",
      slug: "eth-etf",
      category: "加密",
      volume24h: 3900000,
      totalVolume: 18000000,
      liquidity: 1100000,
      daysLeft: 88,
      markets: [
        { conditionId: "d5m1", question: "Will Ethereum ETF be approved by May?", yesPrice: 0.75, noPrice: 0.25, endDate: "2024-05-31", slug: "eth-etf-may", daysLeft: 88, yesTokenId: "", noTokenId: "" },
        { conditionId: "d5m2", question: "Will Ethereum ETF be approved by July?", yesPrice: 0.85, noPrice: 0.15, endDate: "2024-07-31", slug: "eth-etf-jul", daysLeft: 150, yesTokenId: "", noTokenId: "" },
      ],
    },
    {
      id: "evt6",
      title: "Will OpenAI IPO in 2024?",
      description: "",
      image: "",
      slug: "openai-ipo",
      category: "其他",
      volume24h: 3200000,
      totalVolume: 15000000,
      liquidity: 960000,
      daysLeft: 300,
      markets: [
        { conditionId: "d6m1", question: "Will OpenAI IPO in 2024?", yesPrice: 0.15, noPrice: 0.85, endDate: "2024-12-31", slug: "openai-ipo", daysLeft: 300, yesTokenId: "", noTokenId: "" },
      ],
    },
    {
      id: "evt7",
      title: "Apple market cap milestones",
      description: "",
      image: "",
      slug: "apple-cap",
      category: "其他",
      volume24h: 2800000,
      totalVolume: 12000000,
      liquidity: 840000,
      daysLeft: 300,
      markets: [
        { conditionId: "d7m1", question: "Will Apple exceed $4T market cap?", yesPrice: 0.42, noPrice: 0.58, endDate: "2024-12-31", slug: "apple-4t", daysLeft: 300, yesTokenId: "", noTokenId: "" },
        { conditionId: "d7m2", question: "Will Apple exceed $3.5T market cap?", yesPrice: 0.71, noPrice: 0.29, endDate: "2024-12-31", slug: "apple-35t", daysLeft: 300, yesTokenId: "", noTokenId: "" },
      ],
    },
    {
      id: "evt8",
      title: "Will Musk acquire another company?",
      description: "",
      image: "",
      slug: "musk-acquire",
      category: "其他",
      volume24h: 2100000,
      totalVolume: 9000000,
      liquidity: 630000,
      daysLeft: 300,
      markets: [
        { conditionId: "d8m1", question: "Will Musk acquire another company?", yesPrice: 0.38, noPrice: 0.62, endDate: "2024-12-31", slug: "musk-acquire", daysLeft: 300, yesTokenId: "", noTokenId: "" },
      ],
    },
  ];
}

// ─── Memoized Components ────────────────────────────────────────────

const EventCard = memo(function EventCard({ event }: { event: EventGroup }) {
  const isSingle = event.markets.length === 1;
  const primary = event.markets[0];
  const displayMarkets = event.markets.slice(0, 2);
  const remaining = event.markets.length - 2;
  const primaryLink = primary?.conditionId ? `/markets/${primary.conditionId}` : "#";

  if (isSingle) {
    const yp = Math.round(primary.yesPrice * 100);
    const np = 100 - yp;
    return (
      <div className="group flex h-full flex-col rounded-2xl border border-[#1e1e28] bg-[#13131a] p-5 transition-all duration-200 hover:border-[#2d2d3a] hover:bg-[#16161f]">
        <Link href={primaryLink} className="mb-4 flex items-start gap-3">
          {event.image && (
            <img src={event.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          )}
          <h3 className="text-[15px] font-semibold leading-snug text-[#e4e4f0] line-clamp-2 group-hover:text-white transition-colors">
            {event.title}
          </h3>
        </Link>

        <div className="flex flex-1 flex-col justify-end">
          <div className="mb-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Link
              href={primaryLink}
              className="flex-1 rounded-xl bg-[#00D4AA] py-2.5 text-center text-sm font-bold text-[#0a1a14] transition-colors hover:bg-[#00c49a]"
            >
              Buy Yes
            </Link>
            <Link
              href={primaryLink}
              className="flex-1 rounded-xl bg-[#FF6B6B] py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-[#e85d5d]"
            >
              Buy No
            </Link>
          </div>

          <div className="mb-4 flex justify-between text-xs">
            <span className="text-[#8888a0]">Yes {yp}%</span>
            <span className="text-[#8888a0]">No {np}%</span>
          </div>

          <div className="flex items-center justify-between border-t border-[#1e1e28] pt-3">
            <span className="text-xs text-[#6b6b80]">Vol {formatMoney(event.totalVolume)}</span>
            <button
              className="text-[#6b6b80] transition-colors hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const eventLink = `/events/${event.id}`;

  return (
    <div className="group flex h-full flex-col rounded-2xl border border-[#1e1e28] bg-[#13131a] p-5 transition-all duration-200 hover:border-[#2d2d3a] hover:bg-[#16161f]">
      <Link href={eventLink} className="mb-4 flex items-start gap-3">
        {event.image && (
          <img src={event.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
        )}
        <h3 className="text-[15px] font-semibold leading-snug text-[#e4e4f0] line-clamp-2 group-hover:text-white transition-colors">
          {event.title}
        </h3>
      </Link>

      <div className="mb-3 flex flex-1 flex-col gap-2.5">
        {displayMarkets.map((m) => {
          const yp = Math.round(m.yesPrice * 100);
          const label = getSubMarketLabel(m.question, event.title) || m.question;
          const mLink = m.conditionId ? `/markets/${m.conditionId}` : "#";
          return (
            <div key={m.conditionId} className="flex items-center gap-2">
              <Link
                href={mLink}
                className="min-w-0 flex-1 truncate text-sm text-[#c0c0d0] hover:text-white transition-colors"
              >
                {label}
              </Link>
              <span className="shrink-0 w-12 text-right text-sm font-semibold text-white">
                {yp}%
              </span>
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <Link
                  href={mLink}
                  className="rounded-md border border-[#00D4AA]/40 bg-[#00D4AA]/10 px-2.5 py-1 text-xs font-semibold text-[#00D4AA] transition-colors hover:bg-[#00D4AA]/25"
                >
                  Yes
                </Link>
                <Link
                  href={mLink}
                  className="rounded-md border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 px-2.5 py-1 text-xs font-semibold text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/25"
                >
                  No
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-[#1e1e28] pt-3 mt-auto">
        <Link href={eventLink} className="text-xs text-[#6b6b80] hover:text-[#00D4AA] transition-colors">
          {remaining > 0 && `+${remaining} Outcomes · `}Vol {formatMoney(event.totalVolume)}
        </Link>
        <button
          className="text-[#6b6b80] transition-colors hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

const EventRow = memo(function EventRow({ event }: { event: EventGroup }) {
  const primary = event.markets[0];
  const yp = Math.round(primary.yesPrice * 100);
  const eventLink = `/events/${event.id}`;
  const primaryMarketLink = primary?.conditionId ? `/markets/${primary.conditionId}` : eventLink;

  return (
    <Link href={eventLink} className="block">
      <div className="group grid grid-cols-[1fr_100px_100px_100px_140px] items-center gap-4 rounded-xl border border-transparent px-4 py-3.5 transition-all hover:border-[#1e1e28] hover:bg-[#13131a]">
        <div className="flex items-start gap-3 min-w-0">
          {event.image && (
            <img src={event.image} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#e4e4f0] group-hover:text-white transition-colors">
              {event.title}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#6b6b80]">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.daysLeft}天
              </span>
              {event.markets.length > 1 && (
                <span className="rounded bg-[#1e1e28] px-1.5 py-0.5 text-[10px]">
                  {event.markets.length} 个市场
                </span>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[#00D4AA]">{yp}%</span>
            <span className="text-[11px] text-[#6b6b80]">Yes</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#1e1e28]">
            <div className="h-full rounded-full bg-[#00D4AA]" style={{ width: `${yp}%` }} />
          </div>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-[#c0c0d0]">{formatMoney(event.volume24h)}</p>
          <p className="text-[11px] text-[#6b6b80]">24h</p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-[#c0c0d0]">{formatMoney(event.totalVolume)}</p>
          <p className="text-[11px] text-[#6b6b80]">总量</p>
        </div>

        <div className="flex items-center justify-end gap-2" onClick={(e) => e.preventDefault()}>
          <Link
            href={primaryMarketLink}
            className="rounded-lg bg-[#00D4AA]/10 px-3 py-1.5 text-xs font-semibold text-[#00D4AA] transition-colors hover:bg-[#00D4AA]/20"
          >
            Yes {yp}¢
          </Link>
          <Link
            href={primaryMarketLink}
            className="rounded-lg bg-[#FF6B6B]/10 px-3 py-1.5 text-xs font-semibold text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20"
          >
            No {100 - yp}¢
          </Link>
        </div>
      </div>
    </Link>
  );
});

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0c10]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-2 border-[#1e1e28]" />
          <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-[#00D4AA]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#888]">正在加载市场数据</span>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00D4AA]" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00D4AA]" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#00D4AA]" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div 
      className="rounded-2xl border border-[#1e1e28] bg-[#13131a] p-5 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="h-8 w-8 shrink-0 rounded-lg skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-full rounded skeleton-shimmer" />
          <div className="h-4 w-2/3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="mb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded skeleton-shimmer" />
          <div className="flex gap-1">
            <div className="h-6 w-10 rounded-md skeleton-shimmer" />
            <div className="h-6 w-10 rounded-md skeleton-shimmer" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 rounded skeleton-shimmer" />
          <div className="flex gap-1">
            <div className="h-6 w-10 rounded-md skeleton-shimmer" />
            <div className="h-6 w-10 rounded-md skeleton-shimmer" />
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-[#1e1e28] pt-3">
        <div className="h-3 w-28 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div 
      className="grid grid-cols-[1fr_100px_100px_100px_140px] items-center gap-4 px-4 py-3.5 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex items-start gap-3">
        <div className="h-7 w-7 shrink-0 rounded-md skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded skeleton-shimmer" />
          <div className="h-3 w-1/3 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-14 rounded skeleton-shimmer" />
        <div className="h-1.5 rounded-full skeleton-shimmer" />
      </div>
      <div className="ml-auto h-4 w-14 rounded skeleton-shimmer" />
      <div className="ml-auto h-4 w-14 rounded skeleton-shimmer" />
      <div className="flex justify-end gap-2">
        <div className="h-7 w-16 rounded-lg skeleton-shimmer" />
        <div className="h-7 w-16 animate-pulse rounded-lg bg-[#1e1e28]" />
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function Home() {
  const [events, setEvents] = useState<EventGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("Trending");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "card">("card");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();

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

  const processToEventGroups = useCallback((rawEvents: unknown[]): EventGroup[] => {
    const groups: EventGroup[] = [];
    for (const event of rawEvents as Record<string, unknown>[]) {
      const eventMarkets = event.markets as Record<string, unknown>[] | undefined;
      if (!Array.isArray(eventMarkets) || eventMarkets.length === 0) continue;

      const title = (event.title || "") as string;
      const eventEndDate = (event.endDate || "") as string;
      const volume24h = parseFloat((event.volume24hr as string) || "0");

      const subMarkets: SubMarket[] = eventMarkets.map((m) => {
        let yesPrice = 0.5;
        let yesTokenId = "";
        let noTokenId = "";
        try {
          if (m.outcomePrices) yesPrice = parseFloat(JSON.parse(m.outcomePrices as string)[0]) || 0.5;
          if (m.clobTokenIds) {
            const tokenIds = JSON.parse(m.clobTokenIds as string);
            yesTokenId = tokenIds[0] || "";
            noTokenId = tokenIds[1] || "";
          }
        } catch {}
        const endDate = (m.endDate || eventEndDate || "") as string;
        return {
          conditionId: (m.conditionId || m.condition_id || "") as string,
          question: (m.question || title) as string,
          yesPrice,
          noPrice: 1 - yesPrice,
          endDate,
          slug: (m.slug || "") as string,
          daysLeft: calculateDaysLeft(endDate),
          yesTokenId,
          noTokenId,
        };
      });

      const eventId = (event.id || subMarkets[0]?.conditionId || `evt-${groups.length}`) as string;
      
      // Skip events with past years in title (e.g., "2024", "2025" when current year is 2026)
      if (isExpiredEvent(title, eventEndDate)) continue;

      // Filter out markets that have already ended (keep markets with no end date or future end date)
      const activeMarkets = subMarkets.filter((m) => {
        // If daysLeft is -1, it means no valid end date, keep it
        if (m.daysLeft === -1) return true;
        // If daysLeft > 0, it's still active
        if (m.daysLeft > 0) return true;
        // Check if title contains past year
        if (isExpiredEvent(m.question, "")) return false;
        return false;
      });
      if (activeMarkets.length === 0) continue;
      
      const validDaysLeft = activeMarkets.filter(m => m.daysLeft > 0).map(m => m.daysLeft);
      const eventDaysLeft = validDaysLeft.length > 0 ? Math.min(...validDaysLeft) : 30;

      groups.push({
        id: eventId,
        title,
        description: (event.description || "") as string,
        image: (event.image || "") as string,
        slug: (event.slug || "") as string,
        category: categorizeMarket(title),
        volume24h,
        totalVolume: parseFloat((event.volume as string) || "0"),
        liquidity: parseFloat((event.liquidity as string) || "0"),
        markets: activeMarkets,
        daysLeft: eventDaysLeft,
      });
    }
    return groups;
  }, []);

  const fetchFromProxy = useCallback(async (): Promise<EventGroup[]> => {
    const apiUrl = "https://gamma-api.polymarket.com/events?limit=100&active=true&closed=false&order=volume24hr&ascending=false";
    const res = await fetchWithTimeout(PROXY_URL + encodeURIComponent(apiUrl), 8000);
    if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
    const text = await res.text();
    if (!text || text.length < 10) throw new Error("Empty response");
    const raw = JSON.parse(text);
    if (!Array.isArray(raw) || raw.length === 0) throw new Error("No events data");
    const result = processToEventGroups(raw);
    if (result.length === 0) throw new Error("No events processed");
    return result;
  }, [fetchWithTimeout, processToEventGroups]);

  const fetchEvents = useCallback(
    async (useCache = true) => {
      const cached = useCache ? getCache() : null;

      if (cached && cached.events.length > 0) {
        setEvents(cached.events);
        setLoading(false);
        setIsRefreshing(true);
        try {
          const fresh = await fetchFromProxy();
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
        const fresh = await fetchFromProxy();
        setEvents(fresh);
        setCache(fresh);
      } catch {
        const fallback = getFallbackEvents();
        setEvents(fallback);
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
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, categoryFilter]);

  // ── derived state ──

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
          ev.markets.some((m) => m.question.toLowerCase().includes(q)),
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
    [sortedEvents, currentPage],
  );

  // ── render ──

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0c0c10] text-white">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-[#1a1a22] bg-[#0c0c10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-gradient">Tectonic</span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {navItems.map(({ href, label }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`rounded-lg px-3.5 py-1.5 font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-[#00D4AA]/15 text-[#00D4AA]"
                        : "text-[#6b6b80] hover:bg-[#ffffff08] hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
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
        <div className="mx-auto max-w-[1440px] px-6 py-3 space-y-3">
          {/* Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categoryFilters.map(({ value, label }) => {
              const count = categoryCounts[value] || 0;
              return (
                <button
                  key={value}
                  onClick={() => setCategoryFilter(value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap transition-all ${
                    categoryFilter === value
                      ? "bg-[#00D4AA] text-black"
                      : "bg-[#1e1e28] text-[#8888a0] hover:bg-[#2a2a36] hover:text-white"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-xs ${categoryFilter === value ? "text-black/60" : "text-[#6b6b80]"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Sort & View Controls */}
          <div className="flex items-center justify-between">
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
              onClick={() => fetchEvents(false)}
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
      </div>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1440px] px-6 py-5">
          {!loading && !error && (
            <div className="mb-4 flex items-center gap-4 text-xs text-[#6b6b80]">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                共 {sortedEvents.length} 个事件
              </span>
              {categoryFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00D4AA]/10 text-[#00D4AA]">
                  {categoryFilter}
                  <button onClick={() => setCategoryFilter("all")} className="hover:text-white">×</button>
                </span>
              )}
              {searchQuery && <span>搜索：&quot;{searchQuery}&quot;</span>}
            </div>
          )}

          {loading ? (
            <>
              <LoadingOverlay />
              {viewMode === "card" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonCard key={i} delay={i * 50} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} delay={i * 50} />
                  ))}
                </div>
              )}
            </>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24">
              <AlertCircle className="mb-4 h-12 w-12 text-[#FF6B6B]" />
              <p className="mb-2 text-lg font-semibold text-[#FF6B6B]">加载失败</p>
              <p className="mb-6 text-sm text-[#6b6b80]">{error}</p>
              <button
                onClick={() => fetchEvents(false)}
                className="rounded-xl bg-[#00D4AA] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#00b892]"
              >
                重新加载
              </button>
            </div>
          ) : paginatedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Search className="mb-4 h-10 w-10 text-[#6b6b80]" />
              <p className="mb-2 text-[#8888a0]">未找到匹配的事件</p>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-1 grid grid-cols-[1fr_100px_100px_100px_140px] gap-4 px-4 text-[11px] font-medium uppercase tracking-wider text-[#5a5a70]">
                <span>事件</span>
                <span>概率</span>
                <span className="text-right">24h 量</span>
                <span className="text-right">总成交</span>
                <span className="text-right">操作</span>
              </div>
              <div className="divide-y divide-[#1a1a22]">
                {paginatedEvents.map((ev) => (
                  <EventRow key={ev.id} event={ev} />
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
