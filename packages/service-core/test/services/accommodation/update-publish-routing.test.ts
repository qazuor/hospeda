/**
 * update-publish-routing.test.ts
 *
 * Validates the routing logic in `AccommodationService.update`: ACTIVE
 * transitions are dispatched to the dedicated `publish()` flow when billing
 * dependencies are wired, and fall through to the legacy lifecycle hook path
 * when they are not.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { AccommodationPublishDeps } from '../../../src/services/accommodation/accommodation.types';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

vi.mock('../../../src/utils/transaction.js', () => ({
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

describe('AccommodationService.update — publish routing', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
    });

    it('falls through to legacy update path when publishDeps are not wired', async () => {
        const service = buildService(accommodationModel, userModel, null);
        const accommodation = createMockAccommodation({
            id: 'acc-fallback',
            ownerId: 'user-001',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'user-001',
            role: RoleEnum.USER
        });

        const actor = createAdminActor({ id: 'admin-x' });
        await service.update(actor, 'acc-fallback', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Legacy path runs the regular update pipeline, so the model is updated
        // and the role assignment fires through `_afterUpdate` (best-effort).
        expect(accommodationModel.update).toHaveBeenCalled();
    });

    it('routes ACTIVE transition to publish() when publishDeps are wired', async () => {
        const deps = createPublishDeps();
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-publish',
            ownerId: 'user-002',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        // First findById = override probe, second = inside publish()
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'user-002',
            role: RoleEnum.USER
        });

        const actor = createActor({
            id: 'user-002',
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const result = await service.update(actor, 'acc-publish', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        expect(result.error).toBeUndefined();
        // Confirm the publish path was taken (eligibility was checked + trial started)
        expect(deps.checkEligibility).toHaveBeenCalledWith('user-002', expect.anything());
        expect(deps.startTrial).toHaveBeenCalledWith({ ownerId: 'user-002' });
    });

    it('does NOT route to publish when current state is already ACTIVE', async () => {
        const deps = createPublishDeps();
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-noop',
            ownerId: 'user-003',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation
        });

        const actor = createAdminActor({ id: 'user-003' });
        await service.update(actor, 'acc-noop', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Since current is already ACTIVE, the override falls through to super.update
        // and no publish work happens.
        expect(deps.startTrial).not.toHaveBeenCalled();
        expect(deps.checkEligibility).not.toHaveBeenCalled();
    });

    it('does NOT route to publish for non-ACTIVE updates', async () => {
        const deps = createPublishDeps();
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-namechange',
            ownerId: 'user-004',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'New name'
        });

        const actor = createAdminActor({ id: 'user-004' });
        await service.update(actor, 'acc-namechange', {
            name: 'New name'
        });

        expect(deps.startTrial).not.toHaveBeenCalled();
        expect(accommodationModel.update).toHaveBeenCalled();
    });
});
