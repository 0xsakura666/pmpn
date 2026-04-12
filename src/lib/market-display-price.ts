function normalizeUnitPrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0 || value >= 1) {
    return null;
  }

  return value;
}

function normalizeTickSize(tickSize: string | number | null | undefined): number | null {
  const parsed = typeof tickSize === "number" ? tickSize : Number(tickSize);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export interface SafeMarketDisplayPriceInput {
  bestBid?: number | null;
  bestAsk?: number | null;
  lastTradePrice?: number | null;
  tickSize?: string | number | null;
}

export interface SafeMarketDisplayPriceResult {
  bestBid: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
  midFromBook: number | null;
  displayPrice: number | null;
}

export function getSafeMarketDisplayPrice({
  bestBid,
  bestAsk,
  lastTradePrice,
  tickSize,
}: SafeMarketDisplayPriceInput): SafeMarketDisplayPriceResult {
  const normalizedBid = normalizeUnitPrice(bestBid);
  const normalizedAsk = normalizeUnitPrice(bestAsk);
  const normalizedLastTradePrice = normalizeUnitPrice(lastTradePrice);
  const normalizedTickSize = normalizeTickSize(tickSize);

  const bookLooksBroken =
    normalizedBid != null &&
    normalizedAsk != null &&
    (normalizedBid >= normalizedAsk ||
      (normalizedBid <= 0.02 && normalizedAsk >= 0.98) ||
      normalizedAsk - normalizedBid >= 0.9);

  const safeBid = bookLooksBroken ? null : normalizedBid;
  const safeAsk = bookLooksBroken ? null : normalizedAsk;
  const midFromBook =
    safeBid != null && safeAsk != null
      ? (safeBid + safeAsk) / 2
      : null;

  const bookSpread =
    safeBid != null && safeAsk != null
      ? safeAsk - safeBid
      : null;

  const bookConsistencyTolerance = Math.max(
    normalizedTickSize ?? 0,
    bookSpread != null ? bookSpread * 1.5 : 0,
    0.015
  );

  const lastTradeMatchesBook =
    normalizedLastTradePrice != null &&
    midFromBook != null &&
    safeBid != null &&
    safeAsk != null &&
    normalizedLastTradePrice >= safeBid - bookConsistencyTolerance &&
    normalizedLastTradePrice <= safeAsk + bookConsistencyTolerance;

  const safeLastTradePrice =
    normalizedLastTradePrice != null && (!midFromBook || lastTradeMatchesBook)
      ? normalizedLastTradePrice
      : null;

  return {
    bestBid: safeBid,
    bestAsk: safeAsk,
    lastTradePrice: safeLastTradePrice,
    midFromBook,
    displayPrice: safeLastTradePrice ?? midFromBook,
  };
}
