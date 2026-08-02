/**
 * roleAssignment.test.ts
 *
 * Unit tests for the HOST role grant hook in `AccommodationService` (HOS-296 G-6).
 *
 * ## What changed, and why this file was rewritten rather than adapted
 *
 * Before HOS-296 the hook was `update(users, { role: HOST })` — a DESTRUCTIVE
 * scalar overwrite guarded by `PRIVILEGED_ROLES = {HOST, ADMIN, CLIENT_MANAGER,
 * SUPER_ADMIN}`. That set omits `COMMERCE_OWNER`, `SPONSOR` and `EDITOR`, so
 * activating an accommodation owned by any of them silently destroyed their hat.
 * The previous version of this file asserted exactly that behaviour (it
 * parametrised over the privileged set and asserted `userModel.update` was
 * called with `{ role: HOST }`), so it encoded the bug as the contract.
 *
 * The hook is now an unconditional, additive, idempotent `grantRole`. The guard
 * disappears because granting can no longer remove anything, and the
 * "is it needed?" question is answered by the `(user_id, role)` primary key
 * inside the primitive rather than by a pre-read here.
 *
 * The regression test for AC-2 is pinned DIRECTLY on `_assignHostRoleIfNeeded`
 * rather than on `service.update`, so it cannot be made to pass by a change in
 * how the hook is reached.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as helpers from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceContext } from '../../../src/types';
import { ServiceError } from '../../../src/types';
import {
    createMockAccommodation,
    createMockAccommodationUpdateInput
} from '../../factories/accommodationFactory';
import { createActor, createAdminActor } from '../../factories/actorFactory';
import { createMockBaseModel } from '../../factories/baseServiceFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

const grantRoleMock = vi.hoisted(() => vi.fn());
const getUserRolesMock = vi.hoisted(() => vi.fn(async () => []));

vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    grantRole: grantRoleMock,
    // HOS-296: the module also exports the read primitive, and the
    // billing-exempt-owner branch of publish/update calls it. A module mock
    // that omits it turns that branch into "getUserRoles is not a function"
    // — an INTERNAL_ERROR that looks nothing like a role problem.
    getUserRoles: getUserRolesMock
}));

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

/**
 * Invokes the private hook directly.
 *
 * AC-2 requires the regression to be pinned on `_assignHostRoleIfNeeded`
 * itself, not on a caller, so the cast is deliberate.
 */
function callAssignHostRole(
    service: AccommodationService,
    ownerId: string,
    ctx: ServiceContext
): Promise<void> {
    return (
        service as unknown as {
            _assignHostRoleIfNeeded: (ownerId: string, ctx: ServiceContext) => Promise<void>;
        }
    )._assignHostRoleIfNeeded(ownerId, ctx);
}

// ---------------------------------------------------------------------------
// AC-2 / G-6 — the regression this whole change exists for
// ---------------------------------------------------------------------------

describe('AccommodationService._assignHostRoleIfNeeded — G-6 regression (AC-2)', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        grantRoleMock.mockResolvedValue({ data: undefined });
        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
        service = buildService(accommodationModel, userModel);
    });

    // The three roles the old `PRIVILEGED_ROLES` guard omitted, i.e. exactly the
    // hats the pre-HOS-296 hook destroyed on every accommodation activation.
    const hatsTheOldGuardDestroyed = [
        RoleEnum.COMMERCE_OWNER,
        RoleEnum.SPONSOR,
        RoleEnum.EDITOR
    ] as const;

    for (const heldRole of hatsTheOldGuardDestroyed) {
        it(`grants HOST additively to a ${heldRole} owner without writing users.role`, async () => {
            // Arrange — the owner already wears a hat the old guard did not
            // protect. `findById` is stubbed with that hat on purpose: without
            // it the OLD implementation short-circuits on "owner not found" and
            // the `userModel.update` assertion below would be vacuous.
            const ownerId = `owner-${heldRole}`;
            const ctx: ServiceContext = {};
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: ownerId,
                role: heldRole
            });

            // Act
            await callAssignHostRole(service, ownerId, ctx);

            // Assert — NOTHING that could remove the hat the owner already
            // holds. This is the assertion that fails against the pre-HOS-296
            // `update(users, { role: HOST })` implementation.
            expect(userModel.update).not.toHaveBeenCalled();

            // ...and exactly one additive grant.
            expect(grantRoleMock).toHaveBeenCalledTimes(1);
            expect(grantRoleMock).toHaveBeenCalledWith({
                userId: ownerId,
                role: RoleEnum.HOST,
                grantedBy: null,
                reason: 'accommodation_activated',
                ctx
            });
        });
    }

    it('does not pre-read the user — idempotency lives in the (user_id, role) PK', async () => {
        // Arrange
        const ctx: ServiceContext = {};

        // Act
        await callAssignHostRole(service, 'owner-no-read', ctx);

        // Assert — the removed `findById` was the read half of the check-then-act
        // that made the old hook both racy and destructive.
        expect(userModel.findById).not.toHaveBeenCalled();
        expect(grantRoleMock).toHaveBeenCalledTimes(1);
    });

    it('still grants when the owner already holds HOST (idempotent no-op downstream)', async () => {
        // Arrange — `PRIVILEGED_ROLES` used to short-circuit here.
        const ctx: ServiceContext = {};

        // Act
        await callAssignHostRole(service, 'owner-already-host', ctx);

        // Assert
        expect(grantRoleMock).toHaveBeenCalledTimes(1);
    });

    it('forwards the caller context so the grant enlists in an open transaction', async () => {
        // Arrange
        const ctx = { tx: { marker: 'caller-tx' } } as unknown as ServiceContext;

        // Act
        await callAssignHostRole(service, 'owner-tx', ctx);

        // Assert
        expect(grantRoleMock).toHaveBeenCalledWith(expect.objectContaining({ ctx }));
    });

    it('propagates a grant failure instead of swallowing it', async () => {
        // Arrange — the pre-HOS-296 hook logged and returned here, which is the
        // "fails silently in both directions" half of G-6.
        grantRoleMock.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'grant exploded')
        });

        // Act + Assert
        await expect(callAssignHostRole(service, 'owner-fail', {})).rejects.toThrow(
            /grant exploded/
        );
    });
});

