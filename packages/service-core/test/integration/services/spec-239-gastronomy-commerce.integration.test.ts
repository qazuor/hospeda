/**
 * SPEC-239 — Cross-layer integration test for the gastronomy commerce
 * admin-sells lifecycle.
 *
 * ## Scope
 *
 * Asserts the full lifecycle from lead → provisioning → listing creation →
 * subscription link → visibility reconciliation → public read gating →
 * owner operational update → review moderation → rating recompute against
 * a REAL ephemeral PostgreSQL database.
 *
 * ## Why real-DB
 *
 * Mocked unit tests cannot detect:
 * - Drizzle relations misconfigured in gastronomy schemas.
 * - Rating recompute queries that only touch approved reviews.
 * - Visibility writes that depend on the live `findById` + `update` chain.
 * - The UNIQUE constraint on `gastronomy_reviews(userId, gastronomyId)`.
 *
 * ## Harness
 *
 * Uses `withServiceTestTransaction` so every insert is rolled back after each
 * test, keeping the ephemeral DB clean between runs.
 *
 * @module spec-239-gastronomy-commerce.integration.test
 */

import type { CommerceLead } from '@repo/schemas';
import {
    GastronomyTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    PriceRangeEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CreateUserPortResult } from '../../../src/services/commerce/commerce-owner-provisioning.service';
import { CommerceOwnerProvisioningService } from '../../../src/services/commerce/commerce-owner-provisioning.service';
import type { CommerceEntityModel } from '../../../src/services/commerce/commerce-visibility';
import { reconcileCommerceListingVisibility } from '../../../src/services/commerce/commerce-visibility';
import { GastronomyReviewService } from '../../../src/services/gastronomy/gastronomy.review.service';
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedCommerceLead,
    seedCommerceListingSubscription,
    seedGastronomy,
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
 * Creates a COMMERCE_OWNER actor with operational edit permissions.
 * The `id` must match the seeded user to satisfy ownership checks.
 *
 * @param userId - The UUID of the owner user row in the DB.
 * @returns Actor with COMMERCE_OWNER role and relevant permissions.
 */
