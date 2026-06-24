/**
 * Regression tests for B-2 (data loss guard): media.videos must survive any
 * accommodation update that carries a `media` payload without a `videos` key.
 *
 * Root cause: the media write is a wholesale REPLACE of the JSONB column. The
 * web editor sends only featuredImage+gallery, so `videos` is absent from the
 * client payload. Without the preservation guard the existing videos array is
 * silently wiped.
 *
 * Fix location: `AccommodationService.update()` — the B-2 block that mirrors
 * the existing B-1 archivedGallery preservation logic.
 *
 * @module test/services/accommodation/videosPreservation
 */

import type { AccommodationModel } from '@repo/db';
import {
    AccommodationUpdateInputSchema,
    DestinationTypeEnum,
    ModerationStatusEnum
} from '@repo/schemas';
import type { Media, Video } from '@repo/schemas';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createMockAccommodation,
    createMockAccommodationUpdateInput
} from '../../factories/accommodationFactory';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, makeMediaModelStub } from '../../utils/modelMockFactory';

/**
 * SPEC-204 DIRECT CUTOVER: AccommodationService.update() no longer opens a
 * transaction for media-only payloads. Junction sync (amenityIds/featureIds)
 * still wraps in a tx, but a videos-only blob write does not. The
 * withServiceTransaction mock below is retained for payloads that do include
 * junction fields, but is not exercised by the videos-preservation cases here.
 */
vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: object; hookState: Record<string, unknown> }) => Promise<unknown>,
            baseCtx?: { hookState?: Record<string, unknown> }
        ) => {
            // Provide a truthy tx stub so the !ctx.tx guards in _afterUpdate
            // don't fire. The injected AccommodationMediaModel stub swallows all DB calls.
            const ctx = { ...baseCtx, tx: {}, hookState: baseCtx?.hookState ?? {} };
            try {
                return await fn(ctx as never);
            } catch (err) {
                // runWithLoggingAndValidation re-throws ServiceError when ctx.tx is truthy.
                // Detect via duck-type and wrap back into { error } for unit test assertions.
                if (
                    err !== null &&
                    typeof err === 'object' &&
                    'code' in err &&
                    'name' in err &&
                    (err as { name: string }).name === 'ServiceError'
                ) {
                    return { error: err };
                }
                throw err;
            }
        }
    )
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const mockLogger = createLoggerMock();

function makeVideo(url: string): Video {
    return { url, moderationState: ModerationStatusEnum.APPROVED };
}

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    vi.spyOn(AccommodationUpdateInputSchema, 'safeParseAsync').mockImplementation(
        async (input: unknown) => ({
            success: true,
            data: input as z.infer<typeof AccommodationUpdateInputSchema>
        })
    );
});

function makeService(model: ReturnType<typeof createMockBaseModel>): AccommodationService {
    const svc = new AccommodationService(
        { logger: mockLogger },
        model as AccommodationModel,
        null,
        undefined,
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        // biome-ignore lint/suspicious/noExplicitAny: test stub
        makeMediaModelStub() as any
    );
    // Stub the private destination model so _assertDestinationIsCity resolves.
    // @ts-expect-error: private override for test
    svc._destinationModel = {
        findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.CITY })
    };
    return svc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccommodationService.update — media.videos preservation (B-2 regression)', () => {
    let model: ReturnType<typeof createMockBaseModel>;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createMockBaseModel();
        service = makeService(model);
    });

    it('preserves existing videos when update carries media without a videos key', async () => {
        // Arrange: existing row has videos
        const existingVideo1 = makeVideo('https://cdn.test/video-1.mp4');
        const existingVideo2 = makeVideo('https://cdn.test/video-2.mp4');
        const existingVideos: Video[] = [existingVideo1, existingVideo2];

        const existingMedia: Media = {
            featuredImage: {
                url: 'https://cdn.test/feat.jpg',
                moderationState: ModerationStatusEnum.APPROVED
            },
            gallery: [],
            videos: existingVideos
        };
        const existing = createMockAccommodation({ id: 'acc-vid-01', media: existingMedia });

        // Client sends a media update with only featuredImage+gallery (no videos key)
        const updateInput = createMockAccommodationUpdateInput({
            media: {
                featuredImage: {
                    url: 'https://cdn.test/new-feat.jpg',
                    moderationState: ModerationStatusEnum.APPROVED
                },
                gallery: []
            }
        });

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        // Act
        const actor = createAdminActor();
        const result = await service.update(actor, 'acc-vid-01', updateInput);

        // Assert: videos carried forward from existing row
        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalled();
        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media: Media }];
        expect(payloadArg.media).toBeDefined();
        expect(payloadArg.media.videos).toHaveLength(2);
        expect(payloadArg.media.videos?.[0]).toStrictEqual(existingVideo1);
        expect(payloadArg.media.videos?.[1]).toStrictEqual(existingVideo2);
    });

    it('clears videos when the payload explicitly sends videos: []', async () => {
        // Arrange: existing row has videos
        const existingVideos: Video[] = [makeVideo('https://cdn.test/video-1.mp4')];
        const existing = createMockAccommodation({
            id: 'acc-vid-02',
            media: { gallery: [], videos: existingVideos }
        });

        // Client explicitly sends videos: [] to clear the list
        const updateInput = createMockAccommodationUpdateInput({
            media: {
                gallery: [],
                videos: []
            }
        });

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        const actor = createAdminActor();
        await service.update(actor, 'acc-vid-02', updateInput);

        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media: Media }];
        // Explicit [] must be respected — videos must be cleared
        expect(payloadArg.media.videos).toEqual([]);
    });

    it('does not add videos when update carries no media field at all', async () => {
        // Arrange: existing row has videos
        const existing = createMockAccommodation({
            id: 'acc-vid-03',
            media: {
                gallery: [],
                videos: [makeVideo('https://cdn.test/video-1.mp4')]
            }
        });

        // Client update touches only the name — no media field in payload
        const updateInput = createMockAccommodationUpdateInput({ name: 'Updated Name' });
        (updateInput as Record<string, unknown>).media = undefined;

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        const actor = createAdminActor();
        await service.update(actor, 'acc-vid-03', updateInput);

        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media?: Media }];
        // No media in payload — field stays absent entirely
        expect(payloadArg.media).toBeUndefined();
    });

    it('does not inject videos when existing row has none', async () => {
        // Arrange: existing row has no videos
        const existing = createMockAccommodation({
            id: 'acc-vid-04',
            media: {
                featuredImage: {
                    url: 'https://cdn.test/feat.jpg',
                    moderationState: ModerationStatusEnum.APPROVED
                },
                gallery: []
                // no videos field
            }
        });

        const updateInput = createMockAccommodationUpdateInput({
            media: {
                gallery: []
            }
        });

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        const actor = createAdminActor();
        await service.update(actor, 'acc-vid-04', updateInput);

        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media: Media }];
        // No videos existed — nothing to preserve, field stays absent
        expect(payloadArg.media.videos).toBeUndefined();
    });
});
