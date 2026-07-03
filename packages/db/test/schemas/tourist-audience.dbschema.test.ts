/**
 * HOS-21 T-001 — `tourist_audience` column schema tests.
 *
 * Verifies the Drizzle schema definition for the new
 * owner_promotions.tourist_audience column: enum('plus'|'vip'),
 * default 'plus', NOT NULL. Marks whether a promotion is visible to
 * plus-and-up tourists (default) or reserved for vip-only (additive:
 * vip tourists see 'plus' + 'vip' rows, plus tourists see 'plus' only).
 *
 * This is a separate marker from plan_restricted (owner-side plan limit,
 * unrelated to tourist-side gating — see HOS-21 spec Data Model section).
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 *
 * Reference: HOS-21 spec.md, Data Model section (D1).
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { ownerPromotions } from '../../src/schemas/owner-promotion/owner_promotion.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the full Drizzle column object for the given SQL column name on
 * the owner_promotions table, or `undefined` if not found.
 */
function getOwnerPromotionRawColumn(sqlName: string) {
    const { columns } = getTableConfig(ownerPromotions);
    return columns.find((c) => c.name === sqlName);
}

// ─── owner_promotions.tourist_audience ───────────────────────────────────────

describe('owner_promotions.tourist_audience column (HOS-21 D1)', () => {
    it('exists with SQL name tourist_audience', () => {
        // Arrange & Act
        const col = getOwnerPromotionRawColumn('tourist_audience');

        // Assert
        expect(col).toBeDefined();
    });

    it('is a string-backed enum column', () => {
        // Arrange
        const col = getOwnerPromotionRawColumn('tourist_audience');

        // Assert
        expect(col?.config.dataType).toBe('string');
    });

    it('accepts exactly plus and vip as enum values', () => {
        // Arrange
        const col = getOwnerPromotionRawColumn('tourist_audience');

        // Assert
        expect(col?.enumValues).toEqual(['plus', 'vip']);
    });

    it('is NOT NULL', () => {
        // Arrange
        const col = getOwnerPromotionRawColumn('tourist_audience');

        // Assert
        expect(col?.config.notNull).toBe(true);
    });

    it("defaults to 'plus'", () => {
        // Arrange
        const col = getOwnerPromotionRawColumn('tourist_audience');

        // Assert
        expect(col?.config.default).toBe('plus');
    });

    it('is separate from plan_restricted (owner-side plan limit is unrelated to tourist-side gating)', () => {
        // Arrange — both columns must coexist independently
        const planRestricted = getOwnerPromotionRawColumn('plan_restricted');
        const touristAudience = getOwnerPromotionRawColumn('tourist_audience');

        // Assert
        expect(planRestricted).toBeDefined();
        expect(touristAudience).toBeDefined();
    });

    it('has a corresponding index ownerPromotions_touristAudience_idx', () => {
        // Arrange
        const { indexes } = getTableConfig(ownerPromotions);

        // Act
        const idx = indexes.find((i) => i.config.name === 'ownerPromotions_touristAudience_idx');

        // Assert
        expect(idx).toBeDefined();
        expect(idx?.config.unique).toBeFalsy();
    });
});
