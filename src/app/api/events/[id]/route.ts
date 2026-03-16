import { NextRequest, NextResponse } from "next/server";

interface EventMarket {
  conditionId: string;
  slug?: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesLabel: string;
  noLabel: string;
  endDate: string;
  daysLeft: number;
  yesTokenId: string;
  noTokenId: string;
}

interface EventDetailResponse {
  id: string;
  slug?: string;
  title: string;
  description: string;
  image: string;
  category: string;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  markets: EventMarket[];
}

function reorderMarkets(markets: EventMarket[], preferredId: string) {
  const preferred = markets.find(
    (market) => market.conditionId === preferredId || market.slug === preferredId
  );
  if (!preferred) return markets;
  return [preferred, ...markets.filter((market) => market !== preferred)];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: "EVENT_NOT_FOUND", message: "事件不存在" },
        { status: 404 }
      );
    }

    const listUrl = new URL("/api/events", request.url);
    listUrl.searchParams.set("limit", "200");
    listUrl.searchParams.set("offset", "0");

    const response = await fetch(listUrl.toString(), {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        {
          error: "EVENT_LOOKUP_FAILED",
          message: "事件列表查询失败",
          details: body.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as {
      items?: EventDetailResponse[];
    };

    const items = Array.isArray(payload.items) ? payload.items : [];
    const matched = items.find(
      (event) =>
        event.id === id ||
        event.slug === id ||
        event.markets?.some((market) => market.conditionId === id || market.slug === id)
    );

    if (!matched) {
      return NextResponse.json(
        { error: "EVENT_NOT_FOUND", message: "事件不存在" },
        { status: 404 }
      );
    }

    const reordered: EventDetailResponse = {
      ...matched,
      markets: reorderMarkets(matched.markets || [], id),
    };

    return NextResponse.json(reordered, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { error: "EVENT_DETAIL_ERROR", message },
      { status: 500 }
    );
  }
}
