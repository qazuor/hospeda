/**
 * @fileoverview HOS-203 regression: public-page revalidation must fire ONLY when
 * an accommodation is publicly visible (`publicationStatus` PUBLISHED since
 * V6.9b, HOS-1641; before, lifecycle ACTIVE + visibility PUBLIC).
 *
 * Before the fix, `_afterCreate` / `_afterUpdate` scheduled revalidation of the
 * destination's PUBLIC paths unconditionally, so creating (or editing) a
 * DRAFT/PRIVATE listing purged public pages that never referenced it — pure
 * waste, and in prod it produced spurious `HTTP 404` revalidation logs.
 */

import type { AccommodationModel } from '@repo/db';
import { DestinationTypeEnum, PublicationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createMockAccommodation,
    createMockAccommodationCreateInput
} from '../../factories/accommodationFactory';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, makeMediaModelStub } from '../../utils/modelMockFactory';

// HOS-296: `_afterUpdate` grants the owner the HOST hat while a listing is
// PUBLISHED, and the grant is no longer best-effort — a failure fails the update.
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

// Capture scheduleRevalidation invocations. getRevalidationService() is otherwise
// undefined in unit tests (singleton never initialized), so without this mock the
// call is a silent no-op and the guard could not be asserted.
const mockScheduleRevalidation = vi.fn();
vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => ({
        scheduleRevalidation: mockScheduleRevalidation,
        scheduleRevalidationBatch: vi.fn()
    })
}));

// Run create()'s transactional callback inline with a truthy tx stub so the
// `!ctx.tx` guards in _afterCreate don't fire (mirrors create.test.ts).
vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: object; hookState: Record<string, unknown> }) => Promise<unknown>,
            baseCtx?: { hookState?: Record<string, unknown> }
        ) => {
            const ctx = { ...baseCtx, tx: {}, hookState: baseCtx?.hookState ?? {} };
            return fn(ctx as never);
        }
    )
}));

const mockLogger = createLoggerMock();

const makeService = (model: ReturnType<typeof createMockBaseModel>): AccommodationService => {
    const service = new AccommodationService(
        { logger: mockLogger },
        model as AccommodationModel,
        null,
        undefined,
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        makeMediaModelStub() as any
    );
    // @ts-expect-error: override for test — updateAccommodationsCount hits the DB otherwise
    service.destinationService = {
        updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
    };
    // @ts-expect-error: override for test — _assertDestinationIsCity / _resolveDestinationSlug
    service._destinationModel = {
        findById: vi
            .fn()
            .mockResolvedValue({ destinationType: DestinationTypeEnum.CITY, slug: 'mock-dest' })
    };
    return service;
};

beforeEach(() => {
    vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
});

describe('AccommodationService revalidation gating by public visibility (HOS-203)', () => {
    let model: ReturnType<typeof createMockBaseModel>;
    let service: AccommodationService;

    beforeEach(() => {
        model = createMockBaseModel();
        service = makeService(model);
        vi.clearAllMocks();
    });

    /** Every publication status another account cannot see (AC:V5:5, HOS-1641). */
    const NOT_PUBLISHED = [
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED,
        PublicationStatusEnum.PURGED
    ] as const;

    const listingIn = (id: string, publicationStatus: PublicationStatusEnum) =>
        createMockAccommodation({ id, slug: 'mock-slug', publicationStatus });

    describe('create', () => {
        it.each(
            NOT_PUBLISHED
        )('does NOT schedule revalidation when the new listing is born %s', async (publicationStatus) => {
            const actor = createAdminActor();
            const input = createMockAccommodationCreateInput();
            (model.create as Mock).mockResolvedValue(listingIn('mock-id', publicationStatus));

            const result = await service.create(actor, input);

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).not.toHaveBeenCalled();
        });

        it('schedules revalidation when the new listing is PUBLISHED', async () => {
            const actor = createAdminActor();
            const input = createMockAccommodationCreateInput();
            (model.create as Mock).mockResolvedValue(
                listingIn('mock-id', PublicationStatusEnum.PUBLISHED)
            );

            const result = await service.create(actor, input);

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
            expect(mockScheduleRevalidation).toHaveBeenCalledWith(
                expect.objectContaining({ entityType: 'accommodation', slug: 'mock-slug' })
            );
        });
    });

    describe('update', () => {
        it.each(
            NOT_PUBLISHED
        )('does NOT schedule revalidation when editing a listing that stays %s', async (publicationStatus) => {
            const actor = createAdminActor();
            const id = 'mock-id';
            (model.findById as Mock).mockResolvedValue(listingIn(id, publicationStatus));
            (model.update as Mock).mockResolvedValue({
                ...listingIn(id, publicationStatus),
                summary: 'edited summary'
            });

            const result = await service.update(actor, id, { summary: 'edited summary' });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).not.toHaveBeenCalled();
        });

        it('schedules revalidation when editing a live PUBLISHED listing', async () => {
            const actor = createAdminActor();
            const id = 'mock-id';
            const published = listingIn(id, PublicationStatusEnum.PUBLISHED);
            (model.findById as Mock).mockResolvedValue(published);
            (model.update as Mock).mockResolvedValue({ ...published, summary: 'edited summary' });

            const result = await service.update(actor, id, { summary: 'edited summary' });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        });

        it('schedules revalidation when the row the update returns is PUBLISHED although it was a DRAFT before', async () => {
            const actor = createAdminActor();
            const id = 'mock-id';
            // The `_isPubliclyVisible(entity)` first disjunct must fire even though
            // the before-state was not public.
            (model.findById as Mock).mockResolvedValue(listingIn(id, PublicationStatusEnum.DRAFT));
            (model.update as Mock).mockResolvedValue(
                listingIn(id, PublicationStatusEnum.PUBLISHED)
            );

            const result = await service.update(actor, id, { summary: 'edited summary' });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        });

        it('schedules revalidation when a listing that WAS PUBLISHED is no longer public after the update', async () => {
            const actor = createAdminActor();
            const id = 'mock-id';
            // The public page that just disappeared must still be purged.
            (model.findById as Mock).mockResolvedValue(
                listingIn(id, PublicationStatusEnum.PUBLISHED)
            );
            (model.update as Mock).mockResolvedValue(listingIn(id, PublicationStatusEnum.DRAFT));

            const result = await service.update(actor, id, { summary: 'edited summary' });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        });
    });
});
