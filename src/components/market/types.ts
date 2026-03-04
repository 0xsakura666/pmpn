export interface SubMarket {
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  endDate: string;
  slug: string;
  daysLeft: number;
  yesTokenId: string;
  noTokenId: string;
}

export interface EventGroup {
  id: string;
  title: string;
  description: string;
  image: string;
  slug: string;
  category: string;
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  markets: SubMarket[];
  daysLeft: number;
}

export type SortOption = "Trending" | "Volume" | "Newest" | "Ending Soon";

export type ViewMode = "card" | "list";

export interface CategoryFilter {
  value: string;
  label: string;
}

export const CATEGORIES: CategoryFilter[] = [
  { value: "all", label: "全部" },
  { value: "政治", label: "政治" },
  { value: "加密", label: "加密" },
  { value: "体育", label: "体育" },
  { value: "科技", label: "科技" },
  { value: "经济", label: "经济" },
  { value: "娱乐", label: "娱乐" },
  { value: "其他", label: "其他" },
];

export const PAGE_SIZE = 12;
