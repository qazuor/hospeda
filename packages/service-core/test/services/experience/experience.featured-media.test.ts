/**
 * packages/service-core/test/services/experience/experience.featured-media.test.ts
 *
 * HOS-803 — `addExperienceFeaturedMedia`, the commerce wiring of the shared
 * born-featured primitive.
 *
 * The primitive's policy is proved once, against a fake table, in
 * `test/services/media/add-featured-media.test.ts`. This file asserts only the
 * things the WIRING can get wrong and the primitive cannot:
 *
 *  - that the cap handed over is experience's own (30), not another vertical's;
 *  - that the foreign key threaded into every read and write is `experienceId`;
 *  - that the permission gate still runs before any of it;
 *  - and that the bug is actually fixed here too — a full gallery no longer
 *    blocks a cover replacement.
 *
 * Gastronomy is the same code with one word changed, covered by its own twin.
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
    findByExperience: vi.fn(),
    findFeatured: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        ExperienceMediaModel: vi.fn(function () {
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
import { addExperienceFeaturedMedia } from '../../../src/services/experience/experience.media';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

const EXPERIENCE_ID = '00000000-0000-4000-a000-000000000001';
const PREVIOUS_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';

/** 30 for commerce verticals — the cap this wiring must actually pass on. */
const ENTITY_CAP = getGalleryCap('experience');

const PAYLOAD = { url: 'https://cdn.example.com/new-cover.jpg' };

function makeMediaRow(overrides: Record<string, unknown> = {}) {
    return {
        id: '00000000-0000-4000-a000-00000000000a',
        experienceId: EXPERIENCE_ID,
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

function makeExperienceModel(entity: Record<string, unknown> | null = null) {
    return { findById: vi.fn().mockResolvedValue(entity) };
}

type ModelArg = Parameters<typeof addExperienceFeaturedMedia>[0];

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
});

describe('addExperienceFeaturedMedia (HOS-803)', () => {
    it('succeeds with the gallery exactly at the cap — the reported bug', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: PAYLOAD
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.media).toBeDefined();
    });

    it('creates the row already featured', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: PAYLOAD
        });

        const created = mockMediaModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        // Read the fields directly — `objectContaining` cannot see a key that
        // is missing, and missing is the failure being excluded.
        expect(created.isFeatured).toBe(true);
        expect(created.state).toBe('visible');
        expect(created.experienceId).toBe(EXPERIENCE_ID);
    });

    it('threads experienceId, not another vertical key, through the gallery count', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 4, previousFeatured: true });

        await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: PAYLOAD
        });

        const where = mockMediaModel.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where.experienceId).toBe(EXPERIENCE_ID);
        // HOS-791 — the cover is not a gallery item and must not be counted.
        expect(where.isFeatured).toBe(false);
        expect(where.state).toBe('visible');
    });

    it('demotes the previous cover while the gallery has room', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 4, previousFeatured: true });

        const result = await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: PAYLOAD
        });

        const patch = mockMediaModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(patch.isFeatured).toBe(false);
        expect(patch.state).toBeUndefined();
        expect(result.data?.previousFeatured?.disposition).toBe('demoted');
    });

    it('archives the previous cover at the cap, so the gallery cannot grow', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: ENTITY_CAP, previousFeatured: true });

        const result = await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: PAYLOAD
        });

        const patch = mockMediaModel.update.mock.calls[0]?.[1] as Record<string, unknown>;
        expect(patch.isFeatured).toBe(false);
        expect(patch.state).toBe('archived');
        expect(result.data?.previousFeatured?.disposition).toBe('archived');
    });

    it('reports no previous cover when the listing had none', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 2, previousFeatured: false });

        const result = await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: PAYLOAD
        });

        expect(mockMediaModel.update).not.toHaveBeenCalled();
        expect(result.data?.previousFeatured).toBeNull();
    });

    // ── Gates ──────────────────────────────────────────────────────────────

    it('returns NOT_FOUND when the listing does not exist', async () => {
        const model = makeExperienceModel(null);

        const result = await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: PAYLOAD
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });

    it('refuses an actor without COMMERCE_EDIT_OWN, before touching the table', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        arrangeGallery({ galleryCount: 0, previousFeatured: false });

        const result = await addExperienceFeaturedMedia(
            model as unknown as ModelArg,
            touristActor,
            { experienceId: EXPERIENCE_ID, media: PAYLOAD }
        );

        expect(result.error).toBeDefined();
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });

    it('rejects a payload with no url', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });

        const result = await addExperienceFeaturedMedia(model as unknown as ModelArg, ownerActor, {
            experienceId: EXPERIENCE_ID,
            media: {} as never
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });
});
