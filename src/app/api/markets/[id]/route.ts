import { NextRequest, NextResponse } from "next/server";
import { polymarket } from "@/lib/polymarket";
import { translateToZh } from "@/lib/translate";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";
import { resolveBinaryOutcomeMapping } from "@/lib/binary-outcome";

const GAMMA_PAGE_SIZE = 500;
const MAX_SCAN_EVENTS = 5000;

interface RawGammaMarket {
  conditionId?: string;
  condition_id?: string;
  question?: string;
  description?: string;
  slug?: string;
  endDate?: string;
  image?: string;
  icon?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  negRisk?: boolean;
}

interface RawGammaEvent {
  title?: string;
  description?: string;
  slug?: string;
  image?: string;
  markets?: RawGammaMarket[];
}

interface NormalizedMarketPayload {
  id: string;
  title: string;
  titleOriginal: string;
  description: string;
  descriptionOriginal: string;
  slug: string;
  endDate: string;
  image: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
    winner: boolean;
  }>;
  orderBooks: Array<{
    outcome: string;
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    last_trade_price?: string;
  }>;
  negRisk: boolean;
  tickSize: string;
}

function buildTokens(market: RawGammaMarket) {
  const { yesPrice, noPrice, yesTokenId, noTokenId, yesLabel, noLabel } = resolveBinaryOutcomeMapping({
    outcomes: market.outcomes,
    outcomePrices: market.outcomePrices,
    clobTokenIds: market.clobTokenIds,
  });

  return [
    yesTokenId
      ? { token_id: yesTokenId, outcome: yesLabel, price: yesPrice, winner: false }
      : null,
    noTokenId
      ? { token_id: noTokenId, outcome: noLabel, price: noPrice, winner: false }
      : null,
  ].filter((token): token is NonNullable<typeof token> => token !== null);
}

async function fallbackFindMarketByConditionId(id: string): Promise<NormalizedMarketPayload | null> {
  for (let offset = 0; offset < MAX_SCAN_EVENTS; offset += GAMMA_PAGE_SIZE) {
    const events = await fetchPolymarketAPI<RawGammaEvent[]>(
      `${POLYMARKET_ENDPOINTS.gamma}/events?limit=${GAMMA_PAGE_SIZE}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`
    );

    if (!Array.isArray(events) || events.length === 0) break;

    for (const event of events) {
      const matched = event.markets?.find((market) => {
        const conditionId = market.conditionId || market.condition_id || "";
        return conditionId === id;
      });

      if (!matched) continue;

      return {
        id,
        title: matched.question || event.title || id,
        titleOriginal: matched.question || event.title || id,
        description: matched.description || event.description || "",
        descriptionOriginal: matched.description || event.description || "",
        slug: matched.slug || event.slug || "",
        endDate: matched.endDate || "",
        image: matched.image || matched.icon || event.image || "",
        tokens: buildTokens(matched),
        orderBooks: [],
        negRisk: Boolean(matched.negRisk),
        tickSize: "0.01",
      };
    }

    if (events.length < GAMMA_PAGE_SIZE) break;
  }

  return null;
}


function parseBookUnitPrice(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return null;
  return parsed;
}

function derivePriceFromOrderBook(book: { bids?: Array<{ price: string }>; asks?: Array<{ price: string }>; last_trade_price?: string }): number | null {
  const lastTrade = parseBookUnitPrice(book.last_trade_price);
  if (lastTrade !== null) return lastTrade;

  const bestBid = parseBookUnitPrice(book.bids?.[0]?.price);
  const bestAsk = parseBookUnitPrice(book.asks?.[0]?.price);

  if (bestBid !== null && bestAsk !== null) {
    return (bestBid + bestAsk) / 2;
  }

  return bestBid ?? bestAsk ?? null;
}

function enrichTokenPricesFromBooks(
  tokens: NormalizedMarketPayload["tokens"],
  orderBooks: NormalizedMarketPayload["orderBooks"]
) {
  return tokens.map((token) => {
    const matchingBook = orderBooks.find((book) => book.outcome === token.outcome);
    const livePrice = matchingBook ? derivePriceFromOrderBook(matchingBook) : null;
    return livePrice !== null ? { ...token, price: livePrice } : token;
  });
}

async function buildOrderBooks(tokens: NormalizedMarketPayload["tokens"]) {
  return Promise.all(
    tokens.map(async (token) => {
      try {
        const book = await polymarket.getOrderBook(token.token_id);
        return { outcome: token.outcome, ...book };
      } catch {
        return { outcome: token.outcome, bids: [], asks: [] };
      }
    })
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const locale = searchParams.get("locale") || "zh";

    let payload: NormalizedMarketPayload | null = null;

    const market = await polymarket.getMarket(id);
    if (market) {
      payload = {
        id: market.condition_id,
        title: market.question,
        titleOriginal: market.question,
        description: market.description,
        descriptionOriginal: market.description,
        slug: market.market_slug,
        endDate: market.end_date_iso,
        image: market.image || market.icon,
        tokens: market.tokens,
        orderBooks: [],
        negRisk: market.neg_risk || false,
        tickSize: "0.01",
      };
    }

    if (!payload) {
      payload = await fallbackFindMarketByConditionId(id);
    }

    if (!payload) {
      return NextResponse.json(
        { error: "MARKET_NOT_FOUND", message: "市场不存在" },
        { status: 404 }
      );
    }

    payload.orderBooks = await buildOrderBooks(payload.tokens);
    payload.tokens = enrichTokenPricesFromBooks(payload.tokens, payload.orderBooks);

    if (locale === "zh") {
      try {
        const [title, description] = await Promise.all([
          translateToZh(payload.titleOriginal),
          translateToZh(payload.descriptionOriginal),
        ]);
        payload.title = title;
        payload.description = description;
      } catch {
        // ignore translation failures
      }
    }

    return NextResponse.json(payload);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Market detail API error:", errorMessage);

    return NextResponse.json(
      {
        error: "API_ERROR",
        message: "无法获取市场详情",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
