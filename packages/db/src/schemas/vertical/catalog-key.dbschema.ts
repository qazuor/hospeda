import {
    AGGREGATION_STRATEGIES,
    ENFORCEMENT_STRATEGIES,
    KEY_CLASSES,
    KEY_KINDS,
    KEY_SCOPES
} from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { check, pgTable, varchar } from 'drizzle-orm/pg-core';

const inList = (values: readonly string[]): ReturnType<typeof sql.raw> =>
    sql.raw(values.map((v) => `'${v}'`).join(', '));

/**
 * `catalog_key` — the table of entitlement and limit keys (HOS-1430).
 *
 * One row per key declared in the code catalog (`CATALOG_KEY_DEFINITIONS` in
 * `@repo/schemas`), written by the structural migration. Plan assignments will
 * reference `key` by foreign key, so the database rejects a key the code does
 * not know. Names and the four declared attributes only: no values, prices or
 * assignments. Lean reference table: no audit columns, never edited at runtime.
 */
export const catalogKeys = pgTable(
    'catalog_key',
    {
        /** The key name, e.g. `max_photos_per_accommodation`. Primary key. */
        key: varchar('key', { length: 64 }).primaryKey(),
        /** `entitlement` (boolean) or `limit` (numeric). */
        kind: varchar('kind', { length: 16 }).notNull(),
        /** `vertical` (resolved per user + vertical) or `global` (per user). */
        scope: varchar('scope', { length: 16 }).notNull(),
        /** How several sources of the key fold into one value. */
        aggregationStrategy: varchar('aggregation_strategy', { length: 16 }).notNull(),
        /** What happens to the excess when the effective value drops. */
        enforcementStrategy: varchar('enforcement_strategy', { length: 16 }).notNull(),
        /** `COMERCIAL` or `DE_ACCESO`; the attribute the `G-R3` validation reads. */
        keyClass: varchar('key_class', { length: 16 }).notNull()
    },
    (t) => ({
        kindCheck: check('ck_catalog_key_kind', sql`${t.kind} IN (${inList(KEY_KINDS)})`),
        scopeCheck: check('ck_catalog_key_scope', sql`${t.scope} IN (${inList(KEY_SCOPES)})`),
        aggregationCheck: check(
            'ck_catalog_key_aggregation_strategy',
            sql`${t.aggregationStrategy} IN (${inList(AGGREGATION_STRATEGIES)})`
        ),
        enforcementCheck: check(
            'ck_catalog_key_enforcement_strategy',
            sql`${t.enforcementStrategy} IN (${inList(ENFORCEMENT_STRATEGIES)})`
        ),
        classCheck: check('ck_catalog_key_class', sql`${t.keyClass} IN (${inList(KEY_CLASSES)})`)
    })
);

/** Insert shape for `catalog_key`. */
export type InsertCatalogKey = typeof catalogKeys.$inferInsert;
/** Select shape for `catalog_key`. */
export type SelectCatalogKey = typeof catalogKeys.$inferSelect;
