/**
 * Tests for SPEC-285 T-004: lifecycle event emission in OwnerPromotionService.
 *
 * Covers G-4 from the spec:
 * - `owner_promotion.created` is emitted in `_afterCreate` for every new promotion.
 * - `owner_promotion.activated` is emitted in `_afterUpdate` ONLY when the promotion
 *   transitions from a non-ACTIVE state (DRAFT / INACTIVE / ARCHIVED) to ACTIVE.
 * - `owner_promotion.activated` is NOT emitted when the promotion stays ACTIVE,
 *   or when the update does not touch lifecycleState.
 */

import type { AccommodationModel, OwnerPromotionModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import type { OwnerPromotionLifecycleEvent } from '../../../src/services/owner-promotion/ownerPromotion.lifecycle-events';
import * as lifecycleEventsModule from '../../../src/services/owner-promotion/ownerPromotion.lifecycle-events';
import { OwnerPromotionService } from '../../../src/services/owner-promotion/ownerPromotion.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockOwnerPromotion,
    createMockOwnerPromotionCreateInput,
    getMockOwnerPromotionId
} from '../../factories/ownerPromotionFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// ─── Constants ────────────────────────────────────────────────────────────────

const promotionId = getMockOwnerPromotionId('lifecycle-1');
const ownerId = getMockId('user', 'owner-1') as string;
const accommodationId = getMockId('accommodation', 'accom-1') as string;

