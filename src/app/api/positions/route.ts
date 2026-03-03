import { NextRequest, NextResponse } from "next/server";

const DATA_API = "https://data-api.polymarket.com";

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

    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";
    const sizeThreshold = searchParams.get("sizeThreshold") || "0";

    const params = new URLSearchParams({
      user: userAddress,
      limit,
      offset,
      sizeThreshold,
    });

    console.log(`[Positions API] Fetching for user: ${userAddress}`);
    
    const response = await fetch(`${DATA_API}/positions?${params.toString()}`, {
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Positions API] Error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `Data API error: ${response.status}`, positions: [] },
        { status: response.status }
      );
    }

    const positions = await response.json();
    console.log(`[Positions API] Found ${Array.isArray(positions) ? positions.length : 0} positions`);
    
    return NextResponse.json(positions);
  } catch (error) {
    console.error("Positions API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions", positions: [] },
      { status: 500 }
    );
  }
}
