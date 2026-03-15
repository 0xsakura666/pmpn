export interface SubMarket {
  conditionId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesLabel: string;
  noLabel: string;
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
  tags?: string[];
  volume24h: number;
  totalVolume: number;
  liquidity: number;
  markets: SubMarket[];
  daysLeft: number;
  isShortTerm?: boolean;
  trendingRank?: number;
}

export type SortOption = "Trending" | "Volume" | "Newest" | "Ending Soon";

export type ViewMode = "card" | "list";

export interface CategoryFilter {
  value: string;
  label: string;
}

export const PAGE_SIZE = 12;
