import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";
import { resolveBinaryOutcomeMapping } from "@/lib/binary-outcome";
import { categorizeMarket } from "@/lib/market-category";

const GAMMA_PAGE_SIZE = 500;
const DEFAULT_EVENTS_LIMIT = 48;
const DEFAULT_SEARCH_LIMIT = 48;
const MAX_EVENTS_LIMIT = 5000;
const MAX_SEARCH_SCAN_EVENTS = 5000;
const MAX_TRENDING_MARKET_SCAN = 5000;
const TRENDING_CANDIDATE_MULTIPLIER = 3;

const SHORT_TERM_HOURS = 36;
const SHORT_TERM_PRIORITY_LIMIT_ALL = 6;
const SHORT_TERM_PRIORITY_LIMIT_SCOPE = 36;
const SHORT_TERM_PER_EVENT_CAP = 2;

type MarketScope = "all" | "short-term";

interface RawMarket {
  conditionId?: string;
  condition_id?: string;
  question?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  endDate?: string;
  slug?: string;
}

interface RawEvent {
  id?: string;
  title?: string;
  description?: string;
  image?: string;
  slug?: string;
  endDate?: string;
  volume24hr?: string;
  volume?: string;
  liquidity?: string;
  markets?: RawMarket[];
}

interface RawTrendingMarket {
  events?: Array<{
    id?: string | number;
  }>;
}

interface RawPriorityMarket {
  conditionId?: string;
  condition_id?: string;
  question?: string;
  description?: string;
  image?: string;
  icon?: string;
  slug?: string;
  endDate?: string;
  gameStartTime?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  volume24hr?: number | string;
  volume?: number | string;
  liquidity?: number | string;
  events?: Array<{
    id?: string | number;
    slug?: string;
    title?: string;
    image?: string;
  }>;
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
  tags?: string[];
  markets: Array<{
    conditionId: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    yesLabel: string;
    noLabel: string;
    endDate: string;
    slug: string;
    daysLeft: number;
    yesTokenId: string;
    noTokenId: string;
  }>;
  daysLeft: number;
  isShortTerm: boolean;
  trendingRank?: number;
}

function isExpiredByDate(endDate: string): boolean {
  if (!endDate) return false;
  const endTime = new Date(endDate).getTime();
  if (isNaN(endTime)) return false;
  return endTime < Date.now();
}

