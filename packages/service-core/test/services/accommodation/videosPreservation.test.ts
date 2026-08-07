/**
 * Regression tests for the write-side videos path (HOS-372).
 *
 * ## What changed
 *
 * Videos used to live inside the `media` JSONB blob, and `AccommodationService.update()`
 * carried them forward by hand because the blob write was a wholesale REPLACE: the web
 * editor sent only `featuredImage`+`gallery`, so an absent `videos` key would wipe the
 * existing array (the original B-2 guard).
 *
 * HOS-372 dropped the `media` column and moved videos to a dedicated `videos` column.
 * That makes the carry-forward block obsolete AND wrong:
 *  - Wrong, because it read `existing.media?.videos` off a column that no longer exists
 *    (always `undefined`) and wrote a `media` object back to a column that no longer
 *    exists either.
 *  - Obsolete, because a top-level column gets ordinary PATCH semantics for free: an
 *    absent `videos` key simply never reaches the SET clause, so the stored array
 *    survives without any explicit preservation logic.
 *
 * These tests pin the new contract: `videos` travels top-level and lands on its own
 * column, and `media` is never written by an update.
 *
 * @module test/services/accommodation/videosPreservation
 */

import type { AccommodationModel } from '@repo/db';
import type { Video } from '@repo/schemas';
import {
    AccommodationUpdateInputSchema,
    DestinationTypeEnum,
    ModerationStatusEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
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

// HOS-296: `_afterUpdate` grants the owner the HOST hat when a listing becomes
// ACTIVE, and the grant is no longer best-effort — a failure fails the update.
// These suites mock every other DB touchpoint, so the primitive is stubbed here
// too; the grant's own behaviour is covered by `roleAssignment.test.ts`.
vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    grantRole: vi.fn().mockResolvedValue({ data: undefined }),
    // HOS-296: the module also exports the read primitive, and the
    // billing-exempt-owner branch calls it. A module mock that omits it turns
    // that branch into "getUserRoles is not a function" — an INTERNAL_ERROR
    // that looks nothing like a role problem.
    getUserRoles: vi.fn().mockResolvedValue([])
}));

/**
 * SPEC-204 DIRECT CUTOVER: AccommodationService.update() no longer opens a
 * transaction for media-only payloads. Junction sync (amenityIds/featureIds)
 * still wraps in a tx, but a videos-only write does not. The
 * withServiceTransaction mock below is retained for payloads that do include
 * junction fields, but is not exercised by the videos cases here.
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

/**
 * Runs an update against a mocked model and returns the payload handed to
 * `model.update`, which is what actually reaches the SET clause.
 */
async function captureUpdatePayload(
    service: AccommodationService,
    model: ReturnType<typeof createMockBaseModel>,
    id: string,
    input: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const existing = createMockAccommodation({ id });
    (model.findById as Mock).mockResolvedValue(existing);
    (model.update as Mock).mockImplementation(async (_where, payload) => ({
        ...existing,
        ...payload
    }));

    const result = await service.update(
        createAdminActor(),
        id,
        input as Parameters<AccommodationService['update']>[2]
    );
    expect(result.error).toBeUndefined();
    expect(model.update).toHaveBeenCalled();

    const [, payloadArg] = (model.update as Mock).mock.calls[0] as [
        unknown,
        Record<string, unknown>
    ];
    return payloadArg;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccommodationService.update — videos column write (HOS-372)', () => {
    let model: ReturnType<typeof createMockBaseModel>;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createMockBaseModel();
        service = makeService(model);
    });

    it('writes top-level videos straight to the videos column', async () => {
        const videos = [makeVideo('https://youtu.be/aaa'), makeVideo('https://vimeo.com/222')];
        const input = createMockAccommodationUpdateInput({ videos });

        const payload = await captureUpdatePayload(service, model, 'acc-vid-01', input);

        expect(payload.videos).toStrictEqual(videos);
    });

    it('never writes a media key — the column no longer exists', async () => {
        const input = createMockAccommodationUpdateInput({
            videos: [makeVideo('https://youtu.be/aaa')]
        });

        const payload = await captureUpdatePayload(service, model, 'acc-vid-02', input);

        expect(payload).not.toHaveProperty('media');
    });

    it('leaves videos untouched when the payload omits the key (PATCH semantics)', async () => {
        // No explicit preservation logic needed: an absent key never reaches the
        // SET clause, so the stored array survives on its own.
        const input = createMockAccommodationUpdateInput({ name: 'Updated Name' });

        const payload = await captureUpdatePayload(service, model, 'acc-vid-03', input);

        expect(payload).not.toHaveProperty('videos');
        expect(payload).not.toHaveProperty('media');
    });

    it('clears the column when the payload explicitly sends videos: []', async () => {
        const input = createMockAccommodationUpdateInput({ videos: [] });

        const payload = await captureUpdatePayload(service, model, 'acc-vid-04', input);

        expect(payload.videos).toStrictEqual([]);
    });

    it('drops a legacy media payload instead of writing it to the dropped column', async () => {
        // Older clients may still send `media.videos`. The schema strips `media`
        // from update inputs, but the service must not resurrect it either.
        const input = {
            ...createMockAccommodationUpdateInput({}),
            media: { videos: [makeVideo('https://youtu.be/legacy')], gallery: [] }
        };

        const payload = await captureUpdatePayload(service, model, 'acc-vid-05', input);

        expect(payload).not.toHaveProperty('media');
    });
});
