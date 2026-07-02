import path from 'node:path';
import { config as envConfig } from 'dotenv';
import type { Config } from 'drizzle-kit';

/**
 * Drizzle ORM configuration for migration generation and schema definition.
 */

// Per-app env strategy (SPEC-035): packages/db has no env of its own.
// Database connection string lives in the API app's env file.
envConfig({
    path: path.resolve(__dirname, '../../apps/api/.env.local')
});

export default {
    schema: ['./src/schemas', './src/billing/schemas.ts'],
    out: './src/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.HOSPEDA_DATABASE_URL || ''
    },
    // HOS-68/HOS-73: exclude search_index, a materialized view created by the
    // extras carril (001-search-index.matview.sql) that has no Drizzle TS
    // declaration anywhere. Without this, `db:push` sees it as "extra" and blocks
    // on an unanswerable interactive data-loss prompt (no TTY), silently no-op'ing
    // (exit 0) the entire push. NOTE: this filter does NOT extend to
    // billing_subscriptions/billing_plans/billing_promo_codes (missing
    // product_domain/effect_kind/etc. columns added via SPEC-239/262 extras) —
    // those ARE declared in the schema (re-exported from the external
    // @qazuor/qzpay-drizzle package), so excluding them makes push think they
    // don't exist and crash trying to CREATE TABLE on top of the real one
    // (verified empirically — worse than the original silent no-op). See HOS-73.
    tablesFilter: ['!search_index']
} satisfies Config;
