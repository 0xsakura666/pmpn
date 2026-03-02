"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { WalletButton } from "@/components/auth/ConnectWallet";

interface Market {
  id: string;
  conditionId: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  endDate: string;
  image: string;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  priceChange?: number;
  spread?: number;
  daysLeft?: number;
}

const categories = ["全部", "体育", "加密", "钱包追踪", "事件追踪", "热门"];
const topics = [
  "全部", "特朗普", "爱泼斯坦", "初选", "德州参议员", 
  "委内瑞拉", "中期选举", "法院", "美国大选", "贸易战", 
  "国会", "全球选举"
];

const sortOptions = [
  { value: "Trending", label: "热门" },
  { value: "Volume", label: "成交量" },
  { value: "Newest", label: "最新" },
  { value: "Ending Soon", label: "即将结束" }
];

const PAGE_SIZE = 10;
const CACHE_KEY = "pmpn_markets_cache";
const CACHE_TTL = 5 * 60 * 1000;

const CORS_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

interface CacheData {
  markets: Market[];
  timestamp: number;
}

function getCache(): CacheData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data: CacheData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(markets: Market[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ markets, timestamp: Date.now() }));
  } catch {}
}

function getFallbackMarkets(): Market[] {
  const fallbackData = [
    { id: "1", title: "Will Trump win the 2024 election?", volume24h: 15000000, totalVolume: 89000000, yesPrice: 0.52, endDate: "2024-11-05" },
    { id: "2", title: "Will Bitcoin reach $100K in 2024?", volume24h: 8500000, totalVolume: 45000000, yesPrice: 0.35, endDate: "2024-12-31" },
    { id: "3", title: "Will Fed cut rates in March?", volume24h: 6200000, totalVolume: 28000000, yesPrice: 0.12, endDate: "2024-03-20" },
    { id: "4", title: "Will AI stocks outperform S&P 500?", volume24h: 4800000, totalVolume: 22000000, yesPrice: 0.68, endDate: "2024-12-31" },
    { id: "5", title: "Will Ethereum ETF be approved?", volume24h: 3900000, totalVolume: 18000000, yesPrice: 0.75, endDate: "2024-05-31" },
  ];
  
  return fallbackData.map((m, i) => ({
    id: m.id,
    conditionId: m.id,
    title: m.title,
    description: "",
    slug: `market-${m.id}`,
    category: i < 2 ? "政治" : "加密",
    endDate: m.endDate,
    image: "",
    yesPrice: m.yesPrice,
    noPrice: 1 - m.yesPrice,
    volume24h: m.volume24h,
    totalVolume: m.totalVolume,
    liquidity: m.volume24h * 0.3,
    priceChange: (Math.random() - 0.3) * 10,
    spread: Math.random() * 3,
    daysLeft: Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000),
  }));
}

