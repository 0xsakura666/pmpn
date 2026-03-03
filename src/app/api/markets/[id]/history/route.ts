import { NextRequest, NextResponse } from "next/server";

const CLOB_API = "https://clob.polymarket.com";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const interval = searchParams.get("interval") || "max";
    const fidelity = parseInt(searchParams.get("fidelity") || "60");
    let tokenId = searchParams.get("tokenId");

    console.log(`[Price History] Request for market: ${id}, tokenId: ${tokenId}`);

    // If no tokenId provided, try to get it from CLOB API
    if (!tokenId) {
      try {
        const marketRes = await fetch(`${CLOB_API}/markets/${id}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (marketRes.ok) {
          const market = await marketRes.json();
          const yesToken = market.tokens?.find((t: { outcome: string }) => t.outcome === "Yes");
          if (yesToken) {
            tokenId = yesToken.token_id;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch market for token ID:", e);
      }
    }

    if (!tokenId) {
      console.warn("[Price History] No tokenId available");
      return NextResponse.json({ history: [], candles: [] });
    }

    // Fetch price history directly from CLOB API
    const url = `${CLOB_API}/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`;
    console.log(`[Price History] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Price History] API error: ${response.status} - ${errorText}`);
      return NextResponse.json({ history: [], candles: [] });
    }

    const data = await response.json();
    console.log(`[Price History] Response type:`, typeof data, Array.isArray(data) ? `array(${data.length})` : "object");

    // Handle both array and { history: [...] } response formats
    let history: Array<{ t: number; p: number }> = [];
    if (Array.isArray(data)) {
      history = data;
    } else if (data.history && Array.isArray(data.history)) {
      history = data.history;
    }

    if (history.length === 0) {
      console.log("[Price History] No history data returned");
      return NextResponse.json({ history: [], candles: [] });
    }

    console.log(`[Price History] Got ${history.length} data points`);

    // Transform to candlestick format
    const candles = history.map((point, index, arr) => {
      const prevPrice = index > 0 ? arr[index - 1].p : point.p;
      const variation = Math.random() * 0.01;

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
    return NextResponse.json({ history: [], candles: [] });
  }
}
