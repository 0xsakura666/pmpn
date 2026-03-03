"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/auth/ConnectWallet";
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  Wallet,
  History,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface Position {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  curPrice: number;
  title: string;
  slug: string;
  icon: string;
  outcome: string;
  endDate: string;
}

interface Trade {
  proxyWallet: string;
  side: "BUY" | "SELL";
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title: string;
  slug: string;
  icon: string;
  outcome: string;
  transactionHash: string;
}

type TabType = "positions" | "history";

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<TabType>("positions");
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/positions?user=${address}`);
      if (res.ok) {
        const data = await res.json();
        setPositions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch positions:", err);
    }
  }, [address]);

  const fetchTrades = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/trades?user=${address}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades || []);
      }
    } catch (err) {
      console.error("Failed to fetch trades:", err);
    }
  }, [address]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchPositions(), fetchTrades()]);
    } catch {
      setError("加载数据失败");
    } finally {
      setLoading(false);
    }
  }, [fetchPositions, fetchTrades]);

  useEffect(() => {
    if (isConnected && address) {
      refreshData();
    }
  }, [isConnected, address, refreshData]);

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.cashPnl, 0);
  const totalPnlPercent = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0c0c10] text-white">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <Wallet className="h-16 w-16 text-[#6b6b80] mb-6" />
          <h2 className="text-xl font-semibold mb-2">连接钱包查看资产</h2>
          <p className="text-[#6b6b80] mb-6">连接钱包后可以查看持仓和交易历史</p>
          <WalletButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c10] text-white">
      <Header />

      <main className="mx-auto max-w-[1200px] px-6 py-6">
        {/* Portfolio Summary */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#1e1e28] bg-[#13131a] p-6">
            <div className="flex items-center gap-2 text-sm text-[#6b6b80] mb-2">
              <PieChart className="h-4 w-4" />
              持仓总值
            </div>
            <div className="text-3xl font-bold font-mono">${totalValue.toFixed(2)}</div>
          </div>

          <div className="rounded-2xl border border-[#1e1e28] bg-[#13131a] p-6">
            <div className="flex items-center gap-2 text-sm text-[#6b6b80] mb-2">
              {totalPnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-[#00D4AA]" />
              ) : (
                <TrendingDown className="h-4 w-4 text-[#FF6B6B]" />
              )}
              总盈亏
            </div>
            <div
              className={`text-3xl font-bold font-mono ${
                totalPnl >= 0 ? "text-[#00D4AA]" : "text-[#FF6B6B]"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </div>
            <div
              className={`text-sm ${totalPnl >= 0 ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}
            >
              {totalPnlPercent >= 0 ? "+" : ""}{totalPnlPercent.toFixed(2)}%
            </div>
          </div>

          <div className="rounded-2xl border border-[#1e1e28] bg-[#13131a] p-6">
            <div className="flex items-center gap-2 text-sm text-[#6b6b80] mb-2">
              <History className="h-4 w-4" />
              交易数
            </div>
            <div className="text-3xl font-bold font-mono">{trades.length}</div>
            <div className="text-sm text-[#6b6b80]">
              持仓 {positions.length} 个市场
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("positions")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "positions"
                  ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                  : "text-[#6b6b80] hover:bg-[#1e1e28]"
              }`}
            >
              持仓
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-[#00D4AA]/10 text-[#00D4AA]"
                  : "text-[#6b6b80] hover:bg-[#1e1e28]"
              }`}
            >
              交易历史
            </button>
          </div>
          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 rounded-lg text-[#6b6b80] hover:bg-[#1e1e28] hover:text-white transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 text-[#FF6B6B]">
            {error}
          </div>
        )}

        {/* Positions Tab */}
        {activeTab === "positions" && (
          <div className="space-y-3">
            {loading && positions.length === 0 ? (
              <LoadingSkeleton count={3} />
            ) : positions.length === 0 ? (
              <EmptyState message="暂无持仓" icon={<PieChart className="h-10 w-10" />} />
            ) : (
              positions.map((position) => (
                <PositionCard key={position.conditionId + position.outcome} position={position} />
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-3">
            {loading && trades.length === 0 ? (
              <LoadingSkeleton count={5} />
            ) : trades.length === 0 ? (
              <EmptyState message="暂无交易记录" icon={<History className="h-10 w-10" />} />
            ) : (
              trades.map((trade, idx) => (
                <TradeCard key={trade.transactionHash + idx} trade={trade} />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-[#1a1a22] bg-[#0c0c10]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#6b6b80] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <span className="text-xl font-bold text-gradient">钱包</span>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}

function PositionCard({ position }: { position: Position }) {
  const pnlColor = position.cashPnl >= 0 ? "text-[#00D4AA]" : "text-[#FF6B6B]";
  const pnlBgColor = position.cashPnl >= 0 ? "bg-[#00D4AA]/10" : "bg-[#FF6B6B]/10";

  return (
    <Link href={`/markets/${position.conditionId}`}>
      <div className="rounded-xl border border-[#1e1e28] bg-[#13131a] p-4 hover:border-[#2d2d3a] hover:bg-[#16161f] transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {position.icon && (
              <img
                src={position.icon}
                alt=""
                className="h-10 w-10 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="min-w-0">
              <h3 className="font-medium text-white truncate">{position.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    position.outcome === "Yes"
                      ? "bg-[#00D4AA]/20 text-[#00D4AA]"
                      : "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                  }`}
                >
                  {position.outcome}
                </span>
                <span className="text-xs text-[#6b6b80]">
                  {position.size.toFixed(2)} 份
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="font-mono font-semibold">${position.currentValue.toFixed(2)}</div>
            <div className={`flex items-center justify-end gap-1 text-sm ${pnlColor}`}>
              {position.cashPnl >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              <span>
                {position.cashPnl >= 0 ? "+" : ""}${position.cashPnl.toFixed(2)} (
                {position.percentPnl >= 0 ? "+" : ""}{position.percentPnl.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1e1e28] grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[#6b6b80]">均价</span>
            <div className="font-mono">${position.avgPrice.toFixed(3)}</div>
          </div>
          <div>
            <span className="text-[#6b6b80]">现价</span>
            <div className="font-mono">${position.curPrice.toFixed(3)}</div>
          </div>
          <div>
            <span className="text-[#6b6b80]">成本</span>
            <div className="font-mono">${position.initialValue.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function TradeCard({ trade }: { trade: Trade }) {
  const isBuy = trade.side === "BUY";
  const time = new Date(trade.timestamp).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl border border-[#1e1e28] bg-[#13131a] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isBuy ? "bg-[#00D4AA]/20" : "bg-[#FF6B6B]/20"
            }`}
          >
            {isBuy ? (
              <ArrowUpRight className="h-5 w-5 text-[#00D4AA]" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-[#FF6B6B]" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-white truncate">{trade.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  isBuy
                    ? "bg-[#00D4AA]/20 text-[#00D4AA]"
                    : "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                }`}
              >
                {isBuy ? "买入" : "卖出"} {trade.outcome}
              </span>
              <span className="text-xs text-[#6b6b80] flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {time}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-mono font-semibold">
            ${(trade.size * trade.price).toFixed(2)}
          </div>
          <div className="text-sm text-[#6b6b80]">
            {trade.size.toFixed(2)} @ ${trade.price.toFixed(3)}
          </div>
        </div>
      </div>

      {trade.transactionHash && (
        <div className="mt-3 pt-3 border-t border-[#1e1e28]">
          <a
            href={`https://polygonscan.com/tx/${trade.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#6b6b80] hover:text-[#00D4AA] flex items-center gap-1 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            查看交易
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#1e1e28] bg-[#13131a] p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#1e1e28] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-[#1e1e28] rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-[#1e1e28] rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 bg-[#1e1e28] rounded animate-pulse" />
              <div className="h-3 w-12 bg-[#1e1e28] rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[#6b6b80]">
      {icon}
      <p className="mt-4">{message}</p>
    </div>
  );
}
