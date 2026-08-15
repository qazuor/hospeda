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

// HOS-296: the owner's billing-exempt hats come from `user_role`, read through
// this primitive, NOT from the `users` row the model mock returns. Each test
// below stubs the hats it needs via `getUserRolesMock`.
const grantRoleMock = vi.hoisted(() => vi.fn(async () => ({ data: undefined })));
const getUserRolesMock = vi.hoisted(() => vi.fn(async () => [] as unknown[]));

vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    grantRole: grantRoleMock,
    getUserRoles: getUserRolesMock
}));

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

/**
 * Media model stub. Publishing now reads the listing's media, because the main
 * image is a publish requirement (owner decision, 14/08 — H-101 mitad A): the
 * hub used to warn "Sin fotos" while publishing succeeded anyway, leaving a
 * public page rendering a broken `<img>`.
 *
 * Without this stub the service would build a real `AccommodationMediaModel`
 * and every test here would need a database.
 *
 * @param params - Whether the listing has a featured image.
 * @returns A model mock exposing only what `attachComposedMedia` calls.
 */
function createMediaModelMock({ hasFeatured }: { readonly hasFeatured: boolean }) {
    return {
        findByAccommodations: vi.fn(
            async ({ accommodationIds }: { accommodationIds: string[] }) => {
                const rows = hasFeatured
                    ? [
                          {
                              url: 'https://cdn.example.test/main.jpg',
                              isFeatured: true,
                              state: 'visible',
                              sortOrder: 0,
                              moderationState: 'APPROVED'
                          }
                      ]
                    : [];
                return new Map(accommodationIds.map((id) => [id, rows]));
            }
        )
    };
}

function buildService(
    model: ReturnType<typeof createMockBaseModel>,
    userModel: UserModel,
    publishDeps?: AccommodationPublishDeps | null,
    // Defaults to "has a main image" so the suites that predate this
    // requirement keep testing what they were written to test.
    mediaModel: ReturnType<typeof createMediaModelMock> = createMediaModelMock({
        hasFeatured: true
    })
): AccommodationService {
    const mockLogger = createLoggerMock();
    return new AccommodationService(
        { logger: mockLogger },
        model as AccommodationModel,
        null,
        userModel,
        publishDeps ?? null,
        undefined,
        undefined,
        undefined,
        undefined,
        mediaModel as never
    );
}

