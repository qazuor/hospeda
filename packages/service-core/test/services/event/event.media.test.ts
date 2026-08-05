/**
 * event.media.test.ts
 *
 * Unit tests for the event media helper functions (HOS-390).
 *
 * Coverage:
 *  - addEventMedia: NOT_FOUND event, permission gate, sortOrder auto-assign,
 *    moderationState default.
 *  - removeEventMedia: NOT_FOUND media, cross-event media rejection, resequences
 *    remaining visible rows to a dense 0-based sortOrder.
 *  - reorderEventMedia: rejects missing id, extra id, and duplicate id; happy
 *    path applies sortOrder per index.
 *  - setFeaturedEventMedia: clears the previous featured row, rejects an
 *    archived target.
 *  - getEventMedia: NOT_FOUND event, returns rows, defaults the state filter.
 *
 * All DB interactions are fully mocked — no live DB is touched.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockMediaModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByEvent: vi.fn(),
    findFeatured: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        EventMediaModel: vi.fn(function () {
            return mockMediaModel;
        }),
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({}))
    };
});

// ---------------------------------------------------------------------------

import type {
    EventMedia,
    EventMediaAddInput,
    EventMediaListInput,
    EventMediaRemoveInput,
    EventMediaReorderInput,
    EventMediaSetFeaturedInput
} from '@repo/schemas';
import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addEventMedia,
    getEventMedia,
    removeEventMedia,
    reorderEventMedia,
    setFeaturedEventMedia
} from '../../../src/services/event/event.media';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EVENT_ID = '00000000-0000-4000-a000-000000000001';
const MEDIA_ID = '00000000-0000-4000-a000-000000000002';
const AUTHOR_ID = '00000000-0000-4000-a000-000000000003';
const OTHER_EVENT_ID = '00000000-0000-4000-a000-000000000099';

function makeMediaRow(overrides: Partial<EventMedia> = {}): EventMedia {
    return {
        id: MEDIA_ID,
        eventId: EVENT_ID,
        url: 'https://cdn.example.com/photo.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as EventMedia;
}

/**
 * An event the author is still allowed to edit. `moderationState: PENDING` matters:
 * an APPROVED event locks the author out unless they also hold `EVENT_PUBLISH_OWN`
 * (HOS-374 §7.6.3), and the media gate inherits that rule wholesale.
 */
function makeEvent(overrides: Record<string, unknown> = {}) {
    return {
        id: EVENT_ID,
        authorId: AUTHOR_ID,
        moderationState: ModerationStatusEnum.PENDING,
        ...overrides
    };
}

const authorActor: Actor = {
    id: AUTHOR_ID,
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.EVENT_UPDATE_OWN]
};

const strangerActor: Actor = {
    id: 'stranger-id',
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.EVENT_UPDATE_OWN]
};

// ---------------------------------------------------------------------------
// Mock EventModel factory
// ---------------------------------------------------------------------------

function makeEventModel(entity: Record<string, unknown> | null = null) {
    return {
        findById: vi.fn().mockResolvedValue(entity)
    };
}

type EventModelArg = Parameters<typeof addEventMedia>[0];

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
    mockMediaModel.findByEvent.mockResolvedValue({ items: [], total: 0 });
    mockMediaModel.findFeatured.mockResolvedValue(null);
    mockMediaModel.create.mockResolvedValue(makeMediaRow());
    mockMediaModel.update.mockResolvedValue(makeMediaRow());
    mockMediaModel.softDelete.mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// addEventMedia
// ---------------------------------------------------------------------------

