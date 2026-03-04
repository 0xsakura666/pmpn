"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { RealtimeCandlestickChart } from "@/components/charts/RealtimeCandlestickChart";
import { OrderBook } from "@/components/trading/OrderBook";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { Time, CandlestickData } from "lightweight-charts";
import { usePolymarket, usePolymarketTrade, usePolymarketPositions, usePolymarketOrders } from "@/hooks/usePolymarket";
import { useAccount, useConnect, useDisconnect } from "wagmi";

interface MarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

interface MarketData {
  id: string;
  title: string;
  titleOriginal: string;
  description: string;
  slug: string;
  endDate: string;
  image: string;
  tokens: MarketToken[];
  orderBooks: Array<{
    outcome: string;
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
  }>;
  negRisk?: boolean;
  tickSize?: string;
}

type TimeframeType = "1S" | "5S" | "15S" | "1M" | "5M" | "15M" | "1H" | "4H" | "1D";

function QuickTradePanelCompact({
  yesPrice,
  noPrice,
  yesTokenId,
  noTokenId,
  tickSize = "0.01",
  negRisk = false,
}: {
  marketTitle: string;
  yesPrice: number;
  noPrice: number;
  yesTokenId?: string;
  noTokenId?: string;
  tickSize?: string;
  negRisk?: boolean;
}) {
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, isAuthenticating, authenticate } = usePolymarket();
  const { placeOrder, isSubmitting, isReady } = usePolymarketTrade();

  const price = orderType === "limit" && limitPrice 
    ? parseFloat(limitPrice) 
    : selectedSide === "yes" ? yesPrice : noPrice;
  const shares = amount && price ? parseFloat(amount) / price : 0;
  const potentialReturn = shares * 1;
  const potentialProfit = potentialReturn - parseFloat(amount || "0");

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setError(null);
    setSuccess(null);
    const tokenId = selectedSide === "yes" ? yesTokenId : noTokenId;
    if (!tokenId) {
      setError("Token ID not available");
      return;
    }
    const result = await placeOrder({
      tokenId,
      price: orderType === "limit" ? parseFloat(limitPrice) : price,
      size: shares,
      side: "BUY",
      tickSize,
      negRisk,
      orderType: orderType === "market" ? "FOK" : "GTC",
    });
    if (result.success) {
      setSuccess(`下单成功!`);
      setAmount("");
    } else {
      setError(result.errorMsg || "下单失败");
    }
  };

  return (
    <div className="bg-[#1a1a1f] rounded-lg p-3 border border-[#222] space-y-2">
      <h3 className="font-semibold text-sm text-white">快速交易</h3>

      {!isConnected ? (
        <button
          onClick={() => connect({ connector: connectors[0] })}
          disabled={isConnecting}
          className="w-full py-2 rounded-lg bg-[#00D4AA] text-black text-sm font-semibold"
        >
          {isConnecting ? "连接中..." : "连接钱包"}
        </button>
      ) : !isAuthenticated ? (
        <div className="space-y-2">
          <button
            onClick={authenticate}
            disabled={isAuthenticating}
            className="w-full py-2 rounded-lg bg-[#00D4AA] text-black text-sm font-semibold"
          >
            {isAuthenticating ? "签名中..." : "签名验证"}
          </button>
          <button onClick={() => disconnect()} className="w-full py-1.5 text-xs text-[#666] hover:text-white">
            断开连接
          </button>
        </div>
      ) : (
        <>
          {/* Order Type */}
          <div className="flex rounded overflow-hidden border border-[#333] text-xs">
            <button
              onClick={() => setOrderType("market")}
              className={`flex-1 py-1.5 ${orderType === "market" ? "bg-[#00D4AA] text-black" : "bg-[#0d0d0f] text-[#888]"}`}
            >
              市价
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`flex-1 py-1.5 ${orderType === "limit" ? "bg-[#00D4AA] text-black" : "bg-[#0d0d0f] text-[#888]"}`}
            >
              限价
            </button>
          </div>

          {/* Side Selection */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setSelectedSide("yes")}
              className={`py-2 rounded text-sm font-semibold ${
                selectedSide === "yes" ? "bg-[#00D4AA] text-black" : "bg-[#0d0d0f] text-[#888] hover:bg-[#00D4AA]/20"
              }`}
            >
              Yes {Math.round(yesPrice * 100)}¢
            </button>
            <button
              onClick={() => setSelectedSide("no")}
              className={`py-2 rounded text-sm font-semibold ${
                selectedSide === "no" ? "bg-[#FF6B6B] text-black" : "bg-[#0d0d0f] text-[#888] hover:bg-[#FF6B6B]/20"
              }`}
            >
              No {Math.round(noPrice * 100)}¢
            </button>
          </div>

          {/* Limit Price */}
          {orderType === "limit" && (
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666] text-xs">$</span>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={price.toFixed(3)}
                className="w-full pl-6 pr-2 py-1.5 rounded bg-[#0d0d0f] border border-[#333] text-sm font-mono"
              />
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666] text-xs">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="金额"
                className="w-full pl-6 pr-2 py-1.5 rounded bg-[#0d0d0f] border border-[#333] text-sm font-mono"
              />
            </div>
            <div className="flex gap-1">
              {[10, 50, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v.toString())}
                  className="flex-1 py-1 text-[10px] rounded bg-[#0d0d0f] text-[#888] hover:bg-[#222]"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="flex justify-between text-xs border-t border-[#333] pt-2">
              <span className="text-[#666]">份额: {shares.toFixed(2)}</span>
              <span className="text-[#00D4AA]">
                +{((potentialProfit / parseFloat(amount)) * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {error && <p className="text-xs text-[#FF6B6B]">{error}</p>}
          {success && <p className="text-xs text-[#00D4AA]">{success}</p>}

          {/* Trade Button */}
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isSubmitting || !isReady}
            className={`w-full py-2.5 rounded text-sm font-semibold ${
              selectedSide === "yes" ? "bg-[#00D4AA]" : "bg-[#FF6B6B]"
            } text-black disabled:opacity-50`}
          >
            {isSubmitting ? "提交中..." : `买入 ${selectedSide.toUpperCase()}`}
          </button>
        </>
      )}
    </div>
  );
}

