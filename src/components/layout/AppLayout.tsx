"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { MobileNav, MobileMenu } from "./MobileNav";

interface AppLayoutProps {
  children: ReactNode;
  showMobileNav?: boolean;
}

export function AppLayout({ children, showMobileNav = true }: AppLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isImmersiveDetailPage = /^\/(markets|events)\/[^/]+$/.test(pathname || "");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      {!isImmersiveDetailPage && (
        <Header
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMenuOpen={isMobileMenuOpen}
        />
      )}

      {!isImmersiveDetailPage && (
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className={`flex-1 overflow-y-auto ${!isImmersiveDetailPage && showMobileNav ? "pb-[var(--mobile-nav-height)] md:pb-0" : "pb-0"}`}>
        {children}
      </main>

      {showMobileNav && !isImmersiveDetailPage && <MobileNav />}
    </div>
  );
}

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-[var(--container-max)]",
  full: "max-w-full",
};

export function PageContainer({
  children,
  className,
  maxWidth = "xl",
}: PageContainerProps) {
  return (
    <div className={`mx-auto px-4 md:px-6 py-4 md:py-6 ${maxWidthClasses[maxWidth]} ${className || ""}`}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 mb-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--text-disabled)] mt-1">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 mt-3 md:mt-0">{actions}</div>}
    </div>
  );
}