function createCommerceOwnerActor(userId: string): Actor {
    return {
        id: userId,
        role: RoleEnum.COMMERCE_OWNER,
        // SPEC-253 D2=b: single COMMERCE_EDIT_OWN replaces 10 per-section perms
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
        role: RoleEnum.USER,
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
        email: `tourist-${uid}@example.com`,
        displayName: `Tourist ${uid}`,
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);
    return userId;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SPEC-239 — Gastronomy commerce admin-sells lifecycle (integration)', () => {
    let gastronomyService: GastronomyService;
    let reviewService: GastronomyReviewService;
    let adminActor: Actor;
    /** DB-backed super-admin user ID (seeded in beforeAll, cleaned up in afterAll). */
    let seededAdminId: string;

    beforeAll(async () => {
        if (!dbAvailable) return;
        const db = getServiceTestDb();
        const loggerConfig = { logger: createLoggerMock() };
        gastronomyService = new GastronomyService(loggerConfig);
        reviewService = new GastronomyReviewService(loggerConfig);

        // Seed a real admin user into the DB so FK constraints on
        // createdById / updatedById / moderatedById are satisfied.
        // This row is inserted at the DbClient level (outside any test transaction)
        // so it persists across all test transactions, and is deleted in afterAll.
        seededAdminId = crypto.randomUUID();
        const { users } = await import('@repo/db');
        await db.insert(users).values({
            id: seededAdminId,
            // slug: $defaultFn is client-side and may not fire at the top-level
            // db client (vs tx). Provide it explicitly to avoid NOT NULL violation.
            slug: `test-admin-${seededAdminId.slice(0, 8)}`,
            email: `seeded-admin-${seededAdminId.slice(0, 8)}@test.local`,
            displayName: 'Seeded Test Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE',
            role: RoleEnum.SUPER_ADMIN
        } as typeof users.$inferInsert);

        adminActor = {
            id: seededAdminId,
            role: RoleEnum.SUPER_ADMIN,
            permissions: Object.values(PermissionEnum)
        };
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        // Clean up the seeded admin user.
        if (seededAdminId) {
            const db = getServiceTestDb();
            const { users, eq } = await import('@repo/db');
            await db.delete(users).where(eq(users.id, seededAdminId));
        }
        await closeServiceTestPool();
    });

    // -----------------------------------------------------------------------
    // T-1: Admin creates gastronomy listing (PRIVATE/INACTIVE initially)
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-1: admin creates a gastronomy listing (PRIVATE / INACTIVE)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: seed owner + destination
                const { ownerId, destinationId } = await seedGastronomy(tx);
                const ctx: ServiceContext = { tx };

                // Act: create via service using enum values and required non-null defaults.
                // GastronomyAdminCreateInputSchema omits id/timestamps but keeps
                // averageRating, isFeatured, reviewsCount (they have schema defaults
                // but are still part of the required shape before omit).
                const result = await gastronomyService.create(
                    adminActor,
                    {
                        name: 'La Parrilla Admin',
                        summary: 'Admin-created gastronomy listing summary',
                        description: 'Admin-created gastronomy listing for integration test suite.',
                        type: GastronomyTypeEnum.PARRILLA,
                        ownerId: ownerId as `${string}-${string}-${string}-${string}-${string}`,
                        destinationId:
                            destinationId as `${string}-${string}-${string}-${string}-${string}`,
                        visibility: VisibilityEnum.PRIVATE,
                        lifecycleState: LifecycleStatusEnum.INACTIVE,
                        moderationState: ModerationStatusEnum.PENDING,
                        averageRating: 0,
                        isFeatured: false,
                        reviewsCount: 0
                    },
                    ctx
                );

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data to be populated');

                expect(result.data.name).toBe('La Parrilla Admin');
                expect(result.data.ownerId).toBe(ownerId);
                expect(result.data.destinationId).toBe(destinationId);
                expect(result.data.visibility).toBe('PRIVATE');
                expect(result.data.lifecycleState).toBe('INACTIVE');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-2: Commerce owner provisioning via CreateUserPort stub
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-2: provisions a COMMERCE_OWNER user from a commerce lead',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: seed a commerce lead row
                const { leadId, email, contactName } = await seedCommerceLead(tx);
                const ctx: ServiceContext = { tx };

                // Stub CreateUserPort: insert a real user row in the tx so the
                // FK constraint is satisfied when the gastronomy listing later
                // references this userId.
                const provisionedUserId = crypto.randomUUID();
                const { users } = await import('@repo/db');

                const createUserPortStub = vi.fn(
                    async (input: {
                        email: string;
                        password: string;
                        name: string;
                        role: RoleEnum;
                        mustChangePassword: boolean;
                    }): Promise<CreateUserPortResult> => {
                        // Actually insert the row so FK on gastronomies.owner_id works.
                        await tx.insert(users).values({
                            id: provisionedUserId,
                            email: input.email,
                            displayName: input.name,
                            emailVerified: false,
                            lifecycleState: 'ACTIVE',
                            mustChangePassword: input.mustChangePassword,
                            role: input.role
                        } as typeof users.$inferInsert);
                        return {
                            id: provisionedUserId,
                            email: input.email,
                            name: input.name
                        };
                    }
                );

                const provisioningService = new CommerceOwnerProvisioningService(
                    { logger: createLoggerMock() },
                    createUserPortStub,
                    null // no-op notifier
                );

                // Build the lead object that matches CommerceLead type.
                // CommerceLead includes audit fields (createdById / updatedById)
                // from BaseAuditFields. They are nullable in the schema.
                const lead: CommerceLead = {
                    id: leadId,
                    email,
                    contactName,
                    domain: 'gastronomy',
                    businessName: 'Test Business',
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdById: null,
                    updatedById: null,
                    phone: null,
                    destinationId: null,
                    message: null,
                    handledAt: null,
                    handledById: null,
                    adminNote: null
                };

                // Act
                const result = await provisioningService.provisionCommerceOwner(
                    adminActor,
                    { lead },
                    ctx
                );

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data to be populated');

                expect(result.data.userId).toBe(provisionedUserId);
                expect(result.data.email).toBe(email);
                expect(result.data.name).toBe(contactName);
                expect(result.data.temporaryPassword).toBeTruthy();
                expect(result.data.temporaryPassword.length).toBeGreaterThanOrEqual(20);

                // Assert the user row exists and has mustChangePassword=true
                const { eq } = await import('@repo/db');
                const userRow = await tx
                    .select()
                    .from(users)
                    .where(eq(users.id, provisionedUserId));
                const user = userRow[0];
                expect(user).toBeDefined();
                expect((user as Record<string, unknown>).mustChangePassword).toBe(true);

                // Assert CreateUserPort was called with correct role
                expect(createUserPortStub).toHaveBeenCalledOnce();
                const callArg = createUserPortStub.mock.calls[0]?.[0];
                expect(callArg?.role).toBe(RoleEnum.COMMERCE_OWNER);
                expect(callArg?.mustChangePassword).toBe(true);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-3: Owner assigned to listing (via model-level update — ownerId is
    //      intentionally excluded from GastronomyUpdateInputSchema as a
    //      server-managed field; admin ownership assignment uses the model).
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-3: admin assigns owner to existing gastronomy listing via model',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: seed listing + a second user (the intended owner)
                const { ownerId: originalOwnerId, gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });

                // Seed a new owner user
                const { users, gastronomyModel } = await import('@repo/db');
                const newOwnerId = crypto.randomUUID();
                await tx.insert(users).values({
                    id: newOwnerId,
                    email: `new-owner-${newOwnerId.slice(0, 8)}@example.com`,
                    displayName: 'New Commerce Owner',
                    emailVerified: true,
                    lifecycleState: 'ACTIVE'
                } as typeof users.$inferInsert);

                // Act: assign owner at model level (service layer intentionally
                //      excludes ownerId from the update schema as a dedicated admin action)
                await gastronomyModel.update({ id: gastronomyId }, { ownerId: newOwnerId }, tx);

                // Read back via service to confirm
                const ctx: ServiceContext = { tx };
                const result = await gastronomyService.getById(adminActor, gastronomyId, ctx);

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data');
                expect(result.data.ownerId).toBe(newOwnerId);
                expect(result.data.ownerId).not.toBe(originalOwnerId);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-4: Subscription seeded + visibility reconciled → PUBLIC / ACTIVE
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-4: reconcileCommerceListingVisibility flips listing to PUBLIC/ACTIVE on active subscription',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });
                await seedCommerceListingSubscription(tx, {
                    gastronomyId,
                    status: 'active'
                });
                const { gastronomyModel } = await import('@repo/db');
                const ctx: ServiceContext = { tx };

                // CommerceEntityModel.update signature now matches BaseModel.update:
                // (where: Record<string, unknown>, data, tx?).
                // The reconciler calls model.update({ id: entityId }, ...) so we
                // pass `where` straight through — no wrapping needed.
                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => gastronomyModel.findById(id, tx2),
                    update: (where, data, tx2) =>
                        gastronomyModel.update(
                            where,
                            data as Parameters<typeof gastronomyModel.update>[1],
                            tx2
                        )
                };

                // Act
                const reconcileResult = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'gastronomy',
                        entityId: gastronomyId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter
                );

                // Assert reconciler result
                expect(reconcileResult.updated).toBe(true);
                expect(reconcileResult.visibility).toBe(VisibilityEnum.PUBLIC);
                expect(reconcileResult.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

                // Assert DB row reflects the change
                const getResult = await gastronomyService.getById(adminActor, gastronomyId, ctx);
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
    //
    // NOTE: GastronomyService.getById() does NOT filter by visibility at the
    // service layer — that gate lives in the HTTP route layer
    // (public route enforces visibility=PUBLIC/lifecycleState=ACTIVE).
    // This test therefore verifies the DB state transitions directly via
    // gastronomyModel.findById() to assert the reconciler wrote the correct
    // values, not through a service-level visibility gate.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-5: visibility state transitions correctly via reconcileCommerceListingVisibility',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: listing starts PRIVATE/INACTIVE
                const { gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PRIVATE',
                    lifecycleState: 'INACTIVE'
                });
                const { gastronomyModel } = await import('@repo/db');

                // CommerceEntityModel.update signature matches BaseModel.update:
                // (where: Record<string, unknown>, data, tx?).
                // Reconciler calls model.update({ id: entityId }, ...) — pass through directly.
                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => gastronomyModel.findById(id, tx2),
                    update: (where, data, tx2) =>
                        gastronomyModel.update(
                            where,
                            data as Parameters<typeof gastronomyModel.update>[1],
                            tx2
                        )
                };

                // Act-1: reconcile to 'active' → should flip to PUBLIC/ACTIVE
                const activeResult = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'gastronomy',
                        entityId: gastronomyId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter
                );

                expect(activeResult.updated).toBe(true);
                expect(activeResult.visibility).toBe(VisibilityEnum.PUBLIC);
                expect(activeResult.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

                // Verify DB state directly (service.getById does not gate by visibility)
                const afterActive = await gastronomyModel.findById(gastronomyId, tx);
                expect(afterActive).toBeDefined();
                expect(afterActive?.visibility).toBe('PUBLIC');
                expect(afterActive?.lifecycleState).toBe('ACTIVE');

                // Act-2: reconcile to 'canceled' → should flip back to PRIVATE/INACTIVE
                const cancelResult = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'gastronomy',
                        entityId: gastronomyId,
                        subscriptionStatus: 'canceled',
                        tx
                    },
                    modelAdapter
                );

                expect(cancelResult.updated).toBe(true);
                expect(cancelResult.visibility).toBe(VisibilityEnum.PRIVATE);
                expect(cancelResult.lifecycleState).toBe(LifecycleStatusEnum.INACTIVE);

                // Verify DB state directly
                const afterCancel = await gastronomyModel.findById(gastronomyId, tx);
                expect(afterCancel).toBeDefined();
                expect(afterCancel?.visibility).toBe('PRIVATE');
                expect(afterCancel?.lifecycleState).toBe('INACTIVE');
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-6: Owner operational update (priceRange / menuUrl) — accepted
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-6: owner can update operational fields (priceRange / menuUrl)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: seed listing that is PUBLIC/ACTIVE (owner can see it)
                const { ownerId, gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const ownerActor = createCommerceOwnerActor(ownerId);
                const ctx: ServiceContext = { tx };

                // Act: owner updates operational field
                const result = await gastronomyService.updateOwn(
                    gastronomyId,
                    {
                        priceRange: PriceRangeEnum.MID,
                        menuUrl: 'https://example.com/menu'
                    },
                    ownerActor,
                    ctx
                );

                // Assert
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data');
                expect(result.data.priceRange).toBe('MID');
                expect(result.data.menuUrl).toBe('https://example.com/menu');
                // Identity fields remain untouched
                expect(result.data.ownerId).toBe(ownerId);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-7: Owner update schema only allows operational fields — identity
    //      fields (name, slug, type, destinationId) are absent from
    //      GastronomyOwnerUpdateInputSchema and are silently stripped at
    //      the Zod parse boundary inside updateOwn().
    //
    //      This test verifies that an owner update succeeds for an
    //      operational field and that the identity fields remain unchanged
    //      by reading back the entity via the admin path.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-7: owner update only touches operational fields; identity fields remain unchanged',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { ownerId, gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const ownerActor = createCommerceOwnerActor(ownerId);
                const ctx: ServiceContext = { tx };

                // Read the current name before the owner update
                const before = await gastronomyService.getById(adminActor, gastronomyId, ctx);
                const originalName = before.data?.name;
                const originalType = before.data?.type;
                expect(originalName).toBeTruthy();

                // Act: owner updates an operational field only
                const result = await gastronomyService.updateOwn(
                    gastronomyId,
                    { priceRange: PriceRangeEnum.HIGH },
                    ownerActor,
                    ctx
                );

                // Assert: update succeeds
                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected result.data');

                // Operational field updated
                expect(result.data.priceRange).toBe(PriceRangeEnum.HIGH);

                // Identity fields remain unchanged (GastronomyOwnerUpdateInputSchema
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
                // Arrange: PUBLIC listing so the tourist reviewer can see it
                const { gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const touristUserId = await seedTouristUser(tx);
                const touristActor = createTouristActor(touristUserId);
                const ctx: ServiceContext = { tx };

                // Act-1: tourist submits review
                const createResult = await reviewService.create(
                    touristActor,
                    {
                        gastronomyId,
                        overallRating: 4.5,
                        rating: { food: 5, service: 4, ambiance: 4, value: 4 },
                        title: 'Excellent place!',
                        content: 'Great food, fast service, lovely ambiance.'
                    },
                    ctx
                );

                // Assert review is PENDING
                expect(createResult.error).toBeUndefined();
                expect(createResult.data).toBeDefined();
                if (!createResult.data) throw new Error('expected review data');
                const reviewId = (createResult.data as Record<string, unknown>).id as string;
                expect(reviewId).toBeTruthy();
                const pendingState = (createResult.data as Record<string, unknown>).moderationState;
                expect(pendingState).toBe(ModerationStatusEnum.PENDING);

                // Act-2: admin moderates → APPROVED
                const moderateResult = await reviewService.moderateReview(
                    {
                        id: reviewId,
                        decision: ModerationStatusEnum.APPROVED
                    },
                    adminActor,
                    ctx
                );

                // Assert review is APPROVED
                expect(moderateResult.error).toBeUndefined();
                expect(moderateResult.data).toBeDefined();
                if (!moderateResult.data) throw new Error('expected moderated review data');
                const approvedState = (moderateResult.data as Record<string, unknown>)
                    .moderationState;
                expect(approvedState).toBe(ModerationStatusEnum.APPROVED);

                // Assert-3: listing rating recomputed (>0, reviewsCount=1)
                const gastronomyAfter = await gastronomyService.getById(
                    adminActor,
                    gastronomyId,
                    ctx
                );
                expect(gastronomyAfter.error).toBeUndefined();
                expect(gastronomyAfter.data).toBeDefined();
                if (!gastronomyAfter.data) throw new Error('expected gastronomy data');

                const rc = gastronomyAfter.data.reviewsCount;
                const ar = gastronomyAfter.data.averageRating;

                expect(rc, 'reviewsCount should be 1 after first approved review').toBe(1);
                expect(
                    Number(ar),
                    'averageRating should be > 0 after first approved review'
                ).toBeGreaterThan(0);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-8b: Review WITHOUT the granular `rating` breakdown must succeed.
    //
    // Regression (SPEC-259 Chrome smoke): the `gastronomy_reviews.rating` jsonb
    // column was NOT NULL with no default, but GastronomyReviewCreateInputSchema
    // marks `rating` optional (a reviewer may submit only the scalar
    // `overallRating`). Submitting a rating-less review therefore violated the
    // NOT NULL constraint and surfaced as a 500. Migration 0023 drops NOT NULL
    // on the column; this test reproduces the failing path against the real DB.
    // T-8 above always sends a full breakdown, which is why it never caught it.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-8b: review without granular rating breakdown is created (PENDING), no NOT NULL violation',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange: PUBLIC listing + tourist reviewer
                const { gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const touristUserId = await seedTouristUser(tx);
                const touristActor = createTouristActor(touristUserId);
                const ctx: ServiceContext = { tx };

                // Act: submit a review with ONLY the required scalar rating —
                // no per-dimension `rating` object.
                const createResult = await reviewService.create(
                    touristActor,
                    {
                        gastronomyId,
                        overallRating: 4,
                        title: 'Solid spot',
                        content: 'Tasty and reasonably priced, would return.'
                    },
                    ctx
                );

                // Assert: created successfully (no NOT NULL / 500), state PENDING
                expect(createResult.error).toBeUndefined();
                expect(createResult.data).toBeDefined();
                if (!createResult.data) throw new Error('expected review data');
                const data = createResult.data as Record<string, unknown>;
                expect(data.id).toBeTruthy();
                expect(data.moderationState).toBe(ModerationStatusEnum.PENDING);
                // The breakdown is absent (null/undefined) — never an empty-object sentinel.
                expect(data.rating ?? null).toBeNull();
                // Effective per-review rating falls back to the scalar overallRating
                // (not 0) so the review never renders as ★0.0.
                expect(Number(data.averageRating)).toBe(4);
            });
        }
    );

    // -----------------------------------------------------------------------
    // T-8c: listForModeration surfaces PENDING reviews filtered by state.
    //
    // Regression (SPEC-259 Chrome smoke): the admin "Reseñas" moderation tab
    // showed "no pending reviews" because the list route 400'd on `?status=`.
    // The dedicated service method must filter by `moderationState` (NOT the
    // base adminList `status`/lifecycleState semantics) and require the
    // COMMERCE_MODERATE_REVIEW permission.
    // -----------------------------------------------------------------------

    it.skipIf(!dbAvailable)(
        'T-8c: listForModeration returns PENDING reviews and enforces permission',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const touristUserId = await seedTouristUser(tx);
                const touristActor = createTouristActor(touristUserId);
                const ctx: ServiceContext = { tx };

                // Arrange: a freshly-created review is PENDING.
                const createResult = await reviewService.create(
                    touristActor,
                    { gastronomyId, overallRating: 5, title: 'Great' },
                    ctx
                );
                expect(createResult.error).toBeUndefined();
                const reviewId = (createResult.data as Record<string, unknown>).id as string;

                // Act: list PENDING reviews as an admin moderator.
                const pendingResult = await reviewService.listForModeration(
                    adminActor,
                    { moderationState: ModerationStatusEnum.PENDING },
                    ctx
                );

                // Assert: the new review is in the PENDING queue.
                expect(pendingResult.error).toBeUndefined();
                const pendingIds = (pendingResult.data?.items ?? []).map(
                    (r) => (r as Record<string, unknown>).id
                );
                expect(pendingIds).toContain(reviewId);

                // Act/Assert: filtering by APPROVED excludes the pending review.
                const approvedResult = await reviewService.listForModeration(
                    adminActor,
                    { moderationState: ModerationStatusEnum.APPROVED },
                    ctx
                );
                expect(approvedResult.error).toBeUndefined();
                const approvedIds = (approvedResult.data?.items ?? []).map(
                    (r) => (r as Record<string, unknown>).id
                );
                expect(approvedIds).not.toContain(reviewId);

                // Act/Assert: a non-moderator actor is forbidden.
                const forbidden = await reviewService.listForModeration(
                    touristActor,
                    { moderationState: ModerationStatusEnum.PENDING },
                    ctx
                );
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
                // Arrange: seed listing already in PUBLIC/ACTIVE state
                const { gastronomyId } = await seedGastronomy(tx, {
                    visibility: 'PUBLIC',
                    lifecycleState: 'ACTIVE'
                });
                const { gastronomyModel } = await import('@repo/db');
                // Adapter wraps GastronomyModel.update(where, data, tx)
                // to satisfy CommerceEntityModel.update(id, data, tx).
                const modelAdapter: CommerceEntityModel = {
                    findById: (id, tx2) => gastronomyModel.findById(id, tx2),
                    update: (id, data, tx2) =>
                        gastronomyModel.update(
                            { id },
                            data as Parameters<typeof gastronomyModel.update>[1],
                            tx2
                        )
                };

                // Act: reconcile with 'active' — already in correct state
                const result = await reconcileCommerceListingVisibility(
                    {
                        entityType: 'gastronomy',
                        entityId: gastronomyId,
                        subscriptionStatus: 'active',
                        tx
                    },
                    modelAdapter
                );

                // Assert: no write performed (already in desired state)
                expect(result.updated).toBe(false);
                expect(result.visibility).toBe('PUBLIC');
                expect(result.lifecycleState).toBe('ACTIVE');
            });
        }
    );
});
