import { resolveBinaryOutcomeMapping } from "@/lib/binary-outcome";
import { extractPolymarketEventSlug, normalizePolymarketMarketIdentifier } from "@/lib/polymarket-reference";
import { fetchPolymarketAPI } from "@/lib/polymarket-api";

const POLYMARKET_API_URL = process.env.POLYMARKET_API_URL || "https://clob.polymarket.com";
const POLYMARKET_GAMMA_API = process.env.POLYMARKET_GAMMA_API || "https://gamma-api.polymarket.com";
const POLYMARKET_DATA_API = process.env.POLYMARKET_DATA_API || "https://data-api.polymarket.com";

export interface PolymarketMarket {
  condition_id: string;
  question: string;
  description: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time: string;
  seconds_delay: number;
  fpmm: string;
  maker_base_fee: number;
  taker_base_fee: number;
  notifications_enabled: boolean;
  neg_risk: boolean;
  neg_risk_market_id: string;
  neg_risk_request_id: string;
  icon: string;
  image: string;
  rewards: {
    total_rewards: number;
    daily_rewards: number;
    end_date: string;
  };
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
    winner: boolean;
  }>;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  hash: string;
  timestamp: number;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

export interface Trade {
  id: string;
  market: string;
  asset_id: string;
  side: "BUY" | "SELL";
  price: string;
  size: string;
  timestamp: string;
  trader: string;
}

export interface Position {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  mergeable: boolean;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  endDate: string;
  negativeRisk: boolean;
}

interface RawGammaMarket {
  conditionId?: string;
  condition_id?: string;
  question?: string;
  description?: string;
  slug?: string;
  endDate?: string;
  negRisk?: boolean;
  icon?: string;
  image?: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
}

interface RawGammaEvent {
  title?: string;
  description?: string;
  slug?: string;
  endDate?: string;
  icon?: string;
  image?: string;
  markets?: RawGammaMarket[];
}

