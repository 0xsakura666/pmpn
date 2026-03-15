"use client";

import { useState } from "react";
import { usePolymarket, usePolymarketTrade } from "@/hooks/usePolymarket";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button, Card, Input, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UnifiedTradePanelProps {
  marketTitle?: string;
  yesPrice: number;
  noPrice: number;
  yesTokenId?: string;
  noTokenId?: string;
  tickSize?: string;
  negRisk?: boolean;
  onTradeSuccess?: (orderId: string) => void;
  variant?: "default" | "compact";
  className?: string;
}

export function UnifiedTradePanel({
  yesPrice,
  noPrice,
  yesTokenId,
  noTokenId,
  tickSize = "0.01",
  negRisk = false,
  onTradeSuccess,
  variant = "default",
  className,
}: UnifiedTradePanelProps) {
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");

  const { isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, isAuthenticating, authenticate } = usePolymarket();
  const { placeOrder, isSubmitting, isReady } = usePolymarketTrade();

  const isCompact = variant === "compact";
  const price = orderType === "limit" && limitPrice
    ? parseFloat(limitPrice)
    : selectedSide === "yes" ? yesPrice : noPrice;
  const shares = amount && price ? parseFloat(amount) / price : 0;
  const potentialReturn = shares * 1;
  const potentialProfit = potentialReturn - parseFloat(amount || "0");

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    const tokenId = selectedSide === "yes" ? yesTokenId : noTokenId;
    if (!tokenId) {
      toast.error("Token ID 不可用");
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
      toast.success("下单成功！");
      setAmount("");
      setLimitPrice("");
      onTradeSuccess?.(result.orderID!);
    } else {
      toast.error(result.errorMsg || "下单失败");
    }
  };

  const presetAmounts = isCompact ? [10, 50, 100] : [10, 50, 100, 500];
  const padding = isCompact ? "sm" : "lg";
  const buttonSize = isCompact ? "sm" : "md";

  return (
    <Card padding={padding} className={cn("space-y-3", className)}>
      <h3 className={cn("font-semibold", isCompact ? "text-sm" : "text-base")}>
        快速交易
      </h3>

      {!isConnected ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-muted)]">连接钱包开始交易</p>
          <Button
            onClick={() => connect({ connector: connectors[0] })}
            isLoading={isConnecting}
            fullWidth
            size={buttonSize}
          >
            连接钱包
          </Button>
        </div>
      ) : !isAuthenticated ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-[var(--color-warning)]" />
            <span className="text-[var(--text-muted)]">需要签名验证</span>
          </div>
          <Button
            onClick={authenticate}
            isLoading={isAuthenticating}
            fullWidth
            size={buttonSize}
          >
            签名验证
          </Button>
          <Button
            onClick={() => disconnect()}
            variant="secondary"
            fullWidth
            size="sm"
          >
            断开连接
          </Button>
        </div>
      ) : (
        <>
          {/* Status */}
          <div className="flex items-center gap-2 text-xs text-[var(--color-up)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)]" />
            可以交易
          </div>

          {/* Order Type */}
          <div className="flex rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-default)]">
            <button
              onClick={() => setOrderType("market")}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium transition-colors",
                orderType === "market"
                  ? "bg-[var(--brand-primary)] text-black"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              )}
            >
              市价
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium transition-colors",
                orderType === "limit"
                  ? "bg-[var(--brand-primary)] text-black"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
              )}
            >
              限价
            </button>
          </div>

          {/* Side Selection */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedSide("yes")}
              className={cn(
                "py-2 rounded-[var(--radius-md)] text-sm font-semibold transition-all",
                selectedSide === "yes"
                  ? "bg-[var(--color-up)] text-black"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-[var(--color-up-muted)]"
              )}
            >
              Yes {Math.round(yesPrice * 100)}
            </button>
            <button
              onClick={() => setSelectedSide("no")}
              className={cn(
                "py-2 rounded-[var(--radius-md)] text-sm font-semibold transition-all",
                selectedSide === "no"
                  ? "bg-[var(--color-down)] text-white"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-[var(--color-down-muted)]"
              )}
            >
              No {Math.round(noPrice * 100)}
            </button>
          </div>

          {/* Limit Price */}
          {orderType === "limit" && (
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] text-xs">$</span>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={price.toFixed(3)}
                className="w-full pl-6 pr-2 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-muted)] border border-[var(--border-default)] text-sm font-mono focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-disabled)] text-xs">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="金额"
                className="w-full pl-6 pr-2 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-muted)] border border-[var(--border-default)] text-sm font-mono focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div className="flex gap-1">
              {presetAmounts.map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v.toString())}
                  className="flex-1 py-1 text-[10px] rounded-[var(--radius-sm)] bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="flex justify-between text-xs border-t border-[var(--border-default)] pt-2">
              <span className="text-[var(--text-disabled)]">份额: {shares.toFixed(2)}</span>
              <span className="text-[var(--color-up)]">
                +{((potentialProfit / parseFloat(amount)) * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {/* Trade Button */}
          <Button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isSubmitting || !isReady || (orderType === "limit" && !limitPrice)}
            isLoading={isSubmitting}
            variant={selectedSide === "yes" ? "success" : "danger"}
            fullWidth
            size={isCompact ? "md" : "lg"}
          >
            买入 {selectedSide.toUpperCase()}
          </Button>

          {/* Token ID Warning */}
          {!(selectedSide === "yes" ? yesTokenId : noTokenId) && (
            <p className="text-[10px] text-center text-[var(--color-warning)]">
              该市场未配置 Token ID
            </p>
          )}
        </>
      )}
    </Card>
  );
}

export { UnifiedTradePanel as QuickTradePanel };
