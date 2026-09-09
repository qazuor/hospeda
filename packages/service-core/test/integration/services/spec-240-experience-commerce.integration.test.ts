/**
 * HOS-1269 — Cross-layer integration test for the experience commerce
 * admin-sells lifecycle.
 *
 * ## Scope
 *
 * Ports `spec-239-gastronomy-commerce.integration.test.ts` to the experience
 * vertical. Asserts the full lifecycle from listing creation → subscription
 * link → visibility reconciliation → public read gating → owner operational
 * update → review moderation → rating recompute against a REAL ephemeral
 * PostgreSQL database.
 *
 * Before this ticket, `experiences` had NO integration test at all for this
 * lifecycle — `seedExperience` / `seedExperienceListingSubscription` /
 * `seedExperienceReview` did not exist in `./helpers.ts`, so the suite could
 * not be written without building the fixture first (HOS-1269).
 *
 * ## Why real-DB
 *
 * Mocked unit tests cannot detect:
 * - Drizzle relations misconfigured in experience schemas.
 * - Rating recompute queries that only touch approved reviews.
 * - Visibility writes that depend on the live `findById` + `update` chain.
 * - The UNIQUE constraint on `experience_reviews(userId, experienceId)`.
 *
 * ## Deliberately NOT ported: gastronomy's T-8b
 *
 * Gastronomy's suite carries a T-8b regression test asserting that a review
 * submitted WITHOUT the granular `rating` breakdown still succeeds, because
 * migration 0023 dropped the `NOT NULL` constraint on `gastronomy_reviews.rating`
 * for exactly that reason. `experience_reviews.rating` never received the
 * equivalent migration — it is still `jsonb NOT NULL` with no default (created
 * in migration 0019, never altered since). `ExperienceReviewCreateInputSchema`
 * marks `rating` optional, so a caller can validly submit `overallRating` alone
 * and the write will fail against the real DB with a NOT NULL violation. That
 * is a genuine, currently-live gap — fixing it needs a schema migration, which
 * is out of scope for this fixture-only ticket (HOS-1269 is "add the fixture and
 * port the lifecycle test", not "fix a schema divergence"). Flagged in the PR
 * description instead of silently ported as a green (falsely reassuring) test.
 *
 * ## Harness
 *
 * Uses `withServiceTestTransaction` so every insert is rolled back after each
 * test, keeping the ephemeral DB clean between runs.
 *
 * @module spec-240-experience-commerce.integration.test
 */

import {
    CommerceEntityTypeEnum,
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    resolveListingCompleteness,
    VisibilityEnum
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
    CommerceEntityModel,
    ResolveCommerceListingCompleteness
} from '../../../src/services/commerce/commerce-visibility';
import { reconcileCommerceListingVisibility } from '../../../src/services/commerce/commerce-visibility';
import { ExperienceReviewService } from '../../../src/services/experience/experience.review.service';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedExperience,
    seedExperienceListingSubscription,
    withServiceTestTransaction
} from './helpers';

// ---------------------------------------------------------------------------
// DB availability guard — skips the whole suite when Docker is down.
// ---------------------------------------------------------------------------

const dbAvailable = isServiceTestDbAvailable();

// ---------------------------------------------------------------------------
// Resolver stub (same role as gastronomy's ALWAYS_COMPLETE) — used by tests
// that exercise the reconciler's pure status-driven transition, not
// completeness.
// ---------------------------------------------------------------------------

const ALWAYS_COMPLETE: ResolveCommerceListingCompleteness = async () => ({
    complete: true,
    missing: []
});

// ---------------------------------------------------------------------------
// Actor factories
// ---------------------------------------------------------------------------

/**
 * Creates a COMMERCE_OWNER actor with operational edit permissions.
 * The `id` must match the seeded user to satisfy ownership checks.
 *
 * @param userId - The UUID of the owner user row in the DB.
 * @returns Actor with COMMERCE_OWNER role and relevant permissions.
 */
function createCommerceOwnerActor(userId: string): Actor {
    return {
        id: userId,
        roles: [RoleEnum.COMMERCE_OWNER],
        permissions: [PermissionEnum.COMMERCE_EDIT_OWN]
    };
}

/**
 * Creates a tourist actor (any authenticated user) for review submission.
 *
 * @param userId - The UUID of the tourist user row in the DB.
 * @returns Actor with no specific commerce permissions.
 */
