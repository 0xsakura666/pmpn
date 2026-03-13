const POLYMARKET_HOST_PATTERN = /(^|\.)polymarket\.com$/i;

function normalizeInput(input: string): string {
  return decodeURIComponent(input || "").trim();
}

export function extractPolymarketEventSlug(input: string): string | null {
  const normalized = normalizeInput(input);
  if (!normalized) return null;

  if (!normalized.includes("://")) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (!POLYMARKET_HOST_PATTERN.test(url.hostname)) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const eventIndex = segments.findIndex((segment) => segment === "event");
    if (eventIndex === -1) return null;

    const slug = segments[eventIndex + 1];
    return slug ? slug.trim() : null;
  } catch {
    return null;
  }
}

export function normalizePolymarketMarketIdentifier(input: string): string {
  const normalized = normalizeInput(input);
  return extractPolymarketEventSlug(normalized) || normalized;
}
