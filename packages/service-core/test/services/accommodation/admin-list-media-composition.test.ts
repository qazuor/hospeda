/**
 * HOS-372 regression — the ADMIN accommodations list must return media composed
 * from the relational `accommodation_media` table.
 *
 * `adminList()` returns whatever `_executeAdminSearch()` produces, verbatim. Unlike
 * `list()`/`search()`, it never routes through `_afterList`/`_afterSearch`, which is
 * where SPEC-204's relational media composition normally happens. The accommodation
 * override of `_executeAdminSearch` did its own projections but never composed media,
 * so `GET /api/v1/admin/accommodations` shipped the raw `accommodations.media` JSONB.
 *
 * That was not merely stale — it was EMPTY: the
 * `021-accommodation-media-strip-blob-photos` data migration already removed
 * `featuredImage`/`gallery`/`archivedGallery` from that column, leaving only `videos`.
 * So the admin list rendered no cover images at all while `accommodation_media` held
 * the real rows.
 *
 * This is a true regression test: revert the `attachComposedMediaList` call in
 * `_executeAdminSearch` and the first case goes red.
 */
import { AccommodationModel, resetDb, setDb } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { AdminSearchExecuteParams, ServiceConfig } from '../../../src/types';
import { makeMediaModelStub } from '../../utils/modelMockFactory';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

const ACCOMMODATION_ID = '00000000-0000-4000-8000-000000000301';
const RELATIONAL_FEATURED_URL = 'https://cdn.example.com/relational-featured.jpg';
const RELATIONAL_GALLERY_URL = 'https://cdn.example.com/relational-gallery.jpg';

/**
 * A row as the DB returns it post-021: the JSONB `media` column carries videos
 * only — every photo key was stripped out by the data migration.
 */
function buildAccommodationRow(overrides: Record<string, unknown> = {}) {
    return {
        id: ACCOMMODATION_ID,
        name: 'Cabaña del Río',
        slug: 'cabana-del-rio',
        media: { videos: [] },
        ...overrides
    };
}

/** A relational `accommodation_media` row. */
function buildMediaRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '00000000-0000-4000-8000-000000000401',
        accommodationId: ACCOMMODATION_ID,
        url: RELATIONAL_FEATURED_URL,
        moderationState: 'APPROVED',
        state: 'visible',
        isFeatured: true,
        sortOrder: 0,
        caption: null,
        description: null,
        alt: null,
        publicId: null,
        attribution: null,
        archivedAt: null,
        ...overrides
    };
}

/**
 * `AccommodationService` declares default list relations, so `_executeAdminSearch`
 * goes through `findAllWithRelations` — `db.query.accommodations.findMany()` for the
 * items plus `db.select().from().where()` for the count.
 */
function makeRelationalDbMock(rows: unknown[]) {
    const countWhereFn = vi.fn().mockResolvedValue([{ count: rows.length }]);
    return {
        query: { accommodations: { findMany: vi.fn().mockResolvedValue(rows) } },
        select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: countWhereFn }) })
    };
}

const mockAdminActor = {
    id: 'admin-1',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: Object.values(PermissionEnum)
};

function callExecuteAdminSearch(
    service: AccommodationService,
    params: AdminSearchExecuteParams
): Promise<{ items: { media?: Record<string, unknown> }[]; total: number }> {
    type WithAdminSearch = {
        _executeAdminSearch: (
            p: AdminSearchExecuteParams
        ) => Promise<{ items: { media?: Record<string, unknown> }[]; total: number }>;
    };
    return (service as unknown as WithAdminSearch)._executeAdminSearch(params);
}

function buildParams(overrides: Partial<AdminSearchExecuteParams> = {}): AdminSearchExecuteParams {
    return {
        where: {},
        entityFilters: {},
        pagination: { page: 1, pageSize: 20 },
        sort: { sortBy: 'createdAt', sortOrder: 'desc' },
        actor: mockAdminActor,
        ...overrides
    };
}

describe('AccommodationService admin list — relational media composition (HOS-372)', () => {
    let service: AccommodationService;
    let mediaModel: ReturnType<typeof makeMediaModelStub>;

    beforeEach(() => {
        vi.clearAllMocks();
        mediaModel = makeMediaModelStub();
        service = new AccommodationService(
            {} as ServiceConfig,
            new AccommodationModel() as never,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            mediaModel as never
        );
    });

    afterEach(() => {
        resetDb();
        vi.restoreAllMocks();
    });

    it('composes featuredImage and gallery from accommodation_media, not from the JSONB column', async () => {
        setDb(makeRelationalDbMock([buildAccommodationRow()]) as never);
        mediaModel.findByAccommodations.mockResolvedValue(
            new Map([
                [
                    ACCOMMODATION_ID,
                    [
                        buildMediaRow(),
                        buildMediaRow({
                            id: '00000000-0000-4000-8000-000000000402',
                            url: RELATIONAL_GALLERY_URL,
                            isFeatured: false,
                            sortOrder: 1
                        })
                    ]
                ]
            ])
        );

        const result = await callExecuteAdminSearch(service, buildParams());

        const media = result.items[0]?.media as
            | { featuredImage?: { url?: string }; gallery?: { url?: string }[] }
            | undefined;
        expect(media?.featuredImage?.url).toBe(RELATIONAL_FEATURED_URL);
        expect(media?.gallery).toHaveLength(1);
        expect(media?.gallery?.[0]?.url).toBe(RELATIONAL_GALLERY_URL);
    });

    it('batches the media lookup into a single query for the whole page (no N+1)', async () => {
        const secondId = '00000000-0000-4000-8000-000000000302';
        setDb(
            makeRelationalDbMock([
                buildAccommodationRow(),
                buildAccommodationRow({ id: secondId, slug: 'otra-cabana' })
            ]) as never
        );

        await callExecuteAdminSearch(service, buildParams());

        expect(mediaModel.findByAccommodations).toHaveBeenCalledTimes(1);
        expect(mediaModel.findByAccommodations).toHaveBeenCalledWith(
            expect.objectContaining({ accommodationIds: [ACCOMMODATION_ID, secondId] })
        );
    });

    it('returns an empty result untouched without hitting the media model', async () => {
        setDb(makeRelationalDbMock([]) as never);

        const result = await callExecuteAdminSearch(service, buildParams());

        expect(result.items).toHaveLength(0);
        expect(mediaModel.findByAccommodations).not.toHaveBeenCalled();
    });
});
