export interface MarketTag {
  label?: string;
  slug?: string;
  forceShow?: boolean;
  forceHide?: boolean;
}

const POLITICS_KEYWORDS =
  /trump|biden|election|president|vote|congress|senate|governor|republican|democrat|kamala|harris|white house|supreme court|iran|iranian|israel|gaza|ukraine|russia|war|regime|military|sanctions|geopolitics|china|taiwan/i;
const CRYPTO_KEYWORDS =
  /crypto|cryptocurrency|bitcoin|ethereum|btc|eth|solana|sol|xrp|doge|token|memecoin|coin|defi|nft|stablecoin|airdrop|walletconnect|wallet/i;
const SPORTS_KEYWORDS =
  /sport|sports|nba|nfl|nhl|mlb|ncaa|soccer|football|baseball|basketball|tennis|golf|ufc|mma|boxing|f1|formula 1|nascar|wwe|championship|playoffs|match|game|team|player|super bowl|world cup|champion|laliga|premier league|champions league|counter[-\s]?strike|cs2|valorant|dota|dota 2|league of legends|league-of-legends|lol esports|esports|lcs|lec|lck|vct|iem|blast|major/i;
const ECONOMY_KEYWORDS =
  /economy|economic|fed|federal reserve|inflation|gdp|interest rate|rates|recession|unemployment|oil|gold|stock|stocks|nasdaq|s&p|dow|treasury|yield|cpi|ppi/i;
const TECH_KEYWORDS =
  /ai|openai|gpt|anthropic|claude|xai|grok|tech|technology|apple|google|alphabet|microsoft|nvidia|tesla|meta|amazon|software|startup|ipo|semiconductor|chip/i;
const ENTERTAINMENT_KEYWORDS =
  /movie|movies|oscar|grammy|music|celebrity|tv|show|netflix|disney|streaming|hollywood|box office|album|song|series/i;

const IGNORED_TAG_SLUGS = new Set([
  "featured",
  "parent-for-derivative",
  "earn-4",
  "2024-predictions",
  "2025-predictions",
  "2026-predictions",
]);

const CATEGORY_PRIORITY: Array<{ label: string; zh: string; pattern: RegExp }> = [
  { label: "CS2", zh: "CS2", pattern: /counter[-\s]?strike|cs2|iem|blast|major/i },
  { label: "LoL", zh: "英雄联盟", pattern: /league of legends|league-of-legends|lol esports|lck|lpl|lcs|lec|msi|worlds/i },
  { label: "VALORANT", zh: "VALORANT", pattern: /valorant|vct/i },
  { label: "Dota 2", zh: "Dota 2", pattern: /dota 2|the international|\bdota\b/i },
  { label: "NBA", zh: "NBA", pattern: /\bnba\b|basketball/i },
  { label: "NFL", zh: "NFL", pattern: /\bnfl\b|super bowl|american football/i },
  { label: "MLB", zh: "MLB", pattern: /\bmlb\b|baseball/i },
  { label: "NHL", zh: "NHL", pattern: /\bnhl\b|stanley cup|hockey/i },
  { label: "Soccer", zh: "足球", pattern: /soccer|football|premier league|champions league|laliga|bundesliga|serie a|uefa|world cup/i },
  { label: "Tennis", zh: "网球", pattern: /tennis|atp|wta|grand slam/i },
  { label: "UFC", zh: "UFC", pattern: /ufc|mma/i },
  { label: "Fed Rates", zh: "联邦利率", pattern: /fed[-\s]?rates|federal reserve|interest rates?|\bfed\b/i },
  { label: "Stocks", zh: "股票", pattern: /stocks?|nasdaq|s&p|dow|ipo|equities/i },
  { label: "Politics", zh: "政治", pattern: /politics|elections?|us election|world elections|global elections|primaries/i },
  { label: "Crypto", zh: "加密", pattern: /crypto|bitcoin|btc|ethereum|eth|solana|xrp|doge/i },
  { label: "Tech", zh: "科技", pattern: /tech|ai|openai|anthropic|claude|gpt|tesla|nvidia|apple|google|meta|amazon/i },
  { label: "Entertainment", zh: "娱乐", pattern: /entertainment|movie|music|tv|celebrity|oscar|grammy/i },
  { label: "World", zh: "全球", pattern: /world|geopolitics|middle east|israel|ukraine|russia|china|taiwan/i },
];

function fallbackCategoryFromText(...parts: Array<string | undefined | null>): string {
  const text = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (!text) return "其他";
  if (POLITICS_KEYWORDS.test(text)) return "政治";
  if (CRYPTO_KEYWORDS.test(text)) return "加密";
  if (SPORTS_KEYWORDS.test(text)) return "体育";
  if (ECONOMY_KEYWORDS.test(text)) return "经济";
  if (TECH_KEYWORDS.test(text)) return "科技";
  if (ENTERTAINMENT_KEYWORDS.test(text)) return "娱乐";
  return "其他";
}

function normalizeTagLabel(tag: MarketTag): string | null {
  const label = (tag.label || "").trim();
  const slug = (tag.slug || "").trim().toLowerCase();
  if (!label && !slug) return null;
  if (slug && IGNORED_TAG_SLUGS.has(slug)) return null;

  const haystack = `${label} ${slug}`.trim();
  for (const candidate of CATEGORY_PRIORITY) {
    if (candidate.pattern.test(haystack)) {
      return candidate.zh;
    }
  }

  if (!label) return null;
  if (label.length > 24) return null;
  return label;
}

export function deriveMarketCategory(
  tags: MarketTag[] | undefined,
  ...parts: Array<string | undefined | null>
): string {
  const normalizedTags = (tags || [])
    .map(normalizeTagLabel)
    .filter((tag): tag is string => Boolean(tag));

  if (normalizedTags.length > 0) {
    return normalizedTags[0];
  }

  return fallbackCategoryFromText(...parts);
}

export function extractMarketTags(tags: MarketTag[] | undefined): string[] {
  const normalized = (tags || [])
    .map(normalizeTagLabel)
    .filter((tag): tag is string => Boolean(tag));

  return Array.from(new Set(normalized)).slice(0, 6);
}

export function categorizeMarket(...parts: Array<string | undefined | null>): string {
  return fallbackCategoryFromText(...parts);
}
