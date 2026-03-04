import { NextRequest, NextResponse } from "next/server";
import { fetchPolymarketAPI, POLYMARKET_ENDPOINTS } from "@/lib/polymarket-api";

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

    const url = `${POLYMARKET_ENDPOINTS.clob}/book?token_id=${encodeURIComponent(tokenId)}`;
    const orderbook = await fetchPolymarketAPI<OrderBookData>(url);

    return NextResponse.json(orderbook);
  } catch (error) {
    console.error("OrderBook API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch orderbook" },
      { status: 500 }
    );
  }
}
