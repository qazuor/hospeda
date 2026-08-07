/**
 * experience.media.test.ts
 *
 * Unit tests for experience media helper functions (HOS-372).
 *
 * Mirrors `gastronomy.media.test.ts` — see that file for the full rationale
 * behind each assertion (identical logic, different vertical).
 *
 * Coverage:
 *  - addExperienceMedia: NOT_FOUND listing, permission gate, sortOrder auto-assign.
 *  - removeExperienceMedia: resequences remaining visible rows to a dense
 *    0-based sortOrder.
 *  - reorderExperienceMedia: rejects missing id, extra id, and duplicate id;
 *    happy path applies sortOrder per index.
 *  - setFeaturedExperienceMedia: clears the previous featured row, rejects an
 *    archived target.
 *  - getExperienceMedia: NOT_FOUND listing, returns rows.
 *
 * All DB interactions are fully mocked — no live DB is touched.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockMediaModel = {
    findAll: vi.fn(),
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
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
    };
});

// ---------------------------------------------------------------------------

import type {
    ExperienceMedia,
    ExperienceMediaAddInput,
    ExperienceMediaListInput,
    ExperienceMediaRemoveInput,
    ExperienceMediaReorderInput,
    ExperienceMediaSetFeaturedInput
} from '@repo/schemas';
import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addExperienceMedia,
    getExperienceMedia,
    removeExperienceMedia,
    reorderExperienceMedia,
    setFeaturedExperienceMedia
} from '../../../src/services/experience/experience.media';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXPERIENCE_ID = '00000000-0000-4000-b000-000000000001';
const MEDIA_ID = '00000000-0000-4000-b000-000000000002';
const OWNER_ID = '00000000-0000-4000-b000-000000000003';

function makeMediaRow(overrides: Partial<ExperienceMedia> = {}): ExperienceMedia {
    return {
        id: MEDIA_ID,
        experienceId: EXPERIENCE_ID,
        url: 'https://cdn.example.com/photo.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as ExperienceMedia;
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
// Mock ExperienceModel factory
// ---------------------------------------------------------------------------

function makeExperienceModel(entity: Record<string, unknown> | null = null) {
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
    mockMediaModel.findByExperience.mockResolvedValue({ items: [], total: 0 });
    mockMediaModel.findFeatured.mockResolvedValue(null);
    mockMediaModel.create.mockResolvedValue(makeMediaRow());
    mockMediaModel.update.mockResolvedValue(makeMediaRow());
    mockMediaModel.softDelete.mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// addExperienceMedia
// ---------------------------------------------------------------------------

describe('addExperienceMedia', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        const model = makeExperienceModel(null);
        const input: ExperienceMediaAddInput = {
            experienceId: EXPERIENCE_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        const result = await addExperienceMedia(
            model as unknown as Parameters<typeof addExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN when actor lacks COMMERCE_EDIT_OWN', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        const input: ExperienceMediaAddInput = {
            experienceId: EXPERIENCE_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        const result = await addExperienceMedia(
            model as unknown as Parameters<typeof addExperienceMedia>[0],
            touristActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should set sortOrder to 0 when no visible media exists', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

        const input: ExperienceMediaAddInput = {
            experienceId: EXPERIENCE_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        const result = await addExperienceMedia(
            model as unknown as Parameters<typeof addExperienceMedia>[0],
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
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findAll.mockResolvedValue({
            items: [makeMediaRow({ sortOrder: 3 })],
            total: 1
        });

        const input: ExperienceMediaAddInput = {
            experienceId: EXPERIENCE_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        await addExperienceMedia(
            model as unknown as Parameters<typeof addExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ sortOrder: 4 }),
            undefined
        );
    });

    it('defaults moderationState to PENDING when not supplied', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });

        const input: ExperienceMediaAddInput = {
            experienceId: EXPERIENCE_ID,
            media: { url: 'https://cdn.example.com/new.jpg' }
        };

        await addExperienceMedia(
            model as unknown as Parameters<typeof addExperienceMedia>[0],
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
// removeExperienceMedia
// ---------------------------------------------------------------------------

describe('removeExperienceMedia', () => {
    it('should return NOT_FOUND when the media row does not exist', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(null);

        const input: ExperienceMediaRemoveInput = {
            experienceId: EXPERIENCE_ID,
            mediaId: MEDIA_ID
        };

        const result = await removeExperienceMedia(
            model as unknown as Parameters<typeof removeExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return NOT_FOUND when the media belongs to a different listing', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(
            makeMediaRow({ experienceId: '00000000-0000-4000-b000-000000000099' })
        );

        const input: ExperienceMediaRemoveInput = {
            experienceId: EXPERIENCE_ID,
            mediaId: MEDIA_ID
        };

        const result = await removeExperienceMedia(
            model as unknown as Parameters<typeof removeExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should soft-delete and resequence remaining visible rows to a dense 0-based sortOrder', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ sortOrder: 1 }));

        const remainingId2 = '00000000-0000-4000-b000-000000000010';
        const remainingId3 = '00000000-0000-4000-b000-000000000011';
        mockMediaModel.findByExperience.mockResolvedValue({
            items: [
                makeMediaRow({ id: '00000000-0000-4000-b000-000000000009', sortOrder: 0 }),
                makeMediaRow({ id: remainingId2, sortOrder: 2 }),
                makeMediaRow({ id: remainingId3, sortOrder: 3 })
            ],
            total: 3
        });

        const input: ExperienceMediaRemoveInput = {
            experienceId: EXPERIENCE_ID,
            mediaId: MEDIA_ID
        };

        const result = await removeExperienceMedia(
            model as unknown as Parameters<typeof removeExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.success).toBe(true);
        expect(mockMediaModel.softDelete).toHaveBeenCalledWith({ id: MEDIA_ID }, {});
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
});

// ---------------------------------------------------------------------------
// reorderExperienceMedia
// ---------------------------------------------------------------------------

describe('reorderExperienceMedia', () => {
    const ID_A = '00000000-0000-4000-b000-00000000000a';
    const ID_B = '00000000-0000-4000-b000-00000000000b';
    const ID_C = '00000000-0000-4000-b000-00000000000c';

    function setVisibleRows() {
        mockMediaModel.findByExperience.mockResolvedValue({
            items: [
                makeMediaRow({ id: ID_A, sortOrder: 0 }),
                makeMediaRow({ id: ID_B, sortOrder: 1 }),
                makeMediaRow({ id: ID_C, sortOrder: 2 })
            ],
            total: 3
        });
    }

    it('should reject when orderedIds is missing an id', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        setVisibleRows();

        const input: ExperienceMediaReorderInput = {
            experienceId: EXPERIENCE_ID,
            orderedIds: [ID_A, ID_B]
        };

        const result = await reorderExperienceMedia(
            model as unknown as Parameters<typeof reorderExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should reject when orderedIds contains an extra/foreign id', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        setVisibleRows();

        const input: ExperienceMediaReorderInput = {
            experienceId: EXPERIENCE_ID,
            orderedIds: [ID_A, ID_B, ID_C, '00000000-0000-4000-b000-000000000099']
        };

        const result = await reorderExperienceMedia(
            model as unknown as Parameters<typeof reorderExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should reject a duplicate even when the deduplicated set exactly matches existing ids', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findByExperience.mockResolvedValue({
            items: [
                makeMediaRow({ id: ID_A, sortOrder: 0 }),
                makeMediaRow({ id: ID_B, sortOrder: 1 })
            ],
            total: 2
        });

        const input: ExperienceMediaReorderInput = {
            experienceId: EXPERIENCE_ID,
            orderedIds: [ID_A, ID_A, ID_B]
        };

        const result = await reorderExperienceMedia(
            model as unknown as Parameters<typeof reorderExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain('duplicate');
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should apply sortOrder per index on the happy path', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        setVisibleRows();

        const input: ExperienceMediaReorderInput = {
            experienceId: EXPERIENCE_ID,
            orderedIds: [ID_C, ID_A, ID_B]
        };

        const result = await reorderExperienceMedia(
            model as unknown as Parameters<typeof reorderExperienceMedia>[0],
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
// setFeaturedExperienceMedia
// ---------------------------------------------------------------------------

describe('setFeaturedExperienceMedia', () => {
    it('should return NOT_FOUND when the media row does not exist', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(null);

        const input: ExperienceMediaSetFeaturedInput = {
            experienceId: EXPERIENCE_ID,
            mediaId: MEDIA_ID
        };

        const result = await setFeaturedExperienceMedia(
            model as unknown as Parameters<typeof setFeaturedExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should reject an archived target photo', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ state: 'archived' }));

        const input: ExperienceMediaSetFeaturedInput = {
            experienceId: EXPERIENCE_ID,
            mediaId: MEDIA_ID
        };

        const result = await setFeaturedExperienceMedia(
            model as unknown as Parameters<typeof setFeaturedExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('should clear the previous featured row before setting the new one', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        const previousFeaturedId = '00000000-0000-4000-b000-000000000020';
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

        const input: ExperienceMediaSetFeaturedInput = {
            experienceId: EXPERIENCE_ID,
            mediaId: MEDIA_ID
        };

        const result = await setFeaturedExperienceMedia(
            model as unknown as Parameters<typeof setFeaturedExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.update).toHaveBeenNthCalledWith(
            1,
            { id: previousFeaturedId },
            { isFeatured: false },
            {}
        );
        expect(mockMediaModel.update).toHaveBeenNthCalledWith(
            2,
            { id: MEDIA_ID },
            { isFeatured: true },
            {}
        );
    });
});

// ---------------------------------------------------------------------------
// getExperienceMedia
// ---------------------------------------------------------------------------

describe('getExperienceMedia', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        const model = makeExperienceModel(null);
        const input: ExperienceMediaListInput = { experienceId: EXPERIENCE_ID };

        const result = await getExperienceMedia(
            model as unknown as Parameters<typeof getExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should default to the visible state filter', async () => {
        const model = makeExperienceModel({ id: EXPERIENCE_ID, ownerId: OWNER_ID });
        mockMediaModel.findByExperience.mockResolvedValue({ items: [makeMediaRow()], total: 1 });

        const input: ExperienceMediaListInput = { experienceId: EXPERIENCE_ID };

        const result = await getExperienceMedia(
            model as unknown as Parameters<typeof getExperienceMedia>[0],
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.media).toHaveLength(1);
        expect(mockMediaModel.findByExperience).toHaveBeenCalledWith(
            expect.objectContaining({ state: 'visible' })
        );
    });
});