describe('addEventMedia', () => {
    const addInput: EventMediaAddInput = {
        eventId: EVENT_ID,
        media: { url: 'https://cdn.example.com/new.jpg' }
    };

    it('returns NOT_FOUND when the event does not exist', async () => {
        const model = makeEventModel(null);

        const result = await addEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            addInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });

    it('returns FORBIDDEN when the actor is not the author', async () => {
        const model = makeEventModel(makeEvent());

        const result = await addEventMedia(
            model as unknown as EventModelArg,
            strangerActor,
            addInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(mockMediaModel.create).not.toHaveBeenCalled();
    });

    it('returns FORBIDDEN when the author edit lock has closed on an approved event', async () => {
        const model = makeEventModel(makeEvent({ moderationState: ModerationStatusEnum.APPROVED }));

        const result = await addEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            addInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('returns VALIDATION_ERROR for a non-URL payload', async () => {
        const model = makeEventModel(makeEvent());

        const result = await addEventMedia(model as unknown as EventModelArg, authorActor, {
            eventId: EVENT_ID,
            media: { url: 'not-a-url' }
        } as EventMediaAddInput);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('sets sortOrder to 0 when no visible media exists', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

        const result = await addEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            addInput
        );

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ sortOrder: 0, isFeatured: false, state: 'visible' }),
            undefined
        );
    });

    it('sets sortOrder to max + 1 when visible media exists', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findAll.mockResolvedValue({
            items: [makeMediaRow({ sortOrder: 3 })],
            total: 1
        });

        await addEventMedia(model as unknown as EventModelArg, authorActor, addInput);

        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ sortOrder: 4 }),
            undefined
        );
    });

    it('defaults moderationState to PENDING when not supplied', async () => {
        const model = makeEventModel(makeEvent());

        await addEventMedia(model as unknown as EventModelArg, authorActor, addInput);

        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ moderationState: ModerationStatusEnum.PENDING }),
            undefined
        );
    });

    it('honors a caller-supplied moderationState', async () => {
        const model = makeEventModel(makeEvent());

        await addEventMedia(model as unknown as EventModelArg, authorActor, {
            eventId: EVENT_ID,
            media: {
                url: 'https://cdn.example.com/new.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            }
        });

        expect(mockMediaModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ moderationState: ModerationStatusEnum.APPROVED }),
            undefined
        );
    });
});

// ---------------------------------------------------------------------------
// removeEventMedia
// ---------------------------------------------------------------------------

describe('removeEventMedia', () => {
    const removeInput: EventMediaRemoveInput = { eventId: EVENT_ID, mediaId: MEDIA_ID };

    it('returns NOT_FOUND when the media row does not exist', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findById.mockResolvedValue(null);

        const result = await removeEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            removeInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockMediaModel.softDelete).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when the media belongs to a different event', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ eventId: OTHER_EVENT_ID }));

        const result = await removeEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            removeInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockMediaModel.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes and resequences remaining visible rows to a dense 0-based sortOrder', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ sortOrder: 1 }));

        // Remaining rows carry a GAP at sortOrder 1 (0, 2, 3) — the exact shape
        // removeEventMedia must repair to (0, 1, 2).
        const keptA = '00000000-0000-4000-a000-000000000009';
        const keptB = '00000000-0000-4000-a000-000000000010';
        const keptC = '00000000-0000-4000-a000-000000000011';
        mockMediaModel.findByEvent.mockResolvedValue({
            items: [
                makeMediaRow({ id: keptA, sortOrder: 0 }),
                makeMediaRow({ id: keptB, sortOrder: 2 }),
                makeMediaRow({ id: keptC, sortOrder: 3 })
            ],
            total: 3
        });

        const result = await removeEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            removeInput
        );

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.softDelete).toHaveBeenCalledWith({ id: MEDIA_ID }, expect.anything());
        // Row already at index 0 is left alone; the two gapped rows are rewritten.
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: keptB },
            { sortOrder: 1 },
            expect.anything()
        );
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: keptC },
            { sortOrder: 2 },
            expect.anything()
        );
        expect(mockMediaModel.update).toHaveBeenCalledTimes(2);
    });
});

// ---------------------------------------------------------------------------
// reorderEventMedia
// ---------------------------------------------------------------------------

describe('reorderEventMedia', () => {
    const idA = '00000000-0000-4000-a000-000000000021';
    const idB = '00000000-0000-4000-a000-000000000022';
    const idC = '00000000-0000-4000-a000-000000000023';

    function stubVisible(ids: string[]) {
        mockMediaModel.findByEvent.mockResolvedValue({
            items: ids.map((id, i) => makeMediaRow({ id, sortOrder: i })),
            total: ids.length
        });
    }

    it('rejects an orderedIds list that omits a current visible row', async () => {
        const model = makeEventModel(makeEvent());
        stubVisible([idA, idB, idC]);

        const result = await reorderEventMedia(model as unknown as EventModelArg, authorActor, {
            eventId: EVENT_ID,
            orderedIds: [idA, idB]
        } satisfies EventMediaReorderInput);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain('missing');
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('rejects an orderedIds list containing a foreign id', async () => {
        const model = makeEventModel(makeEvent());
        stubVisible([idA, idB]);

        const result = await reorderEventMedia(model as unknown as EventModelArg, authorActor, {
            eventId: EVENT_ID,
            orderedIds: [idA, idB, idC]
        } satisfies EventMediaReorderInput);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain('unknown/foreign');
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('rejects duplicate ids that a set-only comparison would miss', async () => {
        const model = makeEventModel(makeEvent());
        stubVisible([idA, idB]);

        // [A, A, B] dedupes to {A, B} — nothing missing, nothing extra. Only the
        // explicit length-vs-set-size guard catches it.
        const result = await reorderEventMedia(model as unknown as EventModelArg, authorActor, {
            eventId: EVENT_ID,
            orderedIds: [idA, idA, idB]
        } satisfies EventMediaReorderInput);

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain('duplicate');
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('applies sortOrder by index and returns the rows in the requested order', async () => {
        const model = makeEventModel(makeEvent());
        stubVisible([idA, idB, idC]);

        const result = await reorderEventMedia(model as unknown as EventModelArg, authorActor, {
            eventId: EVENT_ID,
            orderedIds: [idC, idA, idB]
        } satisfies EventMediaReorderInput);

        expect(result.error).toBeUndefined();
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: idC },
            { sortOrder: 0 },
            expect.anything()
        );
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: idA },
            { sortOrder: 1 },
            expect.anything()
        );
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: idB },
            { sortOrder: 2 },
            expect.anything()
        );
        expect(result.data?.media.map((m) => m.id)).toEqual([idC, idA, idB]);
        expect(result.data?.media.map((m) => m.sortOrder)).toEqual([0, 1, 2]);
    });
});

