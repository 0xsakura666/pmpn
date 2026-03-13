import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";
import { resolveBinaryOutcomeMapping } from "@/lib/binary-outcome";
import { categorizeMarket } from "@/lib/market-category";

const GAMMA_PAGE_SIZE = 500;
const DEFAULT_EVENTS_LIMIT = 500;
const DEFAULT_SEARCH_LIMIT = 200;
const MAX_EVENTS_LIMIT = 5000;
const MAX_SEARCH_SCAN_EVENTS = 5000;
const TRENDING_CANDIDATE_MULTIPLIER = 3;
const MAX_TRENDING_MARKET_SCAN = 5000;

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
  markets: Array<{
    conditionId: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    endDate: string;
    slug: string;
    daysLeft: number;
    yesTokenId: string;
    noTokenId: string;
  }>;
  daysLeft: number;
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

    const { yesPrice, noPrice, yesTokenId, noTokenId } = resolveBinaryOutcomeMapping({
      outcomes: m.outcomes,
      outcomePrices: m.outcomePrices,
      clobTokenIds: m.clobTokenIds,
    });

    subMarkets.push({
      conditionId: m.conditionId || m.condition_id || "",
      question: m.question || title,
      yesPrice,
      noPrice,
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = (searchParams.get("search") || "").trim();
  const sortMode = (searchParams.get("sort") || "trending").toLowerCase();
  const requestedLimit = parseInt(
    searchParams.get("limit") || (search ? String(DEFAULT_SEARCH_LIMIT) : String(DEFAULT_EVENTS_LIMIT))
  );
  const limit = clampNumber(requestedLimit, 1, MAX_EVENTS_LIMIT);

  try {
    const shouldSyncTrending = !search && sortMode === "trending";
    const candidateLimit = shouldSyncTrending ? Math.min(MAX_EVENTS_LIMIT, limit * TRENDING_CANDIDATE_MULTIPLIER) : limit;
    const events: EventGroup[] = [];
    const seenIds = new Set<string>();
    let trendingRankMap = new Map<string, number>();

    if (shouldSyncTrending) {
      try {
        trendingRankMap = await fetchTrendingEventRankMap(candidateLimit);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.warn("[Events API] Failed to fetch trending rank map, fallback to volume ranking:", message);
      }
    }

    for (let offset = 0; offset < MAX_SEARCH_SCAN_EVENTS && events.length < candidateLimit; offset += GAMMA_PAGE_SIZE) {
      const apiUrl = `${POLYMARKET_ENDPOINTS.gamma}/events?limit=${GAMMA_PAGE_SIZE}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;
      const rawEvents = await fetchPolymarketAPI<RawEvent[]>(apiUrl);
      if (!Array.isArray(rawEvents) || rawEvents.length === 0) break;

      for (const rawEvent of rawEvents) {
        if (search && !matchesSearch(rawEvent, search)) continue;

        const transformed = transformEvent(rawEvent, events.length);
        if (!transformed || seenIds.has(transformed.id)) continue;
        seenIds.add(transformed.id);
        events.push(transformed);

        if (events.length >= candidateLimit) break;
      }

      if (rawEvents.length < GAMMA_PAGE_SIZE) break;
    }

    const rankedEvents =
      shouldSyncTrending && trendingRankMap.size > 0
        ? events
            .map((event, index) => ({
              ...event,
              trendingRank: trendingRankMap.get(String(event.id)) ?? MAX_EVENTS_LIMIT + index,
            }))
            .sort((a, b) => (a.trendingRank || 0) - (b.trendingRank || 0))
        : events.map((event, index) => ({ ...event, trendingRank: index }));

    const finalEvents = rankedEvents.slice(0, limit);
    console.log(
      "[Events API] Returning",
      finalEvents.length,
      "events",
      search ? `(search=${search})` : "",
      shouldSyncTrending ? "(synced-trending)" : ""
    );

    return NextResponse.json(finalEvents, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
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
