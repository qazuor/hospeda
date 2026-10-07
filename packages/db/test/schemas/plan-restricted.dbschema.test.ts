/**
 * SPEC-167 T-001 — `plan_restricted` column schema tests.
 *
 * Verifies the Drizzle schema definitions for the `plan_restricted` boolean
 * columns added by SPEC-167:
 *   (1) accommodations.plan_restricted — boolean NOT NULL DEFAULT false
 *   (2) owner_promotions.plan_restricted — DROPPED by HOS-1419
 *
 * Each column must be separate from its respective "suspension" mechanism
 * (ownerSuspended for accommodations; lifecycleState deactivation for
 * promotions) so the two states do not collide (design decision D-3).
 *
 * These are in-process schema tests — they do NOT require a running PostgreSQL
 * instance. They inspect Drizzle column/table metadata via `getTableConfig`.
 *
 * References: SPEC-167 §3, §4 (design decision D-3), T-001.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { ownerPromotions } from '../../src/schemas/owner-promotion/owner_promotion.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the Drizzle column config for the given SQL column name on
 * the accommodations table, or `undefined` if not found.
 */
function getAccommodationColumn(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(accommodations);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

/**
 * Returns the Drizzle column config for the given SQL column name on
 * the owner_promotions table, or `undefined` if not found.
 */
function getOwnerPromotionColumn(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(ownerPromotions);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

// ─── accommodations.plan_restricted ─────────────────────────────────────────

describe('accommodations.plan_restricted column (SPEC-167 D-3)', () => {
    it('exists with SQL name plan_restricted', () => {
        // Arrange & Act
        const config = getAccommodationColumn('plan_restricted');

        // Assert
        expect(config).toBeDefined();
    });

    it('is boolean type', () => {
        // Arrange
        const config = getAccommodationColumn('plan_restricted');

        // Assert
        expect(config?.dataType).toBe('boolean');
    });

    it('is NOT NULL', () => {
        // Arrange
        const config = getAccommodationColumn('plan_restricted');

        // Assert
        expect(config?.notNull).toBe(true);
    });

    it('defaults to false', () => {
        // Arrange
        const config = getAccommodationColumn('plan_restricted');

        // Assert
        expect(config?.default).toBe(false);
    });

    it('is separate from owner_suspended (D-3: no collision between pause and plan-restrict flows)', () => {
        // Arrange — both columns must coexist independently
        const ownerSuspended = getAccommodationColumn('owner_suspended');
        const planRestricted = getAccommodationColumn('plan_restricted');

        // Assert
        expect(ownerSuspended).toBeDefined();
        expect(planRestricted).toBeDefined();
        // Both are independent boolean columns with their own defaults
        expect(ownerSuspended?.default).toBe(false);
        expect(planRestricted?.default).toBe(false);
    });

    it('has a corresponding index accommodations_planRestricted_idx', () => {
        // Arrange
        const { indexes } = getTableConfig(accommodations);

        // Act
        const idx = indexes.find((i) => i.config.name === 'accommodations_planRestricted_idx');

        // Assert
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });
});

// ─── owner_promotions.plan_restricted (retired) ──────────────────────────────

describe('owner_promotions.plan_restricted column (dropped by HOS-1419)', () => {
    it('no longer exists, nor does its index', () => {
        // Arrange
        const { indexes } = getTableConfig(ownerPromotions);

        // Assert — the accommodations column above survives; this one left
        // together with the old plan-downgrade flow that wrote it.
        expect(getOwnerPromotionColumn('plan_restricted')).toBeUndefined();
        expect(
            indexes.find((i) => i.config.name === 'ownerPromotions_planRestricted_idx')
        ).toBeUndefined();
    });
});
