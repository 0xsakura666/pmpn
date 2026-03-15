import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

const DATABASE_URL = process.env.DATABASE_URL;
const GAMMA_API = process.env.POLYMARKET_GAMMA_API || "https://gamma-api.polymarket.com";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const SHORT_TERM_HOURS = Number(process.env.INTRADAY_COLLECTOR_SHORT_TERM_HOURS || 36);
const MAX_MARKETS = Number(process.env.INTRADAY_COLLECTOR_MAX_MARKETS || 120);
const REFRESH_MS = Number(process.env.INTRADAY_COLLECTOR_REFRESH_MS || 5 * 60 * 1000);
const RETENTION_HOURS = Number(process.env.INTRADAY_COLLECTOR_RETENTION_HOURS || 12);
const FETCH_TIMEOUT_MS = Number(process.env.INTRADAY_COLLECTOR_FETCH_TIMEOUT_MS || 12000);
const PAGE_SIZE = 500;
const MAX_SCAN = 3000;

if (!DATABASE_URL) {
  console.error("[collector] Missing DATABASE_URL");
  process.exit(1);
}

// Node 18 on Railway does not provide a global WebSocket constructor for the
// Neon serverless driver. Wire it explicitly so pooled writes can connect.
neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({ connectionString: DATABASE_URL });

function parseArray(input) {
  if (Array.isArray(input)) return input.map((value) => String(value));
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map((value) => String(value));
    } catch {}
  }
  return [];
}

function isShortTermMarket(market) {
  const now = Date.now();
  const candidates = [market.gameStartTime, market.endDate]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));

  return candidates.some((timestamp) => {
    const hours = (timestamp - now) / 3600000;
    return hours >= -6 && hours <= SHORT_TERM_HOURS;
  });
}

function resolveBinaryTokens(market) {
  const outcomes = parseArray(market.outcomes);
  const tokenIds = parseArray(market.clobTokenIds);
  const entries = [];
  const maxLength = Math.max(outcomes.length, tokenIds.length, 2);

  for (let i = 0; i < maxLength; i += 1) {
    const fallbackOutcome = i === 0 ? "Yes" : i === 1 ? "No" : `Outcome ${i + 1}`;
    entries.push({
      outcome: String(outcomes[i] || fallbackOutcome),
      tokenId: String(tokenIds[i] || ""),
    });
  }

  const yes = entries.find((entry) => entry.outcome.trim().toLowerCase() === "yes") || entries[0];
  const no = entries.find((entry) => entry.outcome.trim().toLowerCase() === "no") || entries[1];

  return [
    yes?.tokenId
      ? {
          tokenId: yes.tokenId,
          outcome: "Yes",
        }
      : null,
    no?.tokenId
      ? {
          tokenId: no.tokenId,
          outcome: "No",
        }
      : null,
  ].filter(Boolean);
}

function safeText(value) {
  return value == null ? null : String(value).slice(0, 500);
}

function toTradingDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getExpiryDate(market) {
  const base = market.endDate || market.gameStartTime;
  const baseDate = base ? new Date(base) : new Date();
  return new Date(baseDate.getTime() + RETENTION_HOURS * 3600000);
}

async function fetchJson(url) {
  const candidates = [
    url,
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          Accept: "application/json",
          "User-Agent": "pmpn-intraday-collector/1.0",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${candidate}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[collector] fetch failed: ${candidate} -> ${message}`);
    }
  }

  throw lastError || new Error(`All fetch attempts failed for ${url}`);
}

async function fetchTrackedTokens() {
  const tracked = [];
  const seen = new Set();

  for (let offset = 0; offset < MAX_SCAN && tracked.length < MAX_MARKETS; offset += PAGE_SIZE) {
    const url = `${GAMMA_API}/markets?limit=${PAGE_SIZE}&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;
    const markets = await fetchJson(url);
    if (!Array.isArray(markets) || markets.length === 0) break;

    for (const market of markets) {
      if (!isShortTermMarket(market)) continue;

      const binaryTokens = resolveBinaryTokens(market);
      for (const token of binaryTokens) {
        if (!token?.tokenId || seen.has(token.tokenId)) continue;
        seen.add(token.tokenId);
        tracked.push({
          tokenId: token.tokenId,
          outcome: token.outcome,
          conditionId: safeText(market.conditionId || market.condition_id),
          marketTitle: safeText(market.question || market.title),
          eventSlug: safeText(market.events?.[0]?.slug || market.slug),
          expiresAt: getExpiryDate(market),
        });
        if (tracked.length >= MAX_MARKETS) break;
      }

      if (tracked.length >= MAX_MARKETS) break;
    }

    if (markets.length < PAGE_SIZE) break;
  }

  return tracked;
}

