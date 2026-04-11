"use client";

import { WalletButton } from "@/components/auth/ConnectWallet";
import { usePolymarket } from "@/hooks/usePolymarket";
import { useAccount, useDisconnect } from "wagmi";

export function PolymarketAuth() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const {
    isAuthenticated,
    isAuthenticating,
    error,
    authenticate,
    logout,
  } = usePolymarket();

  if (!isConnected) {
    return (
      <div className="p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <h3 className="font-semibold mb-3">连接钱包以开始交易</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          先连接钱包，再签名验证 Polymarket 交易身份。
        </p>
        <WalletButton
          className="w-full px-4 py-2 text-center"
          connectLabel="连接钱包"
          authenticateLabel="签名验证"
          authenticatingLabel="签名中..."
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">完成 Polymarket 验证</h3>
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          签名一次以派生 Polymarket API 凭证，之后才能下单和查看交易记录。
        </p>
        {error && (
          <p className="text-sm text-[var(--down)] mb-3">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={authenticate}
            disabled={isAuthenticating}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isAuthenticating ? "签名中..." : "签名验证"}
          </button>
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            断开连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-[var(--up)]/30 bg-[var(--up)]/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-[var(--up)]" />
          <div>
            <p className="font-semibold text-[var(--up)]">已连接到 Polymarket</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            退出验证
          </button>
          <button
            onClick={() => disconnect()}
            className="px-3 py-1.5 text-sm rounded-lg text-[var(--down)] border border-[var(--down)]/30 hover:bg-[var(--down)]/10 transition-colors"
          >
            断开钱包
          </button>
        </div>
      </div>
    </div>
  );
}

export function PolymarketAuthCompact() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, isAuthenticating, authenticate, logout } = usePolymarket();

  if (!isConnected) {
    return (
      <WalletButton
        className="w-full px-4 py-2 text-center"
        connectLabel="连接钱包"
        authenticateLabel="签名验证"
        authenticatingLabel="签名中..."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={authenticate}
          disabled={isAuthenticating}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isAuthenticating ? "签名中..." : "签名验证"}
        </button>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 text-sm rounded-lg bg-[hsl(var(--muted))] hover:bg-[var(--down)]/20 transition-colors"
        >
          断开连接
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--up)]/10 border border-[var(--up)]/30">
        <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
        <span className="font-mono text-sm">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
      </div>
      <button
        onClick={logout}
        className="px-3 py-2 text-sm rounded-lg bg-[hsl(var(--muted))] hover:bg-[var(--down)]/20 transition-colors"
      >
        退出验证
      </button>
    </div>
  );
}
