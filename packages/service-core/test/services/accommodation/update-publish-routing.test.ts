/**
 * update-publish-routing.test.ts
 *
 * Validates the routing logic in `AccommodationService.update`: ACTIVE
 * transitions are dispatched to the dedicated `publish()` flow when billing
 * dependencies are wired, and fall through to the legacy lifecycle hook path
 * when they are not.
 */

import type { AccommodationModel, UserModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
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
        // Confirm the publish path was taken. Since HOS-171 publish() does not touch
        // billing, so the eligibility check is what proves the routing happened.
        expect(deps.checkEligibility).toHaveBeenCalledWith('user-002', expect.anything());
    });

    it('promotes a PRIVATE draft to PUBLIC when activated without an explicit visibility', async () => {
        const deps = createPublishDeps();
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-promote',
            ownerId: 'user-005',
            lifecycleState: LifecycleStatusEnum.DRAFT,
            visibility: VisibilityEnum.PRIVATE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            visibility: VisibilityEnum.PUBLIC
        });
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'user-005',
            role: RoleEnum.USER
        });

        const actor = createActor({
            id: 'user-005',
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        // Only lifecycleState is sent — no explicit visibility — so the routing
        // passes callerSetVisibility=false and publish promotes PRIVATE -> PUBLIC.
        const result = await service.update(actor, 'acc-promote', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalledWith(
            { id: 'acc-promote' },
            expect.objectContaining({
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                visibility: VisibilityEnum.PUBLIC
            }),
            expect.anything()
        );
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

        expect(deps.checkEligibility).not.toHaveBeenCalled();
        expect(accommodationModel.update).toHaveBeenCalled();
    });
});

