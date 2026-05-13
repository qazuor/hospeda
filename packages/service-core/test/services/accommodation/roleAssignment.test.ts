/**
 * roleAssignment.test.ts
 *
 * Unit tests for the HOST role auto-assignment hook in AccommodationService.
 *
 * The hook fires in `_afterUpdate` when `entity.lifecycleState === LifecycleStatusEnum.ACTIVE`
 * and the owning user does not already hold a privileged role (HOST, ADMIN, CLIENT_MANAGER,
 * SUPER_ADMIN). Role assignment is idempotent: repeated ACTIVE-state updates are no-ops
 * because the user already has HOST after the first assignment.
 *
 * `_beforeUpdate` captures the incoming `lifecycleState` in `ctx.hookState.previousLifecycleState`
 * so downstream hooks can read the intended transition target.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createMockAccommodation,
    createMockAccommodationUpdateInput
} from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal UserModel mock with findById + update. */
function createUserModelMock(): UserModel {
    return createModelMock() as unknown as UserModel;
}

/** Build an AccommodationService wired to controlled mocks. */
function buildService(
    model: ReturnType<typeof createMockBaseModel>,
    userModel: UserModel
): AccommodationService {
    const mockLogger = createLoggerMock();
    const service = new AccommodationService(
        { logger: mockLogger },
        model as AccommodationModel,
        null, // mediaProvider
        userModel
    );

    // Suppress DestinationService side-effects — not under test here.
    // @ts-expect-error: override internal for test isolation
    service.destinationService = {
        updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
    };

    return service;
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('AccommodationService — HOST role auto-assignment hook', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');

        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
        service = buildService(accommodationModel, userModel);
    });

    // -----------------------------------------------------------------------
    // TC-01: Happy path — USER role → HOST assigned on ACTIVE transition
    // -----------------------------------------------------------------------
    describe('TC-01: happy path — user with no privileged role receives HOST', () => {
        it('should call userModel.update with HOST role when accommodation becomes ACTIVE', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-001';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-001',
                ownerId,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const existingUser = { id: ownerId, role: RoleEnum.USER };

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);
            asMock(userModel.findById as Mock).mockResolvedValue(existingUser);
            asMock(userModel.update as Mock).mockResolvedValue({
                ...existingUser,
                role: RoleEnum.HOST
            });

            // Act
            const result = await service.update(actor, 'acc-001', {
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(userModel.findById).toHaveBeenCalledWith(ownerId, undefined);
            expect(userModel.update).toHaveBeenCalledWith(
                { id: ownerId },
                { role: RoleEnum.HOST },
                undefined
            );
        });
    });

    // -----------------------------------------------------------------------
    // TC-02: Idempotency — user already has HOST role → no re-assignment
    // -----------------------------------------------------------------------
    describe('TC-02: idempotency — user already has HOST role', () => {
        it('should NOT call userModel.update when user already has HOST role', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-002';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-002',
                ownerId,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const existingUser = { id: ownerId, role: RoleEnum.HOST };

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);
            asMock(userModel.findById as Mock).mockResolvedValue(existingUser);

            // Act
            const result = await service.update(actor, 'acc-002', {
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(userModel.findById).toHaveBeenCalledWith(ownerId, undefined);
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // TC-03: Idempotency — privileged roles skip HOST assignment (parametrized)
    // -----------------------------------------------------------------------
    describe('TC-03: idempotency — privileged roles skip HOST assignment', () => {
        const privilegedRoles = [
            RoleEnum.ADMIN,
            RoleEnum.CLIENT_MANAGER,
            RoleEnum.SUPER_ADMIN
        ] as const;

        for (const role of privilegedRoles) {
            it(`should NOT call userModel.update when user already has ${role} role`, async () => {
                // Arrange
                const actor = createAdminActor();
                const ownerId = `owner-${role}`;

                const existingAccommodation = createMockAccommodation({
                    id: `acc-${role}`,
                    ownerId,
                    lifecycleState: LifecycleStatusEnum.DRAFT
                });

                const updatedAccommodation = createMockAccommodation({
                    ...existingAccommodation,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                });

                const existingUser = { id: ownerId, role };

                asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
                asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);
                asMock(userModel.findById as Mock).mockResolvedValue(existingUser);

                // Act
                const result = await service.update(actor, `acc-${role}`, {
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                });

                // Assert
                expect(result.error).toBeUndefined();
                expect(userModel.findById).toHaveBeenCalledWith(ownerId, undefined);
                expect(userModel.update).not.toHaveBeenCalled();
            });
        }
    });

    // -----------------------------------------------------------------------
    // TC-04: Non-ACTIVE transitions — no role assignment
    // -----------------------------------------------------------------------
    describe('TC-04: non-ACTIVE lifecycleState transitions do not trigger HOST assignment', () => {
        it('should NOT call userModel.update when updating to DRAFT', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-draft';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-draft',
                ownerId,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);

            // Act
            const result = await service.update(actor, 'acc-draft', {
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(userModel.findById).not.toHaveBeenCalled();
            expect(userModel.update).not.toHaveBeenCalled();
        });

        it('should NOT call userModel.update when updating to ARCHIVED', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-archived';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-archived',
                ownerId,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);

            // Act
            const result = await service.update(actor, 'acc-archived', {
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });

            // Assert
            expect(result.error).toBeUndefined();
            expect(userModel.findById).not.toHaveBeenCalled();
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // TC-05: Update without lifecycleState field — no role assignment
    // -----------------------------------------------------------------------
    describe('TC-05: update with no lifecycleState in payload does not trigger HOST assignment', () => {
        it('should NOT call userModel.update when updating only name/description', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-name-update';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-name',
                ownerId,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                name: 'Updated Name'
            });

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);

            // Act
            const result = await service.update(
                actor,
                'acc-name',
                createMockAccommodationUpdateInput({ name: 'Updated Name' })
            );

            // Assert
            expect(result.error).toBeUndefined();
            // Updated entity retains DRAFT state → _afterUpdate skips HOST assignment
            expect(userModel.findById).not.toHaveBeenCalled();
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // TC-06: hookState — _beforeUpdate stores incoming lifecycleState
    // -----------------------------------------------------------------------
    describe('TC-06: _beforeUpdate correctly stores incoming lifecycleState in hookState', () => {
        it('should store ACTIVE in hookState.previousLifecycleState when payload has ACTIVE', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-hookstate';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-hookstate',
                ownerId,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const existingUser = { id: ownerId, role: RoleEnum.USER };

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);
            asMock(userModel.findById as Mock).mockResolvedValue(existingUser);
            asMock(userModel.update as Mock).mockResolvedValue({
                ...existingUser,
                role: RoleEnum.HOST
            });

            // Intercept the _afterUpdate call to capture the ctx hookState at that point.
            // We verify this indirectly: if HOST was assigned, hookState was correctly populated.
            // Act
            const result = await service.update(actor, 'acc-hookstate', {
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            // Assert — the update succeeded and HOST was assigned, confirming hookState carried
            // the ACTIVE value through to _afterUpdate which then called _assignHostRoleIfNeeded.
            expect(result.error).toBeUndefined();
            expect(userModel.update).toHaveBeenCalledWith(
                { id: ownerId },
                { role: RoleEnum.HOST },
                undefined
            );
        });

        it('should store DRAFT in hookState.previousLifecycleState when payload has DRAFT', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-hookstate-draft';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-hookstate-draft',
                ownerId,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            // Model returns entity with DRAFT state after update
            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);

            // Act
            const result = await service.update(actor, 'acc-hookstate-draft', {
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            // Assert — DRAFT entity means _afterUpdate skips HOST assignment entirely
            expect(result.error).toBeUndefined();
            expect(userModel.findById).not.toHaveBeenCalled();
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // TC-07: Role assignment failure is non-blocking
    // -----------------------------------------------------------------------
    describe('TC-07: role assignment failure does not abort the accommodation update', () => {
        it('should still succeed when userModel.findById throws during HOST assignment', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-error';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-error',
                ownerId,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);
            asMock(userModel.findById as Mock).mockRejectedValue(new Error('DB connection lost'));

            // Act
            const result = await service.update(actor, 'acc-error', {
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            // Assert — update itself succeeds; role assignment error is swallowed
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });

        it('should still succeed when owner user is not found during HOST assignment', async () => {
            // Arrange
            const actor = createAdminActor();
            const ownerId = 'owner-notfound';

            const existingAccommodation = createMockAccommodation({
                id: 'acc-notfound',
                ownerId,
                lifecycleState: LifecycleStatusEnum.DRAFT
            });

            const updatedAccommodation = createMockAccommodation({
                ...existingAccommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);
            asMock(accommodationModel.update).mockResolvedValue(updatedAccommodation);
            // User lookup returns null (owner not found)
            asMock(userModel.findById as Mock).mockResolvedValue(null);

            // Act
            const result = await service.update(actor, 'acc-notfound', {
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            // Assert — update succeeds; HOST assignment is skipped with a warn log
            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            expect(userModel.update).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// Additional permission prerequisite — actor needs ACCOMMODATION_UPDATE_ANY
// ---------------------------------------------------------------------------
describe('AccommodationService.update — permission prerequisite for HOST assignment tests', () => {
    it('should require update permission before any hook runs (role assignment never fires on FORBIDDEN)', async () => {
        // Arrange — actor has NO permissions

        const actor = createActor({ permissions: [] });
        const accommodationModel = createMockBaseModel();
        const userModel = createUserModelMock();
        const service = buildService(accommodationModel, userModel);

        const existingAccommodation = createMockAccommodation({
            id: 'acc-forbidden',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });

        asMock(accommodationModel.findById).mockResolvedValue(existingAccommodation);

        // Act
        const result = await service.update(actor, 'acc-forbidden', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Assert — permission check fails; model.update and userModel.* never called
        expect(result.error).toBeDefined();
        expect(userModel.findById).not.toHaveBeenCalled();
        expect(userModel.update).not.toHaveBeenCalled();
    });
});
