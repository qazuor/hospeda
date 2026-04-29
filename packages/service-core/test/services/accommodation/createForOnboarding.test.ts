/**
 * createForOnboarding.test.ts
 *
 * Unit tests for the public-host-onboarding entry point of AccommodationService.
 *
 * Validates the three terminal states (`created`, `resumed`, `already_host`),
 * the idempotency contract (one DRAFT per USER), the privileged-role short-circuit,
 * and the defense-in-depth `ownerId = actor.id` override.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import {
    AccommodationTypeEnum,
    DestinationTypeEnum,
    LifecycleStatusEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createMockAccommodation } from '../../factories/accommodationFactory';
import { createActor, createHostActor, createSuperAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const VALID_DRAFT_INPUT = {
    name: 'Casa frente al rio',
    summary: 'Una casa amplia con vista al rio Uruguay y mucho parque',
    description:
        'Casa de cinco ambientes a metros del rio Uruguay. Ideal para familias o grupos chicos.',
    type: AccommodationTypeEnum.CABIN,
    destinationId: '8d8fe2db-2f7f-4a9b-8f3a-1234567890ab'
} as const;

function createUserModelMock(): UserModel {
    return createModelMock() as unknown as UserModel;
}

function buildService(
    model: ReturnType<typeof createMockBaseModel>,
    userModel: UserModel
): AccommodationService {
    const mockLogger = createLoggerMock();
    const service = new AccommodationService(
        { logger: mockLogger },
        model as AccommodationModel,
        null,
        userModel
    );
    // Suppress destination-count side-effect.
    // @ts-expect-error: override internal for test isolation
    service.destinationService = {
        updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
    };
    // Stub destination model so _assertDestinationIsCity sees a CITY.
    // @ts-expect-error: override for test
    service._destinationModel = {
        findById: vi.fn().mockResolvedValue({ destinationType: DestinationTypeEnum.CITY })
    };
    return service;
}

describe('AccommodationService.createForOnboarding', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');

        accommodationModel = createMockBaseModel();
        // The shared mock factory does not include findOne — add it for this suite.
        (accommodationModel as unknown as { findOne: unknown }).findOne = vi.fn();
        userModel = createUserModelMock();
        service = buildService(accommodationModel, userModel);
    });

    describe('status: created', () => {
        it('inserts a fresh DRAFT for a USER without an existing draft', async () => {
            // Arrange
            const actor = createActor({ id: 'user-001' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-001',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            const created = createMockAccommodation({
                id: 'acc-001',
                ownerId: 'user-001',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.status).toBe('created');
            if (result.data?.status === 'created') {
                expect(result.data.accommodation.id).toBe('acc-001');
            }
            expect(accommodationModel.create).toHaveBeenCalledTimes(1);
        });

        it('forces ownerId to actor.id and lifecycleState to DRAFT (defense in depth)', async () => {
            // Arrange
            const actor = createActor({ id: 'user-002' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-002',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            const created = createMockAccommodation({
                id: 'acc-002',
                ownerId: 'user-002',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.create as Mock).mockResolvedValue(created);

            // Act
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert: payload passed to model.create has the correct ownerId and DRAFT state
            const createCalls = (accommodationModel.create as Mock).mock.calls;
            expect(createCalls).toHaveLength(1);
            const payload = createCalls[0]?.[0];
            expect(payload.ownerId).toBe('user-002');
            expect(payload.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
            expect(payload.lastWarnedAt).toBeNull();
            expect(payload.createdById).toBe('user-002');
        });
    });

    describe('status: resumed (idempotency)', () => {
        it('returns the existing DRAFT when one is already active for this owner', async () => {
            // Arrange
            const actor = createActor({ id: 'user-003' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-003',
                role: RoleEnum.USER
            });
            const existing = createMockAccommodation({
                id: 'acc-existing',
                ownerId: 'user-003',
                lifecycleState: LifecycleStatusEnum.DRAFT
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(existing);

            // Act
            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('resumed');
            if (result.data?.status === 'resumed') {
                expect(result.data.accommodation.id).toBe('acc-existing');
            }
            // model.create must not be called when a draft already exists
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });

        it('queries for non-deleted DRAFT only', async () => {
            // Arrange
            const actor = createActor({ id: 'user-004' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-004',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            (accommodationModel.create as Mock).mockResolvedValue(
                createMockAccommodation({ id: 'acc-new', ownerId: 'user-004' })
            );

            // Act
            await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert: the where clause locks the lookup to ownerId + DRAFT + not soft-deleted
            const findOneCalls = (accommodationModel.findOne as Mock).mock.calls;
            expect(findOneCalls).toHaveLength(1);
            expect(findOneCalls[0]?.[0]).toEqual({
                ownerId: 'user-004',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                deletedAt: null
            });
        });
    });

    describe('status: already_host (privileged role short-circuit)', () => {
        it('returns already_host with null accommodation for HOST role', async () => {
            // Arrange
            const actor = createHostActor({ id: 'user-host' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-host',
                role: RoleEnum.HOST
            });

            // Act
            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.status).toBe('already_host');
            expect(result.data?.accommodation).toBeNull();
            // No DB writes when short-circuiting
            expect(accommodationModel.findOne).not.toHaveBeenCalled();
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });

        it.each([
            ['ADMIN', RoleEnum.ADMIN],
            ['CLIENT_MANAGER', RoleEnum.CLIENT_MANAGER],
            ['SUPER_ADMIN', RoleEnum.SUPER_ADMIN]
        ])('returns already_host for %s role', async (_label, role) => {
            const actor = createSuperAdminActor({ id: 'user-priv' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-priv',
                role
            });

            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            expect(result.data?.status).toBe('already_host');
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });
    });

    describe('validation', () => {
        it('returns VALIDATION_ERROR when name is missing', async () => {
            const actor = createActor({ id: 'user-005' });
            const result = await service.createForOnboarding(actor, {
                ...VALID_DRAFT_INPUT,
                name: undefined
            } as unknown as typeof VALID_DRAFT_INPUT);
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.data).toBeUndefined();
        });

        it('returns VALIDATION_ERROR when destinationId is not a UUID', async () => {
            const actor = createActor({ id: 'user-006' });
            const result = await service.createForOnboarding(actor, {
                ...VALID_DRAFT_INPUT,
                destinationId: 'not-a-uuid'
            });
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('returns VALIDATION_ERROR when destination is not a CITY', async () => {
            const actor = createActor({ id: 'user-007' });
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'user-007',
                role: RoleEnum.USER
            });
            (accommodationModel.findOne as Mock).mockResolvedValue(null);
            // Override destination to a non-CITY type.
            // @ts-expect-error: override for test
            service._destinationModel = {
                findById: vi
                    .fn()
                    .mockResolvedValue({ destinationType: DestinationTypeEnum.PROVINCE })
            };

            const result = await service.createForOnboarding(actor, VALID_DRAFT_INPUT);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.message).toMatch(/CITY/);
            expect(accommodationModel.create).not.toHaveBeenCalled();
        });
    });
});