/** An actor with full admin-level owner promotion permissions. */
const adminActor = createActor({
    permissions: [
        PermissionEnum.OWNER_PROMOTION_CREATE,
        PermissionEnum.OWNER_PROMOTION_UPDATE_ANY,
        PermissionEnum.OWNER_PROMOTION_VIEW_ANY
    ]
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const activePromo = createMockOwnerPromotion({
    id: promotionId,
    ownerId,
    accommodationId,
    slug: 'summer-20-off',
    lifecycleState: LifecycleStatusEnum.ACTIVE
});

const draftPromo = createMockOwnerPromotion({
    id: promotionId,
    ownerId,
    accommodationId,
    slug: 'summer-20-off',
    lifecycleState: LifecycleStatusEnum.DRAFT
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('OwnerPromotionService lifecycle events (SPEC-285 T-004)', () => {
    let service: OwnerPromotionService;
    let modelMock: ReturnType<typeof createModelMock>;
    let accommodationModelMock: { findById: ReturnType<typeof vi.fn> };
    let emitSpy: MockInstance<(event: OwnerPromotionLifecycleEvent) => Promise<void>>;

    /** Returns the first argument of the Nth emit call, typed as OwnerPromotionLifecycleEvent. */
    function getEmittedEvent(callIndex = 0): OwnerPromotionLifecycleEvent | undefined {
        // vi.spyOn narrows the spy type to the real function signature, which causes
        // TypeScript to widen call args to `unknown[]`. We cast here to preserve the
        // domain type; the actual runtime value is always a fully-typed event object.
        // mock.calls is [OwnerPromotionLifecycleEvent][] — each element is the arg tuple
        // for one invocation; [0] dereferences the single argument.
        const calls = emitSpy.mock.calls as unknown as [OwnerPromotionLifecycleEvent][];
        return calls[callIndex]?.[0];
    }

    beforeEach(() => {
        // FIX 8: clear all mocks FIRST so default values set below survive into tests.
        vi.clearAllMocks();

        modelMock = createModelMock(['findActiveForAccommodation', 'findBySlug']);
        accommodationModelMock = { findById: vi.fn() };
        const loggerMock = createLoggerMock();

        service = new OwnerPromotionService({
            logger: loggerMock,
            model: modelMock as unknown as OwnerPromotionModel,
            accommodationModel: accommodationModelMock as unknown as AccommodationModel
        });

        // Default slug uniqueness — findBySlug returns null (slug is free).
        (modelMock.findBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        // Attach the emit spy AFTER clearing mocks (single assignment — no duplicate).
        emitSpy = vi
            .spyOn(lifecycleEventsModule, 'emitOwnerPromotionLifecycleEvent')
            .mockResolvedValue(undefined);
    });

    // ── _afterCreate ──────────────────────────────────────────────────────────

    describe('_afterCreate: owner_promotion.created', () => {
        it('emits CREATED event when a promotion is successfully created', async () => {
            const createInput = createMockOwnerPromotionCreateInput({
                ownerId,
                accommodationId,
                slug: 'summer-20-off'
            });

            // The model.create() must return a fully-formed entity so _afterCreate
            // has access to id, ownerId, slug, and accommodationId.
            modelMock.create.mockResolvedValue(activePromo);

            const result = await service.create(adminActor, createInput);

            expect(result.error).toBeUndefined();
            expect(emitSpy).toHaveBeenCalledTimes(1);

            const event = getEmittedEvent();
            expect(event).toMatchObject({
                type: lifecycleEventsModule.OwnerPromotionLifecycleEventType.CREATED,
                promotionId: activePromo.id,
                ownerId: activePromo.ownerId,
                slug: activePromo.slug,
                accommodationId: activePromo.accommodationId
            });
            expect(event?.timestamp).toBeInstanceOf(Date);
        });

        it('passes accommodationId as null for owner-wide promotions', async () => {
            const ownerWidePromo = createMockOwnerPromotion({
                id: promotionId,
                ownerId,
                accommodationId: undefined,
                slug: 'owner-wide-promo',
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            const createInput = createMockOwnerPromotionCreateInput({
                ownerId,
                accommodationId: undefined,
                slug: 'owner-wide-promo'
            });
            modelMock.create.mockResolvedValue(ownerWidePromo);

            await service.create(adminActor, createInput);

            const event = getEmittedEvent();
            expect(event).toMatchObject({
                type: lifecycleEventsModule.OwnerPromotionLifecycleEventType.CREATED,
                accommodationId: null
            });
        });
    });

    // ── _afterUpdate ──────────────────────────────────────────────────────────

    describe('_afterUpdate: owner_promotion.activated', () => {
        it('emits ACTIVATED event when lifecycleState transitions DRAFT → ACTIVE', async () => {
            // _beforeUpdate fetches the entity via findById — return the DRAFT version.
            modelMock.findById.mockResolvedValue(draftPromo);
            // The actual update returns the ACTIVE version.
            modelMock.update.mockResolvedValue(activePromo);

            const result = await service.update(adminActor, promotionId, {
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            expect(result.error).toBeUndefined();
            expect(emitSpy).toHaveBeenCalledTimes(1);

            const event = getEmittedEvent();
            expect(event).toMatchObject({
                type: lifecycleEventsModule.OwnerPromotionLifecycleEventType.ACTIVATED,
                promotionId: activePromo.id,
                ownerId: activePromo.ownerId,
                previousState: LifecycleStatusEnum.DRAFT
            });
            expect(event?.timestamp).toBeInstanceOf(Date);
        });

        it('emits ACTIVATED when lifecycleState transitions INACTIVE → ACTIVE', async () => {
            const inactivePromo = { ...draftPromo, lifecycleState: LifecycleStatusEnum.INACTIVE };
            modelMock.findById.mockResolvedValue(inactivePromo);
            modelMock.update.mockResolvedValue(activePromo);

            await service.update(adminActor, promotionId, {
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const event = getEmittedEvent();
            expect(event).toMatchObject({
                type: lifecycleEventsModule.OwnerPromotionLifecycleEventType.ACTIVATED,
                previousState: LifecycleStatusEnum.INACTIVE
            });
        });

        it('does NOT emit ACTIVATED when the entity stays ACTIVE → ACTIVE', async () => {
            // Previous state is already ACTIVE.
            modelMock.findById.mockResolvedValue(activePromo);
            // Update returns ACTIVE (e.g. only title changed).
            modelMock.update.mockResolvedValue({ ...activePromo, title: 'Updated title' });

            await service.update(adminActor, promotionId, { title: 'Updated title' });

            expect(emitSpy).not.toHaveBeenCalled();
        });

        it('does NOT emit ACTIVATED when lifecycleState changes to a non-ACTIVE state', async () => {
            const archivedPromo = { ...activePromo, lifecycleState: LifecycleStatusEnum.ARCHIVED };
            modelMock.findById.mockResolvedValue(activePromo);
            modelMock.update.mockResolvedValue(archivedPromo);

            await service.update(adminActor, promotionId, {
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });

            expect(emitSpy).not.toHaveBeenCalled();
        });

        it('does NOT emit ACTIVATED when the update does not touch lifecycleState', async () => {
            // Previous state is DRAFT; update only changes title — no lifecycle change.
            modelMock.findById.mockResolvedValue(draftPromo);
            modelMock.update.mockResolvedValue({ ...draftPromo, title: 'New title' });

            await service.update(adminActor, promotionId, { title: 'New title' });

            expect(emitSpy).not.toHaveBeenCalled();
        });
    });
});