describe('AccommodationService.update — billing write-gate (SPEC-217, scoped to ACTIVE by HOS-217-followup)', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(helpers, 'generateSlug').mockResolvedValue('mock-slug');
        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
    });

    it('a. returns FORBIDDEN subscription_required when non-admin owner has lapsed subscription and the accommodation is ACTIVE', async () => {
        // Arrange
        const deps = createPublishDeps({
            checkEligibility: vi.fn().mockResolvedValue('subscription_required')
        });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-a',
            ownerId: 'user-host-a',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        // actor IS the owner — userModel.findById should NOT be called (perf path)
        const actor = createActor({
            id: 'user-host-a',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-a', { name: 'x' });

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.error?.message).toBe('subscription_required');
        expect(accommodationModel.update).not.toHaveBeenCalled();
    });

    it('a2. HOS-217-followup: does NOT gate edits to a DRAFT accommodation even when checkEligibility would return subscription_required', async () => {
        // Arrange — this is the exact bug scenario: a HOST with a non-owner plan
        // (checkEligibility would deny) must still be able to edit their own DRAFT.
        // Only publishing (DRAFT -> ACTIVE) requires an owner plan, not editing.
        const checkEligibility = vi.fn().mockResolvedValue('subscription_required');
        const deps = createPublishDeps({ checkEligibility });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-a2',
            ownerId: 'user-host-a2',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'draft-edit'
        });
        const actor = createActor({
            id: 'user-host-a2',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-a2', { name: 'draft-edit' });

        // Assert — the write-gate never even runs for a non-ACTIVE accommodation,
        // so checkEligibility is not invoked from it at all.
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
        expect(checkEligibility).not.toHaveBeenCalled();
    });

    it('a3. HOS-217-followup: does NOT gate edits to an INACTIVE accommodation even when checkEligibility would return subscription_required', async () => {
        // Arrange — editing an INACTIVE accommodation does not require a plan owner —
        // it is not public (checkCanView treats non-ACTIVE as non-visible); the plan
        // gate only applies to ACTIVE. This fixes the HOS-217-followup design decision
        // so a future change to `!== DRAFT` instead of `=== ACTIVE` gets caught here.
        const checkEligibility = vi.fn().mockResolvedValue('subscription_required');
        const deps = createPublishDeps({ checkEligibility });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-a3',
            ownerId: 'user-host-a3',
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'inactive-edit'
        });
        const actor = createActor({
            id: 'user-host-a3',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-a3', { name: 'inactive-edit' });

        // Assert — the write-gate never even runs for a non-ACTIVE accommodation,
        // so checkEligibility is not invoked from it at all.
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
        expect(checkEligibility).not.toHaveBeenCalled();
    });

    it('a4. HOS-217-followup: does NOT gate edits to an ARCHIVED accommodation even when checkEligibility would return subscription_required', async () => {
        // Arrange — same reasoning as (a3): ARCHIVED is not public either, so editing
        // it must not require an owner plan. Documents that the gate is scoped to
        // ACTIVE only, not "any non-DRAFT" state.
        const checkEligibility = vi.fn().mockResolvedValue('subscription_required');
        const deps = createPublishDeps({ checkEligibility });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-a4',
            ownerId: 'user-host-a4',
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'archived-edit'
        });
        const actor = createActor({
            id: 'user-host-a4',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-a4', { name: 'archived-edit' });

        // Assert — the write-gate never even runs for a non-ACTIVE accommodation,
        // so checkEligibility is not invoked from it at all.
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
        expect(checkEligibility).not.toHaveBeenCalled();
    });

    it('b. proceeds when owner has an active subscription and the accommodation is ACTIVE', async () => {
        // Arrange
        const deps = createPublishDeps({
            checkEligibility: vi.fn().mockResolvedValue('has_active_sub')
        });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-b',
            ownerId: 'user-host-b',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'Updated Name B'
        });
        const actor = createActor({
            id: 'user-host-b',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-b', { name: 'Updated Name B' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
        expect(deps.checkEligibility).toHaveBeenCalledWith('user-host-b', expect.anything());
    });

    it('b2. proceeds when owner has an owner-category plan and edits a DRAFT (no regression)', async () => {
        // Arrange — same "owner has a valid plan" case as (b), but on a DRAFT, where
        // the gate is skipped altogether rather than evaluated-and-passed.
        const checkEligibility = vi.fn().mockResolvedValue('has_active_sub');
        const deps = createPublishDeps({ checkEligibility });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-b2',
            ownerId: 'user-host-b2',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'Updated Name B2'
        });
        const actor = createActor({
            id: 'user-host-b2',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-b2', { name: 'Updated Name B2' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
    });

    it('c. proceeds when checkEligibility returns first_publish and the accommodation is ACTIVE', async () => {
        // Arrange
        const deps = createPublishDeps({
            checkEligibility: vi.fn().mockResolvedValue('first_publish')
        });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-c',
            ownerId: 'user-host-c',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'Updated Name C'
        });
        const actor = createActor({
            id: 'user-host-c',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-c', { name: 'Updated Name C' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
    });

    it('d. admin actor bypasses the gate regardless of eligibility result, on an ACTIVE accommodation', async () => {
        // Arrange
        const checkEligibility = vi.fn().mockResolvedValue('subscription_required');
        const deps = createPublishDeps({ checkEligibility });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-d',
            ownerId: 'user-host-d',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'admin-edit'
        });
        // Admin actor has ACCOMMODATION_UPDATE_ANY — gate must skip entirely
        const actor = createAdminActor({ id: 'admin-d' });

        // Act
        const result = await service.update(actor, 'acc-gate-d', { name: 'admin-edit' });

        // Assert — no FORBIDDEN, update proceeded
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
    });

    it('e. billing-exempt owner role bypasses checkEligibility (DB lookup path), on an ACTIVE accommodation', async () => {
        // Arrange — actor is NOT the owner so the fallback DB lookup runs
        const checkEligibility = vi.fn().mockResolvedValue('subscription_required');
        const deps = createPublishDeps({ checkEligibility });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-e',
            ownerId: 'user-client-manager',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'exempt-edit'
        });
        // userModel returns an owner with a billing-exempt role
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'user-client-manager',
            role: RoleEnum.CLIENT_MANAGER
        });
        // Actor is a different admin-level user (not the owner)
        const actor = createAdminActor({ id: 'another-admin' });

        // Act
        const result = await service.update(actor, 'acc-gate-e', { name: 'exempt-edit' });

        // Assert — gate was bypassed, no FORBIDDEN, and checkEligibility was NOT called
        expect(result.error).toBeUndefined();
        expect(checkEligibility).not.toHaveBeenCalled();
    });

    it('f. gate does not fire when publishDeps are not wired, regardless of lifecycle state', async () => {
        // Arrange — service built without billing deps
        const service = buildService(accommodationModel, userModel, null);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-f',
            ownerId: 'user-host-f',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'no-billing'
        });
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'user-host-f',
            role: RoleEnum.HOST
        });
        const actor = createActor({
            id: 'user-host-f',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-f', { name: 'no-billing' });

        // Assert — regular update path, no FORBIDDEN
        expect(result.error).toBeUndefined();
        expect(accommodationModel.update).toHaveBeenCalled();
    });

    it('g. perf: userModel.findById is NOT called when actor is the owner, on an ACTIVE accommodation', async () => {
        // Arrange — actor IS the owner; the optimised path reuses actor.role
        const checkEligibility = vi.fn().mockResolvedValue('has_active_sub');
        const deps = createPublishDeps({ checkEligibility });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-gate-g',
            ownerId: 'user-host-g',
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            name: 'perf-check'
        });
        const actor = createActor({
            id: 'user-host-g',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });

        // Act
        const result = await service.update(actor, 'acc-gate-g', { name: 'perf-check' });

        // Assert — update succeeded, eligibility was checked, but no extra DB lookup
        expect(result.error).toBeUndefined();
        // ctx is undefined when called without explicit context — verify only the ownerId arg
        expect(checkEligibility).toHaveBeenCalledOnce();
        expect((checkEligibility as Mock).mock.calls[0]?.[0]).toBe('user-host-g');
        // The perf optimisation: userModel.findById must NOT be called for the
        // write-gate's billing-exempt role check when actor.id === ownerId — the
        // single call observed here comes from the unrelated `_assignHostRoleIfNeeded`
        // afterUpdate hook, which fires on any ACTIVE-state update regardless of the
        // write-gate. If the perf optimisation regressed, the gate would add a SECOND
        // call, so exactly-once (not zero) is the correct assertion on an ACTIVE fixture.
        expect(userModel.findById).toHaveBeenCalledTimes(1);
    });
});
