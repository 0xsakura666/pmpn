import { type WalletClient, parseUnits } from "viem";

const CLOB_HOST = "https://clob.polymarket.com";

const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as const;

const ORDER_DOMAIN = {
  name: "Polymarket CTF Exchange",
  version: "1",
  chainId: 137,
  verifyingContract: EXCHANGE_ADDRESS,
} as const;

const ORDER_TYPES = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "taker", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "feeRateBps", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "signatureType", type: "uint8" },
  ],
} as const;

export type Side = "BUY" | "SELL";
export type OrderType = "GTC" | "GTD" | "FOK" | "FAK";

export interface CreateOrderParams {
  tokenId: string;
  price: number;
  size: number;
  side: Side;
  tickSize?: string;
  negRisk?: boolean;
  orderType?: OrderType;
  expiration?: number;
}

export interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: string;
  signatureType: string;
  signature: string;
}

function generateSalt(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return BigInt("0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(""));
}

function roundPrice(price: number, tickSize: string): number {
  const tick = parseFloat(tickSize);
  return Math.round(price / tick) * tick;
}

function calculateAmounts(
  side: Side,
  price: number,
  size: number,
  tickSize: string
): { makerAmount: bigint; takerAmount: bigint } {
  const roundedPrice = roundPrice(price, tickSize);
  const sizeInUnits = parseUnits(size.toString(), 6);
  const priceInUnits = parseUnits(roundedPrice.toString(), 6);

  if (side === "BUY") {
    const takerAmount = sizeInUnits;
    const makerAmount = (sizeInUnits * priceInUnits) / BigInt(1e6);
    return { makerAmount, takerAmount };
  } else {
    const makerAmount = sizeInUnits;
    const takerAmount = (sizeInUnits * priceInUnits) / BigInt(1e6);
    return { makerAmount, takerAmount };
  }
}

async function generateHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string = ""
): Promise<string> {
  const message = timestamp + method + path + body;
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createAndSignOrder(
  walletClient: WalletClient,
  account: `0x${string}`,
  funderAddress: `0x${string}`,
  params: CreateOrderParams,
  signatureType: number = 2
): Promise<SignedOrder> {
  const tickSize = params.tickSize || "0.01";
  const { makerAmount, takerAmount } = calculateAmounts(
    params.side,
    params.price,
    params.size,
    tickSize
  );

  const salt = generateSalt();
  const expiration = params.expiration
    ? BigInt(params.expiration)
    : BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30);
  const nonce = BigInt(0);
  const feeRateBps = BigInt(0);
  const side = params.side === "BUY" ? 0 : 1;

  const orderMessage = {
    salt,
    maker: funderAddress,
    signer: account,
    taker: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenId: BigInt(params.tokenId),
    makerAmount,
    takerAmount,
    expiration,
    nonce,
    feeRateBps,
    side,
    signatureType,
  };

  const signature = await walletClient.signTypedData({
    account,
    domain: ORDER_DOMAIN,
    types: ORDER_TYPES,
    primaryType: "Order",
    message: orderMessage,
  });

  return {
    salt: salt.toString(),
    maker: funderAddress,
    signer: account,
    taker: "0x0000000000000000000000000000000000000000",
    tokenId: params.tokenId,
    makerAmount: makerAmount.toString(),
    takerAmount: takerAmount.toString(),
    expiration: expiration.toString(),
    nonce: nonce.toString(),
    feeRateBps: feeRateBps.toString(),
    side: side.toString(),
    signatureType: signatureType.toString(),
    signature,
  };
}

export async function postOrder(
  signedOrder: SignedOrder,
  credentials: { apiKey: string; secret: string; passphrase: string },
  address: string,
  orderType: OrderType = "GTC"
): Promise<{ success: boolean; orderID?: string; errorMsg?: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = "/order";
  const body = JSON.stringify({
    order: signedOrder,
    order_type: orderType,
  });

  const signature = await generateHmacSignature(
    credentials.secret,
    timestamp,
    "POST",
    path,
    body
  );

  const response = await fetch(`${CLOB_HOST}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "POLY_ADDRESS": address,
      "POLY_API_KEY": credentials.apiKey,
      "POLY_PASSPHRASE": credentials.passphrase,
      "POLY_SIGNATURE": signature,
      "POLY_TIMESTAMP": timestamp,
    },
    body,
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      errorMsg: result.error || `Order failed: ${response.status}`,
    };
  }

  return {
    success: true,
    orderID: result.orderID,
  };
}

export async function createAndPostOrder(
  walletClient: WalletClient,
  account: `0x${string}`,
  funderAddress: `0x${string}`,
  credentials: { apiKey: string; secret: string; passphrase: string },
  params: CreateOrderParams,
  signatureType: number = 2
): Promise<{ success: boolean; orderID?: string; errorMsg?: string }> {
  try {
    const signedOrder = await createAndSignOrder(
      walletClient,
      account,
      funderAddress,
      params,
      signatureType
    );

    return await postOrder(signedOrder, credentials, account, params.orderType);
  } catch (error) {
    return {
      success: false,
      errorMsg: error instanceof Error ? error.message : "Order creation failed",
    };
  }
}
