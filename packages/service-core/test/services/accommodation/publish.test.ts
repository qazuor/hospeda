/**
 * publish.test.ts
 *
 * Unit tests for the publish flow on AccommodationService.
 *
 * Publishing used to CREATE billing state: it started a no-card trial outside the
 * transaction, then flipped lifecycleState inside it, compensating via cancelTrial
 * if that tx failed. HOS-171 made the trial card-first, so publishing no longer
 * touches billing at all — it resolves eligibility and either flips the row or
 * rejects with `subscription_required`. `AccommodationPublishDeps` is down to
 * `checkEligibility`, and the trial-creation, QZPay-fault and compensation suites
 * went with the mechanism they covered.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { AccommodationPublishDeps } from '../../../src/services/accommodation/accommodation.types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createActor, createAdminActor, createHostActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

vi.mock('../../../src/utils/transaction.js', () => ({
    /**
     * Drop-in stub for `withServiceTransaction`. Runs the callback synchronously
     * with a fake context, so the tx semantics under test reduce to "did the
     * callback throw or did it return". The real driver is exercised by
     * integration tests.
     */
    withServiceTransaction: vi.fn(async (cb: (txCtx: unknown) => Promise<unknown>) => {
        return cb({ tx: {} as unknown, hookState: {} });
    })
}));

function createUserModelMock(): UserModel {
    return createModelMock() as unknown as UserModel;
}

function createPublishDeps(
    overrides: Partial<AccommodationPublishDeps> = {}
): AccommodationPublishDeps {
    return {
        // 'has_active_sub' is the only eligibility that still permits publishing.
        // This default used to be 'first_publish', back when that meant "grant a
        // no-card trial and go live"; card-first rejects it to the plans page just
        // like 'subscription_required', so it is no longer a publishable owner.
        checkEligibility: vi.fn().mockResolvedValue('has_active_sub'),
        ...overrides
    };
}

function buildService(
    model: ReturnType<typeof createMockBaseModel>,
    userModel: UserModel,
    publishDeps?: AccommodationPublishDeps | null
): AccommodationService {
    const mockLogger = createLoggerMock();
    return new AccommodationService(
        { logger: mockLogger },
        model as AccommodationModel,
        null,
        userModel,
        publishDeps ?? null
    );
}

