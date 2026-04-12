import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

const DATABASE_URL = process.env.DATABASE_URL;
const GAMMA_API = process.env.POLYMARKET_GAMMA_API || "https://gamma-api.polymarket.com";
const FETCH_TIMEOUT_MS = Number(process.env.INTRADAY_COLLECTOR_FETCH_TIMEOUT_MS || 12000);
const CONDITION_SCAN_BATCH = Number(process.env.INTRADAY_MAINTENANCE_CONDITION_SCAN_BATCH || 100);
const DELETE_BATCH_SIZE = Number(process.env.INTRADAY_MAINTENANCE_DELETE_BATCH_SIZE || 5000);
const DELETE_MAX_PASSES = Number(process.env.INTRADAY_MAINTENANCE_DELETE_MAX_PASSES || 2000);
const STALE_MARKET_HOURS = Number(process.env.INTRADAY_MAINTENANCE_STALE_MARKET_HOURS || 1);

if (!DATABASE_URL) {
  console.error("[maintenance] Missing DATABASE_URL");
  process.exit(1);
}

neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({ connectionString: DATABASE_URL });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const MARK_ONLY = args.has("--mark-only");
const DELETE_ONLY = args.has("--delete-only");

function normalizeConditionId(market) {
  const value = market?.conditionId || market?.condition_id;
  return value == null ? "" : String(value);
}

function isResolvedMarket(market) {
  if (!market || typeof market !== "object") return false;
  if (market.closed === true) return true;
  if (market.active === false) return true;
  if (Array.isArray(market.tokens) && market.tokens.some((token) => token?.winner === true)) {
    return true;
  }
  return false;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
          "User-Agent": "pmpn-intraday-maintenance/1.0",
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
      console.warn(`[maintenance] fetch failed: ${candidate} -> ${message}`);
    }
  }

  throw lastError || new Error(`All fetch attempts failed for ${url}`);
}

async function fetchResolvedConditionIds(conditionIds) {
  const resolved = new Set();
  const uniqueIds = Array.from(new Set(conditionIds.filter(Boolean)));
  const chunks = chunkArray(uniqueIds, 10);

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(async (conditionId) => {
        try {
          const markets = await fetchJson(`${GAMMA_API}/markets?condition_id=${encodeURIComponent(conditionId)}`);
          if (!Array.isArray(markets) || markets.length === 0) return null;
          const market = markets.find((item) => normalizeConditionId(item) === conditionId) || markets[0];
          return isResolvedMarket(market) ? conditionId : null;
        } catch (error) {
          console.warn(`[maintenance] failed to verify conditionId=${conditionId}`, error);
          return null;
        }
      })
    );

    for (const conditionId of results) {
      if (conditionId) resolved.add(conditionId);
    }
  }

  return Array.from(resolved);
}

async function markSettledConditions() {
  let cursor = "";
  let scannedConditions = 0;
  let markedConditions = 0;
  let markedRows = 0;

  while (true) {
    const result = await pool.query(
      `
        SELECT condition_id
        FROM intraday_market_bars
        WHERE condition_id IS NOT NULL
          AND condition_id > $1
          AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY condition_id
        HAVING MAX(bucket_start) < NOW() - ($2::int * INTERVAL '1 hour')
        ORDER BY condition_id
        LIMIT $3
      `,
      [cursor, STALE_MARKET_HOURS, CONDITION_SCAN_BATCH]
    );

    if (!result.rows.length) break;

    const conditionIds = result.rows.map((row) => row.condition_id).filter(Boolean);
    cursor = conditionIds[conditionIds.length - 1] || cursor;
    scannedConditions += conditionIds.length;

    const resolvedConditionIds = await fetchResolvedConditionIds(conditionIds);
    if (resolvedConditionIds.length === 0) {
      console.log(`[maintenance] scanned=${scannedConditions} marked_conditions=${markedConditions} marked_rows=${markedRows}`);
      continue;
    }

    markedConditions += resolvedConditionIds.length;

    if (DRY_RUN) {
      console.log(`[maintenance] dry-run mark conditions=${resolvedConditionIds.length}`);
      continue;
    }

    const updateResult = await pool.query(
      `
        UPDATE intraday_market_bars
        SET expires_at = NOW(), updated_at = NOW()
        WHERE condition_id = ANY($1::text[])
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [resolvedConditionIds]
    );

    markedRows += typeof updateResult.rowCount === "number" ? updateResult.rowCount : 0;
    console.log(`[maintenance] scanned=${scannedConditions} marked_conditions=${markedConditions} marked_rows=${markedRows}`);
  }

  return { scannedConditions, markedConditions, markedRows };
}

async function probeExpiredRow() {
  const result = await pool.query(`
    SELECT expires_at
    FROM intraday_market_bars
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
    ORDER BY expires_at ASC
    LIMIT 1
  `);
  return result.rows[0]?.expires_at || null;
}

async function drainExpiredRows() {
  let deletedRows = 0;
  let passes = 0;

  while (passes < DELETE_MAX_PASSES) {
    const result = await pool.query(`
      WITH expired_batch AS (
        SELECT ctid
        FROM intraday_market_bars
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        LIMIT ${DELETE_BATCH_SIZE}
      )
      DELETE FROM intraday_market_bars
      WHERE ctid IN (SELECT ctid FROM expired_batch)
    `);

    const deleted = typeof result.rowCount === "number" ? result.rowCount : 0;
    passes += 1;
    deletedRows += deleted;
    console.log(`[maintenance] delete_pass=${passes} deleted=${deleted} total_deleted=${deletedRows}`);

    if (deleted < DELETE_BATCH_SIZE) break;
  }

  return { passes, deletedRows, remainingProbe: await probeExpiredRow() };
}

async function main() {
  console.log(`[maintenance] start dryRun=${DRY_RUN} markOnly=${MARK_ONLY} deleteOnly=${DELETE_ONLY}`);

  let markSummary = { scannedConditions: 0, markedConditions: 0, markedRows: 0 };
  if (!DELETE_ONLY) {
    markSummary = await markSettledConditions();
  }

  let deleteSummary = { passes: 0, deletedRows: 0, remainingProbe: await probeExpiredRow() };
  if (!MARK_ONLY && !DRY_RUN) {
    deleteSummary = await drainExpiredRows();
  }

  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        markOnly: MARK_ONLY,
        deleteOnly: DELETE_ONLY,
        markSummary,
        deleteSummary,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[maintenance] fatal error", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
