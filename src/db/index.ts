import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export const hasDatabase = Boolean(connectionString);
const sql = connectionString ? neon(connectionString) : null;
export const db = sql ? drizzle(sql, { schema }) : (null as unknown as ReturnType<typeof drizzle>);

export * from "./schema";