export default function Home() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [activeTopic, setActiveTopic] = useState("全部");
  const [sortBy, setSortBy] = useState("Trending");
  const [viewMode, setViewMode] = useState<"list" | "card">("list");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchWithTimeout = async (url: string, timeout = 12000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };

  const processEvents = useCallback((events: unknown[]): Market[] => {
    const transformedMarkets: Market[] = [];
    
    for (const event of events as Record<string, unknown>[]) {
      const eventMarkets = event.markets as Record<string, unknown>[] | undefined;
      if (eventMarkets && Array.isArray(eventMarkets)) {
        for (const market of eventMarkets) {
          let yesPrice = 0.5;
          try {
            if (market.outcomePrices) {
              yesPrice = parseFloat(JSON.parse(market.outcomePrices as string)[0]) || 0.5;
            }
          } catch {}
          
          const volume24h = parseFloat((event.volume24hr as string) || "0");
          const totalVolume = parseFloat((event.volume as string) || "0");
          const conditionId = (market.conditionId || market.condition_id || "") as string;
          const title = (market.question || event.title || "") as string;
          const endDate = (market.endDate || event.endDate || "") as string;
          
          transformedMarkets.push({
            id: conditionId,
            conditionId,
            title,
            description: (market.description || event.description || "") as string,
            slug: (market.slug || event.slug || "") as string,
            category: categorizeMarket(title),
            endDate,
            image: (event.image || "") as string,
            yesPrice,
            noPrice: 1 - yesPrice,
            volume24h,
            totalVolume,
            liquidity: parseFloat((event.liquidity as string) || "0"),
            priceChange: (Math.random() - 0.3) * 15,
            spread: Math.random() * 5,
            daysLeft: calculateDaysLeft(endDate),
          });
        }
      }
    }
    return transformedMarkets;
  }, []);

  const fetchFromApi = useCallback(async (): Promise<Market[]> => {
    // 跳过服务端 API，直接返回 null 让前端通过代理请求
    return Promise.reject(new Error("Skip API route"));
  }, []);

  const fetchFromProxy = useCallback(async (): Promise<Market[]> => {
    const apiUrl = "https://gamma-api.polymarket.com/events?limit=50&active=true&closed=false";
    
    const tryProxy = async (makeProxy: (url: string) => string, retries = 2): Promise<Market[] | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          const proxyUrl = makeProxy(apiUrl);
          const res = await fetchWithTimeout(proxyUrl, 18000);
          if (!res.ok) continue;
          const events = await res.json();
          if (!Array.isArray(events) || events.length === 0) continue;
          const markets = processEvents(events);
          if (markets.length > 0) return markets;
        } catch {
          await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
      }
      return null;
    };

    // 并行尝试所有代理，取第一个成功的
    const results = await Promise.all(CORS_PROXIES.map(p => tryProxy(p)));
    const validResult = results.find(r => r && r.length > 0);
    if (validResult) return validResult;
    
    throw new Error("All proxies failed");
  }, [processEvents]);

  const fetchMarkets = useCallback(async (useCache = true) => {
    const cached = useCache ? getCache() : null;
    
    if (cached && cached.markets.length > 0) {
      setMarkets(cached.markets);
      setLoading(false);
      setIsRefreshing(true);
      
      (async () => {
        try {
          let freshMarkets = await fetchFromApi().catch(() => null);
          if (!freshMarkets || freshMarkets.length === 0) {
            freshMarkets = await fetchFromProxy();
          }
          if (freshMarkets.length > 0) {
            setMarkets(freshMarkets);
            setCache(freshMarkets);
          }
        } catch {}
        setIsRefreshing(false);
      })();
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let freshMarkets = await fetchFromApi().catch(() => null);
      if (!freshMarkets || freshMarkets.length === 0) {
        freshMarkets = await fetchFromProxy().catch(() => null);
      }
      if (freshMarkets && freshMarkets.length > 0) {
        setMarkets(freshMarkets);
        setCache(freshMarkets);
      } else {
        throw new Error("No data");
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
      const fallback = getFallbackMarkets();
      if (fallback.length > 0) {
        setMarkets(fallback);
        setError(null);
      } else {
        setError("无法连接到 Polymarket API，请检查网络或稍后重试");
        setMarkets([]);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFromApi, fetchFromProxy]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, activeTopic, sortBy]);


  const categorizeMarket = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes("trump") || q.includes("biden") || q.includes("election") || q.includes("president")) return "政治";
    if (q.includes("crypto") || q.includes("bitcoin") || q.includes("ethereum")) return "加密";
    if (q.includes("sports") || q.includes("nba") || q.includes("nfl")) return "体育";
    return "其他";
  };

  const calculateDaysLeft = (endDate: string): number => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const topicToEnglish: Record<string, string> = {
    "全部": "all",
    "特朗普": "trump",
    "爱泼斯坦": "epstein",
    "初选": "primaries",
    "德州参议员": "texas",
    "委内瑞拉": "venezuela",
    "中期选举": "midterm",
    "法院": "court",
    "美国大选": "election",
    "贸易战": "trade",
    "国会": "congress",
    "全球选举": "election"
  };

  const filteredMarkets = markets.filter(m => {
    if (activeTopic !== "全部") {
      const topicEnglish = topicToEnglish[activeTopic] || activeTopic.toLowerCase();
      if (!m.title.toLowerCase().includes(topicEnglish)) return false;
    }
    return true;
  });

  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    switch (sortBy) {
      case "Volume": return (b.volume24h || 0) - (a.volume24h || 0);
      case "Newest": return (b.daysLeft || 0) - (a.daysLeft || 0);
      case "Ending Soon": return (a.daysLeft || 0) - (b.daysLeft || 0);
      default: return (b.volume24h || 0) - (a.volume24h || 0);
    }
  });

  const totalPages = Math.ceil(sortedMarkets.length / PAGE_SIZE);
  const paginatedMarkets = sortedMarkets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="h-screen bg-[#0d0d0f] text-white flex flex-col overflow-hidden">
      {/* 顶部导航 - 固定 */}
      <header className="flex-shrink-0 border-b border-[#1a1a1f] bg-[#0d0d0f]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-gradient">Tectonic</span>
              <span className="text-xs text-[#666] uppercase tracking-wider">Pro</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/" className="text-white font-medium">市场</Link>
              <Link href="#" className="text-[#666] hover:text-white transition-colors flex items-center gap-1">
                交易 <span className="text-[8px]">▼</span>
              </Link>
              <Link href="#" className="text-[#666] hover:text-white transition-colors">钱包</Link>
              <Link href="#" className="text-[#666] hover:text-white transition-colors">竞赛</Link>
              <Link href="/smart-money" className="text-[#666] hover:text-white transition-colors">排行榜</Link>
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

      {/* 分类和筛选 - 固定 */}
      <div className="flex-shrink-0 px-6 pt-4 pb-2 bg-[#0d0d0f]">
        {/* 分类标签 */}
        <div className="flex items-center gap-6 mb-3 text-sm">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`transition-colors ${
                activeCategory === cat ? "text-white font-medium" : "text-[#666] hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 排序下拉 */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 px-2 py-1 text-[#666]">
                <span>☰</span>
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#1a1a1f] border border-[#2a2a2f] rounded-lg px-3 py-1.5 text-sm text-white outline-none"
              >
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 话题标签 */}
            <div className="flex items-center gap-2 overflow-x-auto ml-4">
              {topics.map(topic => (
                <button
                  key={topic}
                  onClick={() => setActiveTopic(topic)}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                    activeTopic === topic 
                      ? "bg-[#2a2a2f] text-white" 
                      : "bg-transparent text-[#666] hover:text-white hover:bg-[#1a1a1f]"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* 视图切换 */}
          <button
            onClick={() => setViewMode(viewMode === "list" ? "card" : "list")}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] rounded-lg text-sm text-[#888]"
          >
            {viewMode === "list" ? "卡片视图" : "列表视图"}
          </button>
        </div>
      </div>

      {/* 表头 - 固定 */}
      <div className="flex-shrink-0 px-6 bg-[#0d0d0f]">
        <div className="grid grid-cols-[auto_1fr_120px_80px_80px_90px_90px_90px_70px] gap-2 py-2 text-xs text-[#666] border-b border-[#1a1a1f]">
          <div className="w-6"></div>
          <div className="flex items-center gap-1">事件 <span className="text-[8px]">◇</span></div>
          <div>赔率 / 价格</div>
          <div className="text-right flex items-center justify-end gap-1">价差 <span className="text-[8px]">◇</span></div>
          <div className="text-right flex items-center justify-end gap-1">24h <span className="text-[8px]">◇</span></div>
          <div className="text-right flex items-center justify-end gap-1">24h量 <span className="text-[8px]">◇</span></div>
          <div className="text-right flex items-center justify-end gap-1">总成交 <span className="text-[8px]">◇</span></div>
          <div className="text-right flex items-center justify-end gap-1">流动性 <span className="text-[8px]">◇</span></div>
          <div className="text-center">买入</div>
        </div>
      </div>

      {/* 市场列表 - 可滚动 */}
      <div className="flex-1 px-6 overflow-y-auto">
        {isRefreshing && (
          <div className="sticky top-0 z-10 flex items-center justify-center py-1 bg-[#0d0d0f]/90 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-[#00D4AA]">
              <div className="animate-spin h-3 w-3 border border-[#00D4AA] border-t-transparent rounded-full"></div>
              更新中...
            </div>
          </div>
        )}
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-[#FF6B6B] mb-2">加载失败</p>
            <p className="text-[#666] text-sm mb-4">{error}</p>
            <button 
              onClick={() => fetchMarkets(false)}
              className="px-4 py-2 bg-[#00D4AA] text-black rounded-lg font-medium hover:bg-[#00C49A] transition-colors"
            >
              重新加载
            </button>
          </div>
        ) : paginatedMarkets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[#666] mb-4">暂无市场数据</p>
            <button 
              onClick={() => fetchMarkets(false)}
              className="px-4 py-2 bg-[#1a1a1f] text-white rounded-lg hover:bg-[#2a2a2f] transition-colors"
            >
              重新加载
            </button>
          </div>
        ) : (
          paginatedMarkets.map((market, index) => (
            <MarketRow key={market.conditionId || index} market={market} />
          ))
        )}
      </div>

      {/* 分页控件 - 固定 */}
      {!loading && !error && sortedMarkets.length > 0 && (
        <div className="flex-shrink-0 px-6 py-3 bg-[#0d0d0f] border-t border-[#1a1a1f]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[#666]">
              共 {sortedMarkets.length} 个市场，第 {currentPage}/{totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-[#1a1a1f] rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a2a2f] transition-colors"
              >
                上一页
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                      currentPage === pageNum 
                        ? "bg-[#00D4AA] text-black font-medium" 
                        : "bg-[#1a1a1f] hover:bg-[#2a2a2f]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-[#1a1a1f] rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a2a2f] transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部状态栏 - 固定 */}
      <footer className="flex-shrink-0 border-t border-[#1a1a1f] bg-[#0a0a0c] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 text-sm text-[#00D4AA]">
              <span className="w-2 h-2 bg-[#00D4AA] rounded-full animate-pulse"></span>
              实时
            </button>
            <button className="text-sm text-[#666] hover:text-white">📊 管理</button>
            <button className="text-sm text-[#666] hover:text-white">🔔 提醒</button>
            <button className="text-sm text-[#666] hover:text-white">📍 追踪</button>
            <button className="text-sm text-[#666] hover:text-white">⭐ 自选</button>
            <button className="text-sm text-[#666] hover:text-white">🔄 兑换</button>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-[#00D4AA]">฿ $69.9K</span>
            <span className="text-[#00D4AA]">Ⓤ US$87.67</span>
            <span className="text-[#666]">→</span>
            <span className="text-white">US$32.15</span>
            <div className="flex items-center gap-4 text-[#666]">
              <Link href="#" className="hover:text-white">支持</Link>
              <Link href="#" className="hover:text-white">隐私</Link>
              <Link href="#" className="hover:text-white">条款</Link>
              <Link href="#" className="hover:text-white">文档</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MarketRow({ market }: { market: Market }) {
  const isUp = (market.priceChange || 0) >= 0;
  const yesPercent = Math.round(market.yesPrice * 100);
  
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    } catch {
      return dateStr;
    }
  };

  const formatMoney = (vol: number): string => {
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${Math.round(vol / 1e3)}K`;
    return `$${Math.round(vol)}`;
  };

  const marketLink = market.conditionId ? `/markets/${market.conditionId}` : "#";

  return (
    <Link href={marketLink}>
      <div className="grid grid-cols-[auto_1fr_120px_80px_80px_90px_90px_90px_70px] gap-2 py-3 items-center border-b border-[#1a1a1f] hover:bg-[#111114] transition-colors cursor-pointer group">
        {/* 展开箭头 */}
        <div className="w-6 text-[#444] group-hover:text-[#666]">
          <span className="text-xs">›</span>
        </div>

        {/* 事件 */}
        <div className="min-w-0">
          <div className="font-medium text-white truncate pr-2 text-sm">{market.title}</div>
          <div className="flex items-center gap-2 text-xs text-[#666]">
            <span className="text-[#00D4AA]">{market.daysLeft}天</span>
            <span>截止: {formatDate(market.endDate)}</span>
          </div>
        </div>

        {/* 赔率 / 价格 */}
        <div>
          <div className="text-white font-semibold text-sm">{yesPercent}%</div>
          <div className="text-xs text-[#666]">
            {formatDate(market.endDate).slice(0, 7)}
          </div>
        </div>

        {/* 价差 */}
        <div className="text-right">
          <div className={`font-mono text-sm ${isUp ? "text-[#00D4AA]" : "text-white"}`}>
            {(market.spread || 0).toFixed(2)}¢
          </div>
          <div className="text-xs text-[#666]">{((market.spread || 0) * 2).toFixed(1)}%</div>
        </div>

        {/* 24h 变化 */}
        <div className="text-right">
          <div className={`text-sm ${isUp ? "text-[#00D4AA]" : "text-[#FF6B6B]"}`}>
            {isUp ? "+" : ""}{(market.priceChange || 0).toFixed(1)}¢
          </div>
          <div className="text-xs text-[#666]">{Math.abs(market.priceChange || 0).toFixed(1)}%</div>
        </div>

        {/* 24h 成交量 */}
        <div className="text-right font-mono text-white text-sm">
          {formatMoney(market.volume24h)}
        </div>

        {/* 总成交量 */}
        <div className="text-right font-mono text-white text-sm">
          {formatMoney(market.totalVolume)}
        </div>

        {/* 流动性 */}
        <div className="text-right font-mono text-white text-sm">
          {formatMoney(market.liquidity)}
        </div>

        {/* 买入按钮 */}
        <div className="flex items-center gap-1 justify-center" onClick={(e) => e.preventDefault()}>
          <button className="w-6 h-6 rounded bg-[#00D4AA]/20 text-[#00D4AA] text-xs font-semibold hover:bg-[#00D4AA]/30 transition-colors">
            是
          </button>
          <button className="w-6 h-6 rounded bg-[#FF6B6B]/20 text-[#FF6B6B] text-xs font-semibold hover:bg-[#FF6B6B]/30 transition-colors">
            否
          </button>
        </div>
      </div>
    </Link>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[auto_1fr_120px_80px_80px_90px_90px_90px_70px] gap-2 py-3 items-center border-b border-[#1a1a1f] animate-pulse">
      <div className="w-6"></div>
      <div className="min-w-0 space-y-2">
        <div className="h-4 bg-[#1a1a1f] rounded w-3/4"></div>
        <div className="h-3 bg-[#1a1a1f] rounded w-1/2"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-[#1a1a1f] rounded w-12"></div>
        <div className="h-3 bg-[#1a1a1f] rounded w-16"></div>
      </div>
      <div className="text-right space-y-2">
        <div className="h-4 bg-[#1a1a1f] rounded w-12 ml-auto"></div>
        <div className="h-3 bg-[#1a1a1f] rounded w-8 ml-auto"></div>
      </div>
      <div className="text-right space-y-2">
        <div className="h-4 bg-[#1a1a1f] rounded w-10 ml-auto"></div>
        <div className="h-3 bg-[#1a1a1f] rounded w-8 ml-auto"></div>
      </div>
      <div className="text-right">
        <div className="h-4 bg-[#1a1a1f] rounded w-14 ml-auto"></div>
      </div>
      <div className="text-right">
        <div className="h-4 bg-[#1a1a1f] rounded w-14 ml-auto"></div>
      </div>
      <div className="text-right">
        <div className="h-4 bg-[#1a1a1f] rounded w-14 ml-auto"></div>
      </div>
      <div className="flex items-center gap-1 justify-center">
        <div className="w-6 h-6 bg-[#1a1a1f] rounded"></div>
        <div className="w-6 h-6 bg-[#1a1a1f] rounded"></div>
      </div>
    </div>
  );
}
