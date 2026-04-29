/**
 * publish.test.ts
 *
 * Unit tests for the atomic publish flow on AccommodationService.
 *
 * Validates the "Option C" pattern: external trial creation OUTSIDE the
 * transaction, short DB tx with accommodation update + role promotion,
 * compensation via cancelTrial when the post-trial tx fails.
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
        checkEligibility: vi.fn().mockResolvedValue('first_publish'),
        startTrial: vi.fn().mockResolvedValue({ subscriptionId: 'qzpay-sub-001' }),
        cancelTrial: vi.fn().mockResolvedValue(undefined),
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
            expect(deps.startTrial).not.toHaveBeenCalled();
            expect(accommodationModel.update).not.toHaveBeenCalled();
        });
    });

    describe('privileged owner branch', () => {
        it('skips billing entirely when the owner is HOST', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-004',
                ownerId: 'host-001',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-001',
                role: RoleEnum.HOST
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createHostActor({ id: 'host-001' });
            const result = await service.publish(actor, 'acc-004');

            expect(result.error).toBeUndefined();
            expect(deps.checkEligibility).not.toHaveBeenCalled();
            expect(deps.startTrial).not.toHaveBeenCalled();
            // No role promotion needed for already-privileged owner
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });

    describe('first publish (USER -> HOST + trial)', () => {
        it('calls startTrial outside tx, then updates state and promotes role inside tx', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-005',
                ownerId: 'user-005',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-005',
                role: RoleEnum.USER
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createActor({ id: 'user-005' });
            const result = await service.publish(actor, 'acc-005');

            expect(result.error).toBeUndefined();
            expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
            expect(deps.checkEligibility).toHaveBeenCalledWith('user-005', expect.anything());
            expect(deps.startTrial).toHaveBeenCalledWith({ ownerId: 'user-005' });
            // Role promotion happens
            expect(userModel.update).toHaveBeenCalledWith(
                { id: 'user-005' },
                { role: RoleEnum.HOST },
                expect.anything()
            );
            // No compensation when tx succeeds
            expect(deps.cancelTrial).not.toHaveBeenCalled();
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
            expect(deps.startTrial).not.toHaveBeenCalled();
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
            expect(deps.startTrial).not.toHaveBeenCalled();
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

    describe('QZPay timeout / failure', () => {
        it('returns SERVICE_UNAVAILABLE without any DB writes when startTrial throws', async () => {
            const deps = createPublishDeps({
                startTrial: vi.fn().mockRejectedValue(new Error('QZPay timeout'))
            });
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-009',
                ownerId: 'user-009',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-009',
                role: RoleEnum.USER
            });

            const actor = createActor({ id: 'user-009' });
            const result = await service.publish(actor, 'acc-009');

            expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
            expect(accommodationModel.update).not.toHaveBeenCalled();
            expect(userModel.update).not.toHaveBeenCalled();
            // No cancellation needed because the trial was never created
            expect(deps.cancelTrial).not.toHaveBeenCalled();
        });
    });

    describe('compensation when post-trial tx fails', () => {
        it('cancels the trial when the model.update inside the tx throws', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-010',
                ownerId: 'user-010',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-010',
                role: RoleEnum.USER
            });
            // Tx throws on the accommodation update
            (accommodationModel.update as Mock).mockRejectedValue(new Error('DB failure'));

            const actor = createActor({ id: 'user-010' });
            const result = await service.publish(actor, 'acc-010');

            expect(result.error).toBeDefined();
            expect(deps.cancelTrial).toHaveBeenCalledWith('qzpay-sub-001');
        });

        it('still surfaces the error when both tx and cancelTrial fail (CRITICAL inconsistency path)', async () => {
            const deps = createPublishDeps({
                cancelTrial: vi.fn().mockRejectedValue(new Error('QZPay cancel timeout'))
            });
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-011',
                ownerId: 'user-011',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-011',
                role: RoleEnum.USER
            });
            (accommodationModel.update as Mock).mockRejectedValue(new Error('DB failure'));

            const actor = createActor({ id: 'user-011' });
            const result = await service.publish(actor, 'acc-011');

            expect(result.error).toBeDefined();
            // Compensation was attempted even though it failed
            expect(deps.cancelTrial).toHaveBeenCalledWith('qzpay-sub-001');
        });
    });
});
