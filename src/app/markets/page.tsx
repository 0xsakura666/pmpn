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
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [sortBy, setSortBy] = useState("volume");
  const [viewMode, setViewMode] = useState<"list" | "heatmap">("list");

  useEffect(() => {
    fetchMarkets();
  }, [selectedCategory]);

  const fetchMarkets = async () => {
    setLoading(true);
    setError(null);
    try {
      // 首先尝试通过服务器端 API
      const categoryParam = selectedCategory !== "全部" ? `&category=${selectedCategory}` : "";
      const res = await fetch(`/api/markets?limit=50${categoryParam}`);
      const data = await res.json();
      
      // 如果服务器端失败，尝试直接从客户端访问 Polymarket API
      if (data.error) {
        console.log("Server API failed, trying direct client-side fetch...");
        await fetchMarketsDirectly();
        return;
      }
      
      // Check if data is an array
      if (!Array.isArray(data)) {
        setError({ message: "API 返回了无效数据格式" });
        setMarkets([]);
        return;
      }
      
      // Add sparkline data
      const marketsWithSparkline = data.map((m: Market) => ({
        ...m,
        sparkline: generateMockSparkline(m.yesPrice || 0.5),
        priceChange: (Math.random() - 0.5) * 20,
        volume24h: m.volume24h || Math.floor(Math.random() * 10000000),
      }));
      
      setMarkets(marketsWithSparkline);
    } catch (err) {
      console.error("Failed to fetch markets:", err);
      // 尝试直接客户端获取
      await fetchMarketsDirectly();
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketsDirectly = async () => {
    try {
      console.log("=== Client-side fetch started ===");
      
      // 尝试多个方式获取数据
      const apiUrl = "https://gamma-api.polymarket.com/events?limit=50&active=true&closed=false&order=volume_24hr";
      
      // 使用 CodeTabs 代理 (已测试可用，绕过 DNS 污染)
      const proxyUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(apiUrl)}`;
      
      console.log("[CodeTabs] Fetching via proxy...");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      const res = await fetch(proxyUrl, {
        headers: {
          "Accept": "application/json",
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log(`[CodeTabs] Status: ${res.status}`);
      
      if (!res.ok) {
        throw new Error(`CodeTabs proxy failed: HTTP ${res.status}`);
      }
      
      // CodeTabs directly returns the API response
      const events = await res.json();
      console.log(`[CodeTabs] SUCCESS! Got ${events?.length || 0} events`);
      
      if (!Array.isArray(events)) {
        throw new Error("Invalid response format");
      }

      // 从 events 中提取 markets
      const transformedMarkets: Market[] = [];
      
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            const yesPrice = market.outcomePrices 
              ? parseFloat(JSON.parse(market.outcomePrices)[0]) 
              : (market.tokens?.find((t: any) => t.outcome === "Yes")?.price || 0.5);
            
            transformedMarkets.push({
              id: market.conditionId || market.condition_id || event.id,
              title: market.question || event.title,
              description: market.description || event.description || "",
              slug: market.slug || event.slug,
              category: categorizeMarket(market.question || event.title),
              endDate: market.endDate || event.endDate,
              image: event.image || "",
              yesPrice,
              noPrice: 1 - yesPrice,
              volume24h: parseFloat(event.volume24hr || "0"),
              liquidity: parseFloat(event.liquidity || "0"),
              sparkline: generateMockSparkline(yesPrice),
              priceChange: (Math.random() - 0.5) * 20,
            } as Market);
          }
        }
      }

      // Filter by category
      const filtered = selectedCategory !== "全部"
        ? transformedMarkets.filter((m: Market) => m.category === selectedCategory)
        : transformedMarkets;

      setMarkets(filtered);
      setError(null);
      console.log(`Loaded ${filtered.length} markets from Polymarket`);
    } catch (err) {
      console.error("Direct fetch failed:", err);
      setError({
        message: "无法连接到 Polymarket API",
        details: err instanceof Error ? err.message : undefined,
      });
      setMarkets([]);
    }
  };

  const categorizeMarket = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes("trump") || q.includes("biden") || q.includes("election") || q.includes("president")) {
      return "政治";
    }
    if (q.includes("crypto") || q.includes("bitcoin") || q.includes("ethereum") || q.includes("btc") || q.includes("eth")) {
      return "加密货币";
    }
    if (q.includes("sports") || q.includes("nba") || q.includes("nfl") || q.includes("super bowl")) {
      return "体育";
    }
    if (q.includes("economy") || q.includes("fed") || q.includes("inflation") || q.includes("rate")) {
      return "经济";
    }
    return "其他";
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
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--primary))] mx-auto mb-4" />
            <p className="text-[hsl(var(--muted-foreground))]">正在连接 Polymarket API...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto glass rounded-xl p-8">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold mb-2 text-[var(--down)]">无法获取市场数据</h3>
              <p className="text-[hsl(var(--muted-foreground))] mb-4">{error.message}</p>
              {error.details && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4 font-mono bg-[hsl(var(--muted))] p-2 rounded">
                  {error.details}
                </p>
              )}
              <div className="space-y-3">
                <button
                  onClick={fetchMarkets}
                  className="w-full px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white font-semibold hover:opacity-90"
                >
                  重试
                </button>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  <p className="mb-2">可能的解决方案：</p>
                  <ul className="text-left space-y-1">
                    <li>• 使用 VPN 连接到美国/欧洲地区</li>
                    <li>• 检查网络连接是否正常</li>
                    <li>• Polymarket 可能暂时不可用</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : sortedMarkets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[hsl(var(--muted-foreground))] mb-4">暂无市场数据</p>
            <button
              onClick={fetchMarkets}
              className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white"
            >
              重新加载
            </button>
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
                ${(market.yesPrice || 0.5).toFixed(2)}
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

function formatVolume(volume: number): string {
  if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
  if (volume >= 1e3) return `${(volume / 1e3).toFixed(0)}K`;
  return volume.toFixed(0);
}
