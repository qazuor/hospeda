/**
 * HOS-2058 -- data-migration 0146: backfill `features.category` and retype the
 * moved amenities, by slug. Unit test with a mocked Drizzle client: it pins the
 * statements the migration issues (idempotent WHERE clauses) and its counts.
 */
import { AmenitiesTypeEnum, FeatureCategoryEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    AMENITY_TYPE_MOVES,
    FEATURE_CATEGORY_BACKFILL,
    meta,
    up
} from '../../src/data-migrations/0146-hos-2058-feature-category-amenity-type.js';

interface RecordedUpdate {
    readonly table: unknown;
    readonly set: Record<string, unknown>;
    readonly where: unknown;
}

/**
 * Builds a fake `ctx.db` whose `update().set().where().returning()` chain
 * records each call and resolves to `rowsPerCall` fake rows.
 */
const createCtx = ({ rowsPerCall }: { readonly rowsPerCall: number }) => {
    const updates: RecordedUpdate[] = [];
    const update = vi.fn((table: unknown) => ({
        set: (set: Record<string, unknown>) => ({
            where: (where: unknown) => ({
                returning: async () => {
                    updates.push({ table, set, where });
                    return Array.from({ length: rowsPerCall }, (_, i) => ({ id: `row-${i}` }));
                }
            })
        })
    }));
    const ctx = { db: { update } } as unknown as Parameters<typeof up>[0];
    return { ctx, updates, update };
};

describe('0146-hos-2058-feature-category-amenity-type', () => {
    it('declares a non-destructive required migration that needs features.category', () => {
        expect(meta).toEqual({
            name: '0146-hos-2058-feature-category-amenity-type',
            group: 'required',
            destructive: false,
            requiresColumns: [{ table: 'features', column: 'category' }]
        });
    });

    it('covers 106 distinct feature slugs, each in exactly one valid category', () => {
        // Arrange
        const validCategories = new Set<string>(Object.values(FeatureCategoryEnum));
        const slugs = Object.values(FEATURE_CATEGORY_BACKFILL).flat();

        // Assert
        expect(Object.keys(FEATURE_CATEGORY_BACKFILL).every((c) => validCategories.has(c))).toBe(
            true
        );
        expect(slugs).toHaveLength(106);
        expect(new Set(slugs).size).toBe(106);
    });

    it('applies the owner decisions: VIEW kept, security rows in OFFER_PROFILE', () => {
        expect(FEATURE_CATEGORY_BACKFILL.VIEW).toEqual([
            'panoramic_view_extended',
            'private_viewpoint'
        ]);
        for (const slug of ['24h_security', 'perimeter_lighting', 'perimeter_fence']) {
            expect(FEATURE_CATEGORY_BACKFILL.OFFER_PROFILE).toContain(slug);
        }
    });

    it('does not backfill the HOS-1787 epic rows (the epic categorizes them)', () => {
        const slugs = Object.values(FEATURE_CATEGORY_BACKFILL).flat();
        expect(slugs).not.toContain('dj_sets');
        expect(slugs).not.toContain('karaoke');
    });

    it('moves 30 amenities, each into one of the five new types', () => {
        const newTypes = new Set<string>([
            AmenitiesTypeEnum.PARKING,
            AmenitiesTypeEnum.LAUNDRY,
            AmenitiesTypeEnum.WATER_ACTIVITIES,
            AmenitiesTypeEnum.WELLNESS,
            AmenitiesTypeEnum.DINING
        ]);
        expect(AMENITY_TYPE_MOVES).toHaveLength(30);
        expect(new Set(AMENITY_TYPE_MOVES.map((m) => m.slug)).size).toBe(30);
        expect(AMENITY_TYPE_MOVES.every((m) => newTypes.has(m.to) && !newTypes.has(m.from))).toBe(
            true
        );
    });

    it('issues one feature UPDATE per category and one amenity UPDATE per move', async () => {
        // Arrange
        const { ctx, updates } = createCtx({ rowsPerCall: 1 });

        // Act
        const result = await up(ctx);

        // Assert
        // Feature statements set `category`, amenity statements set `type`.
        const featureUpdates = updates.filter((u) => 'category' in u.set);
        const amenityUpdates = updates.filter((u) => 'type' in u.set);
        expect(updates).toHaveLength(featureUpdates.length + amenityUpdates.length);
        expect(featureUpdates).toHaveLength(Object.keys(FEATURE_CATEGORY_BACKFILL).length);
        expect(amenityUpdates).toHaveLength(AMENITY_TYPE_MOVES.length);
        expect(featureUpdates.map((u) => u.set)).toEqual(
            Object.keys(FEATURE_CATEGORY_BACKFILL).map((category) => ({ category }))
        );
        expect(amenityUpdates.map((u) => u.set)).toEqual(
            AMENITY_TYPE_MOVES.map((m) => ({ type: m.to }))
        );
        expect(result.counts).toEqual({
            featuresCategorized: Object.keys(FEATURE_CATEGORY_BACKFILL).length,
            amenitiesRetyped: AMENITY_TYPE_MOVES.length
        });
    });

    it('reports zero writes on a re-run where every WHERE clause matches nothing', async () => {
        // Arrange: idempotent WHERE (category IS NULL / type = old) matches no row.
        const { ctx } = createCtx({ rowsPerCall: 0 });

        // Act
        const result = await up(ctx);

        // Assert
        expect(result.counts).toEqual({ featuresCategorized: 0, amenitiesRetyped: 0 });
        expect(result.summary).toContain('0 feature(s) categorized');
    });
});
