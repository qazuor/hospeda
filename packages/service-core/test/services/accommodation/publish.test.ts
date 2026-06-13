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
import {
    AccommodationPatchInputSchema,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
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

    describe('billing-exempt owner branch', () => {
        // ADMIN / SUPER_ADMIN / CLIENT_MANAGER are exempt from the billing
        // eligibility check (they publish on behalf of the platform without a
        // subscription). Regular HOST users go through the eligibility flow.
        it.each([RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN, RoleEnum.CLIENT_MANAGER])(
            'skips eligibility entirely when the owner is %s',
            async (role) => {
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
                expect(deps.startTrial).not.toHaveBeenCalled();
                // Role promotion never happens in publish — promotion is done at
                // draft creation. The user model should not be touched here.
                expect(userModel.update).not.toHaveBeenCalled();
            }
        );
    });

    describe('first publish for HOST owner (trial creation)', () => {
        // The owner is already HOST by the time `publish` runs (promoted at
        // draft creation). The trial is what gets created here.
        it('calls startTrial outside tx, then flips lifecycleState inside tx', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-005',
                ownerId: 'host-005',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                // Onboarding drafts are created PRIVATE — this is the case publish
                // must promote to PUBLIC.
                visibility: VisibilityEnum.PRIVATE
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-005',
                role: RoleEnum.HOST
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createHostActor({ id: 'host-005' });
            const result = await service.publish(actor, 'acc-005');

            expect(result.error).toBeUndefined();
            expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
            // Regression (SPEC-217): publishing must also promote visibility to
            // PUBLIC. Onboarding drafts are created PRIVATE; without this the
            // public detail-by-slug endpoint 404s the freshly-published listing.
            expect(accommodationModel.update).toHaveBeenCalledWith(
                { id: 'acc-005' },
                expect.objectContaining({
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    visibility: VisibilityEnum.PUBLIC
                }),
                expect.anything()
            );
            expect(deps.checkEligibility).toHaveBeenCalledWith('host-005', expect.anything());
            expect(deps.startTrial).toHaveBeenCalledWith({
                ownerId: 'host-005',
                accommodationId: 'acc-005'
            });
            // Role promotion no longer happens in publish — that's done at
            // draft creation. The user model stays untouched.
            expect(userModel.update).not.toHaveBeenCalled();
            // No compensation when tx succeeds
            expect(deps.cancelTrial).not.toHaveBeenCalled();
        });

        // SPEC-222 Part 1 (AC-1): a single structured linkage line is emitted at
        // first publish, tying the trial subscription to the accommodation that
        // triggered it and its owner. Searching logs by any of these ids surfaces
        // the whole linkage even though trials are per-owner.
        it('emits a structured linkage log line at first publish', async () => {
            const deps = createPublishDeps();
            const logger = createLoggerMock();
            const service = new AccommodationService(
                { logger },
                accommodationModel as AccommodationModel,
                null,
                userModel,
                deps
            );
            const accommodation = createMockAccommodation({
                id: 'acc-link',
                ownerId: 'host-link',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                visibility: VisibilityEnum.PRIVATE
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-link',
                role: RoleEnum.HOST
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createHostActor({ id: 'host-link' });
            const result = await service.publish(actor, 'acc-link');

            expect(result.error).toBeUndefined();
            expect(logger.info).toHaveBeenCalledWith(
                {
                    subscriptionId: 'qzpay-sub-001',
                    accommodationId: 'acc-link',
                    ownerId: 'host-link',
                    planSlug: 'owner-basico',
                    eligibility: 'first_publish'
                },
                '[accommodation.publish] trial subscription linkage'
            );
        });

        // Regression (SPEC-217): publish must NOT clobber a deliberately-set
        // RESTRICTED (or PUBLIC) visibility — only a PRIVATE onboarding draft is
        // promoted. A RESTRICTED accommodation activated by an admin must stay
        // RESTRICTED, never silently leak to the public site.
        it('preserves a non-PRIVATE visibility on publish (no clobber)', async () => {
            const deps = createPublishDeps();
            const service = buildService(accommodationModel, userModel, deps);
            const accommodation = createMockAccommodation({
                id: 'acc-restricted',
                ownerId: 'host-restricted',
                lifecycleState: LifecycleStatusEnum.DRAFT,
                visibility: VisibilityEnum.RESTRICTED
            });
            (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
            asMock(userModel.findById as Mock).mockResolvedValue({
                id: 'host-restricted',
                role: RoleEnum.HOST
            });
            (accommodationModel.update as Mock).mockResolvedValue({
                ...accommodation,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });

            const actor = createHostActor({ id: 'host-restricted' });
            const result = await service.publish(actor, 'acc-restricted');

            expect(result.error).toBeUndefined();
            // The update flips lifecycleState but does NOT write a visibility key.
            expect(accommodationModel.update).toHaveBeenCalledWith(
                { id: 'acc-restricted' },
                expect.not.objectContaining({ visibility: expect.anything() }),
                expect.anything()
            );
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

/**
 * SPEC-217 — host-07c reproduction at the SERVICE layer.
 *
 * host-07c (apps/e2e/tests/host/host-07c-qzpay-timeout.spec.ts) PATCHes a DRAFT
 * accommodation with `{ lifecycleState: 'ACTIVE' }` and NOTHING else, expecting a
 * 5xx when the armed QZPay `startTrial` fault fires.
 *
 * These tests pin the SERVICE contract: given a CLEAN `{ lifecycleState: 'ACTIVE' }`
 * payload, `AccommodationService.update()` routes through `publish()` and reaches
 * `startTrial`. With a clean payload `restFields` is empty (the only key,
 * `lifecycleState`, is stripped), so `super.update()` is never called and `update()`
 * delegates straight to `publish()`.
 *
 * HISTORY: before the SPEC-217 schema-default fix, the real admin PATCH route did
 * NOT reach the service with a clean payload. `AccommodationPatchInputSchema`
 * (`.partial()`) re-injected `.default()` values (`lifecycleState:'ACTIVE'`,
 * `visibility:'PUBLIC'`, `moderationState:'PENDING'`, `isFeatured:false`,
 * `reviewsCount:0`, `averageRating:0`) on EVERY parse. Those extra keys made
 * `restFields` non-empty, so `super.update()` ran, re-injected `lifecycleState:'ACTIVE'`,
 * flipped the row to ACTIVE, and `publish()` then early-returned idempotently —
 * bypassing `startTrial` and returning 200 instead of 5xx. `stripShapeDefaults`
 * (packages/schemas/src/utils/utils.ts) removed the default injection; the FAITHFUL
 * tests below now drive the schema-parsed payload through `update()` and assert the
 * trial flow is reached. The service publish flow itself was never the defect.
 */
describe('AccommodationService.update → publish routing (host-07c reproduction)', () => {
    let accommodationModel: ReturnType<typeof createMockBaseModel>;
    let userModel: UserModel;

    beforeEach(() => {
        vi.clearAllMocks();
        accommodationModel = createMockBaseModel();
        userModel = createUserModelMock();
    });

    it('invokes startTrial when a HOST publishes a DRAFT acc via update({lifecycleState:ACTIVE}) only', async () => {
        const deps = createPublishDeps(); // checkEligibility → 'first_publish'
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-07c',
            ownerId: 'host-07c',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'host-07c',
            role: RoleEnum.HOST
        });
        (accommodationModel.update as Mock).mockResolvedValue({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        const actor = createHostActor({ id: 'host-07c' });
        const result = await service.update(actor, 'acc-07c', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        } as never);

        expect(result.error).toBeUndefined();
        expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        // The decisive assertion: the publish flow DID reach the billing trial.
        expect(deps.startTrial).toHaveBeenCalledWith({
            ownerId: 'host-07c',
            accommodationId: 'acc-07c'
        });
    });

    it('surfaces SERVICE_UNAVAILABLE with no DB write when startTrial fails (host-07c fault contract via update path)', async () => {
        const deps = createPublishDeps({
            startTrial: vi.fn().mockRejectedValue(new Error('QZPay timeout'))
        });
        const service = buildService(accommodationModel, userModel, deps);
        const accommodation = createMockAccommodation({
            id: 'acc-07c-fail',
            ownerId: 'host-07c-fail',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockResolvedValue(accommodation);
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'host-07c-fail',
            role: RoleEnum.HOST
        });

        const actor = createHostActor({ id: 'host-07c-fail' });
        const result = await service.update(actor, 'acc-07c-fail', {
            lifecycleState: LifecycleStatusEnum.ACTIVE
        } as never);

        expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
        // DRAFT must stay DRAFT: no accommodation write on a failed trial.
        expect(accommodationModel.update).not.toHaveBeenCalled();
        expect(deps.cancelTrial).not.toHaveBeenCalled();
    });

    // ── FAITHFUL repro: the EXACT bytes host-07c sends, parsed by the REAL route
    // schema (which used to inject `.default()` values), driven through update()
    // with a STATEFUL model so a `super.update()` write is reflected in the next
    // findById(). Before the schema-default fix, the injected defaults made
    // `restFields` non-empty → `super.update()` flipped the row to ACTIVE → publish()
    // early-returned → startTrial was bypassed (200 instead of 5xx). These tests are
    // the regression guard for SPEC-217.
    it('FAITHFUL: schema-parsed {lifecycleState:ACTIVE} still reaches startTrial (no default-injection bypass)', async () => {
        const deps = createPublishDeps();
        const service = buildService(accommodationModel, userModel, deps);

        const row = createMockAccommodation({
            id: 'acc-07c-real',
            ownerId: 'host-07c-real',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockImplementation(async () => ({ ...row }));
        (accommodationModel.update as Mock).mockImplementation(
            async (_where: unknown, data: Record<string, unknown>) => {
                Object.assign(row, data);
                return { ...row };
            }
        );
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'host-07c-real',
            role: RoleEnum.HOST
        });

        // EXACTLY what the admin PATCH route does before calling the service.
        const routePayload = AccommodationPatchInputSchema.parse({
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        const actor = createHostActor({ id: 'host-07c-real' });
        const result = await service.update(actor, 'acc-07c-real', routePayload as never);

        expect(result.error).toBeUndefined();
        // The decisive guard: the trial flow ran (it didn't before the fix).
        expect(deps.startTrial).toHaveBeenCalledWith({
            ownerId: 'host-07c-real',
            accommodationId: 'acc-07c-real'
        });
    });

    it('FAITHFUL: schema-parsed publish surfaces SERVICE_UNAVAILABLE and keeps DRAFT when startTrial fails', async () => {
        const deps = createPublishDeps({
            startTrial: vi.fn().mockRejectedValue(new Error('QZPay timeout'))
        });
        const service = buildService(accommodationModel, userModel, deps);

        const row = createMockAccommodation({
            id: 'acc-07c-real-fail',
            ownerId: 'host-07c-real-fail',
            lifecycleState: LifecycleStatusEnum.DRAFT
        });
        (accommodationModel.findById as Mock).mockImplementation(async () => ({ ...row }));
        (accommodationModel.update as Mock).mockImplementation(
            async (_where: unknown, data: Record<string, unknown>) => {
                Object.assign(row, data);
                return { ...row };
            }
        );
        asMock(userModel.findById as Mock).mockResolvedValue({
            id: 'host-07c-real-fail',
            role: RoleEnum.HOST
        });

        const routePayload = AccommodationPatchInputSchema.parse({
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        const actor = createHostActor({ id: 'host-07c-real-fail' });
        const result = await service.update(actor, 'acc-07c-real-fail', routePayload as never);

        expect(result.error?.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
        // The row must NOT have been flipped to ACTIVE by an injected-default write.
        expect(row.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
    });
});
