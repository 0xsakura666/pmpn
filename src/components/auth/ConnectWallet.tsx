"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!address) return;

    setIsSigningIn(true);
    try {
      // Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "登录 Tectonic",
        uri: window.location.origin,
        version: "1",
        chainId: 137, // Polygon
        nonce: generateNonce(),
      });

      const messageToSign = message.prepareMessage();
      const signature = await signMessageAsync({ message: messageToSign });

      // Send to backend for verification
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSign, signature }),
      });

      if (response.ok) {
        // Refresh page to update session
        window.location.reload();
      }
    } catch (error) {
      console.error("Sign in failed:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--muted))]">
          <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
          <span className="font-mono text-sm">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>
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
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isPending ? "连接中..." : `连接 ${connector.name}`}
        </button>
      ))}
    </div>
  );
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? "连接中..." : "连接钱包"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
        <span className="font-mono text-sm">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${showMenu ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))] shadow-xl z-50">
            <a
              href="/profile"
              className="block px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              我的资料
            </a>
            <a
              href="/positions"
              className="block px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              我的持仓
            </a>
            <a
              href="/settings"
              className="block px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              设置
            </a>
            <hr className="border-[hsl(var(--border))]" />
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-[var(--down)] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              断开连接
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function generateNonce() {
  return Math.random().toString(36).substring(2, 15);
}
