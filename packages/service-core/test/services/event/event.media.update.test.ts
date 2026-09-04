/**
 * event.media.update.test.ts
 *
 * Unit tests for `updateEventMedia` (HOS-1036) — the text-metadata PATCH that
 * closes the gap left by HOS-390: `event_media` rows had `alt`, `caption`,
 * `description` and `attribution` columns and no endpoint that could write them.
 *
 * What these tests are built to catch, stated as mutations that must turn them
 * red (verified by mutation, not assumed):
 *
 *  - the handler dropping a field on the floor (e.g. never forwarding `alt`) —
 *    every patch assertion is `toEqual` on the WHOLE object, never
 *    `expect.objectContaining`, which is blind to a missing key;
 *  - the handler spreading the payload wholesale instead of using
 *    `buildMediaTextPatch`, which would write `undefined` over every omitted
 *    column and turn "fix the alt" into "erase the caption";
 *  - the cross-event ownership check disappearing, which would let a media id
 *    from someone else's event be edited through your own event's URL;
 *  - the empty-body guard disappearing, which would answer 200 to a PATCH that
 *    changes nothing.
 *
 * All DB interactions are fully mocked — no live DB is touched.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockMediaModel = {
    findById: vi.fn(),
    update: vi.fn()
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

import type { EventMedia, EventMediaUpdateInput } from '@repo/schemas';
import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateEventMedia } from '../../../src/services/event/event.media';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EVENT_ID = '00000000-0000-4000-a000-000000000001';
const MEDIA_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';
const OTHER_EVENT_ID = '00000000-0000-4000-a000-000000000099';

function makeMediaRow(overrides: Partial<EventMedia> = {}): EventMedia {
    return {
        id: MEDIA_ID,
        eventId: EVENT_ID,
        url: 'https://cdn.example.com/photo.jpg',
        caption: 'Vista al río',
        description: 'La galería desde el patio trasero',
        alt: 'Texto viejo',
        attribution: null,
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
        authorId: OWNER_ID,
        moderationState: ModerationStatusEnum.PENDING,
        ...overrides
    };
}

const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.EVENT_UPDATE_OWN]
};

const strangerActor: Actor = {
    id: 'stranger-id',
    roles: [RoleEnum.USER],
    permissions: [PermissionEnum.EVENT_UPDATE_OWN]
};

function makeEventModel(entity: Record<string, unknown> | null = null) {
    return {
        findById: vi.fn().mockResolvedValue(entity)
    };
}

type ModelArg = Parameters<typeof updateEventMedia>[0];

/** Run the helper against a mocked model, keeping the cast in one place. */
function run(entity: Record<string, unknown> | null, actor: Actor, input: EventMediaUpdateInput) {
    return updateEventMedia(makeEventModel(entity) as unknown as ModelArg, actor, input);
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

    mockMediaModel.findById.mockResolvedValue(makeMediaRow());
    mockMediaModel.update.mockImplementation(
        async (_where: unknown, patch: Record<string, unknown>) =>
            makeMediaRow(patch as Partial<EventMedia>)
    );
});

// ---------------------------------------------------------------------------

describe('updateEventMedia (HOS-1036)', () => {
    describe('happy path', () => {
        it('writes every supplied field, and ONLY the supplied fields', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                caption: 'Atardecer en el muelle',
                description: 'El muelle viejo visto desde la costanera',
                alt: 'Muelle de madera sobre el río al atardecer',
                attribution: { photographer: 'Estudio Paraná' }
            });

            expect(result.error).toBeUndefined();
            expect(mockMediaModel.update).toHaveBeenCalledTimes(1);
            expect(mockMediaModel.update.mock.calls[0]?.[0]).toEqual({ id: MEDIA_ID });
            // toEqual on the WHOLE patch: objectContaining would stay green with
            // `alt` silently dropped, which is exactly the bug worth catching.
            expect(mockMediaModel.update.mock.calls[0]?.[1]).toEqual({
                caption: 'Atardecer en el muelle',
                description: 'El muelle viejo visto desde la costanera',
                alt: 'Muelle de madera sobre el río al atardecer',
                attribution: { photographer: 'Estudio Paraná' }
            });
        });

        it('returns the updated row inside the media envelope', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                alt: 'Texto nuevo'
            });

            expect(result.data?.media.alt).toBe('Texto nuevo');
            expect(result.data?.media.id).toBe(MEDIA_ID);
        });

        it('leaves an OMITTED field out of the patch entirely', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                alt: 'Sólo el alt'
            });

            expect(result.error).toBeUndefined();
            // An exact match is the assertion: spreading the payload instead of
            // building the patch would add `caption: undefined` here, and that
            // would be written as NULL over a caption the author never touched.
            expect(mockMediaModel.update.mock.calls[0]?.[1]).toEqual({ alt: 'Sólo el alt' });
        });

        it('CLEARS a field sent as null (null is an edit, not an omission)', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                caption: null
            });

            expect(result.error).toBeUndefined();
            expect(mockMediaModel.update.mock.calls[0]?.[1]).toEqual({ caption: null });
        });
    });

    describe('ownership and existence — 404, never 403', () => {
        it('returns NOT_FOUND when the media row belongs to another event', async () => {
            mockMediaModel.findById.mockResolvedValue(
                makeMediaRow({ eventId: OTHER_EVENT_ID } as Partial<EventMedia>)
            );

            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                alt: 'No debería escribirse'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(mockMediaModel.update).not.toHaveBeenCalled();
        });

        it('returns NOT_FOUND when the media row does not exist', async () => {
            mockMediaModel.findById.mockResolvedValue(null);

            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                alt: 'No debería escribirse'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(mockMediaModel.update).not.toHaveBeenCalled();
        });

        it('returns NOT_FOUND when the parent event does not exist', async () => {
            const result = await run(null, ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                alt: 'No debería escribirse'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(mockMediaModel.update).not.toHaveBeenCalled();
        });

        it('returns FORBIDDEN when the actor may not edit the event', async () => {
            const result = await run(makeEvent(), strangerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                alt: 'No debería escribirse'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(mockMediaModel.update).not.toHaveBeenCalled();
        });
    });

    describe('input validation', () => {
        it('rejects a body with no editable field at all', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID
            } as EventMediaUpdateInput);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(mockMediaModel.update).not.toHaveBeenCalled();
        });

        it('rejects an alt longer than 200 characters', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                alt: 'x'.repeat(201)
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(mockMediaModel.update).not.toHaveBeenCalled();
        });

        it('rejects an empty-string caption (clearing is null, not "")', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: MEDIA_ID,
                caption: ''
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(mockMediaModel.update).not.toHaveBeenCalled();
        });

        it('rejects a non-UUID mediaId before touching the DB', async () => {
            const result = await run(makeEvent(), ownerActor, {
                eventId: EVENT_ID,
                mediaId: 'not-a-uuid',
                alt: 'Cualquier cosa'
            } as EventMediaUpdateInput);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(mockMediaModel.findById).not.toHaveBeenCalled();
        });
    });
});
