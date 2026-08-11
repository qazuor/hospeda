/**
 * Regression coverage for commerce bookmark thumbnails (HOS-372).
 *
 * `enrichBookmarksWithEntityInfo` used to read a gastronomy's or experience's
 * featured image from the listing row's `media` JSONB blob. Photos now live in
 * the relational `gastronomy_media` / `experience_media` tables, and the seeders
 * stopped filling that blob — so on a freshly seeded database every commerce
 * favourite silently lost its thumbnail while every test stayed green, because
 * nothing asserted on this path at all.
 *
 * These tests pin the source of the URL, not merely that one comes back: the
 * blob is deliberately populated with a DIFFERENT url, so a regression back to
 * reading it fails loudly instead of coincidentally passing.
 */

import { EntityTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const GASTRONOMY_ID = '390a09a5-dee0-5a59-83b1-21d4a62bd0c5';
const EXPERIENCE_ID = '686b70d4-aa3f-57c6-8958-a83eca33cd69';

const RELATIONAL_URL = 'https://cdn.example.com/from-media-table.jpg';
/** The value a regression would surface — never expected in an assertion. */
const BLOB_URL = 'https://cdn.example.com/from-jsonb-blob.jpg';

const mockFindByGastronomies = vi.fn();
const mockFindByExperiences = vi.fn();
const mockSelect = vi.fn();

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: () => ({ select: mockSelect }),
        accommodationMediaModel: { findByAccommodations: vi.fn() },
        gastronomyMediaModel: { findByGastronomies: mockFindByGastronomies },
        experienceMediaModel: { findByExperiences: mockFindByExperiences }
    };
});

const { enrichBookmarksWithEntityInfo } = await import(
    '../../../src/services/userBookmark/userBookmark.enrichment.js'
);

/**
 * Stubs the Drizzle `select().from().where()` chain to return `rows`.
 *
 * Each test enriches a bookmark of ONE entity type, and the enrichment skips
 * the query for every type with no ids — so exactly one select is issued and it
 * is always the one under test. Indexing by call position would be wrong.
 */
function stubSelectChain(rows: readonly unknown[]): void {
    mockSelect.mockImplementation(() => ({
        from: () => ({ where: () => Promise.resolve(rows) })
    }));
}

describe('enrichBookmarksWithEntityInfo — commerce thumbnails (HOS-372)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should resolve a gastronomy thumbnail from gastronomy_media, not the blob', async () => {
        stubSelectChain([
            {
                id: GASTRONOMY_ID,
                name: 'La Parrilla del Puerto',
                slug: 'la-parrilla-del-puerto',
                // Present but must be ignored — the column is on its way out.
                media: { featuredImage: { url: BLOB_URL } }
            }
        ]);
        mockFindByGastronomies.mockResolvedValue(
            new Map([[GASTRONOMY_ID, [{ isFeatured: true, url: RELATIONAL_URL }]]])
        );

        const [enriched] = await enrichBookmarksWithEntityInfo([
            {
                id: 'bookmark-1',
                entityId: GASTRONOMY_ID,
                entityType: EntityTypeEnum.GASTRONOMY
            } as never
        ]);

        expect(enriched?.entityImage).toBe(RELATIONAL_URL);
        expect(enriched?.entityName).toBe('La Parrilla del Puerto');
        expect(mockFindByGastronomies).toHaveBeenCalledWith(
            expect.objectContaining({ gastronomyIds: [GASTRONOMY_ID], state: 'visible' })
        );
    });

    it('should resolve an experience thumbnail from experience_media, not the blob', async () => {
        stubSelectChain([
            {
                id: EXPERIENCE_ID,
                name: 'Kayak al atardecer',
                slug: 'kayak-al-atardecer',
                media: { featuredImage: { url: BLOB_URL } }
            }
        ]);
        mockFindByExperiences.mockResolvedValue(
            new Map([[EXPERIENCE_ID, [{ isFeatured: true, url: RELATIONAL_URL }]]])
        );

        const [enriched] = await enrichBookmarksWithEntityInfo([
            {
                id: 'bookmark-2',
                entityId: EXPERIENCE_ID,
                entityType: EntityTypeEnum.EXPERIENCE
            } as never
        ]);

        expect(enriched?.entityImage).toBe(RELATIONAL_URL);
        expect(mockFindByExperiences).toHaveBeenCalledWith(
            expect.objectContaining({ experienceIds: [EXPERIENCE_ID], state: 'visible' })
        );
    });

    it('should return a null image when the listing has no featured row', async () => {
        // Non-featured rows must not be promoted into the thumbnail slot.
        stubSelectChain([{ id: GASTRONOMY_ID, name: 'Sin foto', slug: 'sin-foto', media: null }]);
        mockFindByGastronomies.mockResolvedValue(
            new Map([[GASTRONOMY_ID, [{ isFeatured: false, url: RELATIONAL_URL }]]])
        );

        const [enriched] = await enrichBookmarksWithEntityInfo([
            {
                id: 'bookmark-3',
                entityId: GASTRONOMY_ID,
                entityType: EntityTypeEnum.GASTRONOMY
            } as never
        ]);

        expect(enriched?.entityImage).toBeNull();
    });
});
