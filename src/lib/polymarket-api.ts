const POLYMARKET_ENDPOINTS = {
  gamma: "https://gamma-api.polymarket.com",
  clob: "https://clob.polymarket.com",
  data: "https://data-api.polymarket.com",
  ws: "wss://ws-subscriptions-clob.polymarket.com/ws/market",
};

const FALLBACK_PROXIES = [
  (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

interface FetchOptions {
  timeout?: number;
  useFallback?: boolean;
}

export async function fetchPolymarketAPI<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 15000, useFallback = true } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const fetchOptions: RequestInit = {
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; TectonicBot/1.0)",
    },
    cache: "no-store",
  };

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (response.ok) {
      return response.json();
    }
    throw new Error(`API error: ${response.status}`);
  } catch (directError) {
    clearTimeout(timeoutId);

    if (!useFallback) {
      throw directError;
    }

    for (const makeProxy of FALLBACK_PROXIES) {
      try {
        const proxyController = new AbortController();
        const proxyTimeoutId = setTimeout(() => proxyController.abort(), timeout);

        const proxyResponse = await fetch(makeProxy(url), {
          ...fetchOptions,
          signal: proxyController.signal,
        });
        clearTimeout(proxyTimeoutId);

        if (proxyResponse.ok) {
          return proxyResponse.json();
        }
      } catch {
        continue;
      }
    }

    throw directError;
  }
}

export { POLYMARKET_ENDPOINTS };
