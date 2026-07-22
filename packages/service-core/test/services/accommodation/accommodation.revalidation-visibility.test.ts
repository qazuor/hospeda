/**
 * @fileoverview HOS-203 regression: public-page revalidation must fire ONLY when
 * an accommodation is publicly visible (lifecycle ACTIVE + visibility PUBLIC).
 *
 * Before the fix, `_afterCreate` / `_afterUpdate` scheduled revalidation of the
 * destination's PUBLIC paths unconditionally, so creating (or editing) a
 * DRAFT/PRIVATE listing purged public pages that never referenced it — pure
 * waste, and in prod it produced spurious `HTTP 404` revalidation logs.
 */

import type { AccommodationModel } from '@repo/db';
import {
    DestinationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
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
    // @ts-expect-error: override for test — _beforeCreate service-suspension guard
    service._userModel = {
        findById: vi.fn().mockResolvedValue({ serviceSuspended: false })
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

    describe('create', () => {
        it('does NOT schedule revalidation when the new listing is a DRAFT/PRIVATE draft', async () => {
            const actor = createAdminActor();
            const input = createMockAccommodationCreateInput({
                lifecycleState: LifecycleStatusEnum.DRAFT,
                visibility: VisibilityEnum.PRIVATE
            });
            (model.create as Mock).mockResolvedValue(
                createMockAccommodation({
                    id: 'mock-id',
                    slug: 'mock-slug',
                    lifecycleState: LifecycleStatusEnum.DRAFT,
                    visibility: VisibilityEnum.PRIVATE
                })
            );

            const result = await service.create(actor, input);

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).not.toHaveBeenCalled();
        });

        it('schedules revalidation when the new listing is ACTIVE/PUBLIC', async () => {
            const actor = createAdminActor();
            const input = createMockAccommodationCreateInput();
            (model.create as Mock).mockResolvedValue(
                createMockAccommodation({
                    id: 'mock-id',
                    slug: 'mock-slug',
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    visibility: VisibilityEnum.PUBLIC
                })
            );

            const result = await service.create(actor, input);

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
            expect(mockScheduleRevalidation).toHaveBeenCalledWith(
                expect.objectContaining({ entityType: 'accommodation', slug: 'mock-slug' })
            );
        });

        it('does NOT schedule revalidation for a DRAFT that is nominally PUBLIC (not yet published)', async () => {
            const actor = createAdminActor();
            const input = createMockAccommodationCreateInput({
                lifecycleState: LifecycleStatusEnum.DRAFT,
                visibility: VisibilityEnum.PUBLIC
            });
            (model.create as Mock).mockResolvedValue(
                createMockAccommodation({
                    id: 'mock-id',
                    slug: 'mock-slug',
                    lifecycleState: LifecycleStatusEnum.DRAFT,
                    visibility: VisibilityEnum.PUBLIC
                })
            );

            const result = await service.create(actor, input);

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).not.toHaveBeenCalled();
        });
    });

    describe('update', () => {
        const draftPrivate = (id: string) =>
            createMockAccommodation({
                id,
                slug: 'mock-slug',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                visibility: VisibilityEnum.PRIVATE,
                moderationState: ModerationStatusEnum.APPROVED
            });
        const activePublic = (id: string) =>
            createMockAccommodation({
                id,
                slug: 'mock-slug',
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                visibility: VisibilityEnum.PUBLIC,
                moderationState: ModerationStatusEnum.APPROVED
            });

        it('does NOT schedule revalidation when editing a listing that stays DRAFT/PRIVATE', async () => {
            const actor = createAdminActor();
            const id = 'mock-id';
            (model.findById as Mock).mockResolvedValue(draftPrivate(id));
            (model.update as Mock).mockResolvedValue({
                ...draftPrivate(id),
                summary: 'edited summary'
            });

            const result = await service.update(actor, id, { summary: 'edited summary' });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).not.toHaveBeenCalled();
        });

        it('schedules revalidation when editing a live ACTIVE/PUBLIC listing', async () => {
            const actor = createAdminActor();
            const id = 'mock-id';
            (model.findById as Mock).mockResolvedValue(activePublic(id));
            (model.update as Mock).mockResolvedValue({
                ...activePublic(id),
                summary: 'edited summary'
            });

            const result = await service.update(actor, id, { summary: 'edited summary' });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        });

        it('schedules revalidation when a DRAFT/PRIVATE listing is published (→ACTIVE/PUBLIC) via a generic update', async () => {
            const actor = createAdminActor();
            const id = 'mock-id';
            // Was private before; the update makes it public. The `_isPubliclyVisible(entity)`
            // first disjunct must fire even though the before-state was private.
            (model.findById as Mock).mockResolvedValue(draftPrivate(id));
            (model.update as Mock).mockResolvedValue(activePublic(id));

            const result = await service.update(actor, id, {
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                visibility: VisibilityEnum.PUBLIC
            });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        });

        it('schedules revalidation when a live listing is unpublished (ACTIVE→DRAFT) via update', async () => {
            const actor = createAdminActor();
            const id = 'mock-id';
            // Was public before the update; ends up as a DRAFT. The public page that
            // just disappeared must still be purged, so revalidation MUST fire.
            (model.findById as Mock).mockResolvedValue(activePublic(id));
            (model.update as Mock).mockResolvedValue({
                ...activePublic(id),
                lifecycleState: LifecycleStatusEnum.DRAFT,
                visibility: VisibilityEnum.PRIVATE
            });

            const result = await service.update(actor, id, { summary: 'edited summary' });

            expect(result.error).toBeUndefined();
            expect(mockScheduleRevalidation).toHaveBeenCalledTimes(1);
        });
    });
});
