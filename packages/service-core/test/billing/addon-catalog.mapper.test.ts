/**
 * Unit tests for addon-catalog.mapper.ts (SPEC-192 T-003)
 *
 * Two test suites:
 *
 * 1. mapRowToAddonDefinition — unit tests for field-level mapping covering:
 *    - Happy-path: all fields present and correct
 *    - Null/undefined metadata graceful fallback
 *    - billingType derivation from billingInterval
 *    - grantsEntitlement from first entitlements array element
 *    - affectsLimitKey + limitIncrease from first limits entry
 *    - targetCategories from metadata JSONB array
 *    - durationDays and sortOrder fallbacks
 *
 * 2. Config parity — field-for-field equality between mapRowToAddonDefinition()
 *    output and ALL_ADDONS static config for EVERY slug.
 *    Row inputs are built from the exact shape the seeder writes to billing_addons,
 *    ensuring the DB path returns exactly what the static config path returned.
 */

import { ALL_ADDONS } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import { mapRowToAddonDefinition } from '../../src/services/billing/addon/addon-catalog.mapper.js';

// ─── Row builder (mirrors the seeder exactly) ────────────────────────────────

/**
 * Builds a billing_addons row using the exact same field mapping the seeder
 * uses when writing to the DB (see billingAddons.seed.ts):
 *
 * - name        ← addon.name
 * - description ← addon.description
 * - active      ← addon.isActive
 * - unitAmount  ← addon.priceArs
 * - currency    ← 'ARS'
 * - billingInterval ← addon.billingType === 'one_time' ? 'one_time' : 'month'
 * - billingIntervalCount ← 1
 * - entitlements ← [addon.grantsEntitlement] | []
 * - limits      ← { [affectsLimitKey]: limitIncrease } | {}
 * - livemode    ← false (development)
 * - metadata    ← { slug, durationDays, targetCategories, sortOrder }
 */
function buildRowFromAddon(addon: (typeof ALL_ADDONS)[number]) {
    const entitlements: string[] = addon.grantsEntitlement ? [addon.grantsEntitlement] : [];
    const limits: Record<string, number> =
        addon.affectsLimitKey !== null && addon.limitIncrease !== null
            ? { [addon.affectsLimitKey]: addon.limitIncrease }
            : {};

    return {
        id: `uuid-${addon.slug}`,
        name: addon.name,
        description: addon.description,
        active: addon.isActive,
        unitAmount: addon.priceArs,
        currency: 'ARS',
        billingInterval: addon.billingType === 'one_time' ? 'one_time' : 'month',
        billingIntervalCount: 1,
        entitlements,
        limits,
        livemode: false,
        metadata: {
            slug: addon.slug,
            durationDays: addon.durationDays,
            targetCategories: addon.targetCategories,
            sortOrder: addon.sortOrder
        },
        // Required fields from QZPayBillingAddon (QZPay schema additions)
        version: '1',
        deletedAt: null,
        compatiblePlanIds: [] as string[],
        allowMultiple: false,
        maxQuantity: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

// ─── mapRowToAddonDefinition — unit tests ─────────────────────────────────────

describe('mapRowToAddonDefinition', () => {
    describe('happy path — all fields present', () => {
        it('should map name and description', () => {
            // Arrange
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            // Act
            const def = mapRowToAddonDefinition(row);
            // Assert
            expect(def.name).toBe('Visibility Boost (7 days)');
            expect(def.description).toBe(
                'Your accommodation appears featured in search results for 7 days.'
            );
        });

        it('should map slug from metadata.slug', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition(row);
            expect(def.slug).toBe('visibility-boost-7d');
        });

        it('should map priceArs from unitAmount', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition(row);
            expect(def.priceArs).toBe(500000);
        });

        it('should always set annualPriceArs to null (not stored in billing_addons)', () => {
            const row = buildRowFromAddon(ALL_ADDONS[2]!); // extra-photos-20 (has annualPriceArs in static config)
            const def = mapRowToAddonDefinition(row);
            expect(def.annualPriceArs).toBeNull();
        });

        it('should map billingType=one_time when billingInterval=one_time', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition(row);
            expect(def.billingType).toBe('one_time');
        });

        it('should map billingType=recurring when billingInterval=month', () => {
            const row = buildRowFromAddon(ALL_ADDONS[2]!); // extra-photos-20
            const def = mapRowToAddonDefinition(row);
            expect(def.billingType).toBe('recurring');
        });

        it('should map grantsEntitlement from first entitlements element', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!); // visibility-boost-7d — featured_listing
            const def = mapRowToAddonDefinition(row);
            // EntitlementKey.FEATURED_LISTING = 'featured_listing' (lowercase enum value)
            expect(def.grantsEntitlement).toBe('featured_listing');
        });

        it('should map grantsEntitlement=null when entitlements is empty', () => {
            const row = buildRowFromAddon(ALL_ADDONS[2]!); // extra-photos-20 — no entitlement
            const def = mapRowToAddonDefinition(row);
            expect(def.grantsEntitlement).toBeNull();
        });

        it('should map affectsLimitKey and limitIncrease from limits object', () => {
            const row = buildRowFromAddon(ALL_ADDONS[2]!); // extra-photos-20
            const def = mapRowToAddonDefinition(row);
            expect(def.affectsLimitKey).toBe('max_photos_per_accommodation');
            expect(def.limitIncrease).toBe(20);
        });

        it('should map affectsLimitKey=null and limitIncrease=null when limits is empty', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!); // visibility-boost-7d — no limit
            const def = mapRowToAddonDefinition(row);
            expect(def.affectsLimitKey).toBeNull();
            expect(def.limitIncrease).toBeNull();
        });

        it('should map targetCategories from metadata', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!); // visibility-boost-7d — ['owner', 'complex']
            const def = mapRowToAddonDefinition(row);
            expect(def.targetCategories).toEqual(['owner', 'complex']);
        });

        it('should map durationDays from metadata', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!); // 7 days
            const def = mapRowToAddonDefinition(row);
            expect(def.durationDays).toBe(7);
        });

        it('should map durationDays=null for recurring addons', () => {
            const row = buildRowFromAddon(ALL_ADDONS[2]!); // extra-photos-20 — null
            const def = mapRowToAddonDefinition(row);
            expect(def.durationDays).toBeNull();
        });

        it('should map sortOrder from metadata', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!); // sortOrder: 1
            const def = mapRowToAddonDefinition(row);
            expect(def.sortOrder).toBe(1);
        });

        it('should map isActive from active column', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition(row);
            expect(def.isActive).toBe(true);
        });
    });

    describe('null/undefined graceful fallbacks', () => {
        it('should fall back slug to row.name when metadata.slug is missing', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({
                ...row,
                metadata: { durationDays: 7, targetCategories: ['owner'], sortOrder: 1 }
            });
            expect(def.slug).toBe(row.name);
        });

        it('should use empty string for description when null', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({ ...row, description: null as unknown as string });
            expect(def.description).toBe('');
        });

        it('should default sortOrder to 0 when metadata.sortOrder is missing', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({
                ...row,
                metadata: { slug: 'x', durationDays: null, targetCategories: ['owner'] }
            });
            expect(def.sortOrder).toBe(0);
        });

        it('should default targetCategories to [owner, complex] when metadata is null', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({
                ...row,
                metadata: null as unknown as Record<string, unknown>
            });
            expect(def.targetCategories).toEqual(['owner', 'complex']);
        });

        it('should handle empty metadata object gracefully', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({ ...row, metadata: {} });
            expect(def.slug).toBe(row.name); // falls back to name
            expect(def.sortOrder).toBe(0);
            expect(def.durationDays).toBeNull();
            expect(def.targetCategories).toEqual(['owner', 'complex']);
        });

        it('should handle null limits object gracefully', () => {
            const row = buildRowFromAddon(ALL_ADDONS[2]!);
            const def = mapRowToAddonDefinition({
                ...row,
                limits: null as unknown as Record<string, number>
            });
            expect(def.affectsLimitKey).toBeNull();
            expect(def.limitIncrease).toBeNull();
        });

        it('should handle null entitlements array gracefully', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({
                ...row,
                entitlements: null as unknown as string[]
            });
            expect(def.grantsEntitlement).toBeNull();
        });

        it('should return false for isActive when active is null', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({ ...row, active: null as unknown as boolean });
            expect(def.isActive).toBe(false);
        });

        it('should return 0 for priceArs when unitAmount is null', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({ ...row, unitAmount: null as unknown as number });
            expect(def.priceArs).toBe(0);
        });

        it('should default billingType to recurring for unknown billingInterval', () => {
            const row = buildRowFromAddon(ALL_ADDONS[0]!);
            const def = mapRowToAddonDefinition({ ...row, billingInterval: 'year' });
            expect(def.billingType).toBe('recurring');
        });
    });
});

