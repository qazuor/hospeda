import { describe, expect, it } from 'vitest';
import { PointOfInterestListItemSchema } from '../points-of-interest.schemas';

// ============================================================================
// HOS-144 regression — the admin POI list must render against real catalog data.
//
// The admin list is validated by `createEntityApi` (see
// apps/admin/src/components/entity-list/api/createEntityApi.ts), which
// `safeParse`s the WHOLE paginated response against
// `createPaginatedResponseSchema(PointOfInterestListItemSchema)` and THROWS on
// the first failing row. The 914-POI catalog is Spanish-sourced, so every row's
// `nameI18n` is `{ es, en: null, pt: null }` (HOS-142). A prior version of this
// admin schema re-overrode `nameI18n` with the strict `I18nTextSchema`
// (`en`/`pt` required, non-null), which rejected every real row and blanked the
// entire admin POI list. This suite locks in that the schema accepts es-only
// names AND retains `nameI18n` so the name column can resolve it (it falls back
// to the slug when `nameI18n` is stripped).
// ============================================================================

/** A POI list row as returned by `/api/v1/admin/points-of-interest`. */
const ES_ONLY_ROW = {
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
    hasOwnPage: false,
    createdAt: '2026-07-16T22:44:50.081Z',
    updatedAt: '2026-07-16T22:45:01.913Z'
} as const;

describe('admin PointOfInterestListItemSchema', () => {
    it('accepts the es-only catalog nameI18n shape ({ es, en: null, pt: null }) — HOS-144 regression', () => {
        const result = PointOfInterestListItemSchema.safeParse(ES_ONLY_ROW);

        expect(result.success).toBe(true);
    });

    it('retains nameI18n so the list name column can resolve it (not the slug)', () => {
        const result = PointOfInterestListItemSchema.safeParse(ES_ONLY_ROW);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.nameI18n).toEqual({
                es: 'Vuelos de Bautismo sobre el Delta',
                en: null,
                pt: null
            });
        }
    });

    it('defaults hasOwnPage to false when the field is absent', () => {
        const { hasOwnPage: _omit, ...withoutFlag } = ES_ONLY_ROW;
        const result = PointOfInterestListItemSchema.safeParse(withoutFlag);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hasOwnPage).toBe(false);
        }
    });

    it('still accepts a fully-translated nameI18n', () => {
        const result = PointOfInterestListItemSchema.safeParse({
            ...ES_ONLY_ROW,
            nameI18n: { es: 'Aeroclub', en: 'Flying club', pt: 'Aeroclube' }
        });

        expect(result.success).toBe(true);
    });
});
