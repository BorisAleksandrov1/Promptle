import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Common hosted default (keeps you safe if SSL is required)
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
