import { describe, expect, it } from 'vitest';
import { PointOfInterestListItemSchema } from '../../../src/entities/point-of-interest/point-of-interest.query.schema.js';

// ============================================================================
// HOS-144 regression — the admin POI list must be able to display the name.
//
// The admin list column resolves the display name via
// `resolveI18nText(row.nameI18n) || row.slug`
// (apps/admin/.../points-of-interest.columns.ts), and the admin's list-item
// schema extends THIS base schema. If `nameI18n` is not part of the base
// `.pick()`, the client response validator (`createEntityApi`) strips it and the
// column silently falls back to the raw slug. The 914-POI catalog is
// Spanish-sourced, so every row's `nameI18n` is `{ es, en: null, pt: null }`;
// `nameI18n` is `PartialI18nTextSchema.nullish()` on the base entity, so only
// `es` is required. This suite locks in that the field is present and
// locale-null-safe.
// ============================================================================

/** A POI list item as returned by `/api/v1/admin/points-of-interest`. */
const ES_ONLY_ITEM = {
    id: '4c93a4f6-a504-41a5-8e54-0ddc33a11ee5',
    slug: 'vuelos_bautismo',
    nameI18n: { es: 'Vuelos de Bautismo sobre el Delta', en: null, pt: null },
    lat: -33.7122919,
    long: -58.6652823,
    type: 'OTHER',
    description: 'Experiencia aerea para contemplar desde altura el entramado de islas.',
    icon: null,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: 100,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-07-16T22:44:50.081Z',
    updatedAt: '2026-07-16T22:45:01.913Z'
} as const;

describe('PointOfInterestListItemSchema', () => {
    it('includes nameI18n in its shape (so the admin list can render the name, not the slug)', () => {
        expect(Object.keys(PointOfInterestListItemSchema.shape)).toContain('nameI18n');
    });

    it('accepts the es-only catalog nameI18n shape ({ es, en: null, pt: null }) — HOS-144 regression', () => {
        const result = PointOfInterestListItemSchema.safeParse(ES_ONLY_ITEM);

        expect(result.success).toBe(true);
    });

    it('retains nameI18n after parsing (the field is not stripped)', () => {
        const result = PointOfInterestListItemSchema.safeParse(ES_ONLY_ITEM);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.nameI18n).toEqual({
                es: 'Vuelos de Bautismo sobre el Delta',
                en: null,
                pt: null
            });
        }
    });

    it('still accepts a fully-translated nameI18n', () => {
        const result = PointOfInterestListItemSchema.safeParse({
            ...ES_ONLY_ITEM,
            nameI18n: { es: 'Aeroclub', en: 'Flying club', pt: 'Aeroclube' }
        });

        expect(result.success).toBe(true);
    });
});
