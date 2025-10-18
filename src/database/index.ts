import { drizzle } from 'drizzle-orm/libsql';
import * as s  from './schema/index.js'

export const db = drizzle(process.env.DATABASE_URL!, {
    schema: s,
    casing: 'snake_case'
});

export type DrizzleClient = typeof db;
export type TransactionType = Parameters<Parameters<DrizzleClient['transaction']>[0]>[0];

export * as schema from './schema/index.js';
export * from './helper.js';
export default db;
