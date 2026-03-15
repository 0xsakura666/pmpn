export interface BinaryOutcomeMapping {
  yesPrice: number;
  noPrice: number;
  yesTokenId: string;
  noTokenId: string;
  yesLabel: string;
  noLabel: string;
}

function parseStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((v) => String(v));
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v));
      }
    } catch {
      return [];
    }
  }

  return [];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isYesOutcome(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return normalized === "yes" || normalized === "true";
}

function isNoOutcome(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return normalized === "no" || normalized === "false";
}

interface RawEntry {
  outcome: string;
  tokenId: string;
  price: number;
}

export function resolveBinaryOutcomeMapping(input: {
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
}): BinaryOutcomeMapping {
  const outcomes = parseStringArray(input.outcomes);
  const prices = parseStringArray(input.outcomePrices).map((v) => Number(v));
  const tokenIds = parseStringArray(input.clobTokenIds);

  const maxLength = Math.max(outcomes.length, prices.length, tokenIds.length, 2);
  const entries: RawEntry[] = [];

  for (let i = 0; i < maxLength; i++) {
    const fallbackOutcome = i === 0 ? "Yes" : i === 1 ? "No" : `Outcome ${i + 1}`;
    entries.push({
      outcome: outcomes[i] || fallbackOutcome,
      tokenId: tokenIds[i] || "",
      price: Number.isFinite(prices[i]) ? prices[i] : NaN,
    });
  }

  const yesEntry = entries.find((entry) => isYesOutcome(entry.outcome)) || entries[0];
  const noEntry = entries.find((entry) => isNoOutcome(entry.outcome)) || entries[1];

  const yesPrice = clamp01(Number.isFinite(yesEntry?.price) ? yesEntry.price : 0.5);
  const noPrice = clamp01(Number.isFinite(noEntry?.price) ? noEntry.price : 1 - yesPrice);

  const yesTokenId = yesEntry?.tokenId || "";
  const noTokenId = noEntry?.tokenId || "";

  return {
    yesPrice,
    noPrice,
    yesTokenId,
    noTokenId,
    yesLabel: yesEntry?.outcome || "Yes",
    noLabel: noEntry?.outcome || "No",
  };
}
