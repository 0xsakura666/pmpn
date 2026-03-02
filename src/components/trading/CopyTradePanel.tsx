"use client";

import { useState } from "react";
import { WhaleScoreBadge } from "../ui/WhaleScore";

interface CopyTradeTarget {
  address: string;
  name?: string;
  whaleScore: number;
  winRate: number;
  totalPnl: number;
}

interface CopyTradeSettings {
  targetAddress: string;
  isActive: boolean;
  mode: "fixed" | "proportional";
  fixedAmount?: number;
  proportionPercent?: number;
  maxPerTrade?: number;
  slippageTolerance: number;
}

interface CopyTradePanelProps {
  target: CopyTradeTarget;
  settings?: CopyTradeSettings;
  onSettingsChange?: (settings: CopyTradeSettings) => void;
  onStartCopying?: () => void;
  onStopCopying?: () => void;
}

export function CopyTradePanel({
  target,
  settings,
  onSettingsChange,
  onStartCopying,
  onStopCopying,
}: CopyTradePanelProps) {
  const [mode, setMode] = useState<"fixed" | "proportional">(settings?.mode || "fixed");
  const [fixedAmount, setFixedAmount] = useState(settings?.fixedAmount?.toString() || "100");
  const [proportionPercent, setProportionPercent] = useState(
    settings?.proportionPercent?.toString() || "10"
  );
  const [maxPerTrade, setMaxPerTrade] = useState(settings?.maxPerTrade?.toString() || "500");
  const [slippage, setSlippage] = useState(settings?.slippageTolerance?.toString() || "2");
  const [isActive, setIsActive] = useState(settings?.isActive || false);

  const handleToggle = () => {
    const newState = !isActive;
    setIsActive(newState);
    if (newState) {
      onStartCopying?.();
    } else {
      onStopCopying?.();
    }
  };

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Target Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--whale)] to-[hsl(var(--primary))] flex items-center justify-center">
            <span className="text-sm font-bold">{target.whaleScore}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{target.name || "匿名"}</span>
              <WhaleScoreBadge score={target.whaleScore} />
            </div>
            <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
              {target.address.slice(0, 10)}...{target.address.slice(-6)}
            </span>
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            isActive ? "bg-[var(--up)]" : "bg-[hsl(var(--muted))]"
          }`}
        >
          <div
            className={`absolute w-5 h-5 rounded-full bg-white top-1 transition-all ${
              isActive ? "left-8" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 py-3 border-y border-[hsl(var(--border))]">
        <div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">胜率</span>
          <div className="text-lg font-semibold text-[var(--up)]">{target.winRate}%</div>
        </div>
        <div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">总盈亏</span>
          <div
            className={`text-lg font-semibold ${
              target.totalPnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"
            }`}
          >
            {target.totalPnl >= 0 ? "+" : ""}${target.totalPnl.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Copy Mode */}
      <div>
        <label className="text-sm text-[hsl(var(--muted-foreground))]">跟单模式</label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={() => setMode("fixed")}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "fixed"
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            固定金额
          </button>
          <button
            onClick={() => setMode("proportional")}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "proportional"
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            比例跟单
          </button>
        </div>
      </div>

      {/* Amount Settings */}
      {mode === "fixed" ? (
        <div>
          <label className="text-sm text-[hsl(var(--muted-foreground))]">
            每笔交易固定金额 (USDC)
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
              $
            </span>
            <input
              type="number"
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--primary))]"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="text-sm text-[hsl(var(--muted-foreground))]">
            跟单比例 (%)
          </label>
          <div className="relative mt-1">
            <input
              type="number"
              value={proportionPercent}
              onChange={(e) => setProportionPercent(e.target.value)}
              min="1"
              max="100"
              className="w-full pr-8 pl-4 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--primary))]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
              %
            </span>
          </div>
        </div>
      )}

      {/* Max per Trade */}
      <div>
        <label className="text-sm text-[hsl(var(--muted-foreground))]">
          单笔最大金额 (USDC)
        </label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
            $
          </span>
          <input
            type="number"
            value={maxPerTrade}
            onChange={(e) => setMaxPerTrade(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--primary))]"
          />
        </div>
      </div>

      {/* Slippage */}
      <div>
        <label className="text-sm text-[hsl(var(--muted-foreground))]">
          滑点容忍度 (%)
        </label>
        <div className="flex gap-2 mt-1">
          {["1", "2", "3", "5"].map((val) => (
            <button
              key={val}
              onClick={() => setSlippage(val)}
              className={`flex-1 py-1.5 rounded text-sm transition-colors ${
                slippage === val
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {val}%
            </button>
          ))}
        </div>
      </div>

      {/* Warning */}
      <div className="p-3 rounded-lg bg-[var(--down)]/10 border border-[var(--down)]/30 text-sm">
        <p className="text-[var(--down)] font-medium">⚠️ 风险提示</p>
        <p className="text-[hsl(var(--muted-foreground))] mt-1 text-xs">
          跟单交易存在风险。过往表现不能保证未来收益。
          请只使用您能承受损失的资金。
        </p>
      </div>

      {/* Status */}
      {isActive && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-[var(--up)] animate-pulse" />
          <span className="text-[var(--up)]">正在跟单中</span>
        </div>
      )}
    </div>
  );
}

export function CopyTradeHistory({
  trades,
}: {
  trades: {
    id: string;
    marketTitle: string;
    side: "buy" | "sell";
    outcome: "yes" | "no";
    amount: number;
    price: number;
    pnl?: number;
    timestamp: Date;
    status: "pending" | "executed" | "failed";
  }[];
}) {
  return (
    <div className="space-y-3">
      <h4 className="font-['Space_Grotesk'] font-semibold">跟单历史</h4>
      {trades.map((trade) => (
        <div
          key={trade.id}
          className="p-3 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-between"
        >
          <div className="flex-1">
            <p className="text-sm font-medium line-clamp-1">{trade.marketTitle}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              <span className={trade.side === "buy" ? "text-[var(--up)]" : "text-[var(--down)]"}>
                {trade.side.toUpperCase()} {trade.outcome.toUpperCase()}
              </span>
              <span>•</span>
              <span>${trade.amount} @ ${trade.price.toFixed(3)}</span>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-sm font-semibold ${
                trade.status === "executed"
                  ? trade.pnl && trade.pnl >= 0
                    ? "text-[var(--up)]"
                    : "text-[var(--down)]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              {trade.status === "executed" && trade.pnl !== undefined
                ? `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`
                : trade.status}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {trade.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
      {trades.length === 0 && (
        <p className="text-center text-[hsl(var(--muted-foreground))] py-4">
          暂无跟单记录
        </p>
      )}
    </div>
  );
}
