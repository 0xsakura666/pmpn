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
const CLEANUP_BATCH_SIZE = 20000;
const CLEANUP_MAX_PASSES = 25;
const CLEANUP_MAX_DURATION_MS = 15000;

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

function parseUnitPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) return null;
  if (price <= 0 || price > 1) return null;
  return price;
}

function getTopBookPrice(levels, mode) {
  if (!Array.isArray(levels) || levels.length === 0) return null;
  let selected = null;
  for (const level of levels) {
    const price = parseUnitPrice(level?.price);
    if (price === null) continue;
    if (selected === null) {
      selected = price;
      continue;
    }
    selected = mode === "bestBid" ? Math.max(selected, price) : Math.min(selected, price);
  }
  return selected;
}

function resolveLifecycleDateCandidates(market) {
  return [
    market.endDate,
    market.events?.[0]?.endDate,
    market.gameStartTime,
    market.events?.[0]?.gameStartTime,
  ]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));
}

function resolveLifecycleBaseDate(market) {
  const preferred = [
    market.endDate,
    market.events?.[0]?.endDate,
    market.gameStartTime,
    market.events?.[0]?.gameStartTime,
  ];

  for (const value of preferred) {
    const timestamp = value ? new Date(value).getTime() : NaN;
    if (Number.isFinite(timestamp)) {
      return new Date(timestamp);
    }
  }

  return null;
}

function isShortTermMarket(market) {
  const now = Date.now();
  const candidates = resolveLifecycleDateCandidates(market);

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
  const baseDate = resolveLifecycleBaseDate(market) || new Date();
  return new Date(baseDate.getTime() + RETENTION_HOURS * 3600000);
}

