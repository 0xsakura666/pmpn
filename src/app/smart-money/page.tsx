"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { WhaleScore, WhaleScoreBar, WhaleScoreBadge } from "@/components/ui/WhaleScore";
import { SignalFeed } from "@/components/ui/LiveSignalCard";
import { SmartCollections, CreateCollectionModal } from "@/components/ui/SmartCollections";
import { CopyTradePanel } from "@/components/trading/CopyTradePanel";

interface Trader {
  rank: number;
  address: string;
  whaleScore: number;
  tier: string;
  tierLabel: string;
  tierIcon: string;
  tierColor: string;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  winRate: number;
  totalTrades: number;
  totalVolume: number;
  avgTradeSize: number;
  lastActiveAt: number;
}

interface Activity {
  id: string;
  txHash: string;
  timestamp: number;
  trader: {
    address: string;
    whaleScore: number;
    tier: string;
    tierLabel: string;
    tierIcon: string;
    winRate: number;
    totalPnl: number;
  };
  market: {
    id: string;
    title: string;
  };
  action: "buy" | "sell";
  outcome: "yes" | "no";
  price: number;
  size: number;
  total: number;
  significance: "high" | "medium" | "low";
}

export default function SmartMoneyPage() {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "activity" | "collections">("leaderboard");
  const [traders, setTraders] = useState<Trader[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [sortBy, setSortBy] = useState("whaleScore");
  const [minScore, setMinScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const [collections] = useState([
    {
      id: "1",
      name: "顶级巨鲸",
      description: "巨鲸评分 > 90",
      wallets: [],
      criteria: { minWhaleScore: 90 },
      totalPnl: 2500000,
      avgWinRate: 75.2,
    },
    {
      id: "2",
      name: "加密专家",
      description: "加密市场高胜率交易者",
      wallets: [],
      criteria: { minWinRate: 70, category: "加密货币" },
      totalPnl: 890000,
      avgWinRate: 72.5,
    },
  ]);

  useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchTraders();
    } else if (activeTab === "activity") {
      fetchActivity();
    }
  }, [activeTab, sortBy, minScore]);

  const fetchTraders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whale/leaderboard?sortBy=${sortBy}&minScore=${minScore}&limit=20`);
      const data = await res.json();
      setTraders(data);
    } catch (error) {
      console.error("Failed to fetch traders:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whale/activity?minScore=${minScore}&limit=30`);
      const data = await res.json();
      setActivities(data);
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalWhaleVolume = traders.reduce((sum, t) => sum + t.totalVolume, 0);
  const avgWhaleWinRate = traders.length > 0 
    ? traders.reduce((sum, t) => sum + t.winRate, 0) / traders.length 
    : 0;

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white">
      {/* Header */}
      <header className="border-b border-[#1a1a1f] bg-[#0d0d0f]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-gradient">Tectonic</span>
              <span className="text-xs text-[#666] uppercase tracking-wider">Pro</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/" className="text-[#666] hover:text-white transition-colors">市场</Link>
              <Link href="#" className="text-[#666] hover:text-white transition-colors flex items-center gap-1">
                交易 <span className="text-[8px]">▼</span>
              </Link>
              <Link href="#" className="text-[#666] hover:text-white transition-colors">钱包</Link>
              <Link href="#" className="text-[#666] hover:text-white transition-colors">竞赛</Link>
              <Link href="/smart-money" className="text-white font-medium">排行榜</Link>
              <Link href="#" className="text-[#666] hover:text-white transition-colors flex items-center gap-1">
                更多 <span className="text-[8px]">▼</span>
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-[#1a1a1f] rounded-lg">
              <span className="text-[#666]">🔍</span>
              <input 
                type="text" 
                placeholder="搜索代币、合约地址、市场" 
                className="bg-transparent text-sm text-white placeholder-[#666] outline-none w-48"
              />
              <span className="text-[10px] text-[#666] border border-[#333] rounded px-1">⌘K</span>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">
            聪明钱追踪器
          </h1>
          <p className="text-[#666] text-sm">
            追踪巨鲸动向，复制盈利策略
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1a1f] border border-[#2a2a2f] rounded-xl p-4">
            <div className="text-sm text-[#666]">追踪巨鲸</div>
            <div className="text-2xl font-bold text-[#7B61FF]">{traders.length}</div>
          </div>
          <div className="bg-[#1a1a1f] border border-[#2a2a2f] rounded-xl p-4">
            <div className="text-sm text-[#666]">巨鲸成交量</div>
            <div className="text-2xl font-bold">${(totalWhaleVolume / 1e6).toFixed(1)}M</div>
          </div>
          <div className="bg-[#1a1a1f] border border-[#2a2a2f] rounded-xl p-4">
            <div className="text-sm text-[#666]">平均胜率</div>
            <div className="text-2xl font-bold text-[#00D4AA]">{avgWhaleWinRate.toFixed(1)}%</div>
          </div>
          <div className="bg-[#1a1a1f] border border-[#2a2a2f] rounded-xl p-4">
            <div className="text-sm text-[#666]">最近信号</div>
            <div className="text-2xl font-bold">{activities.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[#1a1a1f]">
          {[
            { id: "leaderboard", label: "排行榜" },
            { id: "activity", label: "实时动态" },
            { id: "collections", label: "智能组合" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-[#666] hover:text-white"
              }`}
            >
              {tab.label}
              {tab.id === "activity" && (
                <span className="ml-2 w-2 h-2 rounded-full bg-[#00D4AA] inline-block animate-pulse" />
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00D4AA]" />
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        {(activeTab === "leaderboard" || activeTab === "activity") && (
          <div className="flex flex-wrap gap-4 mb-6">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#1a1a1f] border border-[#2a2a2f] text-sm text-white outline-none"
            >
              <option value="whaleScore">巨鲸评分</option>
              <option value="pnl">总盈亏</option>
              <option value="winRate">胜率</option>
              <option value="volume">成交量</option>
              <option value="trades">交易次数</option>
            </select>
            <select
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="px-3 py-2 rounded-lg bg-[#1a1a1f] border border-[#2a2a2f] text-sm text-white outline-none"
            >
              <option value="0">所有评分</option>
              <option value="50">评分 50+</option>
              <option value="70">评分 70+</option>
              <option value="85">评分 85+</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === "leaderboard" && (
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-12 text-[#666]">
                    加载巨鲸数据中...
                  </div>
                ) : (
                  traders.map((trader) => (
                    <TraderCard
                      key={trader.address}
                      trader={trader}
                      onClick={() => setSelectedTrader(trader)}
                      isSelected={selectedTrader?.address === trader.address}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-12 text-[#666]">
                    加载动态中...
                  </div>
                ) : (
                  activities.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))
                )}
              </div>
            )}

            {activeTab === "collections" && (
              <SmartCollections
                collections={collections as any}
                onCreateCollection={() => setShowCreateCollection(true)}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {selectedTrader ? (
              <CopyTradePanel
                target={{
                  address: selectedTrader.address,
                  whaleScore: selectedTrader.whaleScore,
                  winRate: selectedTrader.winRate,
                  totalPnl: selectedTrader.totalPnl,
                }}
              />
            ) : (
              <div className="glass rounded-xl p-6 text-center">
                <div className="text-4xl mb-4">🐋</div>
                <h3 className="font-['Space_Grotesk'] font-semibold mb-2">
                  选择一只巨鲸
                </h3>
                <p className="text-sm text-[#666]">
                  点击交易者查看详情并设置跟单
                </p>
              </div>
            )}

            {/* Score Legend */}
            <div className="glass rounded-xl p-4">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4">巨鲸评分等级</h3>
              <div className="space-y-3">
                {[
                  { icon: "🐋", label: "超级巨鲸", range: "90-100", color: "#FFD700" },
                  { icon: "🐳", label: "巨鲸", range: "75-89", color: "#3B82F6" },
                  { icon: "🐬", label: "海豚", range: "50-74", color: "#06B6D4" },
                  { icon: "🐟", label: "小鱼", range: "25-49", color: "#22C55E" },
                  { icon: "🦐", label: "虾米", range: "0-24", color: "#6B7280" },
                ].map((tier) => (
                  <div key={tier.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>{tier.icon}</span>
                      <span style={{ color: tier.color }}>{tier.label}</span>
                    </div>
                    <span className="text-[#666]">{tier.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <CreateCollectionModal
        isOpen={showCreateCollection}
        onClose={() => setShowCreateCollection(false)}
        onCreate={(data) => {
          console.log("Create collection:", data);
          setShowCreateCollection(false);
        }}
      />
    </div>
  );
}

function TraderCard({
  trader,
  onClick,
  isSelected,
}: {
  trader: Trader;
  onClick: () => void;
  isSelected: boolean;
}) {
  const isProfitable = trader.totalPnl >= 0;
  const timeAgo = getTimeAgo(trader.lastActiveAt);

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl glass cursor-pointer transition-all hover:scale-[1.01] ${
        isSelected ? "border-2 border-[#00D4AA]" : "border border-transparent"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold text-[#666] w-8">
          #{trader.rank}
        </div>
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
          style={{
            background: `linear-gradient(135deg, ${trader.tierColor}40, ${trader.tierColor}20)`,
            boxShadow: `0 0 15px ${trader.tierColor}30`,
          }}
        >
          {trader.whaleScore}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              {trader.address.slice(0, 8)}...{trader.address.slice(-6)}
            </span>
            <span title={trader.tierLabel}>{trader.tierIcon}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm">
            <span className="text-[var(--up)]">{trader.winRate.toFixed(1)}% 胜率</span>
            <span className="text-[#666]">
              {trader.totalTrades} 笔交易
            </span>
            <span className="text-xs text-[#666]">
              {timeAgo}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-lg font-bold ${
              isProfitable ? "text-[var(--up)]" : "text-[var(--down)]"
            }`}
          >
            {isProfitable ? "+" : ""}${formatNumber(trader.totalPnl)}
          </div>
          <div className="text-xs text-[#666]">总盈亏</div>
        </div>
      </div>
      
      {/* Mini stats bar */}
      <div className="mt-3 pt-3 border-t border-[#1a1a1f] grid grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-[#666]">成交量</span>
          <div className="font-semibold">${formatNumber(trader.totalVolume)}</div>
        </div>
        <div>
          <span className="text-[#666]">平均金额</span>
          <div className="font-semibold">${formatNumber(trader.avgTradeSize)}</div>
        </div>
        <div>
          <span className="text-[#666]">已实现</span>
          <div className={`font-semibold ${trader.realizedPnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
            {trader.realizedPnl >= 0 ? "+" : ""}${formatNumber(trader.realizedPnl)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const isBuy = activity.action === "buy";
  const significanceColors = {
    high: "border-[#FFD700]/50 bg-[#FFD700]/5",
    medium: "border-[var(--whale)]/50 bg-[var(--whale)]/5",
    low: "border-[#1a1a1f]",
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all hover:scale-[1.01] ${significanceColors[activity.significance]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              isBuy ? "bg-[var(--up)]/20 text-[var(--up)]" : "bg-[var(--down)]/20 text-[var(--down)]"
            }`}
          >
            {isBuy ? "B" : "S"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">
                {activity.trader.address.slice(0, 8)}...
              </span>
              <span>{activity.trader.tierIcon}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1f]">
                {activity.trader.whaleScore}
              </span>
            </div>
            <div className="text-xs text-[#666]">
              {activity.trader.winRate.toFixed(1)}% 胜率
            </div>
          </div>
        </div>
        <div className="text-xs text-[#666]">
          {getTimeAgo(activity.timestamp)}
        </div>
      </div>

      <p className="text-sm mb-2 line-clamp-1">{activity.market.title}</p>

      <div className="flex items-center justify-between text-sm">
        <span className={isBuy ? "text-[var(--up)]" : "text-[var(--down)]"}>
          {isBuy ? "买入" : "卖出"} {activity.outcome.toUpperCase()}
        </span>
        <div className="text-right">
          <span className="font-mono font-semibold">${formatNumber(activity.total)}</span>
          <span className="text-xs text-[#666] ml-1">
            @ ${activity.price.toFixed(3)}
          </span>
        </div>
      </div>

      {activity.significance === "high" && (
        <div className="mt-2 text-xs text-[#FFD700] flex items-center gap-1">
          <span>⚡</span> 高价值交易
        </div>
      )}
    </div>
  );
}

function formatNumber(num: number): string {
  const abs = Math.abs(num);
  if (abs >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
