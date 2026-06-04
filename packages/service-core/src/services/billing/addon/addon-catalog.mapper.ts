/**
 * Addon Catalog Row Mapper
 *
 * Maps a raw `billing_addons` DB row (as returned by Drizzle / QZPay) to the
 * canonical {@link AddonDefinition} shape used throughout `@repo/billing`.
 *
 * Column layout of `billing_addons`:
 * - `id`                   UUID primary key
 * - `name`                 varchar — human-readable display name (e.g. "Visibility Boost (7 days)")
 * - `description`          text
 * - `active`               boolean
 * - `unitAmount`           integer — price in ARS cents (maps to `priceArs`)
 * - `currency`             varchar — always 'ARS'
 * - `billingInterval`      varchar — 'one_time' | 'month' (maps to billingType)
 * - `billingIntervalCount` integer
 * - `entitlements`         text[] — first element maps to `grantsEntitlement`
 * - `limits`               JSONB — `{ [limitKey]: limitIncrease }` (first entry maps to affectsLimitKey/limitIncrease)
 * - `livemode`             boolean
 * - `metadata`             JSONB — contains: slug, durationDays, targetCategories, sortOrder
 *
 * JSONB metadata shape (written by the seeder):
 * ```json
 * {
 *   "slug": "visibility-boost-7d",
 *   "durationDays": 7,
 *   "targetCategories": ["owner", "complex"],
 *   "sortOrder": 1
 * }
 * ```
 *
 * @module services/billing/addon/addon-catalog.mapper
 */

import type { AddonDefinition } from '@repo/billing';
import type { EntitlementKey } from '@repo/billing';
import type { LimitKey } from '@repo/billing';
import type { QZPayBillingAddon } from '@repo/db';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely extracts the `metadata` JSONB object from a billing_addons row.
 * Falls back to an empty object when the column is null/undefined.
 */
function extractMetadata(row: QZPayBillingAddon): Record<string, unknown> {
    if (row.metadata == null || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) {
        return {};
    }
    return row.metadata as Record<string, unknown>;
}

/**
 * Resolves `billingType` from the DB `billingInterval` column.
 *
 * - `'one_time'` → `'one_time'`
 * - anything else (e.g. `'month'`) → `'recurring'`
 */
function resolveBillingType(billingInterval: string | null | undefined): 'one_time' | 'recurring' {
    return billingInterval === 'one_time' ? 'one_time' : 'recurring';
}

/**
 * Extracts the first entitlement key from the DB `entitlements` text array.
 * Returns `null` when the array is empty or absent.
 */
function resolveGrantsEntitlement(entitlements: unknown): EntitlementKey | null {
    if (!Array.isArray(entitlements) || entitlements.length === 0) {
        return null;
    }
    const first = entitlements[0];
    return typeof first === 'string' ? (first as EntitlementKey) : null;
}

/**
 * Extracts the first limit key + increase from the DB `limits` JSONB object.
 *
 * The seeder writes `{ [limitKey]: limitIncrease }`. Returns `null` for both
 * when the object is absent or empty.
 */
function resolveLimitFields(limits: unknown): {
    readonly affectsLimitKey: LimitKey | null;
    readonly limitIncrease: number | null;
} {
    if (limits == null || typeof limits !== 'object' || Array.isArray(limits)) {
        return { affectsLimitKey: null, limitIncrease: null };
    }

    const entries = Object.entries(limits as Record<string, unknown>);
    if (entries.length === 0) {
        return { affectsLimitKey: null, limitIncrease: null };
    }

    const [key, value] = entries[0] as [string, unknown];
    const increase = typeof value === 'number' ? value : null;

    return {
        affectsLimitKey: (key as LimitKey) ?? null,
        limitIncrease: increase
    };
}

/**
 * Extracts `targetCategories` from the `metadata` JSONB array.
 *
 * Falls back to `['owner', 'complex']` (widest valid set) when the metadata
 * field is absent or malformed, so the mapped value is always a valid array.
 */
function resolveTargetCategories(metadata: Record<string, unknown>): Array<'owner' | 'complex'> {
    const raw = metadata.targetCategories;
    if (!Array.isArray(raw) || raw.length === 0) {
        return ['owner', 'complex'];
    }
    return raw.filter((v): v is 'owner' | 'complex' => v === 'owner' || v === 'complex');
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

/**
 * Maps a raw `billing_addons` DB row to an {@link AddonDefinition}.
 *
 * Unpacks both the top-level columns and the `metadata` JSONB field. Null
 * and undefined values are handled gracefully:
 * - Missing `metadata` → empty object (safe fallback for all JSONB fields)
 * - Missing `entitlements` → `grantsEntitlement: null`
 * - Empty `limits` → `affectsLimitKey: null`, `limitIncrease: null`
 * - Missing `targetCategories` in metadata → `['owner', 'complex']`
 * - Missing `durationDays` → `null`
 * - Missing `sortOrder` → `0`
 *
 * @param row - Raw DB row from `billing_addons`
 * @returns Fully populated `AddonDefinition`
 *
 * @example
 * ```ts
 * const def = mapRowToAddonDefinition(row);
 * console.log(def.slug);      // 'visibility-boost-7d'
 * console.log(def.priceArs);  // 500000
 * ```
 */
export function mapRowToAddonDefinition(row: QZPayBillingAddon): AddonDefinition {
    const metadata = extractMetadata(row);
    const { affectsLimitKey, limitIncrease } = resolveLimitFields(row.limits);

    const slug = typeof metadata.slug === 'string' ? metadata.slug : row.name;

    const durationDays = typeof metadata.durationDays === 'number' ? metadata.durationDays : null;

    const sortOrder = typeof metadata.sortOrder === 'number' ? metadata.sortOrder : 0;

    return {
        slug,
        name: row.name,
        description: row.description ?? '',
        billingType: resolveBillingType(row.billingInterval),
        priceArs: row.unitAmount ?? 0,
        annualPriceArs: null,
        durationDays,
        affectsLimitKey,
        limitIncrease,
        grantsEntitlement: resolveGrantsEntitlement(row.entitlements),
        targetCategories: resolveTargetCategories(metadata),
        isActive: row.active ?? false,
        sortOrder
    };
}
