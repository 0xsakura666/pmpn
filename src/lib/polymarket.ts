const POLYMARKET_API_URL = process.env.POLYMARKET_API_URL || "https://clob.polymarket.com";
const POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com";
const POLYMARKET_DATA_API = "https://data-api.polymarket.com";

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
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // ==================== Gamma API (Markets) ====================

  async getMarkets(limit: number = 100, offset: number = 0): Promise<PolymarketMarket[]> {
    return this.request<PolymarketMarket[]>(
      `${POLYMARKET_GAMMA_API}/markets?limit=${limit}&offset=${offset}&active=true`
    );
  }

  async getMarket(conditionId: string): Promise<PolymarketMarket> {
    return this.request<PolymarketMarket>(
      `${POLYMARKET_GAMMA_API}/markets/${conditionId}`
    );
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
