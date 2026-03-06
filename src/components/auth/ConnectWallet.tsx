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

const WALLET_ICONS: Record<string, string> = {
  MetaMask: "🦊",
  "Coinbase Wallet": "🔵",
  WalletConnect: "🔗",
  Injected: "💉",
  "Browser Wallet": "🌐",
};

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const handleConnect = async (connector: typeof connectors[0]) => {
    setConnectingWallet(connector.uid);
    try {
      await connect({ connector });
      setShowWalletModal(false);
    } catch (error) {
      console.error("Failed to connect:", error);
    } finally {
      setConnectingWallet(null);
    }
  };

  if (!isConnected) {
    return (
      <>
        <button
          onClick={() => setShowWalletModal(true)}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-[#00D4AA] text-black font-semibold hover:bg-[#00C49A] transition-colors disabled:opacity-50"
        >
          {isPending ? "连接中..." : "登录"}
        </button>

        {/* Wallet Selection Modal */}
        {showWalletModal && (
          <div className="fixed inset-0 z-[200] overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-4 sm:items-center sm:p-6">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowWalletModal(false)}
            />
            <div className="relative my-2 w-full max-w-md max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-3rem)] overflow-hidden bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))]">
                  <h2 className="text-xl font-['Space_Grotesk'] font-bold">连接钱包</h2>
                  <button
                    onClick={() => setShowWalletModal(false)}
                    className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Wallet List */}
                <div className="p-4 space-y-2 overflow-y-auto max-h-[55vh]">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      onClick={() => handleConnect(connector)}
                      disabled={connectingWallet !== null}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.7)] hover:border-[hsl(var(--primary))] border border-transparent transition-all disabled:opacity-50"
                    >
                      <span className="text-2xl">
                        {WALLET_ICONS[connector.name] || "👛"}
                      </span>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{connector.name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {connector.name === "MetaMask" && "流行的浏览器钱包"}
                          {connector.name === "Coinbase Wallet" && "Coinbase 官方钱包"}
                          {connector.name === "WalletConnect" && "支持多种钱包"}
                          {connector.name === "Injected" && "使用已安装的钱包"}
                          {!["MetaMask", "Coinbase Wallet", "WalletConnect", "Injected"].includes(connector.name) && "连接钱包"}
                        </div>
                      </div>
                      {connectingWallet === connector.uid ? (
                        <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.3]">
                  <p className="text-xs text-center text-[hsl(var(--muted-foreground))]">
                    连接钱包即表示您同意我们的服务条款和隐私政策
                  </p>
                </div>
            </div>
            </div>
          </div>
        )}
      </>
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
          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[hsl(var(--background))] border border-[hsl(var(--border))] shadow-xl z-50 overflow-hidden">
            <a
              href="/profile"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <span>👤</span>
              我的资料
            </a>
            <a
              href="/positions"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <span>📊</span>
              我的持仓
            </a>
            <a
              href="/settings"
              className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <span>⚙️</span>
              设置
            </a>
            <hr className="border-[hsl(var(--border))]" />
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm text-[var(--down)] hover:bg-[var(--down)]/10 transition-colors"
            >
              <span>🚪</span>
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
