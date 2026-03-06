import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";

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

          let yesPrice = 0.5;
          let yesTokenId = "";
          let noTokenId = "";

          try {
            if (market.outcomePrices) {
              yesPrice = parseFloat(JSON.parse(market.outcomePrices)[0]) || 0.5;
            }
            if (market.clobTokenIds) {
              const tokenIds = JSON.parse(market.clobTokenIds);
              yesTokenId = tokenIds[0] || "";
              noTokenId = tokenIds[1] || "";
            }
          } catch {
            // Ignore malformed token payloads from upstream API
          }

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
            category: categorizeMarket(question),
            endDate,
            image: (event.image || "") as string,
            yesPrice,
            noPrice: 1 - yesPrice,
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

function categorizeMarket(question: string): string {
  const q = question.toLowerCase();
  if (/trump|biden|election|president|vote|congress|senate|iran|iranian|israel|gaza|ukraine|russia|war|regime|military|sanctions|geopolitics|china|taiwan|governor|republican|democrat|kamala|harris/.test(q)) {
    return "政治";
  }
  if (/crypto|bitcoin|ethereum|btc|eth|sol|coin|defi|nft|solana|xrp|doge/.test(q)) {
    return "加密货币";
  }
  if (/sport|nba|nfl|soccer|football|tennis|championship|playoffs|game|match|team|player|super bowl|champion|win/.test(q)) {
    return "体育";
  }
  if (/economy|fed|inflation|gdp|rate|recession|unemployment|oil|gold|stock|market/.test(q)) {
    return "经济";
  }
  if (/ai|openai|gpt|tech|apple|google|microsoft|nvidia|tesla|meta|amazon|software|startup/.test(q)) {
    return "科技";
  }
  if (/movie|oscar|grammy|music|celebrity|tv|show|netflix|disney|streaming/.test(q)) {
    return "娱乐";
  }
  return "其他";
}
