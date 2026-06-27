import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// A Pool, not a single Client - it manages a small set of reusable
// connections and hands one out per query, which is what you want under
// concurrent API traffic instead of opening a new TCP connection per request.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
