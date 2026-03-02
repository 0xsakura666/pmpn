import { NextRequest, NextResponse } from "next/server";
import { polymarket } from "@/lib/polymarket";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const category = searchParams.get("category");

    // 从 Polymarket API 获取真实市场数据
    const markets = await polymarket.getMarkets(limit, offset);

    const transformedMarkets = markets.map((market) => {
        const title = market.question;
        const description = market.description;

        return {
          id: market.condition_id,
          title,
          titleOriginal: market.question,
          description,
          descriptionOriginal: market.description,
          slug: market.market_slug,
          category: categorizeMarket(market.question),
          endDate: market.end_date_iso,
          image: market.image || market.icon,
          yesPrice: market.tokens?.find((t) => t.outcome === "Yes")?.price || 0.5,
          noPrice: market.tokens?.find((t) => t.outcome === "No")?.price || 0.5,
          tokens: market.tokens,
          volume24h: 0,
          liquidity: 0,
        };
      });

    // Filter by category if specified
    const filtered = category
      ? transformedMarkets.filter((m) => m.category.toLowerCase() === category.toLowerCase())
      : transformedMarkets;

    return NextResponse.json(filtered);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Polymarket API failed:", errorMessage);

    return NextResponse.json({
      error: "POLYMARKET_API_UNREACHABLE",
      message: "无法连接到 Polymarket API。请检查您的 VPN 连接或网络设置。",
      details: errorMessage,
    }, { status: 503 });
  }
}

function categorizeMarket(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("trump") || q.includes("biden") || q.includes("election") || q.includes("president") || q.includes("vote") || q.includes("congress") || q.includes("senate")) {
    return "政治";
  }
  if (q.includes("crypto") || q.includes("bitcoin") || q.includes("ethereum") || q.includes("btc") || q.includes("eth") || q.includes("sol") || q.includes("coin")) {
    return "加密货币";
  }
  if (q.includes("sports") || q.includes("nba") || q.includes("nfl") || q.includes("game") || q.includes("super bowl") || q.includes("champion") || q.includes("win")) {
    return "体育";
  }
  if (q.includes("economy") || q.includes("fed") || q.includes("inflation") || q.includes("gdp") || q.includes("rate") || q.includes("recession")) {
    return "经济";
  }
  if (q.includes("ai") || q.includes("openai") || q.includes("gpt") || q.includes("tech") || q.includes("apple") || q.includes("google") || q.includes("microsoft")) {
    return "科技";
  }
  return "其他";
}
