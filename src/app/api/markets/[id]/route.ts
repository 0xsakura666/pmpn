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
      return NextResponse.json(
        { error: "MARKET_NOT_FOUND", message: "市场不存在" },
        { status: 404 }
      );
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
      try {
        [title, description] = await Promise.all([
          translateToZh(market.question),
          translateToZh(market.description),
        ]);
      } catch {
        // 翻译失败使用原文
      }
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
      negRisk: market.neg_risk || false,
      tickSize: "0.01",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Market detail API error:", errorMessage);
    
    return NextResponse.json(
      { 
        error: "API_ERROR", 
        message: "无法获取市场详情",
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