// ---------------------------------------------------------------------------
// setFeaturedEventMedia
// ---------------------------------------------------------------------------

describe('setFeaturedEventMedia', () => {
    const featuredInput: EventMediaSetFeaturedInput = { eventId: EVENT_ID, mediaId: MEDIA_ID };

    it('returns NOT_FOUND when the media belongs to a different event', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ eventId: OTHER_EVENT_ID }));

        const result = await setFeaturedEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            featuredInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('rejects featuring an archived photo before the DB CHECK constraint can fire', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ state: 'archived' }));

        const result = await setFeaturedEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            featuredInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(mockMediaModel.update).not.toHaveBeenCalled();
    });

    it('clears the previous featured row BEFORE setting the new one', async () => {
        const previousId = '00000000-0000-4000-a000-000000000031';
        const model = makeEventModel(makeEvent());
        mockMediaModel.findById.mockResolvedValue(makeMediaRow());
        mockMediaModel.findFeatured.mockResolvedValue(
            makeMediaRow({ id: previousId, isFeatured: true })
        );

        const result = await setFeaturedEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            featuredInput
        );

        expect(result.error).toBeUndefined();
        // Clear-then-set: reversing this order would transiently violate the
        // partial unique index on (event_id) WHERE is_featured.
        expect(mockMediaModel.update.mock.calls.map((c) => [c[0], c[1]])).toEqual([
            [{ id: previousId }, { isFeatured: false }],
            [{ id: MEDIA_ID }, { isFeatured: true }]
        ]);
    });

    it('does not clear anything when the target is already the featured row', async () => {
        const model = makeEventModel(makeEvent());
        mockMediaModel.findById.mockResolvedValue(makeMediaRow({ isFeatured: true }));
        mockMediaModel.findFeatured.mockResolvedValue(makeMediaRow({ isFeatured: true }));

        await setFeaturedEventMedia(model as unknown as EventModelArg, authorActor, featuredInput);

        expect(mockMediaModel.update).toHaveBeenCalledTimes(1);
        expect(mockMediaModel.update).toHaveBeenCalledWith(
            { id: MEDIA_ID },
            { isFeatured: true },
            expect.anything()
        );
    });
});

// ---------------------------------------------------------------------------
// getEventMedia
// ---------------------------------------------------------------------------

describe('getEventMedia', () => {
    const listInput: EventMediaListInput = { eventId: EVENT_ID };

    it('returns NOT_FOUND when the event does not exist', async () => {
        const model = makeEventModel(null);

        const result = await getEventMedia(
            model as unknown as EventModelArg,
            authorActor,
            listInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('returns FORBIDDEN for an actor who is not the author', async () => {
        const model = makeEventModel(makeEvent());

        const result = await getEventMedia(
            model as unknown as EventModelArg,
            strangerActor,
            listInput
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('defaults the state filter to visible', async () => {
        const model = makeEventModel(makeEvent());

        await getEventMedia(model as unknown as EventModelArg, authorActor, listInput);

        expect(mockMediaModel.findByEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventId: EVENT_ID, state: 'visible' })
        );
    });

    it('honors an explicit archived state filter and returns the rows', async () => {
        const model = makeEventModel(makeEvent());
        const rows = [makeMediaRow({ state: 'archived' })];
        mockMediaModel.findByEvent.mockResolvedValue({ items: rows, total: 1 });

        const result = await getEventMedia(model as unknown as EventModelArg, authorActor, {
            eventId: EVENT_ID,
            state: 'archived'
        });

        expect(mockMediaModel.findByEvent).toHaveBeenCalledWith(
            expect.objectContaining({ state: 'archived' })
        );
        expect(result.data?.media).toEqual(rows);
    });
});
