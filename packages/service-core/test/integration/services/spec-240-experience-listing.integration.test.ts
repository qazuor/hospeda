/**
 * HOS-1269 — Cross-layer integration test for the experience listing
 * admin-sells lifecycle.
 *
 * ## Scope
 *
 * Ports `spec-239-gastronomy-listing.integration.test.ts` to the experience
 * vertical. Asserts the full lifecycle from listing creation → owner assignment →
 * owner operational update → review moderation → rating recompute against a REAL ephemeral
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
 *  * - The UNIQUE constraint on `experience_reviews(userId, experienceId)`.
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
 * @module spec-240-experience-listing.integration.test
 */

import {
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExperienceReviewService } from '../../../src/services/experience/experience.review.service';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedExperience,
    withServiceTestTransaction
} from './helpers';

// ---------------------------------------------------------------------------
// DB availability guard — skips the whole suite when Docker is down.
// ---------------------------------------------------------------------------

const dbAvailable = isServiceTestDbAvailable();

// ---------------------------------------------------------------------------
// Actor factories
// ---------------------------------------------------------------------------

/**
 * Creates a EXPERIENCE_OWNER actor with operational edit permissions.
 * The `id` must match the seeded user to satisfy ownership checks.
 *
 * @param userId - The UUID of the owner user row in the DB.
 * @returns Actor with EXPERIENCE_OWNER role and relevant permissions.
 */
function createListingOwnerActor(userId: string): Actor {
    return {
        id: userId,
        roles: [RoleEnum.EXPERIENCE_OWNER],
        permissions: [PermissionEnum.EXPERIENCE_EDIT_OWN]
    };
}

/**
 * Creates a tourist actor (any authenticated user) for review submission.
 *
 * @param userId - The UUID of the tourist user row in the DB.
 * @returns Actor with no specific listing permission.
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

describe('HOS-1269 — Experience listing admin-sells lifecycle (integration)', () => {
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
                        reviewsCount: 0,
                        // These all carry a Zod `.default()`, which makes them
                        // optional on INPUT but not on the OUTPUT type `z.infer`
                        // resolves to (same reason the gastronomy admin-create
                        // test above states averageRating/reviewsCount
                        // explicitly) — so `tsc` requires them here.
                        meetingPointDirections: [],
                        whatToBring: [],
                        requirements: [],
                        acceptsPrivateGroups: false
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
                    displayName: 'New Listing Owner',
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
                const ownerActor = createListingOwnerActor(ownerId);
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
                const ownerActor = createListingOwnerActor(ownerId);
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
});
