"use client";

import { useEffect, useState } from "react";

type TradeItem = {
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  outcome?: string;
  proxyWallet?: string;
};

export function RecentTradesPanel({ tokenId, limit = 12 }: { tokenId?: string; limit?: number }) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tokenId) {
      setTrades([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/trades?market=${encodeURIComponent(tokenId)}&limit=${limit}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setTrades(Array.isArray(data?.trades) ? data.trades : []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTrades([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [tokenId, limit]);

  if (loading) {
    return <div className="py-8 text-center text-xs text-[#7d818d]">加载成交中...</div>;
  }

  if (trades.length === 0) {
    return <div className="py-8 text-center text-xs text-[#7d818d]">暂无最新成交</div>;
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 px-1 text-[10px] text-[#6f7682]">
        <span>方向</span>
        <span className="text-right">价格</span>
        <span className="text-right">数量</span>
        <span className="text-right">时间</span>
      </div>
      {trades.slice(0, limit).map((trade, index) => {
        const timeLabel = trade.timestamp
          ? new Date(trade.timestamp).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "--";
        const sideColor = trade.side === "BUY" ? "text-[#0ECB81]" : "text-[#F6465D]";
        return (
          <div key={`${trade.timestamp}-${trade.price}-${index}`} className="grid grid-cols-4 rounded-xl bg-[#111319] px-2 py-2 text-[11px]">
            <span className={`font-medium ${sideColor}`}>{trade.side === "BUY" ? "买" : "卖"}</span>
            <span className={`text-right font-mono ${sideColor}`}>{Math.round((trade.price || 0) * 100)}</span>
            <span className="text-right font-mono text-white">{(trade.size || 0).toFixed(1)}</span>
            <span className="text-right text-[#8a8e99]">{timeLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
