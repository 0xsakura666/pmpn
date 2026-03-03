import { NextRequest, NextResponse } from "next/server";

const GAMMA_API = "https://gamma-api.polymarket.com";

const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

interface TransformedMarket {
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
}

async function fetchWithTimeout(url: string, timeout = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function fetchWithProxies(apiUrl: string): Promise<unknown[]> {
  // 首先尝试直连
  try {
    const res = await fetchWithTimeout(apiUrl, 8000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {}

  // 直连失败，尝试代理
  for (const makeProxy of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxy(apiUrl);
      const res = await fetchWithTimeout(proxyUrl, 12000);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch {
      continue;
    }
  }
  
  throw new Error("All methods failed");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const apiUrl = `${GAMMA_API}/events?limit=${limit}&active=true&closed=false`;
    
    const events = await fetchWithProxies(apiUrl);

    const markets: TransformedMarket[] = [];
    
    const now = Date.now();
    
    for (const event of events as Record<string, unknown>[]) {
      const eventMarkets = event.markets as Record<string, unknown>[] | undefined;
      if (eventMarkets && Array.isArray(eventMarkets)) {
        for (const market of eventMarkets) {
          const endDate = (market.endDate || event.endDate || "") as string;
          
          // Skip markets that have already ended
          if (endDate && new Date(endDate).getTime() < now) continue;
          
          let yesPrice = 0.5;
          try {
            if (market.outcomePrices) {
              yesPrice = parseFloat(JSON.parse(market.outcomePrices as string)[0]) || 0.5;
            }
          } catch {}
          
          const conditionId = (market.conditionId || market.condition_id || "") as string;
          
          markets.push({
            id: conditionId,
            conditionId,
            title: (market.question || event.title || "") as string,
            description: (market.description || event.description || "") as string,
            slug: (market.slug || event.slug || "") as string,
            category: categorizeMarket((market.question || event.title || "") as string),
            endDate,
            image: (event.image || "") as string,
            yesPrice,
            noPrice: 1 - yesPrice,
            volume24h: parseFloat((event.volume24hr as string) || "0"),
            totalVolume: parseFloat((event.volume as string) || "0"),
            liquidity: parseFloat((event.liquidity as string) || "0"),
          });
        }
      }
    }

    return NextResponse.json(markets, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Polymarket API failed:", errorMessage);

    return NextResponse.json({
      error: "POLYMARKET_API_UNREACHABLE",
      message: "无法连接到 Polymarket API",
      details: errorMessage,
    }, { status: 503 });
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
