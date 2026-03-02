"use client";

import { usePolymarket } from "@/hooks/usePolymarket";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function PolymarketAuth() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
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
        <h3 className="font-semibold mb-3">Connect Wallet to Trade</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          Connect your wallet to access Polymarket trading features.
        </p>
        <div className="flex flex-wrap gap-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isConnecting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : connector.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Authenticate with Polymarket</h3>
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          Sign a message to derive your Polymarket API credentials. This allows you to place orders and view your trading history.
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
            {isAuthenticating ? "Signing..." : "Sign to Authenticate"}
          </button>
          <button
            onClick={() => disconnect()}
            className="px-4 py-2 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            Disconnect
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
            <p className="font-semibold text-[var(--up)]">Connected to Polymarket</p>
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
            Logout
          </button>
          <button
            onClick={() => disconnect()}
            className="px-3 py-1.5 text-sm rounded-lg text-[var(--down)] border border-[var(--down)]/30 hover:bg-[var(--down)]/10 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

export function PolymarketAuthCompact() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, isAuthenticating, authenticate, logout } = usePolymarket();

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isConnecting}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
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
          {isAuthenticating ? "Signing..." : "Authenticate"}
        </button>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 text-sm rounded-lg bg-[hsl(var(--muted))] hover:bg-[var(--down)]/20 transition-colors"
        >
          Disconnect
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
        Logout
      </button>
    </div>
  );
}
