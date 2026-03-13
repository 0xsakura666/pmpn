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

export function categorizeMarket(...parts: Array<string | undefined | null>): string {
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
