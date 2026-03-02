import { NextRequest, NextResponse } from "next/server";
import { polymarket } from "@/lib/polymarket";
import { translateToZh } from "@/lib/translate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const locale = searchParams.get("locale") || "zh";
    
    const market = await polymarket.getMarket(id);

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Get order book for each token
    const orderBooks = await Promise.all(
      (market.tokens || []).map(async (token) => {
        try {
          const book = await polymarket.getOrderBook(token.token_id);
          return { outcome: token.outcome, ...book };
        } catch {
          return { outcome: token.outcome, bids: [], asks: [] };
        }
      })
    );

    // 翻译标题和描述
    let title = market.question;
    let description = market.description;
    
    if (locale === "zh") {
      [title, description] = await Promise.all([
        translateToZh(market.question),
        translateToZh(market.description),
      ]);
    }

    return NextResponse.json({
      id: market.condition_id,
      title,
      titleOriginal: market.question,
      description,
      descriptionOriginal: market.description,
      slug: market.market_slug,
      endDate: market.end_date_iso,
      image: market.image || market.icon,
      tokens: market.tokens,
      orderBooks,
    });
  } catch (error) {
    console.error("Market detail API error:", error);
    return NextResponse.json({ error: "Failed to fetch market" }, { status: 500 });
  }
}