class PolymarketService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = POLYMARKET_API_URL;
  }

  private async request<T>(url: string): Promise<T> {
    try {
      return await fetchPolymarketAPI<T>(url, { timeout: 15000, useFallback: true });
    } catch (error) {
      console.error(`[Polymarket] Fetch error:`, error);

      if (error instanceof Error) {
        const cause = error.cause;
        if (cause) {
          const causeMessage = cause instanceof Error ? cause.message : String(cause);
          console.error(`[Polymarket] Cause:`, causeMessage);
        }
        throw new Error(`Fetch failed: ${error.message}`);
      }
      throw error;
    }
  }

  // ==================== Gamma API (Markets) ====================

  async getMarkets(limit: number = 100, offset: number = 0): Promise<PolymarketMarket[]> {
    // 首先尝试 /events 端点（返回包含 markets 的事件）
    try {
      const events = await this.request<RawGammaEvent[]>(
        `${POLYMARKET_GAMMA_API}/events?limit=${limit}&offset=${offset}&active=true&closed=false`
      );
      
      // 从 events 中提取 markets
      const markets: PolymarketMarket[] = [];
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            markets.push(this.transformMarket({
              ...market,
              question: market.question || event.title,
              description: market.description || event.description || "",
              slug: market.slug || event.slug,
              endDate: market.endDate || event.endDate,
              icon: event.icon || market.icon,
              image: event.image || market.image,
            }, market.conditionId || market.condition_id || event.slug || "unknown-market"));
          }
        }
      }
      return markets;
    } catch (error) {
      console.error("[Polymarket] Events endpoint failed, trying markets endpoint:", error);
      // 如果 events 失败，尝试 markets 端点
      return this.request<PolymarketMarket[]>(
        `${POLYMARKET_GAMMA_API}/markets?limit=${limit}&offset=${offset}&active=true`
      );
    }
  }

  async getMarket(conditionId: string): Promise<PolymarketMarket | null> {
    const identifier = normalizePolymarketMarketIdentifier(conditionId);

    try {
      const marketByCondition = await this.getMarketByConditionId(identifier);
      if (marketByCondition) {
        return marketByCondition;
      }

      const slug = extractPolymarketEventSlug(conditionId) || identifier;
      return this.getMarketBySlug(slug);
    } catch (error) {
      console.error("[Polymarket] getMarket error:", error);
      return null;
    }
  }

  private async getMarketByConditionId(conditionId: string): Promise<PolymarketMarket | null> {
    const markets = await this.request<RawGammaMarket[]>(
      `${POLYMARKET_GAMMA_API}/markets?condition_id=${encodeURIComponent(conditionId)}`
    );

    if (!markets || markets.length === 0) {
      return null;
    }

    const market = markets.find(
      (item) => (item.conditionId === conditionId) || (item.condition_id === conditionId)
    );

    if (!market) {
      return null;
    }

    return this.transformMarket(market, conditionId);
  }

  private async getMarketBySlug(slug: string): Promise<PolymarketMarket | null> {
    if (!slug) return null;

    const markets = await this.request<RawGammaMarket[]>(
      `${POLYMARKET_GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`
    );

    if (!markets || markets.length === 0) {
      return null;
    }

    const market = markets.find((item) => item.slug === slug) || markets[0];
    return this.transformMarket(market, market.conditionId || market.condition_id || slug);
  }

  private transformMarket(market: RawGammaMarket, fallbackId: string): PolymarketMarket {
    return {
      condition_id: market.conditionId || market.condition_id || fallbackId,
      question: market.question || fallbackId,
      description: market.description || "",
      market_slug: market.slug || "",
      end_date_iso: market.endDate || "",
      game_start_time: "",
      seconds_delay: 0,
      fpmm: "",
      maker_base_fee: 0,
      taker_base_fee: 0,
      notifications_enabled: false,
      neg_risk: market.negRisk || false,
      neg_risk_market_id: "",
      neg_risk_request_id: "",
      icon: market.icon || "",
      image: market.image || "",
      rewards: { total_rewards: 0, daily_rewards: 0, end_date: "" },
      tokens: this.parseTokens(market),
    };
  }
  
  private parseTokens(market: RawGammaMarket): Array<{ token_id: string; outcome: string; price: number; winner: boolean }> {
    const tokens: Array<{ token_id: string; outcome: string; price: number; winner: boolean }> = [];

    const { yesPrice, noPrice, yesTokenId, noTokenId, yesLabel, noLabel } = resolveBinaryOutcomeMapping({
      outcomes: market.outcomes,
      outcomePrices: market.outcomePrices,
      clobTokenIds: market.clobTokenIds,
    });

    if (yesTokenId) {
      tokens.push({
        token_id: yesTokenId,
        outcome: yesLabel,
        price: yesPrice,
        winner: false,
      });
    }
    if (noTokenId) {
      tokens.push({
        token_id: noTokenId,
        outcome: noLabel,
        price: noPrice,
        winner: false,
      });
    }

    return tokens;
  }

  async searchMarkets(query: string, limit: number = 20): Promise<PolymarketMarket[]> {
    return this.request<PolymarketMarket[]>(
      `${POLYMARKET_GAMMA_API}/markets?_q=${encodeURIComponent(query)}&limit=${limit}&active=true`
    );
  }

  // ==================== CLOB API (Order Book, Prices) ====================

  async getOrderBook(tokenId: string): Promise<OrderBook> {
    return this.request<OrderBook>(
      `${this.baseUrl}/book?token_id=${tokenId}`
    );
  }

  async getTrades(tokenId: string, limit: number = 100): Promise<Trade[]> {
    return this.request<Trade[]>(
      `${this.baseUrl}/trades?token_id=${tokenId}&limit=${limit}`
    );
  }

  async getPriceHistory(
    tokenId: string,
    interval: string = "1h",
    fidelity: number = 60
  ): Promise<Array<{ t: number; p: number }>> {
    return this.request<Array<{ t: number; p: number }>>(
      `${this.baseUrl}/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`
    );
  }

  async getMidpoint(tokenId: string): Promise<{ mid: string }> {
    return this.request<{ mid: string }>(
      `${this.baseUrl}/midpoint?token_id=${tokenId}`
    );
  }

  async getTickSize(tokenId: string): Promise<{ tick_size: string }> {
    return this.request<{ tick_size: string }>(
      `${this.baseUrl}/tick-size?token_id=${tokenId}`
    );
  }

  async getSpread(tokenId: string): Promise<{ spread: string }> {
    return this.request<{ spread: string }>(
      `${this.baseUrl}/spread?token_id=${tokenId}`
    );
  }

  // ==================== Data API (User Data) ====================

  async getPositions(
    userAddress: string,
    options?: {
      market?: string;
      limit?: number;
      offset?: number;
      sizeThreshold?: number;
    }
  ): Promise<Position[]> {
    const params = new URLSearchParams({ user: userAddress });
    if (options?.market) params.append("market", options.market);
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.sizeThreshold) params.append("sizeThreshold", options.sizeThreshold.toString());

    return this.request<Position[]>(
      `${POLYMARKET_DATA_API}/positions?${params.toString()}`
    );
  }

  async getUserActivity(
    userAddress: string,
    limit: number = 100
  ): Promise<unknown[]> {
    return this.request<unknown[]>(
      `${POLYMARKET_DATA_API}/activity?user=${userAddress}&limit=${limit}`
    );
  }

  async getUserTrades(
    userAddress: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Trade[]> {
    const params = new URLSearchParams({ user: userAddress });
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());

    return this.request<Trade[]>(
      `${POLYMARKET_DATA_API}/trades?${params.toString()}`
    );
  }

  async getTopHolders(
    conditionId: string,
    limit: number = 10
  ): Promise<unknown[]> {
    return this.request<unknown[]>(
      `${POLYMARKET_DATA_API}/top-holders?market=${conditionId}&limit=${limit}`
    );
  }
}

export const polymarket = new PolymarketService();
