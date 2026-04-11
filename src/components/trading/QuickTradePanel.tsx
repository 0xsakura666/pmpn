"use client";

import { useState } from "react";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { usePolymarket, usePolymarketTrade } from "@/hooks/usePolymarket";
import { useAccount, useDisconnect } from "wagmi";
import { getCompactOutcomeLabel, normalizeOutcomeLabel } from "@/lib/outcome-label";

interface QuickTradePanelProps {
  marketTitle: string;
  yesPrice: number;
  noPrice: number;
  yesLabel?: string;
  noLabel?: string;
  yesTokenId?: string;
  noTokenId?: string;
  tickSize?: string;
  negRisk?: boolean;
  onTradeSuccess?: (orderId: string) => void;
}

export function QuickTradePanel({
  marketTitle,
  yesPrice,
  noPrice,
  yesLabel = "Yes",
  noLabel = "No",
  yesTokenId,
  noTokenId,
  tickSize = "0.01",
  negRisk = false,
  onTradeSuccess,
}: QuickTradePanelProps) {
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, isAuthenticating, authenticate } = usePolymarket();
  const { placeOrder, isSubmitting, isReady } = usePolymarketTrade();

  const normalizedYesLabel = normalizeOutcomeLabel(yesLabel, "Yes");
  const normalizedNoLabel = normalizeOutcomeLabel(noLabel, "No");
  const compactYesLabel = getCompactOutcomeLabel(normalizedYesLabel, 10);
  const compactNoLabel = getCompactOutcomeLabel(normalizedNoLabel, 10);

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
      setError("Token ID not available for this market");
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
      setSuccess(`Order placed! ID: ${result.orderID?.slice(0, 10)}...`);
      setAmount("");
      setLimitPrice("");
      onTradeSuccess?.(result.orderID!);
    } else {
      setError(result.errorMsg || "Order failed");
    }
  };

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <h3 className="font-['Space_Grotesk'] font-semibold">快速交易</h3>

      {/* Authentication Status */}
      {!isConnected ? (
        <div className="space-y-3">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            先连接钱包，再完成一次签名验证即可开始交易
          </p>
          <WalletButton className="w-full py-3 text-center" />
        </div>
      ) : !isAuthenticated ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-[hsl(var(--muted-foreground))]">钱包已连接，还需签名验证才能交易</span>
          </div>
          <button
            onClick={authenticate}
            disabled={isAuthenticating}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isAuthenticating ? "签名中..." : "签名验证"}
          </button>
          <button
            onClick={() => disconnect()}
            className="w-full py-2 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            断开连接
          </button>
        </div>
      ) : (
        <>
          {/* Connected Status */}
          <div className="flex items-center gap-2 text-sm text-[var(--up)]">
            <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
            可以交易
          </div>

          {/* Order Type Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
            <button
              onClick={() => setOrderType("market")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                orderType === "market"
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              市价单
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                orderType === "limit"
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
              }`}
            >
              限价单
            </button>
          </div>

          {/* Side Selection */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedSide("yes")}
              className={`py-3 rounded-lg font-semibold transition-all ${
                selectedSide === "yes"
                  ? "bg-[var(--up)] text-black"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[var(--up)]/20"
              }`}
            >
              {yesLabel} ${yesPrice.toFixed(2)}
            </button>
            <button
              onClick={() => setSelectedSide("no")}
              className={`py-3 rounded-lg font-semibold transition-all ${
                selectedSide === "no"
                  ? "bg-[var(--down)] text-black"
                  : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[var(--down)]/20"
              }`}
            >
              {noLabel} ${noPrice.toFixed(2)}
            </button>
          </div>

          {/* Limit Price Input */}
          {orderType === "limit" && (
            <div className="space-y-2">
              <label className="text-sm text-[hsl(var(--muted-foreground))]">
                限价
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
                  $
                </span>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={price.toFixed(3)}
                  step="0.001"
                  min="0.001"
                  max="0.999"
                  className="w-full pl-8 pr-4 py-3 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-lg font-mono focus:outline-none focus:border-[hsl(var(--primary))]"
                />
              </div>
            </div>
          )}

      {/* Amount Input */}
      <div className="space-y-2">
        <label className="text-sm text-[hsl(var(--muted-foreground))]">
          金额 (USDC)
        </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] text-lg font-mono focus:outline-none focus:border-[hsl(var(--primary))]"
              />
            </div>
            <div className="flex gap-2">
              {[10, 50, 100, 500].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className="flex-1 py-1.5 text-xs rounded bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] transition-colors"
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

      {/* Trade Summary */}
      {amount && parseFloat(amount) > 0 && (
        <div className="space-y-2 pt-4 border-t border-[hsl(var(--border))]">
          <div className="flex justify-between text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">份额</span>
            <span className="font-mono">{shares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">均价</span>
            <span className="font-mono">${price.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[hsl(var(--muted-foreground))]">预期收益</span>
            <span className="font-mono text-[var(--up)]">
              ${potentialReturn.toFixed(2)} (+{((potentialProfit / parseFloat(amount)) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      )}

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-[var(--down)]/10 border border-[var(--down)]/30">
              <p className="text-sm text-[var(--down)]">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-[var(--up)]/10 border border-[var(--up)]/30">
              <p className="text-sm text-[var(--up)]">{success}</p>
            </div>
          )}

          {/* Trade Button */}
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isSubmitting || !isReady || (orderType === "limit" && !limitPrice)}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
              selectedSide === "yes"
                ? "bg-[var(--up)] hover:bg-[var(--up)]/90 text-black"
                : "bg-[var(--down)] hover:bg-[var(--down)]/90 text-black"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? "提交中..." : `买入 ${selectedSide === "yes" ? compactYesLabel : compactNoLabel}`}
          </button>

          {/* Warning for missing token IDs */}
          {!(selectedSide === "yes" ? yesTokenId : noTokenId) && (
            <p className="text-xs text-center text-yellow-500">
              该市场未配置 Token ID
            </p>
          )}
        </>
      )}
    </div>
  );
}