function createTouristActor(userId: string): Actor {
    return {
        id: userId,
        roles: [RoleEnum.USER],
        permissions: []
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inserts a minimal user row and returns its ID (used for tourist actor). */
async function seedTouristUser(tx: import('@repo/db').DrizzleClient): Promise<string> {
    const { users } = await import('@repo/db');
    const userId = crypto.randomUUID();
    const uid = userId.slice(0, 8);
    await tx.insert(users).values({
        id: userId,
        email: `tourist-exp-${uid}@example.com`,
        displayName: `Tourist ${uid}`,
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);
    return userId;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('HOS-1269 — Experience commerce admin-sells lifecycle (integration)', () => {
    let experienceService: ExperienceService;
    let reviewService: ExperienceReviewService;
    let adminActor: Actor;
    /** DB-backed super-admin user ID (seeded in beforeAll, cleaned up in afterAll). */
    let seededAdminId: string;

    beforeAll(async () => {
        if (!dbAvailable) return;
        const db = getServiceTestDb();
        const loggerConfig = { logger: createLoggerMock() };
        experienceService = new ExperienceService(loggerConfig);
        reviewService = new ExperienceReviewService(loggerConfig);

        // Seed a real admin user into the DB so FK constraints on
        // createdById / updatedById / moderatedById are satisfied.
        seededAdminId = crypto.randomUUID();
        const { users } = await import('@repo/db');
        await db.insert(users).values({
            id: seededAdminId,
            slug: `test-admin-exp-${seededAdminId.slice(0, 8)}`,
            email: `seeded-admin-exp-${seededAdminId.slice(0, 8)}@test.local`,
            displayName: 'Seeded Test Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE',
            role: RoleEnum.SUPER_ADMIN
        } as typeof users.$inferInsert);

        adminActor = {
            id: seededAdminId,
            roles: [RoleEnum.SUPER_ADMIN],
            permissions: Object.values(PermissionEnum)
        };
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        if (seededAdminId) {
            const db = getServiceTestDb();
            const { users, eq } = await import('@repo/db');
            await db.delete(users).where(eq(users.id, seededAdminId));
        }
        await closeServiceTestPool();
    });

    // -----------------------------------------------------------------------
    // T-1: Admin creates experience listing (PRIVATE/INACTIVE initially)
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-1: admin creates an experience listing (PRIVATE / INACTIVE)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: seed owner + destination
                const { ownerId, destinationId } = await seedExperience(tx);
                const ctx: ServiceContext = { tx };

                // Act
                const result = await experienceService.create(
                    adminActor,
                    {
                        name: 'City Kayak Tour Admin',
                        summary: 'Admin-created experience listing summary',
                        description: 'Admin-created experience listing for integration test suite.',
                        type: ExperienceTypeEnum.KAYAK_RENTAL,
                        priceFrom: 150000,
                        priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
                        isPriceOnRequest: false,
                        ownerId: ownerId as `${string}-${string}-${string}-${string}-${string}`,
                        destinationId:
                            destinationId as `${string}-${string}-${string}-${string}-${string}`,
                        visibility: VisibilityEnum.PRIVATE,
                        lifecycleState: LifecycleStatusEnum.INACTIVE,
                        moderationState: ModerationStatusEnum.PENDING,
                        averageRating: 0,
                        isFeatured: false,
                        reviewsCount: 0,
                        // These all carry a Zod `.default()`, which makes them
                        // optional on INPUT but not on the OUTPUT type `z.infer`
                        // resolves to (same reason the gastronomy admin-create
                        // test above states averageRating/isFeatured/reviewsCount
                        // explicitly) — so `tsc` requires them here.
                        meetingPointDirections: [],
                        whatToBring: [],
                        requirements: [],
                        acceptsPrivateGroups: false,
                        hasActiveSubscription: false
                    },
                    ctx
                );

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data to be populated');

                expect(result.data.name).toBe('City Kayak Tour Admin');
                expect(result.data.ownerId).toBe(ownerId);
                expect(result.data.destinationId).toBe(destinationId);
                expect(result.data.visibility).toBe('PRIVATE');
                expect(result.data.lifecycleState).toBe('INACTIVE');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-3: Owner assigned to listing (via model-level update — ownerId is
    //      intentionally excluded from ExperienceOwnerUpdateInputSchema as a
    //      server-managed field; admin ownership assignment uses the model).
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-3: admin assigns owner to existing experience listing via model',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId: originalOwnerId, experienceId } = await seedExperience(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });

                const { users, experienceModel } = await import('@repo/db');
                const newOwnerId = crypto.randomUUID();
                await tx.insert(users).values({
                    id: newOwnerId,
                    email: `new-exp-owner-${newOwnerId.slice(0, 8)}@example.com`,
                    displayName: 'New Commerce Owner',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                } as typeof users.$inferInsert);

                await experienceModel.update({ id: experienceId }, { ownerId: newOwnerId }, tx);

                const ctx: ServiceContext = { tx };
                const result = await experienceService.getById(adminActor, experienceId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data');
                expect(result.data.ownerId).toBe(newOwnerId);
                expect(result.data.ownerId).not.toBe(originalOwnerId);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-4: Subscription seeded (REAL billing_subscriptions + entity_subscriptions
    //      rows, per HOS-1269's method note) + visibility reconciled →
    //      PUBLIC / ACTIVE.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-4: reconcileCommerceListingVisibility flips listing to PUBLIC/ACTIVE on active subscription',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { experienceId } = await seedExperience(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });
                // Real rows, not a bare boolean flip — see helpers.ts docblock.
                const { subscriptionId } = await seedExperienceListingSubscription(tx, {
                    experienceId,
                    status: 'active'
                });
                expect(subscriptionId).toBeTruthy();

                const { experienceModel } = await import('@repo/db');
                const ctx: ServiceContext = { tx };

                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => experienceModel.findById(id, tx2),
                    update: (where, data, tx2) =>
                        experienceModel.update(
                            where,
                            data as Parameters<typeof experienceModel.update>[1],
                            tx2
                        )
                };

                const reconcileResult = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'experience',
                        entityId: experienceId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter,
                    ALWAYS_COMPLETE
                );

                expect(reconcileResult.updated).toBe(true);
                expect(reconcileResult.visibility).toBe(VisibilityEnum.PUBLIC);
                expect(reconcileResult.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

                const getResult = await experienceService.getById(adminActor, experienceId, ctx);
                expect(getResult.error).toBeUndefined();
                expect(getResult.data).toBeDefined();
                if (!getResult.data) throw new Error('expected getResult.data');
                expect(getResult.data.visibility).toBe('PUBLIC');
                expect(getResult.data.lifecycleState).toBe('ACTIVE');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-5: Visibility state transitions driven by subscription status
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-5: visibility state transitions correctly via reconcileCommerceListingVisibility',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { experienceId } = await seedExperience(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });
                const { experienceModel } = await import('@repo/db');

                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => experienceModel.findById(id, tx2),
                    update: (where, data, tx2) =>
                        experienceModel.update(
                            where,
                            data as Parameters<typeof experienceModel.update>[1],
                            tx2
                        )
                };

                const activeResult = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'experience',
                        entityId: experienceId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter,
                    ALWAYS_COMPLETE
                );

                expect(activeResult.updated).toBe(true);
                expect(activeResult.visibility).toBe(VisibilityEnum.PUBLIC);
                expect(activeResult.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

                const afterActive = await experienceModel.findById(experienceId, tx);
                expect(afterActive).toBeDefined();
                expect(afterActive?.visibility).toBe('PUBLIC');
                expect(afterActive?.lifecycleState).toBe('ACTIVE');

                const cancelResult = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'experience',
                        entityId: experienceId,
                        subscriptionStatus: 'canceled',
                        tx
                    },
                    modelAdapter,
                    ALWAYS_COMPLETE
                );

                expect(cancelResult.updated).toBe(true);
                expect(cancelResult.visibility).toBe(VisibilityEnum.PRIVATE);
                expect(cancelResult.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);

                const afterCancel = await experienceModel.findById(experienceId, tx);
                expect(afterCancel).toBeDefined();
                expect(afterCancel?.visibility).toBe('PRIVATE');
                expect(afterCancel?.lifecycleState).toBe('INACTIVE');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-6: Owner operational update (durationMinutes / cancellationPolicy) — accepted
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-6: owner can update operational fields (durationMinutes / cancellationPolicy)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, experienceId } = await seedExperience(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const ownerActor = createCommerceOwnerActor(ownerId);
                const ctx: ServiceContext = { tx };

                const result = await experienceService.updateOwn(
                    experienceId,
                    {
                        durationMinutes: 90,
                        cancellationPolicy: 'Free cancellation up to 24h before.'
                    },
                    ownerActor,
                    ctx
                );

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data');
                expect(result.data.durationMinutes).toBe(90);
                expect(result.data.cancellationPolicy).toBe('Free cancellation up to 24h before.');
                expect(result.data.ownerId).toBe(ownerId);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-7: Owner update schema only allows operational fields — identity
    //      fields (name, slug, type, destinationId) are absent from
    //      ExperienceOwnerUpdateInputSchema and are silently stripped at the
    //      Zod parse boundary inside updateOwn().
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-7: owner update only touches operational fields; identity fields remain unchanged',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ownerId, experienceId } = await seedExperience(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const ownerActor = createCommerceOwnerActor(ownerId);
                const ctx: ServiceContext = { tx };

                const before = await experienceService.getById(adminActor, experienceId, ctx);
                const originalName = before.data?.name;
                const originalType = before.data?.type;
                expect(originalName).toBeTruthy();

                const result = await experienceService.updateOwn(
                    experienceId,
                    { durationMinutes: 45 },
                    ownerActor,
                    ctx
                );

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data');

                expect(result.data.durationMinutes).toBe(45);

                // Identity fields remain unchanged (ExperienceOwnerUpdateInputSchema
                // intentionally excludes them — they are absent, not overwritten)
                expect(result.data.name).toBe(originalName);
                expect(result.data.type).toBe(originalType);
                expect(result.data.ownerId).toBe(ownerId);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-8: Review submit (PENDING) → admin moderate (APPROVED) → rating recompute
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-8: review lifecycle — PENDING → APPROVED → listing rating recomputed',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { experienceId } = await seedExperience(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const touristUserId = await seedTouristUser(tx);
                const touristActor = createTouristActor(touristUserId);
                const ctx: ServiceContext = { tx };

                // Act-1: tourist submits review. `rating` is supplied explicitly —
                // see the module docblock for why a rating-less submission is out
                // of scope here (experience_reviews.rating is still NOT NULL).
                const createResult = await reviewService.create(
                    touristActor,
                    {
                        experienceId,
                        overallRating: 4.5,
                        rating: { food: 5, service: 4, ambiance: 4, value: 4 },
                        title: 'Excellent tour!',
                        content: 'Great guide, well organized, would recommend.'
                    },
                    ctx
                );

                expect(createResult.error).toBeUndefined();
                expect(createResult.data).toBeDefined();
                if (!createResult.data) throw new Error('expected review data');
                const reviewId = (createResult.data as Record<string, unknown>).id as string;
                expect(reviewId).toBeTruthy();
                const pendingState = (createResult.data as Record<string, unknown>).moderationState;
                expect(pendingState).toBe(ModerationStatusEnum.PENDING);

                // Act-2: admin moderates → APPROVED
                const moderateResult = await reviewService.moderateReview(
                    { id: reviewId, decision: ModerationStatusEnum.APPROVED },
                    adminActor,
                    ctx
                );

                expect(moderateResult.error).toBeUndefined();
                expect(moderateResult.data).toBeDefined();
                if (!moderateResult.data) throw new Error('expected moderated review data');
                const approvedState = (moderateResult.data as Record<string, unknown>)
                    .moderationState;
                expect(approvedState).toBe(ModerationStatusEnum.APPROVED);

                // Assert-3: listing rating recomputed (>0, reviewsCount=1)
                const experienceAfter = await experienceService.getById(
                    adminActor,
                    experienceId,
                    ctx
                );
                expect(experienceAfter.error).toBeUndefined();
                expect(experienceAfter.data).toBeDefined();
                if (!experienceAfter.data) throw new Error('expected experience data');

                const rc = experienceAfter.data.reviewsCount;
                const ar = experienceAfter.data.averageRating;

                expect(rc, 'reviewsCount should be 1 after first approved review').toBe(1);
                expect(
                    Number(ar),
                    'averageRating should be > 0 after first approved review'
                ).toBeGreaterThan(0);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-8c: getPendingCount + listByExperience — the experience vertical's
    // moderation-queue equivalent of gastronomy's `listForModeration`.
    // `ExperienceReviewService` never grew a `listForModeration` method (it
    // exposes `getPendingCount` — a global PENDING tally — and
    // `listByExperience` — a per-listing APPROVED+ACTIVE read), so this test
    // exercises the actual surface rather than porting a method signature
    // that does not exist here.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-8c: getPendingCount / listByExperience reflect moderation state and enforce permission',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { experienceId } = await seedExperience(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const touristUserId = await seedTouristUser(tx);
                const touristActor = createTouristActor(touristUserId);
                const ctx: ServiceContext = { tx };

                const createResult = await reviewService.create(
                    touristActor,
                    {
                        experienceId,
                        overallRating: 5,
                        rating: { food: 5, service: 5, ambiance: 5, value: 5 },
                        title: 'Great'
                    },
                    ctx
                );
                expect(createResult.error).toBeUndefined();
                const reviewId = (createResult.data as Record<string, unknown>).id as string;

                // Act/Assert: PENDING review counted by the moderator, not yet
                // visible on the public per-listing read.
                const pendingCount = await reviewService.getPendingCount(adminActor, ctx);
                expect(pendingCount.error).toBeUndefined();
                expect(pendingCount.data?.count).toBeGreaterThanOrEqual(1);

                const beforeApproval = await reviewService.listByExperience(
                    experienceId,
                    touristActor,
                    ctx
                );
                expect(beforeApproval.error).toBeUndefined();
                expect(
                    (beforeApproval.data?.reviews ?? []).map(
                        (r) => (r as Record<string, unknown>).id
                    )
                ).not.toContain(reviewId);

                // Act: approve, then confirm the public per-listing read includes it.
                const moderateResult = await reviewService.moderateReview(
                    { id: reviewId, decision: ModerationStatusEnum.APPROVED },
                    adminActor,
                    ctx
                );
                expect(moderateResult.error).toBeUndefined();

                const afterApproval = await reviewService.listByExperience(
                    experienceId,
                    touristActor,
                    ctx
                );
                expect(afterApproval.error).toBeUndefined();
                expect(
                    (afterApproval.data?.reviews ?? []).map(
                        (r) => (r as Record<string, unknown>).id
                    )
                ).toContain(reviewId);

                // Act/Assert: a non-moderator actor is forbidden from the pending count.
                const forbidden = await reviewService.getPendingCount(touristActor, ctx);
                expect(forbidden.error?.code).toBe('FORBIDDEN');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-9: Reconciliation is idempotent — no unnecessary write on second call
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-9: reconcileCommerceListingVisibility is idempotent (no write on repeat)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { experienceId } = await seedExperience(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const { experienceModel } = await import('@repo/db');
                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => experienceModel.findById(id, tx2),
                    update: (id, data, tx2) =>
                        experienceModel.update(
                            { id },
                            data as Parameters<typeof experienceModel.update>[1],
                            tx2
                        )
                };

                const result = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'experience',
                        entityId: experienceId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter,
                    ALWAYS_COMPLETE
                );

                expect(result.updated).toBe(false);
                expect(result.visibility).toBe('PUBLIC');
                expect(result.lifecycleState).toBe('ACTIVE');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-10: HOS-166 AC-6 equivalent — active subscription + genuinely
    // incomplete listing → stays PRIVATE. Uses the REAL
    // resolveListingCompleteness against seedExperience's default row, which
    // deliberately carries no media/contactInfo and priceFrom=0 with
    // isPriceOnRequest=false (the experience-specific completeness gap).
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-10: reconciler keeps an active-but-incomplete listing PRIVATE (HOS-166 AC-6 equivalent)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { experienceId } = await seedExperience(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });
                const { experienceModel } = await import('@repo/db');

                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => experienceModel.findById(id, tx2),
                    update: (where, data, tx2) =>
                        experienceModel.update(
                            where,
                            data as Parameters<typeof experienceModel.update>[1],
                            tx2
                        )
                };
                const resolveCompleteness: ResolveCommerceListingCompleteness = async (
                    entityId,
                    resolveTx
                ) => {
                    const listing = await experienceModel.findById(entityId, resolveTx);
                    return resolveListingCompleteness({
                        entityType: CommerceEntityTypeEnum.EXPERIENCE,
                        listing: listing ?? {}
                    });
                };

                const result = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'experience',
                        entityId: experienceId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter,
                    resolveCompleteness
                );

                expect(result.updated).toBe(false);
                expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
                expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);

                const afterReconcile = await experienceModel.findById(experienceId, tx);
                expect(afterReconcile?.visibility).toBe('PRIVATE');
                expect(afterReconcile?.lifecycleState).toBe('INACTIVE');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-11: HOS-166 AC-9 equivalent — moderationState=REJECTED + active
    // subscription → stays PRIVATE even when the listing would otherwise be
    // complete.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-11: reconciler keeps a REJECTED listing PRIVATE regardless of subscription (HOS-166 AC-9 equivalent)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { experienceId } = await seedExperience(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE',
                    moderationState: 'REJECTED'
                });
                const { experienceModel } = await import('@repo/db');

                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => experienceModel.findById(id, tx2),
                    update: (where, data, tx2) =>
                        experienceModel.update(
                            where,
                            data as Parameters<typeof experienceModel.update>[1],
                            tx2
                        )
                };

                const result = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'experience',
                        entityId: experienceId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter,
                    ALWAYS_COMPLETE
                );

                expect(result.updated).toBe(false);
                expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
                expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-12 (HOS-1269-specific, no gastronomy equivalent): a host-provider
    // dual-owner account owns an experience AND holds an accommodation
    // subscription — the experience's own reconciliation must not read the
    // wrong vertical's subscription. `entity_subscriptions` is keyed
    // UNIQUE(entity_type, entity_id) per listing, and this reconciler takes
    // `subscriptionStatus` as an explicit input rather than resolving it
    // itself, so there is no `.find()`/bare `WHERE customerId` in this path
    // for a dual-owner subscription to be picked up by mistake. This test
    // pins that: seeding an ACCOMMODATION-domain entity_subscriptions row for
    // the SAME owner must not influence the EXPERIENCE listing's own
    // reconciliation.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-12: dual-owner (host + experience provider) — an accommodation-domain subscription row does not leak into the experience reconciliation',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // `seedExperience` always inserts its OWN owner row — passing a
                // pre-existing user id as `ownerId` would collide on the users PK,
                // so the dual-owner narrative reuses the owner `seedExperience`
                // creates rather than pre-seeding a second one.
                const { ownerId: dualOwnerId, experienceId } = await seedExperience(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });
                const uid = dualOwnerId.slice(0, 8);

                // Seed an unrelated ACCOMMODATION-domain entity_subscriptions row
                // for an arbitrary accommodation (not this owner's real portfolio —
                // the point is only that a same-owner, different-domain row exists
                // in the same table the experience reconciler could, in principle,
                // be pointed at).
                const { entitySubscriptions, sql } = await import('@repo/db');
                const accommodationSubscriptionId = crypto.randomUUID();
                const customerId = crypto.randomUUID();
                await tx.execute(sql`
                    INSERT INTO billing_customers (id, external_id, email, livemode)
                    VALUES (${customerId}, ${`ext-${uid}`}, ${`billing-${uid}@test.local`}, false)
                `);
                await tx.execute(sql`
                    INSERT INTO billing_subscriptions (
                        id, customer_id, plan_id, status, billing_interval,
                        current_period_start, current_period_end, livemode, product_domain
                    ) VALUES (
                        ${accommodationSubscriptionId}, ${customerId}, ${crypto.randomUUID()},
                        'active', 'month', now(), now() + interval '30 days', false, 'accommodation'
                    )
                `);
                await tx.insert(entitySubscriptions).values({
                    id: crypto.randomUUID(),
                    subscriptionId: accommodationSubscriptionId,
                    entityType: 'accommodation',
                    entityId: crypto.randomUUID(),
                    status: 'active',
                    productDomain: 'accommodation'
                } as typeof entitySubscriptions.$inferInsert);

                // Act: reconcile the EXPERIENCE listing with NO subscription of its
                // own (subscriptionStatus explicitly 'canceled') — it must stay
                // PRIVATE regardless of the owner's unrelated accommodation
                // subscription being 'active'.
                const { experienceModel } = await import('@repo/db');
                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => experienceModel.findById(id, tx2),
                    update: (where, data, tx2) =>
                        experienceModel.update(
                            where,
                            data as Parameters<typeof experienceModel.update>[1],
                            tx2
                        )
                };

                const result = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'experience',
                        entityId: experienceId,
                        subscriptionStatus: 'canceled',
                        tx
                    },
                    modelAdapter,
                    ALWAYS_COMPLETE
                );

                expect(result.updated).toBe(false);
                expect(result.visibility).toBe(VisibilityEnum.PRIVATE);
                expect(result.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);

                const afterReconcile = await experienceModel.findById(experienceId, tx);
                expect(afterReconcile?.ownerId).toBe(dualOwnerId);
                expect(afterReconcile?.visibility).toBe('PRIVATE');
                expect(afterReconcile?.lifecycleState).toBe('INACTIVE');
            });
        }
    );
});