function getLifecycleDate(market) {
  return resolveLifecycleBaseDate(market);
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
          lifecycleAt: getLifecycleDate(market),
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
    this.heartbeatTimer = null;
    this.trackedTokens = new Map();
    this.stateByToken = new Map();
    this.pendingRows = [];
    this.statsTimer = null;
    this.stats = {
      quotes: 0,
      trades: 0,
      skippedLateTrades: 0,
      flushedRows: 0,
      upsertBatches: 0,
    };
    this.latestSecond = null;
    this.reconnectAttempts = 0;
    this.cleanupTimer = null;
  }

  async start() {
    await this.safeRefreshTrackedTokens();
    await this.cleanupExpiredBars().catch((error) => {
      console.error("[collector] startup cleanupExpiredBars error", error);
    });
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

    this.statsTimer = setInterval(() => {
      const { quotes, trades, skippedLateTrades, flushedRows, upsertBatches } = this.stats;
      console.log(
        `[collector] stats tracked=${this.trackedTokens.size} quotes=${quotes} trades=${trades} late_skips=${skippedLateTrades} flushed_rows=${flushedRows} upsert_batches=${upsertBatches}`
      );
      this.stats = {
        quotes: 0,
        trades: 0,
        skippedLateTrades: 0,
        flushedRows: 0,
        upsertBatches: 0,
      };
    }, 60_000);
  }

  async safeRefreshTrackedTokens() {
    try {
      await this.refreshTrackedTokens();
    } catch (error) {
      console.error("[collector] refreshTrackedTokens failed, will retry later", error);
    }
  }

  async refreshTrackedTokens() {
    const previousTracked = this.trackedTokens;
    const tracked = await fetchTrackedTokens();
    const nextMap = new Map(tracked.map((item) => [item.tokenId, item]));

    const settledTokenIds = [];
    const nowMs = Date.now();
    for (const [tokenId, meta] of previousTracked.entries()) {
      if (nextMap.has(tokenId)) continue;
      const lifecycleMs = meta.lifecycleAt instanceof Date ? meta.lifecycleAt.getTime() : NaN;
      if (Number.isFinite(lifecycleMs) && lifecycleMs <= nowMs) {
        settledTokenIds.push(tokenId);
      }
    }

    if (settledTokenIds.length > 0) {
      await this.expireSettledTokenBars(settledTokenIds);
    }

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

  async expireSettledTokenBars(tokenIds) {
    if (!Array.isArray(tokenIds) || tokenIds.length === 0) return;
    await pool.query(
      `
        UPDATE intraday_market_bars
        SET expires_at = NOW(), updated_at = NOW()
        WHERE token_id = ANY($1::text[])
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [tokenIds]
    );
    console.log(`[collector] marked settled token bars for cleanup count=${tokenIds.length}`);
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log("[collector] websocket connected");
      this.startHeartbeat();
      this.subscribe();
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : event.data?.toString?.("utf8") || String(event.data);
        const trimmed = raw.trim();

        // Some server/control replies are plain text (e.g. invalid/notice lines) instead of JSON.
        // They are noisy but non-fatal for our collector; ignore them quietly.
        if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
          console.debug("[collector] ignoring non-json websocket message:", trimmed.slice(0, 120));
          return;
        }

        const payload = JSON.parse(trimmed);
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
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.warn("[collector] websocket error", error);
      this.stopHeartbeat();
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

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("PING");
      }
    }, 10_000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  stopStats() {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
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
        lastBarClose: null,
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
    state.lastBarClose = price;
  }

  buildRow(tokenId, bucketSecond, state, meta) {
    if (!meta) return null;
    if (
      !Number.isFinite(state.open) ||
      !Number.isFinite(state.high) ||
      !Number.isFinite(state.low) ||
      !Number.isFinite(state.close)
    ) {
      return null;
    }

    return {
      tokenId,
      interval: "1s",
      bucketStart: new Date(bucketSecond * 1000),
      tradingDay: toTradingDay(new Date(bucketSecond * 1000)),
      conditionId: meta.conditionId,
      marketTitle: meta.marketTitle,
      eventSlug: meta.eventSlug,
      outcome: meta.outcome,
      open: state.open,
      high: state.high,
      low: state.low,
      close: state.close,
      bestBid: state.lastBid,
      bestAsk: state.lastAsk,
      lastTradePrice: state.lastTrade,
      sampleCount: state.sampleCount,
      expiresAt: meta.expiresAt,
    };
  }

  queueActiveState(tokenId, bucketSecond, state) {
    const row = this.buildRow(tokenId, bucketSecond, state, this.trackedTokens.get(tokenId));
    if (!row) return;
    this.pendingRows.push(row);
    state.lastBarClose = state.close;
    state.activeSecond = null;
  }

  updateQuote(tokenId, { bestBid, bestAsk }) {
    const state = this.ensureState(tokenId);
    this.stats.quotes += 1;

    const parsedBid = parseUnitPrice(bestBid);
    const parsedAsk = parseUnitPrice(bestAsk);

    if (parsedBid !== null) state.lastBid = parsedBid;
    if (parsedAsk !== null) state.lastAsk = parsedAsk;
  }

  updateTrade(tokenId, second, tradePrice) {
    const state = this.ensureState(tokenId);
    const parsedTrade = parseUnitPrice(tradePrice);
    if (parsedTrade === null) return;

    if (Number.isFinite(state.activeSecond) && second < state.activeSecond) {
      this.stats.skippedLateTrades += 1;
      return;
    }

    if (Number.isFinite(state.activeSecond) && state.activeSecond < second) {
      this.queueActiveState(tokenId, state.activeSecond, state);
    }

    this.stats.trades += 1;
    state.lastTrade = parsedTrade;
    state.lastBarClose = parsedTrade;

    if (state.activeSecond !== second) {
      this.startSecond(state, second, parsedTrade);
      return;
    }

    state.high = Math.max(state.high, parsedTrade);
    state.low = Math.min(state.low, parsedTrade);
    state.close = parsedTrade;
    state.sampleCount += 1;
    state.lastBarClose = state.close;
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
        this.updateQuote(change.asset_id, {
          bestBid: Number(change.best_bid),
          bestAsk: Number(change.best_ask),
        });
      }
      return;
    }

    if (message.event_type === "book" && this.trackedTokens.has(message.asset_id)) {
      this.updateQuote(message.asset_id, {
        bestBid: getTopBookPrice(message.bids, "bestBid"),
        bestAsk: getTopBookPrice(message.asks, "bestAsk"),
      });
      return;
    }

    if (message.event_type === "last_trade_price" && this.trackedTokens.has(message.asset_id)) {
      this.updateTrade(message.asset_id, second, Number(message.price));
    }
  }

  async flushPreviousSecond() {
    const nowSecond = Math.floor(Date.now() / 1000);
    const rows = this.pendingRows.splice(0);

    for (const [tokenId, meta] of this.trackedTokens.entries()) {
      const state = this.ensureState(tokenId);
      if (meta.expiresAt instanceof Date && meta.expiresAt.getTime() <= nowSecond * 1000) {
        this.trackedTokens.delete(tokenId);
        this.stateByToken.delete(tokenId);
        continue;
      }

      if (!Number.isFinite(state.activeSecond) || state.activeSecond >= nowSecond) continue;

      this.queueActiveState(tokenId, state.activeSecond, state);
    }

    if (this.pendingRows.length) {
      rows.push(...this.pendingRows.splice(0));
    }

    if (rows.length) {
      this.stats.flushedRows += rows.length;
      await this.upsertRows(rows);
    }
  }

  async upsertRows(rows) {
    this.stats.upsertBatches += 1;
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
    const startedAt = Date.now();
    let totalDeleted = 0;
    let passes = 0;

    while (passes < CLEANUP_MAX_PASSES && Date.now() - startedAt < CLEANUP_MAX_DURATION_MS) {
      const result = await pool.query(`
        WITH expired_batch AS (
          SELECT ctid
          FROM intraday_market_bars
          WHERE expires_at IS NULL OR expires_at < NOW()
          LIMIT ${CLEANUP_BATCH_SIZE}
        )
        DELETE FROM intraday_market_bars
        WHERE ctid IN (SELECT ctid FROM expired_batch)
      `);

      const deleted = typeof result.rowCount === "number" ? result.rowCount : 0;
      totalDeleted += deleted;
      passes += 1;

      if (deleted < CLEANUP_BATCH_SIZE) break;
    }

    if (totalDeleted > 0) {
      console.log(`[collector] cleaned expired intraday bars rows=${totalDeleted} passes=${passes}`);
    }
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
  collector.stopHeartbeat();
  collector.stopStats();
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[collector] SIGINT");
  collector.stopHeartbeat();
  collector.stopStats();
  await pool.end();
  process.exit(0);
});
