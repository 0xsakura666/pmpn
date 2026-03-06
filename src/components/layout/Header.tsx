"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Menu, X } from "lucide-react";
import { useState, useCallback } from "react";
import { mainNavItems, isActiveRoute } from "@/config/navigation";
import { WalletButton } from "@/components/auth/ConnectWallet";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() =>
    pathname === "/" ? (searchParams.get("search") || "") : ""
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/?search=${encodeURIComponent(q)}`);
    } else {
      router.push("/");
    }
    setIsSearchOpen(false);
  }, [router, searchQuery]);

  return (
    <header className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-base)]/90 backdrop-blur-md sticky top-0 z-[var(--z-sticky)]">
      <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-4 md:px-6 h-[var(--header-height)]">
        {/* Left: Logo & Nav */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMenuToggle}
            className="md:hidden"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] bg-clip-text text-transparent">
              Tectonic
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {mainNavItems.map(({ href, label, icon: Icon }) => {
              const isActive = isActiveRoute(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-1.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]"
                      : "text-[var(--text-disabled)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Search & Wallet */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Desktop Search */}
          <form onSubmit={handleSearch} className="hidden md:block">
            <div className="flex items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--bg-elevated)] px-3.5 py-2 ring-1 ring-[var(--border-default)] focus-within:ring-[var(--border-focus)] transition-shadow">
              <Search className="h-4 w-4 text-[var(--text-disabled)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索市场..."
                className="w-36 lg:w-44 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-[var(--text-disabled)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </form>

          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="md:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Wallet Button */}
          <WalletButton />
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {isSearchOpen && (
        <div className="absolute left-0 right-0 top-[var(--header-height)] bg-[var(--bg-base)] border-b border-[var(--border-default)] p-4 md:hidden">
          <form onSubmit={handleSearch}>
            <div className="flex items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--bg-elevated)] px-3.5 py-2.5 ring-1 ring-[var(--border-default)] focus-within:ring-[var(--border-focus)]">
              <Search className="h-4 w-4 text-[var(--text-disabled)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索市场..."
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="text-[var(--text-disabled)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
