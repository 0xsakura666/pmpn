"use client";

import { useState, useEffect } from "react";
import { PageContainer, PageHeader } from "@/components/layout";
import { Card, Tabs, TabsList, TabsTrigger, TabsContent, Badge } from "@/components/ui";
import { SmartCollections, CreateCollectionModal } from "@/components/ui/SmartCollections";
import { CopyTradePanel } from "@/components/trading/CopyTradePanel";
import { formatNumber, getTimeAgo } from "@/lib/utils";

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
    <PageContainer>
      <PageHeader
        title="聪明钱追踪器"
        description="追踪巨鲸动向，复制盈利策略"
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding="md">
          <div className="text-sm text-[var(--text-disabled)]">追踪巨鲸</div>
          <div className="text-2xl font-bold text-[var(--brand-accent)]">{traders.length}</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-[var(--text-disabled)]">巨鲸成交量</div>
          <div className="text-2xl font-bold">${(totalWhaleVolume / 1e6).toFixed(1)}M</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-[var(--text-disabled)]">平均胜率</div>
          <div className="text-2xl font-bold text-[var(--color-up)]">{avgWhaleWinRate.toFixed(1)}%</div>
        </Card>
        <Card padding="md">
          <div className="text-sm text-[var(--text-disabled)]">最近信号</div>
          <div className="text-2xl font-bold">{activities.length}</div>
        </Card>
      </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[#1a1a22]">
          {[
            { id: "leaderboard", label: "排行榜" },
            { id: "activity", label: "实时动态" },
            { id: "collections", label: "智能组合" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "leaderboard" | "activity" | "collections")}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-[#00D4AA]"
                  : "text-[#6b6b80] hover:text-white"
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
              className="px-3 py-2 rounded-lg bg-[#13131a] border border-[#1e1e28] text-sm text-white outline-none"
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
              className="px-3 py-2 rounded-lg bg-[#13131a] border border-[#1e1e28] text-sm text-white outline-none"
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
                  <div className="text-center py-12 text-[#6b6b80]">
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
                  <div className="text-center py-12 text-[#6b6b80]">
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
              <div className="rounded-xl border border-[#1e1e28] bg-[#13131a] p-6 text-center">
                <div className="text-4xl mb-4">🐋</div>
                <h3 className="font-semibold mb-2">
                  选择一只巨鲸
                </h3>
                <p className="text-sm text-[#6b6b80]">
                  点击交易者查看详情并设置跟单
                </p>
              </div>
            )}

            {/* Score Legend */}
            <div className="rounded-xl border border-[#1e1e28] bg-[#13131a] p-4">
              <h3 className="font-semibold mb-4">巨鲸评分等级</h3>
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
                    <span className="text-[#6b6b80]">{tier.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      <CreateCollectionModal
        isOpen={showCreateCollection}
        onClose={() => setShowCreateCollection(false)}
        onCreate={(data) => {
          console.log("Create collection:", data);
          setShowCreateCollection(false);
        }}
      />
    </PageContainer>
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
      className={`p-4 rounded-xl bg-[#13131a] cursor-pointer transition-all hover:bg-[#16161f] ${
        isSelected ? "border-2 border-[#00D4AA]" : "border border-[#1e1e28]"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold text-[#6b6b80] w-8">
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
            <span className="text-[#00D4AA]">{trader.winRate.toFixed(1)}% 胜率</span>
            <span className="text-[#6b6b80]">
              {trader.totalTrades} 笔交易
            </span>
            <span className="text-xs text-[#6b6b80]">
              {timeAgo}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-lg font-bold ${
              isProfitable ? "text-[#00D4AA]" : "text-[#FF6B6B]"
            }`}
          >
            {isProfitable ? "+" : ""}${formatNumber(trader.totalPnl)}
          </div>
          <div className="text-xs text-[#6b6b80]">总盈亏</div>
        </div>
      </div>
      
      {/* Mini stats bar */}
      <div className="mt-3 pt-3 border-t border-[#1e1e28] grid grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-[#6b6b80]">成交量</span>
          <div className="font-semibold">${formatNumber(trader.totalVolume)}</div>
        </div>
        <div>
          <span className="text-[#6b6b80]">平均金额</span>
          <div className="font-semibold">${formatNumber(trader.avgTradeSize)}</div>
        </div>
        <div>
          <span className="text-[#6b6b80]">已实现</span>
          <div className={`font-semibold ${trader.realizedPnl >= 0 ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}>
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
    medium: "border-[#7B61FF]/50 bg-[#7B61FF]/5",
    low: "border-[#1e1e28] bg-[#13131a]",
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-all hover:scale-[1.01] ${significanceColors[activity.significance]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              isBuy ? "bg-[#00D4AA]/20 text-[#00D4AA]" : "bg-[#FF6B6B]/20 text-[#FF6B6B]"
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e1e28]">
                {activity.trader.whaleScore}
              </span>
            </div>
            <div className="text-xs text-[#6b6b80]">
              {activity.trader.winRate.toFixed(1)}% 胜率
            </div>
          </div>
        </div>
        <div className="text-xs text-[#6b6b80]">
          {getTimeAgo(activity.timestamp)}
        </div>
      </div>

      <p className="text-sm mb-2 line-clamp-1">{activity.market.title}</p>

      <div className="flex items-center justify-between text-sm">
        <span className={isBuy ? "text-[#00D4AA]" : "text-[#FF6B6B]"}>
          {isBuy ? "买入" : "卖出"} {activity.outcome.toUpperCase()}
        </span>
        <div className="text-right">
          <span className="font-mono font-semibold">${formatNumber(activity.total)}</span>
          <span className="text-xs text-[#6b6b80] ml-1">
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

