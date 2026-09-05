/**
 * packages/service-core/test/services/gastronomy/gastronomy.featured-media.test.ts
 *
 * HOS-803 — `addGastronomyFeaturedMedia`, the commerce wiring of the shared
 * born-featured primitive.
 *
 * The primitive's policy is proved once, against a fake table, in
 * `test/services/media/add-featured-media.test.ts`. This file asserts only the
 * things the WIRING can get wrong and the primitive cannot:
 *
 *  - that the foreign key threaded into every read and write is `gastronomyId`;
 *  - that the permission gate still runs before any of it;
 *  - that the outgoing cover is soft-deleted with the actor stamped on it;
 *  - and that the bug is actually fixed here too — a full gallery no longer
 *    blocks a cover replacement.
 *
 * Experience is the same code with one word changed, covered by its own twin.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockScheduleRevalidation = vi.fn();

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(() => ({ scheduleRevalidation: mockScheduleRevalidation }))
}));

const mockMediaModel = {
    findAll: vi.fn(),
    count: vi.fn(),
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
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ __tx: true }))
    };
});

// ---------------------------------------------------------------------------

import {
    getGalleryCap,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addGastronomyFeaturedMedia } from '../../../src/services/gastronomy/gastronomy.media';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

const GASTRONOMY_ID = '00000000-0000-4000-a000-000000000001';
const PREVIOUS_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';

/** 30 for commerce verticals — the cap this wiring must actually pass on. */
const ENTITY_CAP = getGalleryCap('gastronomy');

const PAYLOAD = { url: 'https://cdn.example.com/new-cover.jpg' };

function makeMediaRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '00000000-0000-4000-a000-00000000000a',
        gastronomyId: GASTRONOMY_ID,
        url: PAYLOAD.url,
        moderationState: ModerationStatusEnum.PENDING,
        state: 'visible' as const,
        isFeatured: true,
        sortOrder: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    };
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

function makeGastronomyModel(entity: Record<string, unknown> | null = null) {
    return { findById: vi.fn().mockResolvedValue(entity) };
}

type ModelArg = Parameters<typeof addGastronomyFeaturedMedia>[0];

function arrangeGallery({
    galleryCount,
    previousFeatured
}: {
    galleryCount: number;
    previousFeatured: boolean;
}) {
    mockMediaModel.count.mockResolvedValue(galleryCount);
    mockMediaModel.findAll.mockResolvedValue({
        items: [{ sortOrder: galleryCount - 1 }],
        total: galleryCount
    });
    mockMediaModel.findFeatured.mockResolvedValue(
        previousFeatured ? makeMediaRow({ id: PREVIOUS_ID, sortOrder: 0 }) : null
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );

    mockMediaModel.count.mockResolvedValue(0);
    mockMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
    mockMediaModel.findFeatured.mockResolvedValue(null);
    mockMediaModel.create.mockImplementation(async (row: Record<string, unknown>) =>
        makeMediaRow(row)
    );
    mockMediaModel.update.mockImplementation(async (_w: unknown, patch: Record<string, unknown>) =>
        makeMediaRow(patch)
    );
    mockMediaModel.softDelete.mockResolvedValue(1);
});

describe('addGastronomyFeaturedMedia (HOS-803)', () => {
    it('succeeds with the gallery exactly at the cap — the reported bug', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: PAYLOAD
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.media).toBeDefined();
    });

    it('creates the row already featured', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: PAYLOAD
        });

        const created = mockMediaModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        // Read the fields directly — `objectContaining` cannot see a key that
        // is missing, and missing is the failure being excluded.
        expect(created.isFeatured).toBe(true);
        expect(created.state).toBe('visible');
        expect(created.gastronomyId).toBe(GASTRONOMY_ID);
    });

    it('threads gastronomyId, not another vertical key, through the reads and writes', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 4, previousFeatured: true });

        await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: PAYLOAD
        });

        const created = mockMediaModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(created.gastronomyId).toBe(GASTRONOMY_ID);

        const findFeaturedArg = mockMediaModel.findFeatured.mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(findFeaturedArg.gastronomyId).toBe(GASTRONOMY_ID);

        // The swap moves the gallery by zero, so nothing counts it.
        expect(mockMediaModel.count).not.toHaveBeenCalled();
    });

    it('soft-deletes the previous cover, stamping the actor', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 4, previousFeatured: true });

        const result = await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: PAYLOAD
        });

        expect(mockMediaModel.softDelete).toHaveBeenCalledTimes(1);
        const [where, deletedById] = mockMediaModel.softDelete.mock.calls[0] as [
            Record<string, unknown>,
            string
        ];
        expect(where.id).toBe(PREVIOUS_ID);
        // A soft delete must record WHO — see scripts/check-soft-delete-actor.ts.
        expect(deletedById).toBe(OWNER_ID);
        expect(result.data?.previousFeatured).toEqual({ id: PREVIOUS_ID });
    });

    it('deletes the previous cover at the cap too, so the gallery cannot grow', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: PAYLOAD
        });

        // Unconditional, and never a demotion: the old cover leaves the table
        // rather than joining the gallery, so repeated swaps move no count.
        expect(result.error).toBeUndefined();
        expect(mockMediaModel.softDelete).toHaveBeenCalledTimes(1);

        // The single `update` clears `isFeatured` as part of the release
        // (HOS-803 C-1: softDelete alone leaves the row still flagged as the
        // cover, and a deleted-but-flagged row can be re-featured). It is not a
        // demotion — the soft delete follows it immediately.
        expect(mockMediaModel.update).toHaveBeenCalledTimes(1);
        const patch = mockMediaModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(patch.isFeatured).toBe(false);
        expect(patch.state).toBeUndefined();
    });

    it('reports no previous cover when the listing had none', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 2, previousFeatured: false });

        const result = await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: PAYLOAD
        });

        expect(mockMediaModel.softDelete).not.toHaveBeenCalled();
        expect(result.data?.previousFeatured).toBeNull();
    });

    // ── Gates ──────────────────────────────────────────────────────────────

    it('returns NOT_FOUND when the listing does not exist', async () => {
        const model = makeGastronomyModel(null);

        const result = await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: PAYLOAD
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });

    it('refuses an actor without COMMERCE_EDIT_OWN, before touching the table', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 0, previousFeatured: false });

        const result = await addGastronomyFeaturedMedia(
            model as unknown as ModelArg,
            touristActor,
            { gastronomyId: GASTRONOMY_ID, media: PAYLOAD }
        );

        expect(result.error).toBeDefined();
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });

    it('rejects a payload with no url', async () => {
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });

        const result = await addGastronomyFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            gastronomyId: GASTRONOMY_ID,
            media: {} as never
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });
});
