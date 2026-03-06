import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";
import { resolveBinaryOutcomeMapping } from "@/lib/binary-outcome";

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

function isExpiredByDate(endDate: string): boolean {
  if (!endDate) return false;
  const endTime = new Date(endDate).getTime();
  if (Number.isNaN(endTime)) return false;
  return endTime < Date.now();
}

function calculateDaysLeft(endDate: string): number {
  if (!endDate) return -1;
  const endTime = new Date(endDate).getTime();
  if (Number.isNaN(endTime)) return -1;
  return Math.ceil((endTime - Date.now()) / 86400000);
}

function categorizeMarket(question: string): string {
  const q = question.toLowerCase();
  if (/trump|biden|election|president|vote|congress|senate|iran|iranian|israel|gaza|ukraine|russia|war|regime|military|sanctions|geopolitics|china|taiwan|governor|republican|democrat|kamala|harris/.test(q)) {
    return "政治";
  }
  if (/crypto|bitcoin|ethereum|btc|eth|sol|coin|defi|nft|solana|xrp|doge/.test(q)) {
    return "加密";
  }
  if (/sport|nba|nfl|soccer|football|tennis|championship|playoffs|game|match|team|player|super bowl|champion/.test(q)) {
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const apiUrl = `${POLYMARKET_ENDPOINTS.gamma}/events/${encodeURIComponent(id)}`;
    const rawEvent = await fetchPolymarketAPI<RawEvent>(apiUrl);

    const eventMarkets = rawEvent.markets;
    if (!Array.isArray(eventMarkets) || eventMarkets.length === 0) {
      return NextResponse.json(
        { error: "EVENT_NOT_FOUND", message: "事件不存在" },
        { status: 404 }
      );
    }

    const title = rawEvent.title || "";
    const eventEndDate = rawEvent.endDate || "";
    if (isExpiredByDate(eventEndDate)) {
      return NextResponse.json(
        { error: "EVENT_EXPIRED", message: "事件已过期" },
        { status: 404 }
      );
    }

    const markets = [];
    for (const market of eventMarkets) {
      const endDate = market.endDate || eventEndDate || "";
      if (isExpiredByDate(endDate)) continue;

      const { yesPrice, noPrice, yesTokenId, noTokenId } = resolveBinaryOutcomeMapping({
        outcomes: market.outcomes,
        outcomePrices: market.outcomePrices,
        clobTokenIds: market.clobTokenIds,
      });

      markets.push({
        conditionId: market.conditionId || market.condition_id || "",
        question: market.question || title,
        yesPrice,
        noPrice,
        endDate,
        slug: market.slug || "",
        daysLeft: calculateDaysLeft(endDate),
        yesTokenId,
        noTokenId,
      });
    }

    if (markets.length === 0) {
      return NextResponse.json(
        { error: "EVENT_NOT_FOUND", message: "事件不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        id: rawEvent.id || id,
        title,
        description: rawEvent.description || "",
        image: rawEvent.image || "",
        slug: rawEvent.slug || "",
        category: categorizeMarket(title),
        volume24h: parseFloat(rawEvent.volume24hr || "0"),
        totalVolume: parseFloat(rawEvent.volume || "0"),
        liquidity: parseFloat(rawEvent.liquidity || "0"),
        markets,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Event API] Error:", errorMessage);
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
