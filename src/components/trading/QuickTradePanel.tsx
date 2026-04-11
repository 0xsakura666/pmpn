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
    <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">交易</h3>
          <p className="mt-1 truncate text-xs text-[#8b8d98]">{marketTitle}</p>
        </div>
        <div className="rounded-full border border-[#2a2d38] bg-[#0f1015] px-2.5 py-1 text-[11px] text-[#a9adb8]">
          Tick {tickSize}
        </div>
      </div>

      {!isConnected ? (
        <WalletButton className="w-full rounded-2xl px-4 py-3 text-center text-sm" />
      ) : !isAuthenticated ? (
        <div className="space-y-2">
          <div className="rounded-2xl border border-[#2a2d38] bg-[#0f1015] px-3 py-2 text-xs text-[#8b8d98]">
            钱包已连接，还需签名验证才能下单。
          </div>
          <button
            onClick={authenticate}
            disabled={isAuthenticating}
            className="w-full rounded-2xl bg-[#0ECB81] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {isAuthenticating ? "签名中..." : "签名验证"}
          </button>
          <button
            onClick={() => disconnect()}
            className="w-full rounded-2xl border border-[#2a2d38] bg-[#0f1015] px-4 py-2.5 text-xs text-[#a9adb8]"
          >
            断开连接
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#0f1015] p-1">
            <button
              onClick={() => setOrderType("market")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                orderType === "market" ? "bg-[#1d2028] text-white" : "text-[#707480]"
              }`}
            >
              市价单
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                orderType === "limit" ? "bg-[#1d2028] text-white" : "text-[#707480]"
              }`}
            >
              限价单
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedSide("yes")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedSide === "yes"
                  ? "bg-[#0ECB81] text-black"
                  : "bg-[#1b1d25] text-[#a9adb8] hover:bg-[#0ECB81]/15"
              }`}
            >
              买 {yesLabel} {yesPrice.toFixed(2)}
            </button>
            <button
              onClick={() => setSelectedSide("no")}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedSide === "no"
                  ? "bg-[#F6465D] text-white"
                  : "bg-[#1b1d25] text-[#a9adb8] hover:bg-[#F6465D]/15"
              }`}
            >
              买 {noLabel} {noPrice.toFixed(2)}
            </button>
          </div>

          {orderType === "limit" && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#7b7f8a]">限价</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#666b76]">$</span>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={price.toFixed(3)}
                  step="0.001"
                  min="0.001"
                  max="0.999"
                  className="w-full rounded-2xl border border-[#2a2d38] bg-[#0f1015] py-3 pl-8 pr-3 text-sm font-mono text-white outline-none transition focus:border-[#0ECB81]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-[#7b7f8a]">金额 (USDC)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#666b76]">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-2xl border border-[#2a2d38] bg-[#0f1015] py-3 pl-8 pr-3 text-sm font-mono text-white outline-none transition focus:border-[#0ECB81]"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 50, 100, 500].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className="rounded-xl border border-[#242733] bg-[#111319] px-2 py-2 text-[11px] text-[#b1b5c0] hover:bg-[#242733]"
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="space-y-2 rounded-2xl bg-[#0f1015] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#747886]">份额</span>
                <span className="font-mono text-white">{shares.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#747886]">均价</span>
                <span className="font-mono text-white">${price.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#747886]">潜在收益</span>
                <span className={`font-mono ${potentialProfit >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                  ${potentialReturn.toFixed(2)} (+{((potentialProfit / parseFloat(amount)) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[#F6465D]">{error}</p>}
          {success && <p className="text-xs text-[#0ECB81]">{success}</p>}

          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isSubmitting || !isReady || (orderType === "limit" && !limitPrice)}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              selectedSide === "yes" ? "bg-[#0ECB81] text-black hover:bg-[#0ECB81]/90" : "bg-[#F6465D] text-white hover:bg-[#F6465D]/90"
            } disabled:opacity-50`}
          >
            {isSubmitting ? "提交中..." : `买入 ${selectedSide === "yes" ? compactYesLabel : compactNoLabel}`}
          </button>

          {!(selectedSide === "yes" ? yesTokenId : noTokenId) && (
            <p className="text-xs text-center text-[#f59e0b]">
              该市场未配置 Token ID
            </p>
          )}
        </div>
      )}
    </div>
  );
}
