import { NextRequest, NextResponse } from "next/server";

const CLOB_API = "https://clob.polymarket.com";
const CORS_PROXY = "https://api.codetabs.com/v1/proxy/?quest=";

export interface OrderBookData {
  market: string;
  asset_id: string;
  hash: string;
  timestamp: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  min_order_size: string;
  tick_size: string;
  neg_risk: boolean;
  last_trade_price: string;
}

async function fetchWithProxy<T>(url: string): Promise<T> {
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("token_id");

    if (!tokenId) {
      return NextResponse.json(
        { error: "Missing required parameter: token_id" },
        { status: 400 }
      );
    }

    const url = `${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`;
    const orderbook = await fetchWithProxy<OrderBookData>(url);

    return NextResponse.json(orderbook);
  } catch (error) {
    console.error("OrderBook API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch orderbook" },
      { status: 500 }
    );
  }
}
