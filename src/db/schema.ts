import {
  pgTable,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// Users table - wallet-based authentication
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // wallet address
    address: text("address").notNull().unique(),
    ensName: text("ens_name"),
    avatar: text("avatar"),
    displayName: text("display_name"),
    twitterHandle: text("twitter_handle"),
    isPublicProfile: boolean("is_public_profile").default(true),
    
    // Stats (updated periodically)
    totalPnl: decimal("total_pnl", { precision: 18, scale: 6 }).default("0"),
    winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"),
    totalTrades: integer("total_trades").default(0),
    whaleScore: integer("whale_score").default(0),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
  },
  (table) => [index("users_address_idx").on(table.address)]
);

// User follows relationship
export const userFollows = pgTable(
  "user_follows",
  {
    followerId: text("follower_id").notNull().references(() => users.id),
    followingId: text("following_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    index("follows_follower_idx").on(table.followerId),
    index("follows_following_idx").on(table.followingId),
  ]
);

// User positions
export const userPositions = pgTable(
  "user_positions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    marketId: text("market_id").notNull(),
    marketTitle: text("market_title"),
    conditionId: text("condition_id"),
    outcome: text("outcome").notNull(), // "yes" or "no"
    shares: decimal("shares", { precision: 18, scale: 6 }).notNull(),
    avgCost: decimal("avg_cost", { precision: 18, scale: 6 }).notNull(),
    currentPrice: decimal("current_price", { precision: 18, scale: 6 }),
    unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 6 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("positions_user_idx").on(table.userId),
    index("positions_market_idx").on(table.marketId),
  ]
);

// Trade history
export const tradeHistory = pgTable(
  "trade_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    marketId: text("market_id").notNull(),
    marketTitle: text("market_title"),
    outcome: text("outcome").notNull(),
    side: text("side").notNull(), // "buy" or "sell"
    price: decimal("price", { precision: 18, scale: 6 }).notNull(),
    size: decimal("size", { precision: 18, scale: 6 }).notNull(),
    total: decimal("total", { precision: 18, scale: 6 }).notNull(),
    txHash: text("tx_hash"),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("trades_user_idx").on(table.userId),
    index("trades_market_idx").on(table.marketId),
    index("trades_timestamp_idx").on(table.timestamp),
  ]
);

// Copy trade settings
export const copyTradeSettings = pgTable(
  "copy_trade_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    targetAddress: text("target_address").notNull(),
    targetName: text("target_name"),
    
    isActive: boolean("is_active").default(true),
    mode: text("mode").notNull().default("fixed"), // "fixed" or "proportional"
    fixedAmount: decimal("fixed_amount", { precision: 18, scale: 6 }),
    proportionPercent: decimal("proportion_percent", { precision: 5, scale: 2 }),
    maxPerTrade: decimal("max_per_trade", { precision: 18, scale: 6 }),
    slippageTolerance: decimal("slippage_tolerance", { precision: 5, scale: 2 }).default("2"),
    
    totalCopiedTrades: integer("total_copied_trades").default(0),
    totalPnl: decimal("total_pnl", { precision: 18, scale: 6 }).default("0"),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("copy_settings_user_idx").on(table.userId),
    index("copy_settings_target_idx").on(table.targetAddress),
  ]
);

// Smart collections
export const smartCollections = pgTable(
  "smart_collections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").default(false),
    
    // Filter criteria
    minWhaleScore: integer("min_whale_score"),
    minWinRate: decimal("min_win_rate", { precision: 5, scale: 2 }),
    category: text("category"),
    addresses: text("addresses").array(),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("collections_user_idx").on(table.userId)]
);

// Whale signals (cached from chain)
export const whaleSignals = pgTable(
  "whale_signals",
  {
    id: text("id").primaryKey(),
    address: text("address").notNull(),
    action: text("action").notNull(), // "buy" or "sell"
    marketId: text("market_id").notNull(),
    marketTitle: text("market_title"),
    outcome: text("outcome").notNull(),
    price: decimal("price", { precision: 18, scale: 6 }).notNull(),
    size: decimal("size", { precision: 18, scale: 6 }).notNull(),
    total: decimal("total", { precision: 18, scale: 6 }).notNull(),
    whaleScore: integer("whale_score"),
    txHash: text("tx_hash"),
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("signals_address_idx").on(table.address),
    index("signals_market_idx").on(table.marketId),
    index("signals_timestamp_idx").on(table.timestamp),
  ]
);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserPosition = typeof userPositions.$inferSelect;
export type TradeHistoryRecord = typeof tradeHistory.$inferSelect;
export type CopyTradeSetting = typeof copyTradeSettings.$inferSelect;
export type SmartCollection = typeof smartCollections.$inferSelect;
export type WhaleSignal = typeof whaleSignals.$inferSelect;
