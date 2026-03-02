"use client";

import { WhaleScoreBadge } from "./WhaleScore";

interface Signal {
  id: string;
  address: string;
  action: "buy" | "sell";
  outcome: "yes" | "no";
  marketTitle: string;
  price: number;
  size: number;
  total: number;
  whaleScore: number;
  timestamp: Date;
}

interface LiveSignalCardProps {
  signal: Signal;
  onClick?: () => void;
}

export function LiveSignalCard({ signal, onClick }: LiveSignalCardProps) {
  const isBuy = signal.action === "buy";
  const timeAgo = getTimeAgo(signal.timestamp);

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] ${
        isBuy
          ? "border-[var(--up)]/30 bg-[var(--up)]/5 hover:bg-[var(--up)]/10"
          : "border-[var(--down)]/30 bg-[var(--down)]/5 hover:bg-[var(--down)]/10"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              isBuy ? "bg-[var(--up)]/20 text-[var(--up)]" : "bg-[var(--down)]/20 text-[var(--down)]"
            }`}
          >
            {isBuy ? "B" : "S"}
          </div>
          <div>
            <span className="font-mono text-sm">{truncateAddress(signal.address)}</span>
            <WhaleScoreBadge score={signal.whaleScore} />
          </div>
        </div>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{timeAgo}</span>
      </div>

      <p className="text-sm mb-2 line-clamp-2">{signal.marketTitle}</p>

      <div className="flex items-center justify-between text-sm">
        <span className={isBuy ? "text-[var(--up)]" : "text-[var(--down)]"}>
          {isBuy ? "买入" : "卖出"} {signal.outcome.toUpperCase()}
        </span>
        <div className="text-right">
          <span className="font-mono font-semibold">${signal.total.toLocaleString()}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">
            @ ${signal.price.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SignalFeed({
  signals,
  maxItems = 10,
}: {
  signals: Signal[];
  maxItems?: number;
}) {
  const displaySignals = signals.slice(0, maxItems);

  return (
    <div className="space-y-3">
      {displaySignals.map((signal, index) => (
        <div
          key={signal.id}
          className="animate-in slide-in-from-top duration-300"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <LiveSignalCard signal={signal} />
        </div>
      ))}
      {signals.length === 0 && (
        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
          暂无信号
        </div>
      )}
    </div>
  );
}

export function LiveSignalTicker({ signals }: { signals: Signal[] }) {
  return (
    <div className="overflow-hidden">
      <div className="flex animate-scroll gap-4">
        {signals.concat(signals).map((signal, i) => (
          <div
            key={`${signal.id}-${i}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap ${
              signal.action === "buy"
                ? "bg-[var(--up)]/10 border border-[var(--up)]/30"
                : "bg-[var(--down)]/10 border border-[var(--down)]/30"
            }`}
          >
            <span className="font-mono text-xs">{truncateAddress(signal.address)}</span>
            <span className={signal.action === "buy" ? "text-[var(--up)]" : "text-[var(--down)]"}>
              {signal.action === "buy" ? "▲" : "▼"}
            </span>
            <span className="text-xs font-semibold">${signal.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTimeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