function PositionsPanelCompact() {
  const [activeTab, setActiveTab] = useState<"positions" | "orders">("positions");
  const { isAuthenticated, address } = usePolymarket();
  const { positions, isLoading: positionsLoading } = usePolymarketPositions();
  const { orders, isLoading: ordersLoading, cancelOrder } = usePolymarketOrders();

  if (!address) {
    return (
      <div className="bg-[#1a1a1f] rounded-lg p-3 border border-[#222]">
        <h3 className="font-semibold text-sm text-white mb-2">持仓</h3>
        <p className="text-xs text-[#666]">连接钱包查看</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1f] rounded-lg p-3 border border-[#222] space-y-2">
      {/* Tabs */}
      <div className="flex rounded overflow-hidden border border-[#333] text-xs">
        <button
          onClick={() => setActiveTab("positions")}
          className={`flex-1 py-1.5 ${activeTab === "positions" ? "bg-[#00D4AA] text-black" : "bg-[#0d0d0f] text-[#888]"}`}
        >
          持仓 ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 py-1.5 ${activeTab === "orders" ? "bg-[#00D4AA] text-black" : "bg-[#0d0d0f] text-[#888]"}`}
        >
          订单 ({orders.length})
        </button>
      </div>

      {activeTab === "positions" && (
        <div className="max-h-32 overflow-y-auto space-y-1.5">
          {positionsLoading ? (
            <div className="flex justify-center py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00D4AA]" />
            </div>
          ) : positions.length === 0 ? (
            <p className="text-xs text-[#666] text-center py-2">暂无持仓</p>
          ) : (
            positions.slice(0, 3).map((pos) => (
              <div key={pos.asset} className="p-2 rounded bg-[#0d0d0f] text-xs">
                <div className="flex justify-between">
                  <span className={pos.outcome === "Yes" ? "text-[#00D4AA]" : "text-[#FF6B6B]"}>
                    {pos.outcome}
                  </span>
                  <span className="font-mono">{pos.size.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#666]">
                  <span>P&L</span>
                  <span className={pos.cashPnl >= 0 ? "text-[#00D4AA]" : "text-[#FF6B6B]"}>
                    {pos.cashPnl >= 0 ? "+" : ""}${pos.cashPnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="max-h-32 overflow-y-auto space-y-1.5">
          {!isAuthenticated ? (
            <p className="text-xs text-[#666] text-center py-2">需要验证</p>
          ) : ordersLoading ? (
            <div className="flex justify-center py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00D4AA]" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-xs text-[#666] text-center py-2">暂无订单</p>
          ) : (
            orders.slice(0, 3).map((order) => (
              <div key={order.id} className="p-2 rounded bg-[#0d0d0f] text-xs">
                <div className="flex justify-between items-center">
                  <span className={order.side === "BUY" ? "text-[#00D4AA]" : "text-[#FF6B6B]"}>
                    {order.side} {order.outcome}
                  </span>
                  <button
                    onClick={() => cancelOrder(order.id)}
                    className="text-[#FF6B6B] hover:underline text-[10px]"
                  >
                    取消
                  </button>
                </div>
                <div className="flex justify-between text-[#666]">
                  <span>${order.price}</span>
                  <span>{(parseFloat(order.original_size) / 1e6).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>("1M");
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<CandlestickData<Time>[]>([]);

  useEffect(() => {
    fetchMarket();
  }, [resolvedParams.id]);

  const fetchMarket = async () => {
    setLoading(true);
    setError(null);
    try {
      // 首先尝试从 localStorage 读取
      const cached = localStorage.getItem(`market_${resolvedParams.id}`);
      if (cached) {
        const cachedMarket = JSON.parse(cached);
        const yesTokenId = cachedMarket.yesTokenId || "";
        const noTokenId = cachedMarket.noTokenId || "";
        setMarket({
          id: cachedMarket.conditionId,
          title: cachedMarket.title,
          titleOriginal: cachedMarket.title,
          description: cachedMarket.description || "",
          slug: cachedMarket.slug,
          endDate: cachedMarket.endDate,
          image: cachedMarket.image || "",
          tokens: [
            { token_id: yesTokenId, outcome: "Yes", price: cachedMarket.yesPrice, winner: false },
            { token_id: noTokenId, outcome: "No", price: cachedMarket.noPrice, winner: false },
          ],
          orderBooks: [],
        });
        // 从缓存加载后也尝试获取价格历史
        if (yesTokenId) {
          fetchPriceHistory(yesTokenId);
        }
        setLoading(false);
        return;
      }

      // 如果没有缓存，尝试从 API 获取
      const res = await fetch(`/api/markets/${resolvedParams.id}`);
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.message || data.error);
      }
      
      if (!res.ok) {
        throw new Error("Market not found");
      }
      
      setMarket(data);

      // 获取价格历史
      if (data.tokens && data.tokens.length > 0) {
        const yesToken = data.tokens.find((t: MarketToken) => t.outcome === "Yes");
        if (yesToken) {
          fetchPriceHistory(yesToken.token_id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market");
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceHistory = async (tokenId: string) => {
    try {
      const res = await fetch(`/api/markets/${resolvedParams.id}/history?tokenId=${tokenId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          const candlesticks = data.candles.map((c: { time: number; open: number; high: number; low: number; close: number }) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          setPriceHistory(candlesticks);
        } else {
          setPriceHistory([]);
        }
      }
    } catch {
      setPriceHistory([]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4AA] mx-auto mb-4" />
          <p className="text-[#666]">加载市场数据...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#FF6B6B] mb-4">{error || "市场不存在"}</p>
          <Link href="/" className="text-[#00D4AA] hover:underline">
            ← 返回市场列表
          </Link>
        </div>
      </div>
    );
  }

  const yesToken = market.tokens?.find(t => t.outcome === "Yes");
  const noToken = market.tokens?.find(t => t.outcome === "No");
  const yesPrice = yesToken?.price || 0.5;
  const noPrice = noToken?.price || 0.5;

  const yesOrderBook = market.orderBooks?.find(ob => ob.outcome === "Yes");
  const formattedBids = yesOrderBook?.bids?.map(b => ({
    price: parseFloat(b.price),
    size: parseFloat(b.size),
  })) || [];
  const formattedAsks = yesOrderBook?.asks?.map(a => ({
    price: parseFloat(a.price),
    size: parseFloat(a.size),
  })) || [];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0d0d0f] text-white">
      {/* Compact Header */}
      <header className="shrink-0 border-b border-[#222] bg-[#0d0d0f]">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-[#00D4AA]">
              Tectonic
            </Link>
            <Link href="/" className="text-[#666] hover:text-white text-xs">
              ← 返回
            </Link>
            <div className="h-4 w-px bg-[#333]" />
            {market.image && (
              <img src={market.image} alt="" className="w-6 h-6 rounded object-cover" />
            )}
            <h1 className="text-sm font-medium text-white truncate max-w-md">
              {market.title}
            </h1>
            <span className="text-xs text-[#666]">
              截止 {new Date(market.endDate).toLocaleDateString('zh-CN')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Compact Yes/No Prices */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1f] border border-[#222]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#666]">Yes</span>
                <span className="text-sm font-bold text-[#00D4AA]">{Math.round(yesPrice * 100)}¢</span>
              </div>
              <div className="h-3 w-px bg-[#333]" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#666]">No</span>
                <span className="text-sm font-bold text-[#FF6B6B]">{Math.round(noPrice * 100)}¢</span>
              </div>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content - fills remaining height */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Chart Section */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#222]">
          {/* Realtime Chart - takes most space */}
          <div className="flex-1 p-3 min-h-0">
            <div className="h-full bg-[#1a1a1f] rounded-lg border border-[#222] p-2">
              <RealtimeCandlestickChart
                tokenId={yesToken?.token_id}
                initialData={priceHistory}
                height={0}
                defaultTimeframe={selectedTimeframe}
                onTimeframeChange={(tf) => setSelectedTimeframe(tf)}
                defaultChartMode="line"
              />
            </div>
          </div>

          {/* Bottom info bar */}
          <div className="shrink-0 px-3 pb-3">
            <div className="flex items-center gap-3 text-xs">
              {market.tokens?.map((token) => (
                <div key={token.token_id} className="flex items-center gap-2 px-2 py-1 rounded bg-[#1a1a1f]">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    token.outcome === "Yes" 
                      ? "bg-[#00D4AA]/20 text-[#00D4AA]" 
                      : "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                  }`}>
                    {token.outcome}
                  </span>
                  <span className="font-mono text-[#666] text-[10px]">
                    {token.token_id.slice(0, 12)}...
                  </span>
                  <span className="font-bold text-white">${token.price.toFixed(3)}</span>
                </div>
              ))}
              {market.description && (
                <span className="text-[#666] truncate ml-2" title={market.description}>
                  {market.description.slice(0, 60)}...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Trading Sidebar - compact */}
        <div className="w-80 flex flex-col overflow-y-auto">
          <div className="p-3 space-y-3">
            {/* Quick Trade */}
            <QuickTradePanelCompact
              marketTitle={market.title}
              yesPrice={yesPrice}
              noPrice={noPrice}
              yesTokenId={yesToken?.token_id}
              noTokenId={noToken?.token_id}
              tickSize={market.tickSize || "0.01"}
              negRisk={market.negRisk || false}
            />

            {/* Order Book - compact */}
            <div className="bg-[#1a1a1f] rounded-lg p-3 border border-[#222]">
              <h3 className="font-semibold text-sm mb-2 text-white">订单簿</h3>
              {formattedBids.length > 0 || formattedAsks.length > 0 ? (
                <OrderBook bids={formattedBids} asks={formattedAsks} maxDepth={5} />
              ) : (
                <p className="text-xs text-[#666] text-center py-2">暂无数据</p>
              )}
            </div>

            {/* Positions - compact */}
            <PositionsPanelCompact />

            {/* Market Info - compact */}
            <div className="bg-[#1a1a1f] rounded-lg p-3 border border-[#222]">
              <h3 className="font-semibold text-sm mb-2 text-white">市场信息</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#666]">ID</span>
                  <span className="font-mono text-[#888]">{market.id.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">结算</span>
                  <span className="text-white">{new Date(market.endDate).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

