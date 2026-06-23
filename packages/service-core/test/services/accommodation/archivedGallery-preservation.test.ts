/**
 * Regression tests for B-1 (INV-5 data loss): archived gallery photos must
 * survive any accommodation update that carries a `media` payload.
 *
 * Root cause: when a host edits an accommodation and the update payload
 * includes `media`, the accommodation service must carry forward the existing
 * row's `media.archivedGallery` because:
 *   - The client input schema (`BaseMediaFields.media`) does NOT expose
 *     `archivedGallery` — Zod strips it from client payloads.
 *   - The `archivedGallery` is server-managed (written by the downgrade-
 *     restriction cron) and must never be cleared by a host edit.
 *
 * Fix location: `AccommodationService.update()` (packages/service-core) —
 * before delegating to `super.update()`, if `data.media` is present and the
 * existing row has `media.archivedGallery`, inject it into the outgoing
 * `data.media` so the DB write (JSONB merge or direct) always preserves it.
 *
 * @module test/services/accommodation/archivedGallery-preservation
 */

import type { AccommodationModel } from '@repo/db';
import {
    AccommodationUpdateInputSchema,
    DestinationTypeEnum,
    ModerationStatusEnum
} from '@repo/schemas';
import type { Image, Media } from '@repo/schemas';
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
 * FIX 1 (SPEC-204): AccommodationService.update() now opens a transaction when
 * `media` is present. Mock withServiceTransaction so update tests work without DB.
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

function makeImg(url: string): Image {
    return { url, moderationState: ModerationStatusEnum.APPROVED };
}

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
    // Pass-through schema validation for all update tests.
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

