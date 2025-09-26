import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/lib/schemas/schema';

// Create the connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });

// Export the database instance and schema
export const getDatabase = () => db;

// Export all schema tables for use in API routes
export const { areas, subAreas, runs, dailyPlans, incidents, users } = schema;
