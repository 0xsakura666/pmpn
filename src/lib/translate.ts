const TRANSLATE_CACHE = new Map<string, string>();

// 使用 CORS 代理绕过 DNS 污染
const CORS_PROXY = "https://api.codetabs.com/v1/proxy/?quest=";

export async function translateToZh(text: string): Promise<string> {
  if (!text || text.trim() === "") return text;
  
  // 检查缓存
  const cacheKey = text.trim();
  if (TRANSLATE_CACHE.has(cacheKey)) {
    return TRANSLATE_CACHE.get(cacheKey)!;
  }

  try {
    // 使用 Google Translate 免费 API (通过 CORS 代理)
    const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    const url = `${CORS_PROXY}${encodeURIComponent(googleUrl)}`;
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("Translation failed, returning original text");
      return text;
    }

    const data = await response.json();
    
    // Google Translate 返回格式: [[["翻译结果","原文",null,null,10]],null,"en",...]
    let translated = "";
    if (data && data[0]) {
      for (const segment of data[0]) {
        if (segment[0]) {
          translated += segment[0];
        }
      }
    }

    if (translated) {
      TRANSLATE_CACHE.set(cacheKey, translated);
      return translated;
    }

    return text;
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
    outcomes = await Promise.all(
      market.outcomes.map((outcome) => translateToZh(outcome))
    );
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
