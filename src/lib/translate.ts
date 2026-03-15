const TRANSLATE_CACHE = new Map<string, string>();

async function safeParseTranslateResponse(response: Response): Promise<string | null> {
  const text = await response.text();
  if (!text || text.includes("The quota has been exceeded")) {
    return null;
  }

  try {
    const data = JSON.parse(text);
    let translated = "";
    if (data && data[0]) {
      for (const segment of data[0]) {
        if (segment?.[0]) {
          translated += segment[0];
        }
      }
    }
    return translated || null;
  } catch {
    return null;
  }
}

export async function translateToZh(text: string): Promise<string> {
  if (!text || text.trim() === "") return text;

  const cacheKey = text.trim();
  if (TRANSLATE_CACHE.has(cacheKey)) {
    return TRANSLATE_CACHE.get(cacheKey)!;
  }

  try {
    // 服务器侧请求无需走 CORS 代理；直连更稳定，也避免第三方代理 quota 问题。
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(googleUrl, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; TectonicBot/1.0)",
      },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!response.ok) {
      return text;
    }

    const translated = await safeParseTranslateResponse(response);
    if (!translated) {
      return text;
    }

    TRANSLATE_CACHE.set(cacheKey, translated);
    return translated;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

export async function translateMarket(market: {
  title?: string;
  question?: string;
  description?: string;
  outcomes?: string[];
}): Promise<{
  title?: string;
  question?: string;
  description?: string;
  outcomes?: string[];
}> {
  const [title, question, description] = await Promise.all([
    market.title ? translateToZh(market.title) : Promise.resolve(market.title),
    market.question ? translateToZh(market.question) : Promise.resolve(market.question),
    market.description ? translateToZh(market.description) : Promise.resolve(market.description),
  ]);

  let outcomes = market.outcomes;
  if (market.outcomes && market.outcomes.length > 0) {
    outcomes = await Promise.all(market.outcomes.map((outcome) => translateToZh(outcome)));
  }

  return {
    title,
    question,
    description,
    outcomes,
  };
}

export async function batchTranslate(texts: string[]): Promise<string[]> {
  return Promise.all(texts.map((text) => translateToZh(text)));
}
