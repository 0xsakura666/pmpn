import { NextRequest, NextResponse } from "next/server";
import { polymarket } from "@/lib/polymarket";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get("user");

    if (!userAddress) {
      return NextResponse.json(
        { error: "Missing required parameter: user" },
        { status: 400 }
      );
    }

    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const market = searchParams.get("market");
    const sizeThreshold = searchParams.get("sizeThreshold");

    const positions = await polymarket.getPositions(userAddress, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      market: market || undefined,
      sizeThreshold: sizeThreshold ? parseFloat(sizeThreshold) : undefined,
    });

    return NextResponse.json(positions);
  } catch (error) {
    console.error("Positions API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
