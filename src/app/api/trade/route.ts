import { NextRequest, NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { 
      error: "Trading is handled client-side. Use the Polymarket hooks from @/hooks/usePolymarket" 
    },
    { status: 400 }
  );
}

export async function GET() {
  return NextResponse.json(
    { 
      error: "Orders are fetched client-side. Use the usePolymarketOrders hook from @/hooks/usePolymarket" 
    },
    { status: 400 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { 
      error: "Order cancellation is handled client-side. Use the usePolymarketOrders hook from @/hooks/usePolymarket" 
    },
    { status: 400 }
  );
}
