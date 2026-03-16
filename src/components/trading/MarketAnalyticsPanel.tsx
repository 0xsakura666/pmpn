"use client";

import { useEffect, useState } from "react";

interface SummaryItem {
  label: string;
  value: string;
  helper?: string;
  valueClassName?: string;
}

interface SmartMoneyItem {
  address: string;
  name: string | null;
  whaleScore: number;
  winRate: number;
  totalPnl: number;
  recentActivity: string;
}

interface SignalItem {
  id: string;
  name: string | null;
  action: string;
  outcome: string;
  price: number;
  size: number;
  whaleScore: number;
  timestamp: string;
}

function formatMoney(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function MarketAnalyticsPanel({
  summaryItems,
  marketTitle,
}: {
  summaryItems: SummaryItem[];
  marketTitle: string;
}) {
  const [smartMoney, setSmartMoney] = useState<SmartMoneyItem[]>([]);
  const [signals, setSignals] = useState<SignalItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/api/smart-money?limit=3", { signal: controller.signal, cache: "no-store" })
        .then((res) => res.json())
        .catch(() => []),
      fetch("/api/signals?limit=4&minScore=80", { signal: controller.signal, cache: "no-store" })
        .then((res) => res.json())
        .catch(() => []),
    ]).then(([smart, sigs]) => {
      if (!controller.signal.aborted) {
        setSmartMoney(Array.isArray(smart) ? smart : []);
        setSignals(Array.isArray(sigs) ? sigs : []);
      }
    });

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-3 p-3 pb-28">
      <div className="grid grid-cols-2 gap-3">
        {summaryItems.map((item) => (
          <div key={item.label} className="rounded-[20px] border border-[#22252f] bg-[#15161c] p-3">
            <div className="text-[11px] text-[#7d818d]">{item.label}</div>
            <div className={`mt-1 text-lg font-semibold ${item.valueClassName || "text-white"}`}>{item.value}</div>
            {item.helper && <div className="mt-1 text-xs text-[#8b8d98]">{item.helper}</div>}
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-[#22252f] bg-[#15161c] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">智能钱观察</h3>
          <span className="text-[11px] text-[#7d818d]">{marketTitle}</span>
        </div>
        <div className="space-y-2">
          {smartMoney.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">暂无智能钱数据</p>
          ) : (
            smartMoney.map((wallet) => (
              <div key={wallet.address} className="rounded-2xl bg-[#111319] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{wallet.name || wallet.address.slice(0, 8)}</div>
                    <div className="mt-1 text-[11px] text-[#7d818d]">WinRate {wallet.winRate.toFixed(1)}% · {wallet.recentActivity}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#0ECB81]">{wallet.whaleScore}</div>
                    <div className="text-[11px] text-[#7d818d]">{formatMoney(wallet.totalPnl)}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-[20px] border border-[#22252f] bg-[#15161c] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">最新信号</h3>
          <span className="text-[11px] text-[#7d818d]">鲸鱼 / 大额</span>
        </div>
        <div className="space-y-2">
          {signals.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">暂无信号</p>
          ) : (
            signals.map((signal) => {
              const isBuy = signal.action === "buy";
              return (
                <div key={signal.id} className="rounded-2xl bg-[#111319] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{signal.name || "匿名地址"}</div>
                      <div className="mt-1 text-[11px] text-[#7d818d]">{signal.outcome?.toUpperCase?.() || "--"} · {new Date(signal.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${isBuy ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                        {isBuy ? "BUY" : "SELL"} {Math.round((signal.price || 0) * 100)}
                      </div>
                      <div className="text-[11px] text-[#7d818d]">{signal.size.toLocaleString()} · Score {signal.whaleScore}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