function calculateDaysLeft(endDate: string): number {
  if (!endDate) return -1;
  const endTime = new Date(endDate).getTime();
  if (isNaN(endTime)) return -1;
  return Math.ceil((endTime - Date.now()) / 86400000);
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function matchesSearch(event: RawEvent, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  if (event.title?.toLowerCase().includes(q)) return true;
  if (event.description?.toLowerCase().includes(q)) return true;
  if (event.slug?.toLowerCase().includes(q)) return true;
  if (!Array.isArray(event.markets)) return false;

  return event.markets.some((market) => {
    if (market.question?.toLowerCase().includes(q)) return true;
    if (market.slug?.toLowerCase().includes(q)) return true;
    return false;
  });
}

function parseDateMs(input?: string): number | null {
  if (!input) return null;
  const timestamp = new Date(input).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hoursUntil(input?: string): number | null {
  const ts = parseDateMs(input);
  if (ts === null) return null;
  return (ts - Date.now()) / 3600000;
}

function isShortTermPriorityMarket(market: RawPriorityMarket): boolean {
  const endHours = hoursUntil(market.endDate);
  const gameHours = hoursUntil(market.gameStartTime);

  if (endHours !== null && endHours >= -6 && endHours <= SHORT_TERM_HOURS) {
    return true;
  }

  if (gameHours !== null && gameHours >= -6 && gameHours <= SHORT_TERM_HOURS) {
    return true;
  }

  return false;
}

function transformEvent(event: RawEvent, fallbackId: number): EventGroup | null {
  const eventMarkets = event.markets;
  if (!Array.isArray(eventMarkets) || eventMarkets.length === 0) return null;

  const title = event.title || "";
  const eventEndDate = event.endDate || "";
  const volume24h = parseFloat(event.volume24hr || "0");

  if (isExpiredByDate(eventEndDate)) return null;

  const subMarkets = [];
  for (const m of eventMarkets) {
    const endDate = m.endDate || eventEndDate || "";
    if (isExpiredByDate(endDate)) continue;

    const { yesPrice, noPrice, yesTokenId, noTokenId, yesLabel, noLabel } = resolveBinaryOutcomeMapping({
      outcomes: m.outcomes,
      outcomePrices: m.outcomePrices,
      clobTokenIds: m.clobTokenIds,
    });

    subMarkets.push({
      conditionId: m.conditionId || m.condition_id || "",
      question: m.question || title,
      yesPrice,
      noPrice,
      yesLabel,
      noLabel,
      endDate,
      slug: m.slug || "",
      daysLeft: calculateDaysLeft(endDate),
      yesTokenId,
      noTokenId,
    });
  }

  if (subMarkets.length === 0) return null;

  const validDaysLeft = subMarkets.filter((m) => m.daysLeft > 0).map((m) => m.daysLeft);
  const eventDaysLeft = validDaysLeft.length > 0 ? Math.min(...validDaysLeft) : 30;

  return {
    id: event.id || subMarkets[0]?.conditionId || `evt-${fallbackId}`,
    title,
    description: event.description || "",
    image: event.image || "",
    slug: event.slug || "",
    category: categorizeMarket(
      title,
      event.description,
      event.slug,
      ...subMarkets.flatMap((market) => [market.question, market.slug])
    ),
    volume24h,
    totalVolume: parseFloat(event.volume || "0"),
    liquidity: parseFloat(event.liquidity || "0"),
    markets: subMarkets,
    daysLeft: eventDaysLeft,
    isShortTerm: eventDaysLeft >= 0 && eventDaysLeft <= 2,
  };
}

function transformPriorityMarket(market: RawPriorityMarket, fallbackId: number): EventGroup | null {
  const conditionId = market.conditionId || market.condition_id || "";
  const title = market.question || market.events?.[0]?.title || "";
  const endDate = market.endDate || "";

  if (!conditionId || !title || isExpiredByDate(endDate)) return null;

  const { yesPrice, noPrice, yesTokenId, noTokenId, yesLabel, noLabel } = resolveBinaryOutcomeMapping({
    outcomes: market.outcomes,
    outcomePrices: market.outcomePrices,
    clobTokenIds: market.clobTokenIds,
  });

  return {
    id: conditionId,
    title,
    description: market.description || "",
    image: market.image || market.icon || market.events?.[0]?.image || "",
    slug: market.slug || market.events?.[0]?.slug || "",
    category: categorizeMarket(
      title,
      market.description,
      market.slug,
      market.events?.[0]?.title,
      market.events?.[0]?.slug
    ),
    volume24h: Number(market.volume24hr || 0),
    totalVolume: Number(market.volume || market.volume24hr || 0),
    liquidity: Number(market.liquidity || 0),
    markets: [
      {
        conditionId,
        question: title,
        yesPrice,
        noPrice,
        yesLabel,
        noLabel,
        endDate,
        slug: market.slug || "",
        daysLeft: calculateDaysLeft(endDate),
        yesTokenId,
        noTokenId,
      },
    ],
    daysLeft: calculateDaysLeft(endDate),
    isShortTerm: isShortTermPriorityMarket(market),
  };
}

async function fetchTrendingEventRankMap(targetCount: number): Promise<Map<string, number>> {
  const rankMap = new Map<string, number>();
  const targetRanks = Math.max(targetCount, DEFAULT_EVENTS_LIMIT);

  for (let offset = 0; offset < MAX_TRENDING_MARKET_SCAN && rankMap.size < targetRanks; offset += GAMMA_PAGE_SIZE) {
    const apiUrl = `${POLYMARKET_ENDPOINTS.gamma}/markets?limit=${GAMMA_PAGE_SIZE}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;
    const markets = await fetchPolymarketAPI<RawTrendingMarket[]>(apiUrl);
    if (!Array.isArray(markets) || markets.length === 0) break;

    for (const market of markets) {
      const eventId = market.events?.[0]?.id;
      if (eventId === undefined || eventId === null) continue;

      const key = String(eventId);
      if (!rankMap.has(key)) {
        rankMap.set(key, rankMap.size);
      }

      if (rankMap.size >= targetRanks) break;
    }

    if (markets.length < GAMMA_PAGE_SIZE) break;
  }

  return rankMap;
}

async function fetchPriorityShortTermMarkets(targetCount: number): Promise<EventGroup[]> {
  const results: EventGroup[] = [];
  const seenConditions = new Set<string>();
  const perEventCounts = new Map<string, number>();
  const scanLimit = Math.max(200, targetCount * 12);

  for (let offset = 0; offset < MAX_TRENDING_MARKET_SCAN && results.length < targetCount; offset += GAMMA_PAGE_SIZE) {
    const apiUrl = `${POLYMARKET_ENDPOINTS.gamma}/markets?limit=${GAMMA_PAGE_SIZE}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;
    const markets = await fetchPolymarketAPI<RawPriorityMarket[]>(apiUrl);
    if (!Array.isArray(markets) || markets.length === 0) break;

    for (const market of markets) {
      const conditionId = market.conditionId || market.condition_id || "";
      if (!conditionId || seenConditions.has(conditionId)) continue;
      if (!isShortTermPriorityMarket(market)) continue;

      const eventKey = String(market.events?.[0]?.id || market.events?.[0]?.slug || market.slug || conditionId);
      const existingCount = perEventCounts.get(eventKey) || 0;
      if (existingCount >= SHORT_TERM_PER_EVENT_CAP) continue;

      const transformed = transformPriorityMarket(market, results.length);
      if (!transformed) continue;

      seenConditions.add(conditionId);
      perEventCounts.set(eventKey, existingCount + 1);
      results.push(transformed);

      if (results.length >= targetCount) break;
    }

    if (offset + GAMMA_PAGE_SIZE >= scanLimit) break;
    if (markets.length < GAMMA_PAGE_SIZE) break;
  }

  return results;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = (searchParams.get("search") || "").trim();
  const sortMode = (searchParams.get("sort") || "trending").toLowerCase();
  const scope = (searchParams.get("scope") || "all") as MarketScope;
  const offset = clampNumber(parseInt(searchParams.get("offset") || "0"), 0, MAX_EVENTS_LIMIT);
  const requestedLimit = parseInt(
    searchParams.get("limit") || (search ? String(DEFAULT_SEARCH_LIMIT) : String(DEFAULT_EVENTS_LIMIT))
  );
  const limit = clampNumber(requestedLimit, 1, MAX_EVENTS_LIMIT);

  try {
    const shouldSyncTrending = !search && sortMode === "trending";
    const requestedWindow = Math.min(MAX_EVENTS_LIMIT, offset + limit);
    const candidateLimit = shouldSyncTrending
      ? Math.min(MAX_EVENTS_LIMIT, requestedWindow * TRENDING_CANDIDATE_MULTIPLIER)
      : requestedWindow;

    const events: EventGroup[] = [];
    const seenIds = new Set<string>();
    const seenConditionIds = new Set<string>();
    let trendingRankMap = new Map<string, number>();
    let priorityShortTermMarkets: EventGroup[] = [];

    if (shouldSyncTrending) {
      try {
        trendingRankMap = await fetchTrendingEventRankMap(candidateLimit);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.warn("[Events API] Failed to fetch trending rank map, fallback to volume ranking:", message);
      }

      try {
        const priorityLimit = scope === "short-term"
          ? Math.min(SHORT_TERM_PRIORITY_LIMIT_SCOPE, requestedWindow)
          : Math.min(SHORT_TERM_PRIORITY_LIMIT_ALL, limit);
        priorityShortTermMarkets = await fetchPriorityShortTermMarkets(priorityLimit);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.warn("[Events API] Failed to fetch priority short-term markets:", message);
      }
    }

    for (const market of priorityShortTermMarkets) {
      if (events.length >= candidateLimit) break;
      const primaryConditionId = market.markets[0]?.conditionId;
      if (seenIds.has(market.id) || (primaryConditionId && seenConditionIds.has(primaryConditionId))) continue;
      seenIds.add(market.id);
      if (primaryConditionId) seenConditionIds.add(primaryConditionId);
      events.push(market);
    }

    const insertedPriorityCount = events.length;

    for (let scanOffset = 0; scanOffset < MAX_SEARCH_SCAN_EVENTS && events.length < candidateLimit; scanOffset += GAMMA_PAGE_SIZE) {
      const apiUrl = `${POLYMARKET_ENDPOINTS.gamma}/events?limit=${GAMMA_PAGE_SIZE}&offset=${scanOffset}&active=true&closed=false&order=volume24hr&ascending=false`;
      const rawEvents = await fetchPolymarketAPI<RawEvent[]>(apiUrl);
      if (!Array.isArray(rawEvents) || rawEvents.length === 0) break;

      for (const rawEvent of rawEvents) {
        if (search && !matchesSearch(rawEvent, search)) continue;

        const transformed = transformEvent(rawEvent, events.length);
        if (!transformed || seenIds.has(transformed.id)) continue;
        if (scope === "short-term" && !transformed.isShortTerm) continue;

        const transformedConditions = transformed.markets
          .map((market) => market.conditionId)
          .filter(Boolean);
        if (transformedConditions.some((conditionId) => seenConditionIds.has(conditionId))) {
          continue;
        }

        seenIds.add(transformed.id);
        transformedConditions.forEach((conditionId) => seenConditionIds.add(conditionId));
        events.push(transformed);

        if (events.length >= candidateLimit) break;
      }

      if (rawEvents.length < GAMMA_PAGE_SIZE) break;
    }

    const priorityCount = insertedPriorityCount;
    const rankedEvents = shouldSyncTrending
      ? events
          .map((event, index) => {
            if (index < priorityCount) {
              return {
                ...event,
                trendingRank: index,
              };
            }

            return {
              ...event,
              trendingRank:
                (trendingRankMap.get(String(event.id)) ?? MAX_EVENTS_LIMIT + index) + priorityCount,
            };
          })
          .sort((a, b) => (a.trendingRank || 0) - (b.trendingRank || 0))
      : events.map((event, index) => ({ ...event, trendingRank: index }));

    const pageItems = rankedEvents.slice(offset, offset + limit);
    const hasMore = rankedEvents.length > offset + limit;
    const nextOffset = hasMore ? offset + pageItems.length : null;

    return NextResponse.json(
      {
        items: pageItems,
        hasMore,
        nextOffset,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Events API] Error:", errorMessage);

    return NextResponse.json(
      {
        error: "POLYMARKET_API_UNREACHABLE",
        message: "无法连接到 Polymarket API",
        details: errorMessage,
      },
      { status: 503 }
    );
  }
}