describe('AccommodationService.update — archivedGallery preservation (B-1 regression)', () => {
    let model: ReturnType<typeof createMockBaseModel>;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        model = createMockBaseModel();
        service = makeService(model);
    });

    it('preserves archivedGallery byte-identical when update carries a media payload', async () => {
        // Arrange: existing row has archivedGallery with 2 photos
        const archivedPhoto1 = makeImg('https://cdn.test/archived-1.jpg');
        const archivedPhoto2 = makeImg('https://cdn.test/archived-2.jpg');
        const existingArchivedGallery: Image[] = [archivedPhoto1, archivedPhoto2];

        const existingMedia: Media = {
            featuredImage: makeImg('https://cdn.test/featured.jpg'),
            gallery: [makeImg('https://cdn.test/gallery-1.jpg')],
            archivedGallery: existingArchivedGallery
        };
        const existing = createMockAccommodation({ id: 'acc-b1-01', media: existingMedia });

        // Client sends a media update without archivedGallery (as schema strips it)
        const newGalleryImg = makeImg('https://cdn.test/new-gallery.jpg');
        const updateInput = createMockAccommodationUpdateInput({
            media: {
                gallery: [newGalleryImg],
                featuredImage: {
                    url: 'https://cdn.test/featured.jpg',
                    moderationState: ModerationStatusEnum.APPROVED
                }
            }
        });

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        // Act
        const actor = createAdminActor();
        const result = await service.update(actor, 'acc-b1-01', updateInput);

        // Assert: update was called and archivedGallery is preserved in the payload
        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalled();

        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media: Media }];
        expect(payloadArg.media).toBeDefined();
        expect(payloadArg.media.archivedGallery).toBeDefined();
        expect(payloadArg.media.archivedGallery).toHaveLength(2);
        expect(payloadArg.media.archivedGallery?.[0]).toStrictEqual(archivedPhoto1);
        expect(payloadArg.media.archivedGallery?.[1]).toStrictEqual(archivedPhoto2);
    });

    it('does not add archivedGallery when update carries no media field at all', async () => {
        // Arrange: existing row has archivedGallery
        const existing = createMockAccommodation({
            id: 'acc-b1-02',
            media: {
                gallery: [makeImg('https://cdn.test/g.jpg')],
                archivedGallery: [makeImg('https://cdn.test/archived.jpg')]
            }
        });

        // Client update touches only the name — no media field in payload
        const updateInput = createMockAccommodationUpdateInput({
            name: 'Updated Accommodation Name Here'
        });
        // Ensure media is not in the payload
        (updateInput as Record<string, unknown>).media = undefined;

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        const actor = createAdminActor();
        await service.update(actor, 'acc-b1-02', updateInput);

        // Assert: update was called; the payload should not have media injected
        // (it was absent in the input, so we leave it absent — the JSONB merge
        // at DB level will preserve archivedGallery via ||).
        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media?: Media }];
        expect(payloadArg.media).toBeUndefined();
    });

    it('strips client-supplied archivedGallery and carries forward the server-managed one', async () => {
        // Arrange: existing row has server-managed archivedGallery
        const serverArchivedPhoto = makeImg('https://cdn.test/server-archived.jpg');
        const existing = createMockAccommodation({
            id: 'acc-b1-03',
            media: {
                gallery: [],
                archivedGallery: [serverArchivedPhoto]
            }
        });

        // Client attempts to supply archivedGallery (should be ignored/stripped by schema).
        // For the test we simulate what reaches the service AFTER Zod parsing (i.e., without
        // archivedGallery in media, since BaseMediaFields.media does not include it).
        const attackerGallery = makeImg('https://cdn.test/attacker.jpg');
        const updateInput = createMockAccommodationUpdateInput({
            media: {
                // Note: NO archivedGallery here — Zod strips it before service sees input
                gallery: [attackerGallery]
            }
        });

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        const actor = createAdminActor();
        await service.update(actor, 'acc-b1-03', updateInput);

        // Assert: server-managed archivedGallery is preserved; attacker cannot clear it
        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media: Media }];
        expect(payloadArg.media.archivedGallery).toHaveLength(1);
        expect(payloadArg.media.archivedGallery?.[0]).toStrictEqual(serverArchivedPhoto);
        // Gallery from client IS applied
        expect(payloadArg.media.gallery).toHaveLength(1);
        expect(payloadArg.media.gallery?.[0]).toStrictEqual(attackerGallery);
    });

    it('handles existing archivedGallery = empty array — preserves it as empty', async () => {
        // Arrange: existing row has archivedGallery: [] (empty but explicitly set)
        const existing = createMockAccommodation({
            id: 'acc-b1-04',
            media: {
                gallery: [makeImg('https://cdn.test/g.jpg')],
                archivedGallery: []
            }
        });

        const updateInput = createMockAccommodationUpdateInput({
            media: {
                gallery: [makeImg('https://cdn.test/new.jpg')]
            }
        });

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        const actor = createAdminActor();
        await service.update(actor, 'acc-b1-04', updateInput);

        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media: Media }];
        // Empty archivedGallery is preserved (not undefined)
        expect(payloadArg.media.archivedGallery).toEqual([]);
    });

    it('does not add archivedGallery when existing row has none', async () => {
        // Arrange: existing row has NO archivedGallery (legacy pre-SPEC-167)
        const existing = createMockAccommodation({
            id: 'acc-b1-05',
            media: {
                gallery: [makeImg('https://cdn.test/g.jpg')]
                // no archivedGallery field
            }
        });

        const updateInput = createMockAccommodationUpdateInput({
            media: {
                gallery: [makeImg('https://cdn.test/new.jpg')]
            }
        });

        (model.findById as Mock).mockResolvedValue(existing);
        (model.update as Mock).mockImplementation(async (_where, payload) => ({
            ...existing,
            ...payload
        }));

        const actor = createAdminActor();
        await service.update(actor, 'acc-b1-05', updateInput);

        const [, payloadArg] = (model.update as Mock).mock.calls[0] as [unknown, { media: Media }];
        // No archivedGallery existed — nothing to preserve, field stays absent
        expect(payloadArg.media.archivedGallery).toBeUndefined();
    });
});
