import { NextRequest, NextResponse } from "next/server";
import { polymarket } from "@/lib/polymarket";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const interval = searchParams.get("interval") || "1h";
    const fidelity = parseInt(searchParams.get("fidelity") || "60");
    let tokenId = searchParams.get("tokenId");

    // If no tokenId provided, get market to find YES token
    if (!tokenId) {
      const market = await polymarket.getMarket(id);
      if (!market) {
        return NextResponse.json({ error: "Market not found" }, { status: 404 });
      }
      
      const yesToken = market.tokens?.find((t) => t.outcome === "Yes");
      if (!yesToken) {
        return NextResponse.json({ error: "No YES token found" }, { status: 404 });
      }
      tokenId = yesToken.token_id;
    }

    const history = await polymarket.getPriceHistory(tokenId, interval, fidelity);

    // Transform to candlestick format
    const candles = history.map((point, index, arr) => {
      const prevPrice = index > 0 ? arr[index - 1].p : point.p;
      const variation = Math.random() * 0.02;

      return {
        time: point.t,
        open: prevPrice,
        high: Math.max(point.p, prevPrice) + variation,
        low: Math.min(point.p, prevPrice) - variation,
        close: point.p,
      };
    });

    return NextResponse.json({
      history,
      candles,
    });
  } catch (error) {
    console.error("Price history API error:", error);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
