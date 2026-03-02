"use client";

interface OrderBookProps {
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  maxDepth?: number;
}

export function OrderBook({ bids, asks, maxDepth = 10 }: OrderBookProps) {
  const displayBids = bids.slice(0, maxDepth);
  const displayAsks = asks.slice(0, maxDepth).reverse();
  
  const maxSize = Math.max(
    ...bids.map((b) => b.size),
    ...asks.map((a) => a.size),
    1
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] px-2">
        <span>价格</span>
        <span>数量</span>
      </div>
      
      {/* Asks (sell orders) */}
      <div className="space-y-0.5">
        {displayAsks.map((ask, i) => (
          <OrderRow
            key={`ask-${i}`}
            price={ask.price}
            size={ask.size}
            maxSize={maxSize}
            type="ask"
          />
        ))}
      </div>
      
      {/* Spread */}
      {displayBids.length > 0 && displayAsks.length > 0 && (
        <div className="text-center py-2 text-xs text-[hsl(var(--muted-foreground))] border-y border-[hsl(var(--border))]">
          价差: ${(displayAsks[displayAsks.length - 1]?.price - displayBids[0]?.price).toFixed(3)}
        </div>
      )}
      
      {/* Bids (buy orders) */}
      <div className="space-y-0.5">
        {displayBids.map((bid, i) => (
          <OrderRow
            key={`bid-${i}`}
            price={bid.price}
            size={bid.size}
            maxSize={maxSize}
            type="bid"
          />
        ))}
      </div>
    </div>
  );
}

function OrderRow({
  price,
  size,
  maxSize,
  type,
}: {
  price: number;
  size: number;
  maxSize: number;
  type: "bid" | "ask";
}) {
  const percentage = (size / maxSize) * 100;
  const bgColor = type === "bid" ? "var(--up)" : "var(--down)";
  const textColor = type === "bid" ? "text-[var(--up)]" : "text-[var(--down)]";

  return (
    <div className="relative flex justify-between items-center px-2 py-1 text-sm font-mono">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: bgColor,
          width: `${percentage}%`,
          [type === "bid" ? "left" : "right"]: 0,
        }}
      />
      <span className={`relative ${textColor}`}>${price.toFixed(3)}</span>
      <span className="relative text-[hsl(var(--foreground))]">
        {size.toLocaleString()}
      </span>
    </div>
  );
}
