"use client";

import { usePolymarket, usePolymarketPositions, usePolymarketOrders } from "@/hooks/usePolymarket";
import { useState } from "react";

export function PositionsPanel() {
  const [activeTab, setActiveTab] = useState<"positions" | "orders">("positions");
  const { isAuthenticated, address } = usePolymarket();
  const { positions, isLoading: positionsLoading, refetch: refetchPositions } = usePolymarketPositions();
  const { orders, isLoading: ordersLoading, cancelOrder, cancelAllOrders, refetch: refetchOrders } = usePolymarketOrders();

  if (!address) {
    return (
      <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
        <h3 className="text-sm font-semibold text-white mb-3">持仓 / 订单</h3>
        <p className="text-xs text-[#8b8d98]">连接钱包后查看当前持仓与挂单。</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[#22252f] bg-[#15161c] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex rounded-2xl bg-[#0f1015] p-1 text-xs">
          <button
            onClick={() => setActiveTab("positions")}
            className={`rounded-xl px-3 py-2 font-medium transition ${
              activeTab === "positions" ? "bg-[#1d2028] text-white" : "text-[#7d818d]"
            }`}
          >
            持仓 ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`rounded-xl px-3 py-2 font-medium transition ${
              activeTab === "orders" ? "bg-[#1d2028] text-white" : "text-[#7d818d]"
            }`}
          >
            订单 ({orders.length})
          </button>
        </div>
        <button
          onClick={() => {
            refetchPositions();
            refetchOrders();
          }}
          className="rounded-full p-2 text-[#7d818d] hover:bg-[#1d2028] hover:text-white transition-colors"
          title="刷新"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {activeTab === "positions" && (
        <div className="space-y-2">
          {positionsLoading ? (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
            </div>
          ) : positions.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">暂无持仓</p>
          ) : (
            positions.map((pos) => (
              <div key={pos.asset} className="rounded-2xl bg-[#0f1015] p-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{pos.title}</div>
                    <div className={pos.outcome === "Yes" ? "text-[#0ECB81]" : "text-[#F6465D]"}>{pos.outcome}</div>
                  </div>
                  <div className="text-right text-[#c9ccd5]">
                    <div className="font-mono">{pos.size.toFixed(2)}</div>
                    <div className="text-[#757985]">@ ${pos.avgPrice.toFixed(3)}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[#757985]">
                  <span>P&L</span>
                  <span className={pos.cashPnl >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"}>
                    {pos.cashPnl >= 0 ? "+" : ""}${pos.cashPnl.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-2">
          {!isAuthenticated ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">需要先签名验证</p>
          ) : ordersLoading ? (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-[#0ECB81]" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8b8d98]">暂无挂单</p>
          ) : (
            <>
              {orders.length > 1 && (
                <button
                  onClick={cancelAllOrders}
                  className="w-full rounded-2xl border border-[#F6465D]/30 py-2 text-xs text-[#F6465D] hover:bg-[#F6465D]/10 transition"
                >
                  取消所有订单
                </button>
              )}
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl bg-[#0f1015] p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className={order.side === "BUY" ? "text-[#0ECB81]" : "text-[#F6465D]"}>
                      {order.side} {order.outcome}
                    </span>
                    <button onClick={() => cancelOrder(order.id)} className="text-[#F6465D]">
                      取消
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[#757985]">
                    <span>${order.price}</span>
                    <span>{(parseFloat(order.original_size) / 1e6).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
