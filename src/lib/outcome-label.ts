export function normalizeOutcomeLabel(label?: string | null, fallback = "--") {
  const cleaned = String(label || "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

export function getCompactOutcomeLabel(label?: string | null, maxChars = 10) {
  const normalized = normalizeOutcomeLabel(label, "--");
  const lower = normalized.toLowerCase();
  if (lower === "yes" || lower === "no") return normalized;
  if (normalized.length <= maxChars) return normalized;

  const words = normalized.split(" ").filter(Boolean);
  const weakTailWords = new Set(["fc", "cf", "sc", "afc", "club"]);

  if (words.length >= 2) {
    const last = words[words.length - 1];
    const prev = words[words.length - 2];
    const lastLower = last.toLowerCase();

    if (!weakTailWords.has(lastLower) && last.length <= maxChars) {
      return last;
    }

    const lastTwo = `${prev} ${last}`;
    if (lastTwo.length <= maxChars + 2) {
      return lastTwo;
    }

    const acronym = words
      .map((word) => word[0]?.toUpperCase() || "")
      .join("")
      .slice(0, Math.max(2, Math.min(4, maxChars)));

    if (acronym.length >= 2) {
      return acronym;
    }
  }

  return `${normalized.slice(0, Math.max(1, maxChars - 1))}…`;
}