// ---------------------------------------------------------------------------
// The hook as reached through `service.update`
// ---------------------------------------------------------------------------

describe('AccommodationService.update — HOST grant on ACTIVE transition', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;
    let service: AccommodationService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
        grantRoleMock.mockResolvedValue({ data: undefined });

        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
        service = buildService(accommodationModel, userModel);
    });

    /** Wires the model mocks for an update landing on `finalState`. */
    function arrangeUpdate(params: {
        id: string;
        ownerId: string;
        initialState: LifecycleStatusEnum;
        finalState: LifecycleStatusEnum;
    }): void {
        const existing = createMockAccommodation({
            id: params.id,
            ownerId: params.ownerId,
            lifecycleState: params.initialState
        });
        asMock(accommodationModel.findById).mockResolvedValue(existing);
        asMock(accommodationModel.update).mockResolvedValue(
            createMockAccommodation({ ...existing, lifecycleState: params.finalState })
        );
    }

    it('grants HOST to the owner when the accommodation becomes ACTIVE', async () => {
        // Arrange
        const actor = createAdminActor();
        arrangeUpdate({
            id: 'acc-001',
            ownerId: 'owner-001',
            initialState: LifecycleStatusEnum.DRAFT,
            finalState: LifecycleStatusEnum.ACTIVE
        });

        // Act
        const result = await service.update(actor, 'acc-001', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(grantRoleMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-001',
                role: RoleEnum.HOST,
                reason: 'accommodation_activated'
            })
        );
    });

    it.each([
        LifecycleStatusEnum.DRAFT,
        LifecycleStatusEnum.ARCHIVED
    ])('does NOT grant when the accommodation lands on %s', async (finalState) => {
        // Arrange
        const actor = createAdminActor();
        arrangeUpdate({
            id: `acc-${finalState}`,
            ownerId: `owner-${finalState}`,
            initialState: LifecycleStatusEnum.ACTIVE,
            finalState
        });

        // Act
        const result = await service.update(actor, `acc-${finalState}`, {
            lifecycleState: finalState
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(grantRoleMock).not.toHaveBeenCalled();
    });

    it('does NOT grant on an edit that leaves the listing in DRAFT', async () => {
        // Arrange
        const actor = createAdminActor();
        arrangeUpdate({
            id: 'acc-name',
            ownerId: 'owner-name-update',
            initialState: LifecycleStatusEnum.DRAFT,
            finalState: LifecycleStatusEnum.DRAFT
        });

        // Act
        const result = await service.update(
            actor,
            'acc-name',
            createMockAccommodationUpdateInput({ name: 'Updated Name' })
        );

        // Assert
        expect(result.error).toBeUndefined();
        expect(grantRoleMock).not.toHaveBeenCalled();
    });

    it('fails the update when the grant fails, rather than reporting success', async () => {
        // Arrange — the deliberate behaviour change from HOS-296: the write is
        // now additive, so "best effort" no longer buys safety, it only hides
        // an owner who never received their hat.
        const actor = createAdminActor();
        arrangeUpdate({
            id: 'acc-grant-fail',
            ownerId: 'owner-grant-fail',
            initialState: LifecycleStatusEnum.DRAFT,
            finalState: LifecycleStatusEnum.ACTIVE
        });
        grantRoleMock.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'grant exploded')
        });

        // Act
        const result = await service.update(actor, 'acc-grant-fail', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Assert
        expect(result.error).toBeDefined();
    });

    it('never reaches the grant when the actor lacks update permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        arrangeUpdate({
            id: 'acc-forbidden',
            ownerId: 'owner-forbidden',
            initialState: LifecycleStatusEnum.DRAFT,
            finalState: LifecycleStatusEnum.ACTIVE
        });

        // Act
        const result = await service.update(actor, 'acc-forbidden', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Assert
        expect(result.error).toBeDefined();
        expect(grantRoleMock).not.toHaveBeenCalled();
    });
});