describe('AccommodationService.publish', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;

    beforeEach(() => {
        vi.clearAllMocks();
        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
        getUserRolesMock.mockResolvedValue([RoleEnum.USER]);
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
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'user-owner' });
            getUserRolesMock.mockResolvedValue([RoleEnum.USER]);
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
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'admin-owner' });
            getUserRolesMock.mockResolvedValue([RoleEnum.USER, role]);
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
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'host-006' });
            getUserRolesMock.mockResolvedValue([RoleEnum.USER]);
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
                id: 'user-007'
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
                id: 'user-008'
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
                id: 'user-008'
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
                id: 'host-incomplete-001'
            });

            const actor = createHostActor({ id: 'host-incomplete-001' });
            const result = await service.publish(actor, 'acc-incomplete-001');

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(accommodationModel.update).not.toHaveBeenCalled();
            // Billing is now consulted FIRST (H-99). This assertion used to read
            // `.not.toHaveBeenCalled()`, back when completeness ran ahead of it —
            // which is exactly what made an owner with no plan fill in `bathrooms`,
            // retry, and only then meet the subscription wall.
            expect(deps.checkEligibility).toHaveBeenCalled();
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
                id: 'host-incomplete-002'
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
                id: 'host-complete-001'
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

    describe('the rejection names the field that actually failed (H-94)', () => {
        /**
         * Builds a DRAFT that meets every requirement except the ones removed.
         *
         * @param params - Field overrides and the listing id.
         * @returns The mock accommodation.
         */
        function draftMissing(id: string, extraInfo: Record<string, number>) {
            return createMockAccommodation({
                id,
                ownerId: `owner-${id}`,
                lifecycleState: LifecycleStatusEnum.DRAFT,
                extraInfo
            });
        }

        it('names ONLY bathrooms when that is the only missing field', async () => {
            // Arrange — the exact production repro: the draft held
            // {bedrooms: 3, capacity: 11, minNights: 1} and only `bathrooms` was
            // absent, yet the host was told that guests, bedrooms AND bathrooms
            // were all missing. Two of those three claims were false.
            const service = buildService(accommodationModel, userModel, createPublishDeps());
            const accommodation = draftMissing('acc-h94-001', {
                capacity: 11,
                minNights: 1,
                bedrooms: 3
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'owner-acc-h94-001' });

            // Act
            const result = await service.publish(
                createHostActor({ id: 'owner-acc-h94-001' }),
                'acc-h94-001'
            );

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('PUBLISH_REQUIREMENTS_MISSING:bathrooms');
        });

        it('names minNights, which the editor never mentioned anywhere', async () => {
            // Arrange
            const service = buildService(accommodationModel, userModel, createPublishDeps());
            const accommodation = draftMissing('acc-h94-002', {
                capacity: 4,
                bedrooms: 2,
                bathrooms: 1
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'owner-acc-h94-002' });

            // Act
            const result = await service.publish(
                createHostActor({ id: 'owner-acc-h94-002' }),
                'acc-h94-002'
            );

            // Assert
            expect(result.error?.reason).toBe('PUBLISH_REQUIREMENTS_MISSING:minNights');
        });

        it('carries the reason on the error, not in details, so production keeps it', async () => {
            // Arrange — `details` is stripped whenever HOSPEDA_API_DEBUG_ERRORS is
            // false, which production requires. A field list sent there would
            // never reach a real host.
            const service = buildService(accommodationModel, userModel, createPublishDeps());
            const accommodation = draftMissing('acc-h94-003', {});
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'owner-acc-h94-003' });

            // Act
            const result = await service.publish(
                createHostActor({ id: 'owner-acc-h94-003' }),
                'acc-h94-003'
            );

            // Assert
            expect(result.error?.reason).toBe(
                'PUBLISH_REQUIREMENTS_MISSING:capacity,minNights,bedrooms,bathrooms'
            );
        });
    });

    describe('the main image blocks publishing (H-101 mitad A)', () => {
        it('refuses to publish a listing with no main image', async () => {
            // Arrange — everything else complete, no featured image. This used to
            // publish fine and render a broken <img> on the indexable public page.
            const service = buildService(
                accommodationModel,
                userModel,
                createPublishDeps(),
                createMediaModelMock({ hasFeatured: false })
            );
            const accommodation = createMockAccommodation({
                id: 'acc-nophoto-001',
                ownerId: 'host-nophoto-001',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 }
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'host-nophoto-001' });

            // Act
            const result = await service.publish(
                createHostActor({ id: 'host-nophoto-001' }),
                'acc-nophoto-001'
            );

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(result.error?.reason).toBe('PUBLISH_REQUIREMENTS_MISSING:mainImage');
            expect(accommodationModel.update).not.toHaveBeenCalled();
        });
    });

    describe('guard order: subscription before completeness (H-99)', () => {
        it('reports the missing subscription, not the missing bathroom', async () => {
            // Arrange — an owner with neither a plan nor complete data. Before
            // H-99 they were sent to fill in `bathrooms` first, and met the
            // subscription wall only on the retry.
            const deps = createPublishDeps({
                checkEligibility: vi.fn().mockResolvedValue('subscription_required')
            });
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-noplan-001',
                ownerId: 'host-noplan-001',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                extraInfo: { capacity: 4 }
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({ id: 'host-noplan-001' });

            // Act
            const result = await service.publish(
                createHostActor({ id: 'host-noplan-001' }),
                'acc-noplan-001'
            );

            // Assert — the rejection the host cannot resolve by editing wins.
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(result.error?.message).toBe('subscription_required');
        });
    });
});
