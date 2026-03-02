"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { SparklineChart } from "@/components/charts/CandlestickChart";
import { MarketHeatmap, CategoryHeatBar, FlowIndicator } from "@/components/ui/MarketHeatmap";

interface Market {
  id: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  endDate: string;
  image: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
}

const categories = ["全部", "政治", "加密货币", "体育", "经济", "其他"];

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("volume");
  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");

  useEffect(() => {
    fetchMarkets();
  }, [selectedCategory]);

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const categoryParam = selectedCategory !== "全部" ? `&category=${selectedCategory}` : "";
      const res = await fetch(`/api/markets?limit=50${categoryParam}`);
      const data = await res.json();
      
      // Add mock sparkline data
      const marketsWithSparkline = data.map((m: Market) => ({
        ...m,
        sparkline: generateMockSparkline(m.yesPrice),
        priceChange: (Math.random() - 0.5) * 20,
        volume24h: Math.floor(Math.random() * 10000000),
      }));
      
      setMarkets(marketsWithSparkline);
    } catch (error) {
      console.error("Failed to fetch markets:", error);
      // Use mock data as fallback
      setMarkets(generateMockMarkets());
    } finally {
      setLoading(false);
    }
  };

  const sortedMarkets = [...markets].sort((a, b) => {
    switch (sortBy) {
      case "volume":
        return (b.volume24h || 0) - (a.volume24h || 0);
      case "price":
        return b.yesPrice - a.yesPrice;
      case "change":
        return (b as any).priceChange - (a as any).priceChange;
      default:
        return 0;
    }
  });

  // Category stats for heatmap
  const categoryStats = categories.slice(1).map((cat) => {
    const catMarkets = markets.filter((m) => m.category === cat);
    return {
      name: cat,
      volume: catMarkets.reduce((sum, m) => sum + (m.volume24h || 0), 0),
      change: catMarkets.reduce((sum, m) => sum + ((m as any).priceChange || 0), 0) / (catMarkets.length || 1),
    };
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))]">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-2xl font-['Space_Grotesk'] font-bold">
                <span className="text-gradient">Tectonic</span>
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link href="/markets" className="text-[hsl(var(--foreground))] font-semibold">
                  市场
                </Link>
                <Link href="/smart-money" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                  聪明钱
                </Link>
              </div>
            </div>
            <WalletButton />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-['Space_Grotesk'] font-bold mb-2">市场</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            基于实时概率数据，交易真实世界事件
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort & View */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-sm"
            >
              <option value="volume">成交量</option>
              <option value="price">价格</option>
              <option value="change">涨跌幅</option>
            </select>
            <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm ${
                  viewMode === "list"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-[hsl(var(--muted))]"
                }`}
              >
                列表
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                className={`px-3 py-2 text-sm ${
                  viewMode === "heatmap"
                    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                    : "bg-[hsl(var(--muted))]"
                }`}
              >
                热力图
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[hsl(var(--muted-foreground))]">
            加载市场中...
          </div>
        ) : viewMode === "list" ? (
          <div className="grid grid-cols-1 gap-4">
            {sortedMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Category Heat Bar */}
            <div className="glass rounded-xl p-6">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4">分类表现</h3>
              <CategoryHeatBar categories={categoryStats} />
            </div>

            {/* Flow Indicator */}
            <div className="glass rounded-xl p-6">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4">巨鲸 vs 散户成交量</h3>
              <FlowIndicator whaleVolume={45200000} retailVolume={28800000} />
            </div>

            {/* Market Heatmap */}
            <div className="glass rounded-xl p-6">
              <h3 className="font-['Space_Grotesk'] font-semibold mb-4">市场热力图</h3>
              <MarketHeatmap
                data={sortedMarkets.map((m) => ({
                  id: m.id,
                  title: m.title,
                  category: m.category,
                  volume: m.volume24h || 0,
                  change: (m as any).priceChange || 0,
                  whaleVolume: Math.random() * m.volume24h,
                  retailVolume: Math.random() * m.volume24h,
                }))}
                onCellClick={(cell) => {
                  window.location.href = `/markets/${cell.id}`;
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function MarketCard({ market }: { market: Market & { sparkline?: number[]; priceChange?: number } }) {
  const isUp = (market.priceChange || 0) >= 0;

  return (
    <Link href={`/markets/${market.id}`}>
      <div className="glass p-4 rounded-xl hover:border-[hsl(var(--primary))] border border-transparent transition-all cursor-pointer">
        <div className="flex items-center gap-4">
          {/* Image */}
          {market.image && (
            <div className="w-12 h-12 rounded-lg bg-[hsl(var(--muted))] overflow-hidden flex-shrink-0">
              <img src={market.image} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--muted))]">
                {market.category}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                截止 {new Date(market.endDate).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <h3 className="font-semibold line-clamp-1">{market.title}</h3>
          </div>

          {/* Sparkline */}
          <div className="hidden md:block">
            {market.sparkline && (
              <SparklineChart
                data={market.sparkline}
                width={100}
                height={40}
                color={isUp ? "up" : "down"}
              />
            )}
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[var(--up)]">
                ${market.yesPrice.toFixed(2)}
              </span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">Yes</span>
            </div>
            <div
              className={`text-sm ${isUp ? "text-[var(--up)]" : "text-[var(--down)]"}`}
            >
              {isUp ? "+" : ""}{(market.priceChange || 0).toFixed(1)}%
            </div>
          </div>

          {/* Volume */}
          <div className="hidden md:block text-right min-w-[80px]">
            <div className="text-sm font-semibold">
              ${formatVolume(market.volume24h || 0)}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">24h 成交</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function generateMockSparkline(currentPrice: number): number[] {
  const data = [];
  let price = currentPrice - 0.1;
  for (let i = 0; i < 20; i++) {
    price += (Math.random() - 0.48) * 0.02;
    data.push(Math.max(0.01, Math.min(0.99, price)));
  }
  return data;
}

function generateMockMarkets(): (Market & { sparkline: number[]; priceChange: number })[] {
  const mockMarkets = [
    {
      id: "trump-2024",
      title: "特朗普会赢得2024年总统大选吗？",
      description: "",
      slug: "trump-2024",
      category: "政治",
      endDate: "2024-11-05",
      image: "",
      yesPrice: 0.65,
      noPrice: 0.35,
      volume24h: 12500000,
      liquidity: 8500000,
    },
    {
      id: "btc-100k",
      title: "比特币会在2025年前达到10万美元吗？",
      description: "",
      slug: "btc-100k",
      category: "加密货币",
      endDate: "2024-12-31",
      image: "",
      yesPrice: 0.42,
      noPrice: 0.58,
      volume24h: 8200000,
      liquidity: 5200000,
    },
    {
      id: "fed-rate",
      title: "美联储会在2024年3月降息吗？",
      description: "",
      slug: "fed-rate",
      category: "经济",
      endDate: "2024-03-20",
      image: "",
      yesPrice: 0.28,
      noPrice: 0.72,
      volume24h: 5600000,
      liquidity: 3200000,
    },
    {
      id: "eth-5k",
      title: "ETH会在2024年3月前达到5000美元吗？",
      description: "",
      slug: "eth-5k",
      category: "加密货币",
      endDate: "2024-03-31",
      image: "",
      yesPrice: 0.35,
      noPrice: 0.65,
      volume24h: 4200000,
      liquidity: 2800000,
    },
    {
      id: "superbowl-chiefs",
      title: "堪萨斯城酋长队会赢得2024年超级碗吗？",
      description: "",
      slug: "superbowl-chiefs",
      category: "体育",
      endDate: "2024-02-11",
      image: "",
      yesPrice: 0.52,
      noPrice: 0.48,
      volume24h: 3800000,
      liquidity: 2100000,
    },
    {
      id: "ai-gpt5",
      title: "GPT-5会在2024年发布吗？",
      description: "",
      slug: "ai-gpt5",
      category: "其他",
      endDate: "2024-12-31",
      image: "",
      yesPrice: 0.45,
      noPrice: 0.55,
      volume24h: 2100000,
      liquidity: 1500000,
    },
    {
      id: "recession-2024",
      title: "美国会在2024年进入经济衰退吗？",
      description: "",
      slug: "recession-2024",
      category: "经济",
      endDate: "2024-12-31",
      image: "",
      yesPrice: 0.22,
      noPrice: 0.78,
      volume24h: 1800000,
      liquidity: 1200000,
    },
    {
      id: "sol-200",
      title: "SOL会在2024年达到200美元吗？",
      description: "",
      slug: "sol-200",
      category: "加密货币",
      endDate: "2024-12-31",
      image: "",
      yesPrice: 0.38,
      noPrice: 0.62,
      volume24h: 1500000,
      liquidity: 900000,
    },
  ];
  
  return mockMarkets.map(m => ({
    ...m,
    sparkline: generateMockSparkline(m.yesPrice),
    priceChange: (Math.random() - 0.5) * 20,
  }));
}

function formatVolume(volume: number): string {
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(0)}K`;
  return volume.toFixed(0);
}
