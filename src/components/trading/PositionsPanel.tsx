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
      <div className="glass rounded-xl p-5">
        <h3 className="font-['Space_Grotesk'] font-semibold mb-3">Your Portfolio</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Connect wallet to view your positions and orders.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
          <button
            onClick={() => setActiveTab("positions")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "positions"
                ? "bg-[hsl(var(--primary))] text-white"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "orders"
                ? "bg-[hsl(var(--primary))] text-white"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
            }`}
          >
            Orders ({orders.length})
          </button>
        </div>
        <button
          onClick={() => {
            refetchPositions();
            refetchOrders();
          }}
          className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Positions Tab */}
      {activeTab === "positions" && (
        <div className="space-y-3">
          {positionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[hsl(var(--primary))]" />
            </div>
          ) : positions.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
              No positions yet
            </p>
          ) : (
            positions.map((position) => (
              <div
                key={position.asset}
                className="p-3 rounded-lg bg-[hsl(var(--muted))] space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{position.title}</p>
                    <p className={`text-xs ${position.outcome === "Yes" ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                      {position.outcome}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm">{position.size.toFixed(2)} shares</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      @ ${position.avgPrice.toFixed(3)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[hsl(var(--muted-foreground))]">Current Value</span>
                  <span className="font-mono">${position.currentValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[hsl(var(--muted-foreground))]">P&L</span>
                  <span className={`font-mono ${position.cashPnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                    {position.cashPnl >= 0 ? "+" : ""}${position.cashPnl.toFixed(2)} ({position.percentPnl.toFixed(1)}%)
                  </span>
                </div>
                {position.redeemable && (
                  <div className="pt-2 border-t border-[hsl(var(--border))]">
                    <span className="text-xs text-[var(--up)]">✓ Redeemable</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {!isAuthenticated ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
              Authenticate to view orders
            </p>
          ) : ordersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[hsl(var(--primary))]" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-8">
              No open orders
            </p>
          ) : (
            <>
              {orders.length > 1 && (
                <button
                  onClick={cancelAllOrders}
                  className="w-full py-2 text-sm rounded-lg border border-[var(--down)]/30 text-[var(--down)] hover:bg-[var(--down)]/10 transition-colors"
                >
                  Cancel All Orders
                </button>
              )}
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="p-3 rounded-lg bg-[hsl(var(--muted))] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        order.side === "BUY" 
                          ? "bg-[var(--up)]/20 text-[var(--up)]" 
                          : "bg-[var(--down)]/20 text-[var(--down)]"
                      }`}>
                        {order.side}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {order.outcome}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--background))]">
                      {order.order_type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[hsl(var(--muted-foreground))]">Price: </span>
                      <span className="font-mono">${order.price}</span>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--muted-foreground))]">Size: </span>
                      <span className="font-mono">{(parseFloat(order.original_size) / 1e6).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--muted-foreground))]">Filled: </span>
                      <span className="font-mono">{(parseFloat(order.size_matched) / 1e6).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[hsl(var(--muted-foreground))]">Status: </span>
                      <span className="text-[var(--up)]">
                        {order.status.replace("ORDER_STATUS_", "")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelOrder(order.id)}
                    className="w-full py-1.5 text-xs rounded border border-[var(--down)]/30 text-[var(--down)] hover:bg-[var(--down)]/10 transition-colors"
                  >
                    Cancel Order
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
