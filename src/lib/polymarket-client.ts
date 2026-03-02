import { type WalletClient } from "viem";

const CLOB_HOST = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

export interface ApiCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export interface PolymarketMarket {
  condition_id: string;
  question: string;
  description: string;
  market_slug: string;
  end_date_iso: string;
  neg_risk: boolean;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
  icon?: string;
  image?: string;
}

export interface Position {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  curPrice: number;
  title: string;
  outcome: string;
  redeemable: boolean;
}

export interface OpenOrder {
  id: string;
  status: string;
  market: string;
  asset_id: string;
  side: "BUY" | "SELL";
  original_size: string;
  size_matched: string;
  price: string;
  outcome: string;
  order_type: string;
  created_at: number;
}

const CLOB_AUTH_DOMAIN = {
  name: "ClobAuthDomain",
  version: "1",
  chainId: 137,
} as const;

const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: "address", type: "address" },
    { name: "timestamp", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "message", type: "string" },
  ],
} as const;

function generateHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string = ""
): Promise<string> {
  const message = timestamp + method + path + body;
  return crypto.subtle
    .importKey(
      "raw",
      Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    .then((key) =>
      crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
    )
    .then((sig) => btoa(String.fromCharCode(...new Uint8Array(sig))));
}

export class PolymarketClientService {
  private walletClient: WalletClient | null = null;
  private credentials: ApiCredentials | null = null;
  private address: `0x${string}` | null = null;

  setWalletClient(client: WalletClient, address: `0x${string}`) {
    this.walletClient = client;
    this.address = address;
    this.loadCredentials();
  }

  clearWalletClient() {
    this.walletClient = null;
    this.address = null;
    this.credentials = null;
  }

  private loadCredentials() {
    if (!this.address) return;
    const stored = localStorage.getItem(`polymarket_creds_${this.address}`);
    if (stored) {
      try {
        this.credentials = JSON.parse(stored);
      } catch {
        this.credentials = null;
      }
    }
  }

  private saveCredentials(creds: ApiCredentials) {
    if (!this.address) return;
    localStorage.setItem(`polymarket_creds_${this.address}`, JSON.stringify(creds));
    this.credentials = creds;
  }

  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  getCredentials(): ApiCredentials | null {
    return this.credentials;
  }

  async deriveApiCredentials(): Promise<ApiCredentials> {
    if (!this.walletClient || !this.address) {
      throw new Error("Wallet not connected");
    }

    const serverTimeRes = await fetch(`${CLOB_HOST}/time`);
    const { time } = await serverTimeRes.json();
    const timestamp = time.toString();
    const nonce = BigInt(0);

    const signature = await this.walletClient.signTypedData({
      account: this.address,
      domain: CLOB_AUTH_DOMAIN,
      types: CLOB_AUTH_TYPES,
      primaryType: "ClobAuth",
      message: {
        address: this.address,
        timestamp,
        nonce,
        message: "This message attests that I control the given wallet",
      },
    });

    const response = await fetch(`${CLOB_HOST}/auth/derive-api-key`, {
      method: "GET",
      headers: {
        "POLY_ADDRESS": this.address,
        "POLY_SIGNATURE": signature,
        "POLY_TIMESTAMP": timestamp,
        "POLY_NONCE": nonce.toString(),
      },
    });

    if (!response.ok) {
      const createResponse = await fetch(`${CLOB_HOST}/auth/api-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "POLY_ADDRESS": this.address,
          "POLY_SIGNATURE": signature,
          "POLY_TIMESTAMP": timestamp,
          "POLY_NONCE": nonce.toString(),
        },
      });

      if (!createResponse.ok) {
        throw new Error("Failed to create API credentials");
      }

      const creds = await createResponse.json();
      this.saveCredentials(creds);
      return creds;
    }

    const creds = await response.json();
    this.saveCredentials(creds);
    return creds;
  }

  private async authenticatedRequest<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    if (!this.credentials || !this.address) {
      throw new Error("Not authenticated. Please derive API credentials first.");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : "";
    const signature = await generateHmacSignature(
      this.credentials.secret,
      timestamp,
      method,
      path,
      bodyStr
    );

    const response = await fetch(`${CLOB_HOST}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "POLY_ADDRESS": this.address,
        "POLY_API_KEY": this.credentials.apiKey,
        "POLY_PASSPHRASE": this.credentials.passphrase,
        "POLY_SIGNATURE": signature,
        "POLY_TIMESTAMP": timestamp,
      },
      body: bodyStr || undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // ==================== Public Endpoints ====================

  async getMarkets(limit = 100): Promise<PolymarketMarket[]> {
    const res = await fetch(`${GAMMA_API}/markets?limit=${limit}&active=true`);
    return res.json();
  }

  async getMarket(conditionId: string): Promise<PolymarketMarket> {
    const res = await fetch(`${GAMMA_API}/markets/${conditionId}`);
    return res.json();
  }

  async getOrderBook(tokenId: string) {
    const res = await fetch(`${CLOB_HOST}/book?token_id=${tokenId}`);
    return res.json();
  }

  async getTickSize(tokenId: string): Promise<string> {
    const res = await fetch(`${CLOB_HOST}/tick-size?token_id=${tokenId}`);
    const data = await res.json();
    return data.tick_size;
  }

  async getNegRisk(tokenId: string): Promise<boolean> {
    const res = await fetch(`${CLOB_HOST}/neg-risk?token_id=${tokenId}`);
    const data = await res.json();
    return data.neg_risk;
  }

  // ==================== Data API ====================

  async getPositions(userAddress: string): Promise<Position[]> {
    const res = await fetch(`${DATA_API}/positions?user=${userAddress}`);
    return res.json();
  }

  async getUserActivity(userAddress: string) {
    const res = await fetch(`${DATA_API}/activity?user=${userAddress}`);
    return res.json();
  }

  // ==================== Authenticated Endpoints ====================

  async getOpenOrders(): Promise<OpenOrder[]> {
    const response = await this.authenticatedRequest<{ data: OpenOrder[] }>(
      "GET",
      "/orders"
    );
    return response.data || [];
  }

  async getOrder(orderId: string): Promise<OpenOrder> {
    return this.authenticatedRequest<OpenOrder>("GET", `/orders/${orderId}`);
  }

  async cancelOrder(orderId: string) {
    return this.authenticatedRequest("DELETE", `/order/${orderId}`);
  }

  async cancelAllOrders() {
    return this.authenticatedRequest("DELETE", "/orders/all");
  }

  async getTrades() {
    return this.authenticatedRequest<{ data: unknown[] }>("GET", "/trades");
  }

  async getBalanceAllowance(assetType: "COLLATERAL" | "CONDITIONAL", tokenId?: string) {
    const params = new URLSearchParams({ asset_type: assetType });
    if (tokenId) params.append("token_id", tokenId);
    return this.authenticatedRequest("GET", `/balance-allowance?${params}`);
  }
}

export const polymarketClient = new PolymarketClientService();
