import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/database/schema',
  out: './src/database/migrations',
  dbCredentials: {
    url: 'file:./db.sqlite',
  },
});
