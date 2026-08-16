/**
 * gastronomy.media.test.ts
 *
 * Unit tests for gastronomy media helper functions (HOS-372).
 *
 * Coverage:
 *  - addGastronomyMedia: NOT_FOUND listing, permission gate, sortOrder auto-assign.
 *  - removeGastronomyMedia: NOT_FOUND media, resequences remaining visible rows
 *    to a dense 0-based sortOrder.
 *  - reorderGastronomyMedia: rejects missing id, extra id, and duplicate id;
 *    happy path applies sortOrder per index.
 *  - setFeaturedGastronomyMedia: clears the previous featured row, rejects an
 *    archived target.
 *  - getGastronomyMedia: NOT_FOUND listing, returns rows.
 *
 * All DB interactions are fully mocked — no live DB is touched.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockMediaModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByGastronomy: vi.fn(),
    findFeatured: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        GastronomyMediaModel: vi.fn(function () {
            return mockMediaModel;
        }),
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
    };
});

// ---------------------------------------------------------------------------

import type {
    GastronomyMedia,
    GastronomyMediaAddInput,
    GastronomyMediaListInput,
    GastronomyMediaRemoveInput,
    GastronomyMediaReorderInput,
    GastronomyMediaSetFeaturedInput
} from '@repo/schemas';
import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addGastronomyMedia,
    getGastronomyMedia,
    removeGastronomyMedia,
    reorderGastronomyMedia,
    setFeaturedGastronomyMedia
} from '../../../src/services/gastronomy/gastronomy.media';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GASTRONOMY_ID = '00000000-0000-4000-a000-000000000001';
const MEDIA_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';

function makeMediaRow(overrides: Partial<GastronomyMedia> = {}): GastronomyMedia {
    return {
        id: MEDIA_ID,
        gastronomyId: GASTRONOMY_ID,
        url: 'https://cdn.example.com/photo.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as GastronomyMedia;
}

const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.COMMERCE_OWNER],
    permissions: [PermissionEnum.COMMERCE_EDIT_OWN]
};

const touristActor: Actor = {
    id: 'tourist-id',
    roles: [RoleEnum.USER],
    permissions: []
};

// ---------------------------------------------------------------------------
// Mock GastronomyModel factory
// ---------------------------------------------------------------------------

function makeGastronomyModel(entity: Record<string, unknown> | null = null) {
    return {
        findById: vi.fn().mockResolvedValue(entity)
    };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );

    mockMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
    mockMediaModel.findById.mockResolvedValue(null);
    mockMediaModel.findByGastronomy.mockResolvedValue({ items: [], total: 0 });
    mockMediaModel.findFeatured.mockResolvedValue(null);
    mockMediaModel.create.mockResolvedValue(makeMediaRow());
    mockMediaModel.update.mockResolvedValue(makeMediaRow());
    mockMediaModel.softDelete.mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// addGastronomyMedia
// ---------------------------------------------------------------------------

describe('addGastronomyMedia', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        const model = makeGastronomyModel(null);
        const input: GastronomyMediaAddInput = {
            gastronomyId: GASTRONOMY_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        const result = await addGastronomyMedia(
            model as unknown as Parameters<typeof addGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN when actor lacks COMMERCE_EDIT_OWN', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const input: GastronomyMediaAddInput = {
            gastronomyId: GASTRONOMY_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        const result = await addGastronomyMedia(
            model as unknown as Parameters<typeof addGastronomyMedia>[0],
            touristActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should set sortOrder to 0 when no visible media exists', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

        const input: GastronomyMediaAddInput = {
            gastronomyId: GASTRONOMY_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        const result = await addGastronomyMedia(
            model as unknown as Parameters<typeof addGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ sortOrder: 0, isFeatured: false, state: 'visible' }),
            undefined
        );
    });

    it('should set sortOrder to max + 1 when visible media exists', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findAll.mockResolvedValue({
            items: [makeMediaRow({ sortOrder: 3 })],
            total: 1
        });

        const input: GastronomyMediaAddInput = {
            gastronomyId: GASTRONOMY_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        await addGastronomyMedia(
            model as unknown as Parameters<typeof addGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ sortOrder: 4 }),
            undefined
        );
    });

    it('defaults moderationState to PENDING when not supplied', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });

        const input: GastronomyMediaAddInput = {
            gastronomyId: GASTRONOMY_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        await addGastronomyMedia(
            model as unknown as Parameters<typeof addGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ moderationState: ModerationStatusEnum.PENDING }),
            undefined
        );
    });
});

// ---------------------------------------------------------------------------
// removeGastronomyMedia
// ---------------------------------------------------------------------------

describe('removeGastronomyMedia', () => {
    it('should return NOT_FOUND when the media row does not exist', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(null);

        const input: GastronomyMediaRemoveInput = {
            gastronomyId: GASTRONOMY_ID,
            mediaId: MEDIA_ID
        };

        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return NOT_FOUND when the media belongs to a different listing', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(
            makeMediaRow({ gastronomyId: '00000000-0000-4000-a000-000000000099' })
        );

        const input: GastronomyMediaRemoveInput = {
            gastronomyId: GASTRONOMY_ID,
            mediaId: MEDIA_ID
        };

        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should soft-delete and resequence remaining visible rows to a dense 0-based sortOrder', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ sortOrder: 1 }));

        // Remaining rows after the delete carry a GAP at sortOrder 1 (0, 2, 3) —
        // this is the exact shape removeGastronomyMedia must repair to (0, 1, 2).
        const remainingId2 = '00000000-0000-4000-a000-000000000010';
        const remainingId3 = '00000000-0000-4000-a000-000000000011';
        mockMediaModel.findByGastronomy.mockResolvedValue({
            items: [
                makeMediaRow({ id: '00000000-0000-4000-a000-000000000009', sortOrder: 0 }),
                makeMediaRow({ id: remainingId2, sortOrder: 2 }),
                makeMediaRow({ id: remainingId3, sortOrder: 3 })
            ],
            total: 3
        });

        const input: GastronomyMediaRemoveInput = {
            gastronomyId: GASTRONOMY_ID,
            mediaId: MEDIA_ID
        };

        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.success).toBe(true);
        expect(mockMediaModel.softDelete).toHaveBeenCalledWith({ id: MEDIA_ID }, ownerActor.id, {});
        // Row at index 0 already has sortOrder 0 — no update call needed for it.
        expect(mockMediaModel.update).not.toHaveBeenCalledWith(
            { id: '00000000-0000-4000-a000-000000000009' },
            expect.anything(),
            expect.anything()
        );
        // The two rows with a gap get resequenced to dense 0-based order.
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: remainingId2 },
            { sortOrder: 1 },
            {}
        );
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: remainingId3 },
            { sortOrder: 2 },
            {}
        );
    });

    // Regression guard: reverting the resequencing loop (e.g. deleting without
    // reindexing remaining rows) would leave gaps in sortOrder. Verified this
    // test fails when the resequencing `for` loop body in
    // `removeGastronomyMedia` is commented out — the `update` assertions above
    // then receive zero calls instead of the expected sortOrder values.
});

// ---------------------------------------------------------------------------
// reorderGastronomyMedia
// ---------------------------------------------------------------------------

describe('reorderGastronomyMedia', () => {
    const ID_A = '00000000-0000-4000-a000-00000000000a';
    const ID_B = '00000000-0000-4000-a000-00000000000b';
    const ID_C = '00000000-0000-4000-a000-00000000000c';

    function setVisibleRows() {
        mockMediaModel.findByGastronomy.mockResolvedValue({
            items: [
                makeMediaRow({ id: ID_A, sortOrder: 0 }),
                makeMediaRow({ id: ID_B, sortOrder: 1 }),
                makeMediaRow({ id: ID_C, sortOrder: 2 })
            ],
            total: 3
        });
    }

    it('should reject when orderedIds is missing an id', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        setVisibleRows();

        const input: GastronomyMediaReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            orderedIds: [ID_A, ID_B] // missing ID_C
        };

        const result = await reorderGastronomyMedia(
            model as unknown as Parameters<typeof reorderGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should reject when orderedIds contains an extra/foreign id', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        setVisibleRows();

        const input: GastronomyMediaReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            orderedIds: [ID_A, ID_B, ID_C, '00000000-0000-4000-a000-000000000099']
        };

        const result = await reorderGastronomyMedia(
            model as unknown as Parameters<typeof reorderGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should reject when orderedIds contains a duplicate id', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        setVisibleRows();

        const input: GastronomyMediaReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            orderedIds: [ID_A, ID_A, ID_B] // duplicate A, missing C
        };

        const result = await reorderGastronomyMedia(
            model as unknown as Parameters<typeof reorderGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain('duplicate');
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    // Regression guard: the duplicate check is an EXTRA guard not present in
    // the accommodation template (a pure set-difference check alone misses a
    // duplicate whose deduplicated set still equals existingIds — see the
    // JSDoc in gastronomy.media.ts). Verified this test FAILS (does not reject)
    // when the explicit
    //   `if (validated.orderedIds.length !== inputIds.size) { throw ... }`
    // guard is removed from `reorderGastronomyMedia`, because for the 3-row
    // fixture above a duplicate always also creates a genuine missing id, so a
    // second fixture was required to prove the guard is load-bearing on its
    // own: see the next test.

    it('should reject a duplicate even when the deduplicated set exactly matches existing ids', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        // Only two visible rows this time.
        mockMediaModel.findByGastronomy.mockResolvedValue({
            items: [
                makeMediaRow({ id: ID_A, sortOrder: 0 }),
                makeMediaRow({ id: ID_B, sortOrder: 1 })
            ],
            total: 2
        });

        const input: GastronomyMediaReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            // Deduplicated set is exactly {A, B} == existingIds, but the raw
            // array has a duplicate A and one too many entries — this is the
            // case the set-difference check alone would silently accept.
            orderedIds: [ID_A, ID_A, ID_B]
        };

        const result = await reorderGastronomyMedia(
            model as unknown as Parameters<typeof reorderGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should apply sortOrder per index on the happy path', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        setVisibleRows();

        const input: GastronomyMediaReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            orderedIds: [ID_C, ID_A, ID_B]
        };

        const result = await reorderGastronomyMedia(
            model as unknown as Parameters<typeof reorderGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.update).toHaveBeenCalledWith({ id: ID_C }, { sortOrder: 0 }, {});
        expect(mockMediaModel.update).toHaveBeenCalledWith({ id: ID_A }, { sortOrder: 1 }, {});
        expect(mockMediaModel.update).toHaveBeenCalledWith({ id: ID_B }, { sortOrder: 2 }, {});
        expect(result.data?.media.map((m) => m.id)).toEqual([ID_C, ID_A, ID_B]);
    });
});

// ---------------------------------------------------------------------------
// setFeaturedGastronomyMedia
// ---------------------------------------------------------------------------

describe('setFeaturedGastronomyMedia', () => {
    it('should return NOT_FOUND when the media row does not exist', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(null);

        const input: GastronomyMediaSetFeaturedInput = {
            gastronomyId: GASTRONOMY_ID,
            mediaId: MEDIA_ID
        };

        const result = await setFeaturedGastronomyMedia(
            model as unknown as Parameters<typeof setFeaturedGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should reject an archived target photo', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ state: 'archived' }));

        const input: GastronomyMediaSetFeaturedInput = {
            gastronomyId: GASTRONOMY_ID,
            mediaId: MEDIA_ID
        };

        const result = await setFeaturedGastronomyMedia(
            model as unknown as Parameters<typeof setFeaturedGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should clear the previous featured row before setting the new one', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const previousFeaturedId = '00000000-0000-4000-a000-000000000020';
        mockMediaModel.findById
            .mockResolvedValueOnce(
                makeMediaRow({ id: MEDIA_ID, state: 'visible', isFeatured: false })
            )
            .mockResolvedValueOnce(
                makeMediaRow({ id: MEDIA_ID, state: 'visible', isFeatured: true })
            );
        mockMediaModel.findFeatured.mockResolvedValue(
            makeMediaRow({ id: previousFeaturedId, isFeatured: true })
        );

        const input: GastronomyMediaSetFeaturedInput = {
            gastronomyId: GASTRONOMY_ID,
            mediaId: MEDIA_ID
        };

        const result = await setFeaturedGastronomyMedia(
            model as unknown as Parameters<typeof setFeaturedGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        // Previous featured row cleared first…
        expect(mockMediaModel.update).toHaveBeenNthCalledWith(
            1,
            { id: previousFeaturedId },
            { isFeatured: false },
            {}
        );
        // …then the target row promoted — preserving the partial-unique-index
        // invariant (never two featured rows at once).
        expect(mockMediaModel.update).toHaveBeenNthCalledWith(
            2,
            { id: MEDIA_ID },
            { isFeatured: true },
            {}
        );
    });

    it('should not attempt to clear when there is no previous featured row', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ state: 'visible' }));
        mockMediaModel.findFeatured.mockResolvedValue(null);

        const input: GastronomyMediaSetFeaturedInput = {
            gastronomyId: GASTRONOMY_ID,
            mediaId: MEDIA_ID
        };

        await setFeaturedGastronomyMedia(
            model as unknown as Parameters<typeof setFeaturedGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(mockMediaModel.update).toHaveBeenCalledTimes(1);
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: MEDIA_ID },
            { isFeatured: true },
            {}
        );
    });
});

// ---------------------------------------------------------------------------
// getGastronomyMedia
// ---------------------------------------------------------------------------

describe('getGastronomyMedia', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        const model = makeGastronomyModel(null);
        const input: GastronomyMediaListInput = { gastronomyId: GASTRONOMY_ID };

        const result = await getGastronomyMedia(
            model as unknown as Parameters<typeof getGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should default to the visible state filter', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findByGastronomy.mockResolvedValue({ items: [makeMediaRow()], total: 1 });

        const input: GastronomyMediaListInput = { gastronomyId: GASTRONOMY_ID };

        const result = await getGastronomyMedia(
            model as unknown as Parameters<typeof getGastronomyMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.media).toHaveLength(1);
        expect(mockMediaModel.findByGastronomy).toHaveBeenCalledWith(
            expect.objectContaining({ state: 'visible' })
        );
    });
});

// ---------------------------------------------------------------------------
// removeGastronomyMedia — Cloudinary asset deletion (HOS-372)
// ---------------------------------------------------------------------------

/**
 * Regression coverage for the orphaned-asset bug: before HOS-372, removing a
 * photo deleted only the DB row, so the Cloudinary binary stayed billed forever
 * with nothing referencing it and no cron sweeping it.
 *
 * The contract these tests pin down is ORDERING, not merely "delete was called":
 * the binary must go first, so that a storage failure leaves the row intact and
 * the user can retry. Asserting only that both happened would still pass if the
 * row were dropped first, which is the exact failure mode being prevented.
 */
