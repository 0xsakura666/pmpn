import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";
import { resolveBinaryOutcomeMapping } from "@/lib/binary-outcome";
import { categorizeMarket } from "@/lib/market-category";

const GAMMA_PAGE_SIZE = 500;
const DEFAULT_MARKETS_LIMIT = 800;
const MAX_MARKETS_LIMIT = 5000;
const MAX_SCAN_EVENTS = 5000;

interface RawMarket {
  conditionId?: string;
  condition_id?: string;
  question?: string;
  description?: string;
  slug?: string;
  endDate?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  minimum_tick_size?: string;
  negRisk?: boolean;
}

interface RawEvent {
  title?: string;
  description?: string;
  slug?: string;
  image?: string;
  endDate?: string;
  volume24hr?: string;
  volume?: string;
  liquidity?: string;
  markets?: RawMarket[];
}

interface TransformedMarket {
  id: string;
  conditionId: string;
  title: string;
  question: string;
  description: string;
  slug: string;
  category: string;
  endDate: string;
  image: string;
  yesPrice: number;
  noPrice: number;
  yesLabel: string;
  noLabel: string;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  yesTokenId: string;
  noTokenId: string;
  tickSize: string;
  negRisk: boolean;
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function matchesSearch(event: RawEvent, market: RawMarket, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const title = (market.question || event.title || "").toLowerCase();
  const description = (market.description || event.description || "").toLowerCase();
  const slug = (market.slug || event.slug || "").toLowerCase();
  return title.includes(q) || description.includes(q) || slug.includes(q);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = (searchParams.get("search") || "").trim();
  const requestedLimit = parseInt(searchParams.get("limit") || String(DEFAULT_MARKETS_LIMIT));
  const limit = clampNumber(requestedLimit, 1, MAX_MARKETS_LIMIT);

  try {
    const markets: TransformedMarket[] = [];
    const seenConditionIds = new Set<string>();
    const now = Date.now();

    for (let offset = 0; offset < MAX_SCAN_EVENTS && markets.length < limit; offset += GAMMA_PAGE_SIZE) {
      const apiUrl = `${POLYMARKET_ENDPOINTS.gamma}/events?limit=${GAMMA_PAGE_SIZE}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;
      const events = await fetchPolymarketAPI<RawEvent[]>(apiUrl);
      if (!Array.isArray(events) || events.length === 0) break;

      for (const event of events) {
        const eventMarkets = event.markets;
        if (!Array.isArray(eventMarkets) || eventMarkets.length === 0) continue;

        for (const market of eventMarkets) {
          if (!matchesSearch(event, market, search)) continue;

          const endDate = (market.endDate || event.endDate || "") as string;
          if (endDate && new Date(endDate).getTime() < now) continue;

          const { yesPrice, noPrice, yesTokenId, noTokenId, yesLabel, noLabel } = resolveBinaryOutcomeMapping({
            outcomes: market.outcomes,
            outcomePrices: market.outcomePrices,
            clobTokenIds: market.clobTokenIds,
          });

          const conditionId = (market.conditionId || market.condition_id || "") as string;
          if (!conditionId || seenConditionIds.has(conditionId)) continue;
          seenConditionIds.add(conditionId);

          const question = (market.question || event.title || "") as string;
          markets.push({
            id: conditionId,
            conditionId,
            title: question,
            question,
            description: (market.description || event.description || "") as string,
            slug: (market.slug || event.slug || "") as string,
            category: categorizeMarket(
              question,
              market.description,
              event.description,
              market.slug,
              event.slug
            ),
            endDate,
            image: (event.image || "") as string,
            yesPrice,
            noPrice,
            yesLabel,
            noLabel,
            volume24h: parseFloat((event.volume24hr as string) || "0"),
            totalVolume: parseFloat((event.volume as string) || "0"),
            liquidity: parseFloat((event.liquidity as string) || "0"),
            yesTokenId,
            noTokenId,
            tickSize: market.minimum_tick_size || "0.01",
            negRisk: Boolean(market.negRisk),
          });

          if (markets.length >= limit) break;
        }

        if (markets.length >= limit) break;
      }

      if (events.length < GAMMA_PAGE_SIZE) break;
    }

    return NextResponse.json(markets.slice(0, limit), {
      headers: {
        "Cache-Control": search ? "public, s-maxage=30, stale-while-revalidate=60" : "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Polymarket markets API failed:", errorMessage);

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
