const POLYMARKET_API_URL = process.env.POLYMARKET_API_URL || "https://clob.polymarket.com";
const POLYMARKET_GAMMA_API = process.env.POLYMARKET_GAMMA_API || "https://gamma-api.polymarket.com";
const POLYMARKET_DATA_API = process.env.POLYMARKET_DATA_API || "https://data-api.polymarket.com";

const API_TIMEOUT = parseInt(process.env.POLYMARKET_TIMEOUT || "20000");

// 使用 CORS 代理绕过 DNS 污染
const CORS_PROXY = "https://api.codetabs.com/v1/proxy/?quest=";

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

class PolymarketService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = POLYMARKET_API_URL;
  }

  private async request<T>(url: string): Promise<T> {
    // 使用 CORS 代理绕过 DNS 污染
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
    console.log(`[Polymarket] Fetching via proxy: ${url}`);

    try {
      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        cache: "no-store",
        next: { revalidate: 0 },
      } as RequestInit);

      console.log(`[Polymarket] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Polymarket] Error response: ${errorText}`);
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error(`[Polymarket] Fetch error:`, error);

      if (error instanceof Error) {
        const cause = (error as any).cause;
        if (cause) {
          console.error(`[Polymarket] Cause:`, cause.message || cause);
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
      const events = await this.request<any[]>(
        `${POLYMARKET_GAMMA_API}/events?limit=${limit}&offset=${offset}&active=true&closed=false`
      );
      
      // 从 events 中提取 markets
      const markets: PolymarketMarket[] = [];
      for (const event of events) {
        if (event.markets && Array.isArray(event.markets)) {
          for (const market of event.markets) {
            markets.push({
              condition_id: market.conditionId || market.condition_id,
              question: market.question || event.title,
              description: market.description || event.description || "",
              market_slug: market.slug || event.slug,
              end_date_iso: market.endDate || event.endDate,
              game_start_time: "",
              seconds_delay: 0,
              fpmm: "",
              maker_base_fee: 0,
              taker_base_fee: 0,
              notifications_enabled: false,
              neg_risk: market.negRisk || false,
              neg_risk_market_id: "",
              neg_risk_request_id: "",
              icon: event.icon || "",
              image: event.image || "",
              rewards: { total_rewards: 0, daily_rewards: 0, end_date: "" },
              tokens: this.parseTokens(market),
            });
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
    try {
      // 尝试通过 condition_id 查询
      const markets = await this.request<any[]>(
        `${POLYMARKET_GAMMA_API}/markets?condition_id=${conditionId}`
      );
      
      if (markets && markets.length > 0) {
        // 精确匹配 conditionId
        const market = markets.find(m => 
          (m.conditionId === conditionId) || 
          (m.condition_id === conditionId)
        ) || markets[0];
        
        return {
          condition_id: market.conditionId || market.condition_id || conditionId,
          question: market.question,
          description: market.description || "",
          market_slug: market.slug,
          end_date_iso: market.endDate,
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
      
      return null;
    } catch (error) {
      console.error("[Polymarket] getMarket error:", error);
      return null;
    }
  }
  
  private parseTokens(market: any): Array<{ token_id: string; outcome: string; price: number; winner: boolean }> {
    const tokens: Array<{ token_id: string; outcome: string; price: number; winner: boolean }> = [];
    
    if (market.clobTokenIds) {
      try {
        const tokenIds = JSON.parse(market.clobTokenIds);
        const outcomes = ["Yes", "No"];
        const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [0.5, 0.5];
        
        for (let i = 0; i < tokenIds.length && i < 2; i++) {
          tokens.push({
            token_id: tokenIds[i],
            outcome: outcomes[i],
            price: parseFloat(prices[i]) || 0.5,
            winner: false,
          });
        }
      } catch {
        // Parse error
      }
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