class Collector {
  constructor() {
    this.ws = null;
    this.flushTimer = null;
    this.refreshTimer = null;
    this.reconnectTimer = null;
    this.trackedTokens = new Map();
    this.stateByToken = new Map();
    this.latestSecond = null;
    this.reconnectAttempts = 0;
    this.cleanupTimer = null;
  }

  async start() {
    await this.safeRefreshTrackedTokens();
    this.connect();

    this.flushTimer = setInterval(() => {
      void this.flushPreviousSecond().catch((error) => {
        console.error("[collector] flushPreviousSecond error", error);
      });
    }, 1000);

    this.refreshTimer = setInterval(() => {
      void this.safeRefreshTrackedTokens();
    }, REFRESH_MS);

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredBars().catch((error) => {
        console.error("[collector] cleanupExpiredBars error", error);
      });
    }, 10 * 60 * 1000);
  }

  async safeRefreshTrackedTokens() {
    try {
      await this.refreshTrackedTokens();
    } catch (error) {
      console.error("[collector] refreshTrackedTokens failed, will retry later", error);
    }
  }

  async refreshTrackedTokens() {
    const tracked = await fetchTrackedTokens();
    const nextMap = new Map(tracked.map((item) => [item.tokenId, item]));
    this.trackedTokens = nextMap;

    for (const tokenId of this.stateByToken.keys()) {
      if (!nextMap.has(tokenId)) {
        this.stateByToken.delete(tokenId);
      }
    }

    console.log(`[collector] tracking ${tracked.length} tokens`);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.subscribe();
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log("[collector] websocket connected");
      this.subscribe();
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const messages = Array.isArray(payload) ? payload : [payload];
        for (const message of messages) {
          this.handleMessage(message);
        }
      } catch (error) {
        console.warn("[collector] failed to parse websocket message", error);
      }
    };

    this.ws.onclose = () => {
      console.warn("[collector] websocket closed");
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.warn("[collector] websocket error", error);
      this.ws?.close();
    };
  }

  subscribe() {
    const assetIds = Array.from(this.trackedTokens.keys());
    if (!assetIds.length || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "market",
        assets_ids: assetIds,
        custom_feature_enabled: true,
      })
    );
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.max(1, 2 ** this.reconnectAttempts), 30000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  ensureState(tokenId) {
    if (!this.stateByToken.has(tokenId)) {
      this.stateByToken.set(tokenId, {
        activeSecond: null,
        open: null,
        high: null,
        low: null,
        close: null,
        sampleCount: 0,
        lastMid: null,
        lastBid: null,
        lastAsk: null,
        lastTrade: null,
      });
    }
    return this.stateByToken.get(tokenId);
  }

  startSecond(state, second, price) {
    state.activeSecond = second;
    state.open = price;
    state.high = price;
    state.low = price;
    state.close = price;
    state.sampleCount = 1;
  }

  updatePrice(tokenId, second, { bestBid, bestAsk, lastTrade }) {
    const state = this.ensureState(tokenId);

    if (Number.isFinite(bestBid)) state.lastBid = bestBid;
    if (Number.isFinite(bestAsk)) state.lastAsk = bestAsk;
    if (Number.isFinite(lastTrade)) state.lastTrade = lastTrade;

    let mid = null;
    if (Number.isFinite(state.lastBid) && Number.isFinite(state.lastAsk) && state.lastAsk >= state.lastBid) {
      mid = (state.lastBid + state.lastAsk) / 2;
    } else if (Number.isFinite(state.lastTrade)) {
      mid = state.lastTrade;
    } else if (Number.isFinite(state.lastBid)) {
      mid = state.lastBid;
    } else if (Number.isFinite(state.lastAsk)) {
      mid = state.lastAsk;
    }

    if (!Number.isFinite(mid)) return;

    state.lastMid = mid;

    if (state.activeSecond !== second) {
      this.startSecond(state, second, mid);
      return;
    }

    state.high = Math.max(state.high, mid);
    state.low = Math.min(state.low, mid);
    state.close = mid;
    state.sampleCount += 1;
  }

  handleMessage(message) {
    const timestampMs = typeof message.timestamp === "string" || typeof message.timestamp === "number"
      ? new Date(message.timestamp).getTime() || Number(message.timestamp)
      : Date.now();
    const second = Math.floor((Number.isFinite(timestampMs) ? timestampMs : Date.now()) / 1000);
    this.latestSecond = Math.max(this.latestSecond || second, second);

    if (message.event_type === "price_change" && Array.isArray(message.price_changes)) {
      for (const change of message.price_changes) {
        if (!this.trackedTokens.has(change.asset_id)) continue;
        this.updatePrice(change.asset_id, second, {
          bestBid: Number(change.best_bid),
          bestAsk: Number(change.best_ask),
          lastTrade: Number(change.price),
        });
      }
      return;
    }

    if (message.event_type === "book" && this.trackedTokens.has(message.asset_id)) {
      this.updatePrice(message.asset_id, second, {
        bestBid: Number(message.bids?.[0]?.price),
        bestAsk: Number(message.asks?.[0]?.price),
        lastTrade: Number(message.last_trade_price),
      });
      return;
    }

    if (message.event_type === "last_trade_price" && this.trackedTokens.has(message.asset_id)) {
      this.updatePrice(message.asset_id, second, {
        lastTrade: Number(message.price),
      });
    }
  }

  async flushPreviousSecond() {
    const nowSecond = Math.floor(Date.now() / 1000);
    const flushSecond = nowSecond - 1;
    const rows = [];

    for (const [tokenId, meta] of this.trackedTokens.entries()) {
      const state = this.ensureState(tokenId);
      if (!Number.isFinite(state.lastMid)) continue;

      let open = state.lastMid;
      let high = state.lastMid;
      let low = state.lastMid;
      let close = state.lastMid;
      let sampleCount = 0;

      if (state.activeSecond === flushSecond && Number.isFinite(state.open)) {
        open = state.open;
        high = state.high;
        low = state.low;
        close = state.close;
        sampleCount = state.sampleCount;
        state.lastMid = close;
        state.activeSecond = null;
      }

      rows.push({
        tokenId,
        interval: "1s",
        bucketStart: new Date(flushSecond * 1000),
        tradingDay: toTradingDay(new Date(flushSecond * 1000)),
        conditionId: meta.conditionId,
        marketTitle: meta.marketTitle,
        eventSlug: meta.eventSlug,
        outcome: meta.outcome,
        open,
        high,
        low,
        close,
        bestBid: state.lastBid,
        bestAsk: state.lastAsk,
        lastTradePrice: state.lastTrade,
        sampleCount,
        expiresAt: meta.expiresAt,
      });
    }

    if (rows.length) {
      await this.upsertRows(rows);
    }
  }

  async upsertRows(rows) {
    const columns = [
      "token_id",
      "interval",
      "bucket_start",
      "trading_day",
      "condition_id",
      "market_title",
      "event_slug",
      "outcome",
      "open",
      "high",
      "low",
      "close",
      "best_bid",
      "best_ask",
      "last_trade_price",
      "sample_count",
      "expires_at",
    ];

    const values = [];
    const params = [];

    rows.forEach((row, index) => {
      const base = index * columns.length;
      values.push(`(${columns.map((_, inner) => `$${base + inner + 1}`).join(", ")})`);
      params.push(
        row.tokenId,
        row.interval,
        row.bucketStart,
        row.tradingDay,
        row.conditionId,
        row.marketTitle,
        row.eventSlug,
        row.outcome,
        row.open,
        row.high,
        row.low,
        row.close,
        row.bestBid,
        row.bestAsk,
        row.lastTradePrice,
        row.sampleCount,
        row.expiresAt
      );
    });

    const query = `
      INSERT INTO intraday_market_bars (
        ${columns.join(", ")}
      ) VALUES ${values.join(", ")}
      ON CONFLICT (token_id, interval, bucket_start)
      DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        best_bid = EXCLUDED.best_bid,
        best_ask = EXCLUDED.best_ask,
        last_trade_price = EXCLUDED.last_trade_price,
        sample_count = EXCLUDED.sample_count,
        condition_id = EXCLUDED.condition_id,
        market_title = EXCLUDED.market_title,
        event_slug = EXCLUDED.event_slug,
        outcome = EXCLUDED.outcome,
        trading_day = EXCLUDED.trading_day,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `;

    await pool.query(query, params);
  }

  async cleanupExpiredBars() {
    await pool.query(`
      DELETE FROM intraday_market_bars
      WHERE ctid IN (
        SELECT ctid
        FROM intraday_market_bars
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        LIMIT 5000
      )
    `);
    console.log("[collector] cleaned expired intraday bars");
  }
}

const collector = new Collector();
void collector.start().catch((error) => {
  console.error("[collector] fatal startup error", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("[collector] unhandledRejection", error);
});

process.on("uncaughtException", (error) => {
  console.error("[collector] uncaughtException", error);
});

process.on("SIGTERM", async () => {
  console.log("[collector] SIGTERM");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[collector] SIGINT");
  await pool.end();
  process.exit(0);
});
