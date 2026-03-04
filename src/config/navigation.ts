import {
  LayoutGrid,
  TrendingUp,
  Wallet,
  Trophy,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  external?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const mainNavItems: NavItem[] = [
  { href: "/", label: "市场", icon: LayoutGrid },
  { href: "/trade", label: "交易", icon: TrendingUp },
  { href: "/wallet", label: "钱包", icon: Wallet },
  { href: "/smart-money", label: "排行榜", icon: Trophy },
];

export const secondaryNavItems: NavItem[] = [
  { href: "/positions", label: "持仓", icon: BarChart3 },
];

export const mobileNavItems: NavItem[] = [
  { href: "/", label: "市场", icon: LayoutGrid },
  { href: "/trade", label: "交易", icon: TrendingUp },
  { href: "/wallet", label: "钱包", icon: Wallet },
  { href: "/smart-money", label: "排行榜", icon: Trophy },
];

export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
}
