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

    // Get market to find token IDs
    const market = await polymarket.getMarket(id);
    const yesToken = market.tokens?.find((t) => t.outcome === "Yes");

    if (!yesToken) {
      return NextResponse.json({ error: "No YES token found" }, { status: 404 });
    }

    const history = await polymarket.getPriceHistory(yesToken.token_id, interval, fidelity);

    // Transform to candlestick format
    const candles = history.map((point, index, arr) => {
      const prevPrice = index > 0 ? arr[index - 1].p : point.p;
      const variation = Math.random() * 0.02; // Simulated OHLC variation
      
      return {
        time: point.t,
        open: prevPrice,
        high: Math.max(point.p, prevPrice) + variation,
        low: Math.min(point.p, prevPrice) - variation,
        close: point.p,
      };
    });

    return NextResponse.json(candles);
  } catch (error) {
    console.error("Price history API error:", error);
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}