describe('AccommodationService.publish', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;

    beforeEach(() => {
        vi.clearAllMocks();
        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
    });

    describe('authorization', () => {
        it('returns NOT_FOUND when the accommodation does not exist', async () => {
            const service = buildService(accommodationModel, userModel, createPublishDeps());
            (accommodationModel.findById as Mock).mockResolvedValue(null);

            const actor = createActor({ id: 'user-001' });
            const result = await service.publish(actor, 'missing-id');

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('returns FORBIDDEN when the actor is neither owner nor admin', async () => {
            const service = buildService(accommodationModel, userModel, createPublishDeps());
            const accommodation = createMockAccommodation({
                id: 'acc-001',
                ownerId: 'someone-else',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);

            const actor = createActor({ id: 'user-001', permissions: [] });
            const result = await service.publish(actor, 'acc-001');

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('allows an admin to publish someone else accommodation', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-002',
                ownerId: 'user-owner',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-owner',
                role: RoleEnum.USER
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createAdminActor({
                id: 'admin-001',
                permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
            });
            const result = await service.publish(actor, 'acc-002');

            expect(result.error).toBeUndefined();
            expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });

    describe('idempotency', () => {
        it('returns the accommodation untouched when already ACTIVE', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-003',
                ownerId: 'user-001',
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);

            const actor = createActor({ id: 'user-001' });
            const result = await service.publish(actor, 'acc-003');

            expect(result.data?.id).toBe('acc-003');
            expect(accommodationModel.update).not.toHaveBeenCalled();
        });
    });

    describe('billing-exempt owner branch', () => {
        // ADMIN / SUPER_ADMIN / CLIENT_MANAGER are exempt from the billing
        // eligibility check (they publish on behalf of the platform without a
        // subscription). Regular HOST users go through the eligibility flow.
        it.each([
            RoleEnum.ADMIN,
            RoleEnum.SUPER_ADMIN,
            RoleEnum.CLIENT_MANAGER
        ])('skips eligibility entirely when the owner is %s', async (role) => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-exempt',
                ownerId: 'admin-owner',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'admin-owner',
                role
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createAdminActor({ id: 'admin-actor' });
            const result = await service.publish(actor, 'acc-exempt');

            expect(result.error).toBeUndefined();
            expect(deps.checkEligibility).not.toHaveBeenCalled();
            // Role promotion never happens in publish — promotion is done at
            // draft creation. The user model should not be touched here.
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });

    describe('returning host with active subscription', () => {
        it('updates state without trial call when has_active_sub', async () => {
            const deps = createPublishDeps({
                checkEligibility: vi.fn().mockResolvedValue('has_active_sub')
            });
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-006',
                ownerId: 'host-006',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            // Owner is USER role at the model level (edge: no privileged role yet but has sub)
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-006',
                role: RoleEnum.USER
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createActor({ id: 'host-006' });
            const result = await service.publish(actor, 'acc-006');

            expect(result.error).toBeUndefined();
            // No role promotion when not first_publish
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });

    describe('subscription_required rejection', () => {
        it('returns FORBIDDEN with message subscription_required', async () => {
            const deps = createPublishDeps({
                checkEligibility: vi.fn().mockResolvedValue('subscription_required')
            });
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-007',
                ownerId: 'user-007',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-007',
                role: RoleEnum.USER
            });

            const actor = createActor({ id: 'user-007' });
            const result = await service.publish(actor, 'acc-007');

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.error?.message).toMatch(/subscription_required/);
            expect(accommodationModel.update).not.toHaveBeenCalled();
        });

        it('rejects first_publish too — the first publish also needs a card (HOS-171)', async () => {
            // THE card-first behaviour at this layer. `first_publish` used to be the
            // happy path: it granted a no-card trial mid-publish and the owner went
            // live without ever seeing a checkout. Now a trial IS a MercadoPago
            // preapproval, so it cannot exist before someone authorizes a card, and
            // this rejects to the plans page exactly like `subscription_required`.
            // Creating the accommodation stays free — it just stays a draft.
            const deps = createPublishDeps({
                checkEligibility: vi.fn().mockResolvedValue('first_publish')
            });
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-008',
                ownerId: 'user-008',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-008',
                role: RoleEnum.USER
            });

            const actor = createActor({ id: 'user-008' });
            const result = await service.publish(actor, 'acc-008');

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.error?.message).toMatch(/subscription_required/);
            // The draft must survive untouched — no half-publish.
            expect(accommodationModel.update).not.toHaveBeenCalled();
        });
    });

    describe('configuration error', () => {
        it('returns CONFIGURATION_ERROR when publishDeps are not wired and owner is non-privileged', async () => {
            const service = buildService(accommodationModel, userModel, null);
            const accommodation = createMockAccommodation({
                id: 'acc-008',
                ownerId: 'user-008',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-008',
                role: RoleEnum.USER
            });

            const actor = createActor({ id: 'user-008' });
            const result = await service.publish(actor, 'acc-008');

            expect(result.error?.code).toBe(ServiceErrorCode.CONFIGURATION_ERROR);
        });
    });

    describe('capacity completeness (extraInfo, HOS-152)', () => {
        it('rejects publish with VALIDATION_ERROR when extraInfo is entirely absent', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-incomplete-001',
                ownerId: 'host-incomplete-001',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                extraInfo: undefined
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-incomplete-001',
                role: RoleEnum.HOST
            });

            const actor = createHostActor({ id: 'host-incomplete-001' });
            const result = await service.publish(actor, 'acc-incomplete-001');

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(accommodationModel.update).not.toHaveBeenCalled();
            expect(deps.checkEligibility).not.toHaveBeenCalled();
        });

        it('rejects publish with VALIDATION_ERROR when extraInfo has only a partial capacity field (repro: PATCH with only maxGuests)', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-incomplete-002',
                ownerId: 'host-incomplete-002',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                // Mirrors the exact live repro: a draft PATCHed with only
                // `maxGuests` ends up with `capacity` set but `minNights` /
                // `bedrooms` / `bathrooms` undefined.
                extraInfo: { capacity: 4 }
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-incomplete-002',
                role: RoleEnum.HOST
            });

            const actor = createHostActor({ id: 'host-incomplete-002' });
            const result = await service.publish(actor, 'acc-incomplete-002');

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(accommodationModel.update).not.toHaveBeenCalled();
        });

        it('publishes successfully when extraInfo has all four required fields', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-complete-001',
                ownerId: 'host-complete-001',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 }
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-complete-001',
                role: RoleEnum.HOST
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createHostActor({ id: 'host-complete-001' });
            const result = await service.publish(actor, 'acc-complete-001');

            expect(result.error).toBeUndefined();
            expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });
});