// ─── Config parity tests — field-for-field equality for all 5 addons ─────────

describe('config parity — mapRowToAddonDefinition vs ALL_ADDONS static config', () => {
    /**
     * For each addon in ALL_ADDONS, build the exact row the seeder would write
     * and assert field-for-field equality between the mapped result and the
     * original static AddonDefinition.
     *
     * NOTE: annualPriceArs is intentionally excluded because the seeder does not
     * write it to billing_addons (billing_addons has no annual price column), so
     * the mapper always returns null — a known accepted divergence.
     */

    for (const staticAddon of ALL_ADDONS) {
        it(`should produce equivalent fields for slug '${staticAddon.slug}'`, () => {
            // Arrange — row built exactly as the seeder builds it
            const row = buildRowFromAddon(staticAddon);

            // Act
            const mapped = mapRowToAddonDefinition(row);

            // Assert — field-for-field parity (excluding annualPriceArs)
            expect(mapped.slug).toBe(staticAddon.slug);
            expect(mapped.name).toBe(staticAddon.name);
            expect(mapped.description).toBe(staticAddon.description);
            expect(mapped.billingType).toBe(staticAddon.billingType);
            expect(mapped.priceArs).toBe(staticAddon.priceArs);
            // annualPriceArs is null from DB (not stored in billing_addons)
            expect(mapped.annualPriceArs).toBeNull();
            expect(mapped.durationDays).toBe(staticAddon.durationDays);
            expect(mapped.affectsLimitKey).toBe(staticAddon.affectsLimitKey);
            expect(mapped.limitIncrease).toBe(staticAddon.limitIncrease);
            expect(mapped.grantsEntitlement).toBe(staticAddon.grantsEntitlement);
            expect(mapped.targetCategories).toEqual(staticAddon.targetCategories);
            expect(mapped.isActive).toBe(staticAddon.isActive);
            expect(mapped.sortOrder).toBe(staticAddon.sortOrder);
        });
    }
});
