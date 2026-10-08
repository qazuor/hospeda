import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { catalogKeys } from './catalog-key.dbschema.ts';
import { quotedList } from './quoted-list.ts';

/**
 * How long what an addon version grants lasts (contract §2.6): a fixed number
 * of days, or while the subscription it hangs from is alive.
 */
export const ADDON_VALIDITIES = ['FIXED_DAYS', 'WHILE_SUBSCRIPTION_ALIVE'] as const;
/** One addon validity. */
export type AddonValidity = (typeof ADDON_VALIDITIES)[number];

/**
 * What an addon version applies to (contract §2.7, native scope names): one
 * listing, one vertical subscription, the person, or the whole platform.
 */
export const ADDON_SCOPE_TYPES = ['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL'] as const;
/** One addon scope type. */
export type AddonScopeType = (typeof ADDON_SCOPE_TYPES)[number];

/**
 * `addon` — identity and cosmetics of an addon (HOS-1434, V2, AC:V2:5;
 * `F-8CA3-011`). The `plan` of the addon catalog: mutates freely. No vertical
 * (an addon declares several compatible verticals, which is billing's
 * `addon_product`), no pricing order, and no `current` flag: which version is
 * sold today is `addon_product.version_id`, a column billing owns and re-points.
 */
export const addons = pgTable('addon', {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stable identifier, unique across the catalog. */
    slug: varchar('slug', { length: 64 }).notNull().unique('uq_addon_slug'),
    /** Display name. Cosmetic. */
    name: varchar('name', { length: 120 }).notNull(),
    /** Display description. Cosmetic. */
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * `addon_version` — what an addon grants that has an effect, frozen (HOS-1434,
 * V2, AC:V2:5; DEC-ARCH-001). Always the version OF an addon (`addon_id` is not
 * nullable). Fully immutable (extras `041-plan-catalog-immutability.trigger.sql`):
 * going from 30 to 40 photos is a new version. An addon instance anchors its
 * version the way a subscription anchors its plan version.
 *
 * `validity_days` is set exactly when the validity is `FIXED_DAYS`.
 */
export const addonVersions = pgTable(
    'addon_version',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        addonId: uuid('addon_id')
            .notNull()
            .references(() => addons.id),
        /** How long what it grants lasts. See {@link ADDON_VALIDITIES}. */
        validity: varchar('validity', { length: 32 }).$type<AddonValidity>().notNull(),
        /** Days it lasts, for a `FIXED_DAYS` validity; `NULL` otherwise. */
        validityDays: integer('validity_days'),
        /** What it applies to. See {@link ADDON_SCOPE_TYPES}. */
        scopeType: varchar('scope_type', { length: 32 }).$type<AddonScopeType>().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        validityCheck: check(
            'ck_addon_version_validity',
            sql`${t.validity} IN (${quotedList(ADDON_VALIDITIES)})`
        ),
        scopeTypeCheck: check(
            'ck_addon_version_scope_type',
            sql`${t.scopeType} IN (${quotedList(ADDON_SCOPE_TYPES)})`
        ),
        validityDaysCheck: check(
            'ck_addon_version_validity_days',
            sql`(${t.validity} = 'FIXED_DAYS') = (${t.validityDays} IS NOT NULL) AND (${t.validityDays} IS NULL OR ${t.validityDays} > 0)`
        )
    })
);

/**
 * `addon_version_entitlement` — which entitlement key an addon version grants
 * (HOS-1434, V2, AC:V2:5). Immutable with its version (extras 041).
 */
export const addonVersionEntitlements = pgTable(
    'addon_version_entitlement',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        addonVersionId: uuid('addon_version_id')
            .notNull()
            .references(() => addonVersions.id),
        /** A key of the catalog (`catalog_key`). */
        key: varchar('key', { length: 64 })
            .notNull()
            .references(() => catalogKeys.key),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionKeyUnique: unique('uq_addon_version_entitlement_version_key').on(
            t.addonVersionId,
            t.key
        )
    })
);

/**
 * `addon_version_limit` — which limit key an addon version sets, and to what
 * value (HOS-1434, V2, AC:V2:5). Immutable with its version (extras 041).
 */
export const addonVersionLimits = pgTable(
    'addon_version_limit',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        addonVersionId: uuid('addon_version_id')
            .notNull()
            .references(() => addonVersions.id),
        /** A key of the catalog (`catalog_key`). */
        key: varchar('key', { length: 64 })
            .notNull()
            .references(() => catalogKeys.key),
        /** The limit's value. */
        value: integer('value').notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionKeyUnique: unique('uq_addon_version_limit_version_key').on(t.addonVersionId, t.key),
        valueCheck: check('ck_addon_version_limit_value', sql`${t.value} >= 0`)
    })
);

/** Insert shape for `addon`. */
export type InsertAddon = typeof addons.$inferInsert;
/** Select shape for `addon`. */
export type SelectAddon = typeof addons.$inferSelect;
/** Insert shape for `addon_version`. */
export type InsertAddonVersion = typeof addonVersions.$inferInsert;
/** Select shape for `addon_version`. */
export type SelectAddonVersion = typeof addonVersions.$inferSelect;
/** Insert shape for `addon_version_entitlement`. */
export type InsertAddonVersionEntitlement = typeof addonVersionEntitlements.$inferInsert;
/** Select shape for `addon_version_entitlement`. */
export type SelectAddonVersionEntitlement = typeof addonVersionEntitlements.$inferSelect;
/** Insert shape for `addon_version_limit`. */
export type InsertAddonVersionLimit = typeof addonVersionLimits.$inferInsert;
/** Select shape for `addon_version_limit`. */
export type SelectAddonVersionLimit = typeof addonVersionLimits.$inferSelect;
