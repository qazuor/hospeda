/**
 * HOS-372 regression — the ADMIN accommodations list must return media composed
 * from the relational `accommodation_media` table.
 *
 * `adminList()` passes its result through `_afterAdminList`, which delegates to
 * AccommodationService's `_afterList` projection where relational media is composed.
 *
 * That was not merely stale — it was EMPTY: the
 * `021-accommodation-media-strip-blob-photos` data migration already removed
 * `featuredImage`/`gallery`/`archivedGallery` from that column, leaving only `videos`.
 * So the admin list rendered no cover images at all while `accommodation_media` held
 * the real rows.
 *
 * This is a regression test for the public adminList lifecycle wiring: it verifies
 * that relational photos are present in the service response.
 */
import { AccommodationModel } from '@repo/db';
import type { Accommodation } from '@repo/schemas';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type {
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig
} from '../../../src/types';
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

const mockAdminActor = {
    id: 'admin-1',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: Object.values(PermissionEnum)
};

class AccommodationAdminListFixture extends AccommodationService {
    public rows: ReturnType<typeof buildAccommodationRow>[] = [];

    protected override async _executeAdminSearch(
        _params: AdminSearchExecuteParams
    ): Promise<PaginatedListOutput<Accommodation>> {
        return { items: this.rows as unknown as Accommodation[], total: this.rows.length };
    }
}

describe('AccommodationService admin list — relational media composition (HOS-372)', () => {
    let service: AccommodationAdminListFixture;
    let mediaModel: ReturnType<typeof makeMediaModelStub>;

    beforeEach(() => {
        vi.clearAllMocks();
        mediaModel = makeMediaModelStub();
        service = new AccommodationAdminListFixture(
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
        vi.restoreAllMocks();
    });

    it('composes featuredImage and gallery from accommodation_media, not from the JSONB column', async () => {
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

        service.rows = [buildAccommodationRow()];
        const result = await service.adminList(mockAdminActor, {});

        const media = result.data?.items?.[0]?.media as
            | { featuredImage?: { url?: string }; gallery?: { url?: string }[] }
            | undefined;
        expect(media?.featuredImage?.url).toBe(RELATIONAL_FEATURED_URL);
        expect(media?.gallery).toHaveLength(1);
        expect(media?.gallery?.[0]?.url).toBe(RELATIONAL_GALLERY_URL);
    });

    it('batches the media lookup into a single query for the whole page (no N+1)', async () => {
        const secondId = '00000000-0000-4000-8000-000000000302';
        service.rows = [
            buildAccommodationRow(),
            buildAccommodationRow({ id: secondId, slug: 'otra-cabana' })
        ];
        await service.adminList(mockAdminActor, {});

        expect(mediaModel.findByAccommodations).toHaveBeenCalledTimes(1);
        expect(mediaModel.findByAccommodations).toHaveBeenCalledWith(
            expect.objectContaining({ accommodationIds: [ACCOMMODATION_ID, secondId] })
        );
    });

    it('returns an empty result untouched without hitting the media model', async () => {
        service.rows = [];
        const result = await service.adminList(mockAdminActor, {});

        expect(result.data?.items).toHaveLength(0);
        expect(mediaModel.findByAccommodations).not.toHaveBeenCalled();
    });
});
