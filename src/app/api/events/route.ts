import { NextRequest, NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";

interface RawMarket {
  conditionId?: string;
  condition_id?: string;
  question?: string;
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

async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; TectonicBot/1.0)",
      },
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    const apiUrl = `${GAMMA_API}/events?limit=${limit}&active=true&closed=false&order=volume24hr&ascending=false`;

    console.log("[Events API] Fetching from:", apiUrl);

    const res = await fetchWithTimeout(apiUrl);

    if (!res.ok) {
      console.error("[Events API] Failed:", res.status);
      throw new Error(`API error: ${res.status}`);
    }

    const rawEvents: RawEvent[] = await res.json();
    console.log("[Events API] Got", rawEvents.length, "events");

    const events = [];

    for (const event of rawEvents) {
      const eventMarkets = event.markets;
      if (!Array.isArray(eventMarkets) || eventMarkets.length === 0) continue;

      const title = event.title || "";
      const eventEndDate = event.endDate || "";
      const volume24h = parseFloat(event.volume24hr || "0");

      if (isExpiredByDate(eventEndDate)) continue;

      const subMarkets = [];
      for (const m of eventMarkets) {
        const endDate = m.endDate || eventEndDate || "";
        if (isExpiredByDate(endDate)) continue;

        let yesPrice = 0.5;
        let yesTokenId = "";
        let noTokenId = "";
        try {
          if (m.outcomePrices) {
            yesPrice = parseFloat(JSON.parse(m.outcomePrices)[0]) || 0.5;
          }
          if (m.clobTokenIds) {
            const tokenIds = JSON.parse(m.clobTokenIds);
            yesTokenId = tokenIds[0] || "";
            noTokenId = tokenIds[1] || "";
          }
        } catch {}

        subMarkets.push({
          conditionId: m.conditionId || m.condition_id || "",
          question: m.question || title,
          yesPrice,
          noPrice: 1 - yesPrice,
          endDate,
          slug: m.slug || "",
          daysLeft: calculateDaysLeft(endDate),
          yesTokenId,
          noTokenId,
        });
      }

      if (subMarkets.length === 0) continue;

      const validDaysLeft = subMarkets.filter((m) => m.daysLeft > 0).map((m) => m.daysLeft);
      const eventDaysLeft = validDaysLeft.length > 0 ? Math.min(...validDaysLeft) : 30;

      events.push({
        id: event.id || subMarkets[0]?.conditionId || `evt-${events.length}`,
        title,
        description: event.description || "",
        image: event.image || "",
        slug: event.slug || "",
        category: categorizeMarket(title),
        volume24h,
        totalVolume: parseFloat(event.volume || "0"),
        liquidity: parseFloat(event.liquidity || "0"),
        markets: subMarkets,
        daysLeft: eventDaysLeft,
      });
    }

    console.log("[Events API] Returning", events.length, "active events");

    return NextResponse.json(events, {
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