describe('removeGastronomyMedia — Cloudinary asset deletion', () => {
    /** A row whose binary IS ours to delete (carries a Cloudinary public id). */
    const cloudinaryRow = () =>
        makeMediaRow({
            url: 'https://res.cloudinary.com/demo/image/upload/v1/hospeda/dev/gastronomies/g1/photo.jpg',
            publicId: 'hospeda/dev/gastronomies/g1/photo'
        } as Partial<GastronomyMedia>);

    it('should delete the Cloudinary binary BEFORE soft-deleting the row', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(cloudinaryRow());
        mockMediaModel.findByGastronomy.mockResolvedValue({ items: [], total: 0 });

        // Record the interleaving of both side effects in a single ordered log.
        const callOrder: string[] = [];
        const provider = {
            delete: vi.fn(async () => {
                callOrder.push('cloudinary');
                return { wasPresent: true };
            })
        };
        mockMediaModel.softDelete.mockImplementation(async () => {
            callOrder.push('db');
            return 1;
        });

        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            { gastronomyId: GASTRONOMY_ID, mediaId: MEDIA_ID },
            provider as unknown as Parameters<typeof removeGastronomyMedia>[3]
        );

        expect(result.error).toBeUndefined();
        expect(provider.delete).toHaveBeenCalledWith({
            publicId: 'hospeda/dev/gastronomies/g1/photo'
        });
        expect(callOrder).toEqual(['cloudinary', 'db']);
    });

    it('should NOT delete the row when Cloudinary deletion fails', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(cloudinaryRow());

        const provider = {
            delete: vi.fn(async () => {
                throw new Error('cloudinary is down');
            })
        };

        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            { gastronomyId: GASTRONOMY_ID, mediaId: MEDIA_ID },
            provider as unknown as Parameters<typeof removeGastronomyMedia>[3]
        );

        // The whole operation aborts: the user retries, nothing is orphaned.
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(mockMediaModel.softDelete).not.toHaveBeenCalled();
    });

    it('should treat an already-absent asset as success', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(cloudinaryRow());
        mockMediaModel.findByGastronomy.mockResolvedValue({ items: [], total: 0 });

        // `wasPresent: false` means the binary was already gone — the goal is
        // "the asset does not exist", and it already does not.
        const provider = { delete: vi.fn(async () => ({ wasPresent: false })) };

        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            { gastronomyId: GASTRONOMY_ID, mediaId: MEDIA_ID },
            provider as unknown as Parameters<typeof removeGastronomyMedia>[3]
        );

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.softDelete).toHaveBeenCalledWith({ id: MEDIA_ID }, ownerActor.id, {});
    });

    it('should still remove the row when no media provider is configured', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(cloudinaryRow());
        mockMediaModel.findByGastronomy.mockResolvedValue({ items: [], total: 0 });

        // Local dev and CI run without Cloudinary credentials; removing a photo
        // must not become impossible there.
        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            { gastronomyId: GASTRONOMY_ID, mediaId: MEDIA_ID },
            null
        );

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.softDelete).toHaveBeenCalledWith({ id: MEDIA_ID }, ownerActor.id, {});
    });

    it('should not call the provider for a row hosted outside Cloudinary', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        // Seed fixtures point at external CDNs — there is no binary of ours to
        // delete, and that must not block the removal.
        mockMediaModel.findById.mockResolvedValue(makeMediaRow());
        mockMediaModel.findByGastronomy.mockResolvedValue({ items: [], total: 0 });

        const provider = { delete: vi.fn(async () => ({ wasPresent: true })) };

        const result = await removeGastronomyMedia(
            model as unknown as Parameters<typeof removeGastronomyMedia>[0],
            ownerActor,
            { gastronomyId: GASTRONOMY_ID, mediaId: MEDIA_ID },
            provider as unknown as Parameters<typeof removeGastronomyMedia>[3]
        );

        expect(result.error).toBeUndefined();
        expect(provider.delete).not.toHaveBeenCalled();
        expect(mockMediaModel.softDelete).toHaveBeenCalledWith({ id: MEDIA_ID }, ownerActor.id, {});
    });
});
