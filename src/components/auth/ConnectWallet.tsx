"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePolymarket } from "@/hooks/usePolymarket";
import { cn } from "@/lib/utils";

export function ConnectWallet() {
  return <WalletButton />;
}

interface WalletButtonProps {
  className?: string;
  connectLabel?: string;
  authenticatingLabel?: string;
  authenticateLabel?: string;
}

export function WalletButton({
  className,
  connectLabel = "连接钱包",
  authenticatingLabel = "验证中...",
  authenticateLabel = "验证身份",
}: WalletButtonProps = {}) {
  const { isAuthenticated, isAuthenticating, authenticate } = usePolymarket();

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
        const baseButtonClass = cn(
          "rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          className
        );

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              type="button"
              className={cn(baseButtonClass, "bg-[#00D4AA] px-4 py-2 text-black hover:bg-[#00C49A]")}
            >
              {connectLabel}
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              type="button"
              className={cn(baseButtonClass, "bg-[var(--down)] px-4 py-2 text-white hover:opacity-90")}
            >
              切换到 Polygon
            </button>
          );
        }

        if (!isAuthenticated) {
          return (
            <button
              onClick={() => void authenticate()}
              type="button"
              disabled={isAuthenticating}
              className={cn(baseButtonClass, "bg-[#F5C542] px-4 py-2 text-black hover:bg-[#E9B71A]")}
            >
              {isAuthenticating ? authenticatingLabel : authenticateLabel}
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            type="button"
            className={cn(baseButtonClass, "flex items-center gap-2 bg-[hsl(var(--muted))] px-4 py-2 hover:bg-[hsl(var(--muted)/0.8)]")}
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
