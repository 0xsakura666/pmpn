"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWallet() {
  return <WalletButton />;
}

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === "authenticated");

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              type="button"
              className="px-4 py-2 rounded-lg bg-[#00D4AA] text-black font-semibold hover:bg-[#00C49A] transition-colors disabled:opacity-50"
            >
              登录
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              type="button"
              className="px-4 py-2 rounded-lg bg-[var(--down)] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              切换网络
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--up)]" />
            <span className="font-mono text-sm">{account.displayName}</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
