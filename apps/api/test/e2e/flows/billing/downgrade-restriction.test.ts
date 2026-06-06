/**
 * SPEC-167 T-019 — Downgrade restriction happy path (closes the T-145-11 gap).
 *
 * Validates the full end-to-end flow of the downgrade restriction system:
 *
 * ```
 * (setup) host on owner-pro (cap: accommodations=3, promotions=3, photos=15)
 *         with 3 accommodations (1 over-cap target: owner-basico cap=1),
 *         2 ACTIVE promotions (over-cap: owner-basico cap=0),
 *         and 1 accommodation with photos over target cap (basico cap=5)
 *
 * → POST /api/v1/protected/billing/subscriptions/change-plan
 *   { newPlanId: ownerBasicoPlanId, billingInterval: 'monthly' }
 *   → scheduleSubscriptionDowngrade writes scheduledPlanChange { status: 'pending' }
 *   → response carries restrictionPreview.hasExcess === true with correct counts
 *   → PLAN_DOWNGRADE_LIMIT_WARNING notification paths exercised (fire-and-forget)
 *
 * → applyScheduledPlanChangesJob.handler(ctx)
 *   → applies plan change, runs applyDowngradeRestrictions (SPEC-167 T-011)
 *   → DB assertions:
 *     - 2 accommodations: planRestricted = true (kept = 1 most-recently-updated)
 *     - 2 promotions: planRestricted = true (cap = 0 → all restricted)
 *     - over-cap accommodation: gallery photos moved to archivedGallery
 *   → public list/detail excludes planRestricted accommodations
 *   → owner's protected list still shows all (including restricted)
 *   → entitlement cache cleared for the billing customer
 * ```
 *
 * IMPORTANT contracts pinned by this test:
 *   1. `restrictionPreview` in the schedule response reflects the seed state.
 *   2. After cron apply, DB planRestricted flags are set on exactly the right rows
 *      (most-recently-updated wins by default sort, i.e. keepByDefault=true band).
 *   3. Photos conservation: archivedGallery count + remaining gallery count = original.
 *   4. Public reads exclude planRestricted=true accommodations.
 *   5. Protected (owner-scope) reads include planRestricted=true accommodations.
 *   6. Cache cleared: delta = -1 after cron tick.
 *
 * Scope: happy path only. T-020 covers keepSelections / restore / idempotency.
 *
 * @module test/e2e/flows/billing/downgrade-restriction
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// vi.mock is also hoisted. The factory closes over `stubRef` and returns the
// current adapter every time `createMercadoPagoAdapter` is invoked. The
// downgrade restriction flow does NOT call the payment adapter (no
// mp_subscription_id set in this test), but the QZPay billing middleware
// initializes the adapter eagerly at app boot — the stub prevents it from
// reaching the MP network.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — downgrade-restriction.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { accommodations, billingSubscriptions, destinations, eq, ownerPromotions } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { applyScheduledPlanChangesJob } from '../../../../src/cron/jobs/apply-scheduled-plan-changes.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    getEntitlementCacheStats
} from '../../../../src/middlewares/entitlement.js';
import { createMockActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestPrice, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Construct the stub once per test file and wire it into the ref that the
// vi.mock factory reads. Tests reset response state per case via
// mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Cron context builder (mirrors plan-downgrade-cron.test.ts)
// ---------------------------------------------------------------------------

/**
 * Build a minimal CronJobContext for handler invocation.
 * Counts every log call so individual tests can assert what the cron emitted.
 */
function makeCronCtx() {
    const logs = {
        info: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        warn: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        error: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        debug: [] as Array<{ message: string; data?: Record<string, unknown> }>
    };
    const ctx = {
        logger: {
            info: (message: string, data?: Record<string, unknown>) => {
                logs.info.push({ message, data });
            },
            warn: (message: string, data?: Record<string, unknown>) => {
                logs.warn.push({ message, data });
            },
            error: (message: string, data?: Record<string, unknown>) => {
                logs.error.push({ message, data });
            },
            debug: (message: string, data?: Record<string, unknown>) => {
                logs.debug.push({ message, data });
            }
        },
        startedAt: new Date(),
        dryRun: false
    };
    return { ctx, logs };
}

// ---------------------------------------------------------------------------
// Actor builders
// ---------------------------------------------------------------------------

/**
 * Host actor with the minimum permissions needed to schedule a plan change and
 * read own accommodations via the protected list route.
 *
 * Includes ACCOMMODATION_VIEW_OWN so `accommodationService.list` passes its
 * can-view-own permission check inside the service layer, and
 * BILLING_VIEW_OWN + SUBSCRIPTION_VIEW_OWN so the billing middleware wires up
 * the billing customer id for the change-plan route.
 */
function makeHostActor(userId: string) {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.BILLING_VIEW_OWN,
            PermissionEnum.SUBSCRIPTION_VIEW_OWN,
            PermissionEnum.ACCOMMODATION_VIEW_OWN
        ],
        userId
    );
}

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

/**
 * Build a media JSONB value with a featured image and N gallery items.
 * Used to seed an accommodation with photos that will be over-cap after
 * the restriction runs.
 *
 * Each photo includes `moderationState: 'APPROVED'` to satisfy the
 * AccommodationPublicSchema validator when the public list route strips
 * the response payload against the declared schema. Without this the
 * route returns 500 "Response payload does not match declared schema".
 */
function buildMedia(params: {
    readonly galleryCount: number;
}): Record<string, unknown> {
    const gallery = Array.from({ length: params.galleryCount }, (_, i) => ({
        url: `https://cdn.example.com/gallery-${i + 1}.jpg`,
        alt: `Gallery image ${i + 1}`,
        moderationState: 'APPROVED'
    }));
    return {
        featuredImage: {
            url: 'https://cdn.example.com/featured.jpg',
            alt: 'Featured',
            moderationState: 'APPROVED'
        },
        gallery
    };
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-167 T-019 — downgrade restriction happy path', () => {
    let app: ReturnType<typeof initApp>;
    let hostClient: E2EApiClient;

    // Billing plan IDs (set in beforeEach)
    let ownerProPlanId: string;
    let ownerBasicoPlanId: string;

    // Host identity
    let hostUserId: string;
    let hostCustomerId: string;
    let hostSubscriptionId: string;

    // Accommodation IDs (set in beforeEach)
    let destId: string;
    let acc1Id: string; // kept (most-recently-updated)
    let acc2Id: string; // restricted (second)
    let acc3Id: string; // restricted + photos over cap (third, oldest)

    // Promotion IDs (set in beforeEach)
    let promo1Id: string;
    let promo2Id: string;

    // Photo counts for acc3
    const ACC3_GALLERY_COUNT = 8; // gallery photos; featuredImage = 1 → total = 9 > basico cap of 5
    const BASICO_PHOTO_CAP = 5;
    const ACC3_GALLERY_OVERFLOW = ACC3_GALLERY_COUNT - (BASICO_PHOTO_CAP - 1); // cap - 1 for featured

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        // ── 1. Create billing plans ──────────────────────────────────────
        // The cron uses `billing.plans.get(newPlanId)?.name` as the
        // `targetPlanSlug` passed to `applyDowngradeRestrictions`, which
        // in turn calls `getPlanBySlug(targetPlanSlug)` from the in-memory
        // billing catalog. For the restriction to find the correct limits,
        // the DB billing plan's `name` must equal the catalog's slug.
        //
        // owner-basico: slug = 'owner-basico', limits: accommodations=1, promotions=0, photos=5
        // owner-pro: slug = 'owner-pro', limits: accommodations=3, promotions=3, photos=15
        const ownerBasico = await createTestPlan({
            name: 'owner-basico', // must match the billing catalog slug
            entitlements: ['publish_accommodations', 'edit_accommodation_info', 'view_basic_stats'],
            limits: {
                max_accommodations: 1,
                max_active_promotions: 0,
                max_photos_per_accommodation: BASICO_PHOTO_CAP
            }
        });
        ownerBasicoPlanId = ownerBasico.planId;

        // Monthly price for owner-basico (lower) and owner-pro (higher).
        // The change-plan route's price comparison drives the downgrade branch.
        await createTestPrice({
            planId: ownerBasicoPlanId,
            unitAmount: 1_500_000, // ARS $15,000 (cheaper)
            billingInterval: 'month'
        });

        const ownerPro = await createTestPlan({
            name: 'owner-pro', // must match the billing catalog slug
            entitlements: [
                'publish_accommodations',
                'edit_accommodation_info',
                'view_basic_stats',
                'view_advanced_stats',
                'create_promotions'
            ],
            limits: {
                max_accommodations: 3,
                max_active_promotions: 3,
                max_photos_per_accommodation: 15
            }
        });
        ownerProPlanId = ownerPro.planId;

        await createTestPrice({
            planId: ownerProPlanId,
            unitAmount: 3_500_000, // ARS $35,000 (more expensive)
            billingInterval: 'month'
        });

        // ── 2. Create host user + billing customer ───────────────────────
        const user = await createTestUser({
            email: `downgrade-restriction-${Date.now()}@example.com`
        });
        hostUserId = user.id;

        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });
        hostCustomerId = customer.customerId;

        // currentPeriodEnd 60s in the past → schedule applyAt will be past → cron-due.
        const now = Date.now();
        const periodStart = new Date(now - 31 * 24 * 60 * 60 * 1000);
        const periodEnd = new Date(now - 60 * 1000);

        const sub = await createTestSubscription({
            customerId: hostCustomerId,
            planId: ownerProPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            metadata: { source: 'test-factory-downgrade-restriction' }
        });
        hostSubscriptionId = sub.subscriptionId;

        // ── 3. Create destination (FK for accommodations) ─────────────────
        destId = randomUUID();
        await testDb
            .getDb()
            .insert(destinations)
            .values({
                id: destId,
                destinationType: 'CITY',
                path: `/test-dest-${destId}`,
                slug: `test-dest-${destId}`,
                name: `Restriction Test Dest ${destId}`,
                summary: 'Restriction test destination',
                description: 'Restriction test destination for SPEC-167 T-019',
                location: { country: 'AR', state: 'ER', city: 'CDU' }
            } as typeof destinations.$inferInsert);

        // ── 4. Create 3 accommodations (cap = 1 on owner-basico) ──────────
        // Insert in sequence with slight timestamp offsets so `updatedAt` is
        // deterministic: acc1 is most-recently-updated → keepByDefault=true.
        // acc2 and acc3 will be restricted (keepByDefault=false).
        //
        // acc3 also has photos over the owner-basico cap (5) to exercise
        // the photo restriction primitive.

        acc1Id = randomUUID();
        await testDb
            .getDb()
            .insert(accommodations)
            .values({
                id: acc1Id,
                slug: `spec167-t019-acc1-${acc1Id.slice(0, 8)}`,
                name: 'Restriction Test Acc 1 (kept)',
                summary: 'Will be kept — most-recently-updated',
                type: 'APARTMENT',
                description: 'Accommodation 1 for SPEC-167 T-019',
                ownerId: hostUserId,
                destinationId: destId,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC',
                planRestricted: false,
                updatedAt: new Date(now - 1000) // most recent
            } as typeof accommodations.$inferInsert);

        acc2Id = randomUUID();
        await testDb
            .getDb()
            .insert(accommodations)
            .values({
                id: acc2Id,
                slug: `spec167-t019-acc2-${acc2Id.slice(0, 8)}`,
                name: 'Restriction Test Acc 2 (restricted)',
                summary: 'Will be planRestricted — second most recent',
                type: 'HOUSE',
                description: 'Accommodation 2 for SPEC-167 T-019',
                ownerId: hostUserId,
                destinationId: destId,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC',
                planRestricted: false,
                updatedAt: new Date(now - 5000) // second most recent
            } as typeof accommodations.$inferInsert);

        acc3Id = randomUUID();
        await testDb
            .getDb()
            .insert(accommodations)
            .values({
                id: acc3Id,
                slug: `spec167-t019-acc3-${acc3Id.slice(0, 8)}`,
                name: 'Restriction Test Acc 3 (restricted + photos)',
                summary: 'Will be planRestricted + photos archived',
                type: 'CABIN',
                description: 'Accommodation 3 for SPEC-167 T-019',
                ownerId: hostUserId,
                destinationId: destId,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC',
                planRestricted: false,
                media: buildMedia({ galleryCount: ACC3_GALLERY_COUNT }),
                updatedAt: new Date(now - 10000) // oldest → restricted by default sort
            } as typeof accommodations.$inferInsert);

        // ── 5. Create 2 ACTIVE promotions (cap = 0 on owner-basico) ───────
        const validFrom = new Date(now + 86400000);

        promo1Id = randomUUID();
        await testDb
            .getDb()
            .insert(ownerPromotions)
            .values({
                id: promo1Id,
                slug: `spec167-t019-promo1-${promo1Id.slice(0, 8)}`,
                ownerId: hostUserId,
                title: 'Restriction Test Promo 1',
                discountType: 'percentage',
                discountValue: 10,
                validFrom,
                lifecycleState: 'ACTIVE',
                planRestricted: false,
                updatedAt: new Date(now - 2000)
            } as typeof ownerPromotions.$inferInsert);

        promo2Id = randomUUID();
        await testDb
            .getDb()
            .insert(ownerPromotions)
            .values({
                id: promo2Id,
                slug: `spec167-t019-promo2-${promo2Id.slice(0, 8)}`,
                ownerId: hostUserId,
                title: 'Restriction Test Promo 2',
                discountType: 'percentage',
                discountValue: 15,
                validFrom,
                lifecycleState: 'ACTIVE',
                planRestricted: false,
                updatedAt: new Date(now - 6000)
            } as typeof ownerPromotions.$inferInsert);

        // ── 6. Build API clients ─────────────────────────────────────────
        const hostActor = makeHostActor(hostUserId);
        hostClient = new E2EApiClient(app, hostActor);

        // Clear any stale entitlement cache entry for this customer.
        clearEntitlementCache(hostCustomerId);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // Main happy-path test
    // =========================================================================

    it('schedule → restrictionPreview → cron apply → planRestricted flags + photos archived + public excludes + cache cleared', async () => {
        // ────────────────────────────────────────────────────────────────────
        // ARRANGE — verify the pre-condition: all 3 accommodations are visible
        // in the public list before the downgrade.
        // ────────────────────────────────────────────────────────────────────
        const prePublicRes = await app.request(
            `/api/v1/public/accommodations?destinationId=${destId}&pageSize=50`,
            { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'vitest' } }
        );
        expect(prePublicRes.status).toBe(200);
        const prePublicBody = (await prePublicRes.json()) as {
            data: { items: Array<{ id: string }> };
            pagination: { total: number };
        };
        // 3 accommodations should be visible pre-downgrade.
        const prePublicIds = prePublicBody.data.items.map((a) => a.id);
        expect(prePublicIds).toContain(acc1Id);
        expect(prePublicIds).toContain(acc2Id);
        expect(prePublicIds).toContain(acc3Id);

        // ────────────────────────────────────────────────────────────────────
        // ACT 1 — Schedule the downgrade via the protected route.
        //
        // Because currentPeriodEnd is already in the past, applyAt = periodEnd
        // which is also in the past → cron-due on the next tick.
        // ────────────────────────────────────────────────────────────────────
        const scheduleRes = await hostClient.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: ownerBasicoPlanId,
                billingInterval: 'monthly'
            }
        );
        expect(scheduleRes.status).toBe(200);

        const scheduleBody = (await scheduleRes.json()) as {
            success: boolean;
            data: {
                status: string;
                subscriptionId: string;
                previousPlanId: string;
                newPlanId: string;
                effectiveAt: string;
                restrictionPreview?: {
                    hasExcess: boolean;
                    accommodations: { cap: number; activeCount: number; excessCount: number };
                    promotions: { cap: number; activeCount: number; excessCount: number };
                    photos: Array<{
                        accommodationId: string;
                        cap: number;
                        excessCount: number;
                    }>;
                };
            };
        };

        // ── ASSERT: schedule response shape ──────────────────────────────
        expect(scheduleBody.success).toBe(true);
        expect(scheduleBody.data.status).toBe('scheduled');
        expect(scheduleBody.data.previousPlanId).toBe(ownerProPlanId);
        expect(scheduleBody.data.newPlanId).toBe(ownerBasicoPlanId);
        expect(scheduleBody.data.subscriptionId).toBe(hostSubscriptionId);

        // ── ASSERT: restrictionPreview (SPEC-167 T-016) ────────────────
        // The preview is computed by computeDowngradeExcess with the real
        // billing catalog limits for 'owner-basico'.
        const preview = scheduleBody.data.restrictionPreview;
        expect(preview, 'restrictionPreview must be present in schedule response').toBeDefined();
        expect(preview?.hasExcess).toBe(true);

        // Accommodations: 3 active, cap=1 on basico → excess=2
        expect(preview?.accommodations.cap).toBe(1);
        expect(preview?.accommodations.activeCount).toBe(3);
        expect(preview?.accommodations.excessCount).toBe(2);

        // Promotions: 2 active, cap=0 on basico → excess=2
        expect(preview?.promotions.cap).toBe(0);
        expect(preview?.promotions.activeCount).toBe(2);
        expect(preview?.promotions.excessCount).toBe(2);

        // Photos: acc3 has featuredImage + 8 gallery = 9 total, cap=5
        // → gallerySlots = 4, overflow = 8 - 4 = 4
        const photoEntries = preview?.photos ?? [];
        const acc3PhotoEntry = photoEntries.find((e) => e.accommodationId === acc3Id);
        expect(
            acc3PhotoEntry,
            `acc3 (${acc3Id}) must appear in restrictionPreview.photos`
        ).toBeDefined();
        expect(acc3PhotoEntry?.cap).toBe(BASICO_PHOTO_CAP);
        expect(acc3PhotoEntry?.excessCount).toBe(ACC3_GALLERY_OVERFLOW);

        // ── ASSERT: DB invariant — scheduledPlanChange written, plan_id unchanged ──
        const preCronRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, hostSubscriptionId));
        expect(preCronRows).toHaveLength(1);
        const preCronSchedule = preCronRows[0]?.scheduledPlanChange as Record<
            string,
            unknown
        > | null;
        expect(preCronSchedule?.status).toBe('pending');
        expect(preCronSchedule?.newPlanId).toBe(ownerBasicoPlanId);
        expect(new Date(preCronSchedule?.applyAt as string).getTime()).toBeLessThan(Date.now());
        // plan_id still points at owner-pro — unchanged until cron applies.
        expect(preCronRows[0]?.planId).toBe(ownerProPlanId);

        // Snapshot entitlement cache size before the cron tick.
        const cacheSizeBeforeCron = getEntitlementCacheStats().size;

        // ────────────────────────────────────────────────────────────────────
        // ACT 2 — Invoke the cron handler directly.
        //
        // The row is pending AND applyAt is in the past → exactly one row
        // will be applied. Step 3b of applyOne runs applyDowngradeRestrictions
        // because scheduledPlanChange.metadata.source === 'plan-change-downgrade'.
        // ────────────────────────────────────────────────────────────────────
        const { ctx, logs } = makeCronCtx();
        const cronResult = await applyScheduledPlanChangesJob.handler(ctx);

        // ── ASSERT: cron result counters ──────────────────────────────────
        expect(cronResult.success).toBe(true);
        expect(cronResult.processed).toBe(1);
        expect(cronResult.errors).toBe(0);
        expect(cronResult.details).toMatchObject({
            applied: 1,
            retried: 0,
            failed: 0,
            due: 1
        });

        // ── ASSERT: cron log contains "Scheduled plan change applied" ─────
        const appliedLog = logs.info.find((l) => l.message === 'Scheduled plan change applied');
        expect(appliedLog, 'cron must log Scheduled plan change applied').toBeDefined();
        expect(appliedLog?.data).toMatchObject({
            subscriptionId: hostSubscriptionId,
            customerId: hostCustomerId,
            oldPlanId: ownerProPlanId,
            newPlanId: ownerBasicoPlanId
        });

        // ── ASSERT: entitlement cache invalidated (delta = -1) ────────────
        // applyOne STEP 4 calls clearEntitlementCache(customerId) after step
        // 3b (restriction). A delta of 0 would mean the cache was NOT cleared.
        const cacheSizeAfterCron = getEntitlementCacheStats().size;
        expect(cacheSizeAfterCron).toBe(cacheSizeBeforeCron - 1);

        // ────────────────────────────────────────────────────────────────────
        // ASSERT: DB state after cron
        // ────────────────────────────────────────────────────────────────────

        // Sub: plan_id flipped to owner-basico, schedule marked applied.
        const postCronSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, hostSubscriptionId));
        expect(postCronSubs).toHaveLength(1);
        const postSub = postCronSubs[0];
        expect(postSub?.planId).toBe(ownerBasicoPlanId);
        expect(postSub?.status).toBe('active');
        const postSchedule = postSub?.scheduledPlanChange as Record<string, unknown> | null;
        expect(postSchedule?.status).toBe('applied');
        expect(postSchedule?.attemptCount).toBe(1);
        expect(postSchedule?.resolvedAt).toBeDefined();

        // ── ASSERT: accommodation planRestricted flags ─────────────────────
        // owner-basico cap = 1 → keep the 1 most-recently-updated (acc1).
        // acc2 and acc3 are restricted.
        const postAccRows = await testDb
            .getDb()
            .select({
                id: accommodations.id,
                planRestricted: accommodations.planRestricted
            })
            .from(accommodations)
            .where(eq(accommodations.ownerId, hostUserId));

        const postAccMap = Object.fromEntries(postAccRows.map((r) => [r.id, r.planRestricted]));

        expect(
            postAccMap[acc1Id],
            'acc1 (most-recently-updated) must remain planRestricted=false'
        ).toBe(false);
        expect(
            postAccMap[acc2Id],
            'acc2 must be planRestricted=true after downgrade restriction'
        ).toBe(true);
        expect(
            postAccMap[acc3Id],
            'acc3 must be planRestricted=true after downgrade restriction'
        ).toBe(true);

        // ── ASSERT: promotion planRestricted flags ─────────────────────────
        // owner-basico cap = 0 → ALL promotions restricted.
        const postPromoRows = await testDb
            .getDb()
            .select({
                id: ownerPromotions.id,
                planRestricted: ownerPromotions.planRestricted
            })
            .from(ownerPromotions)
            .where(eq(ownerPromotions.ownerId, hostUserId));

        const postPromoMap = Object.fromEntries(postPromoRows.map((r) => [r.id, r.planRestricted]));

        expect(
            postPromoMap[promo1Id],
            'promo1 must be planRestricted=true (cap=0 → all restricted)'
        ).toBe(true);
        expect(
            postPromoMap[promo2Id],
            'promo2 must be planRestricted=true (cap=0 → all restricted)'
        ).toBe(true);

        // ── ASSERT: photos archived in acc3 ───────────────────────────────
        // acc3 originally: featuredImage + 8 gallery = 9 total, cap=5.
        // After restriction: featuredImage stays, 4 gallery slots kept,
        // remaining 4 gallery items moved to archivedGallery.
        // Conservation: archivedCount + keptGalleryCount == original gallery count.
        const postAcc3Rows = await testDb
            .getDb()
            .select({ media: accommodations.media })
            .from(accommodations)
            .where(eq(accommodations.id, acc3Id));

        const postAcc3Media = postAcc3Rows[0]?.media as {
            featuredImage?: { url: string };
            gallery?: Array<{ url: string }>;
            archivedGallery?: Array<{ url: string }>;
        } | null;

        expect(postAcc3Media, 'acc3 media must be present after restriction').toBeDefined();

        // Featured image must always be preserved.
        expect(
            postAcc3Media?.featuredImage?.url,
            'acc3 featuredImage must be preserved after photo restriction'
        ).toBe('https://cdn.example.com/featured.jpg');

        const keptGalleryCount = postAcc3Media?.gallery?.length ?? 0;
        const archivedCount = postAcc3Media?.archivedGallery?.length ?? 0;

        // Photos are conserved: original 8 gallery = kept + archived.
        expect(
            keptGalleryCount + archivedCount,
            'photo conservation: kept + archived must equal original gallery count'
        ).toBe(ACC3_GALLERY_COUNT);

        // Kept gallery must be within the basico cap (cap - 1 for featured).
        const maxGallerySlots = BASICO_PHOTO_CAP - 1; // 4
        expect(
            keptGalleryCount,
            `kept gallery count must be <= ${maxGallerySlots} (basico cap minus featured)`
        ).toBeLessThanOrEqual(maxGallerySlots);

        // Archived count = overflow amount = ACC3_GALLERY_OVERFLOW.
        expect(archivedCount, `archived photo count must be ${ACC3_GALLERY_OVERFLOW}`).toBe(
            ACC3_GALLERY_OVERFLOW
        );

        // ────────────────────────────────────────────────────────────────────
        // ASSERT: public list/detail excludes planRestricted accommodations
        //
        // Public reads call accommodationService.search with
        // excludePlanRestricted=true for non-VIP, non-owner scope.
        // After restriction, acc2 and acc3 must NOT appear in public results.
        // ────────────────────────────────────────────────────────────────────
        const postPublicRes = await app.request(
            `/api/v1/public/accommodations?destinationId=${destId}&pageSize=50`,
            { method: 'GET', headers: { accept: 'application/json', 'user-agent': 'vitest' } }
        );
        expect(postPublicRes.status).toBe(200);
        const postPublicBody = (await postPublicRes.json()) as {
            data: { items: Array<{ id: string }> };
            pagination: { total: number };
        };

        const postPublicIds = postPublicBody.data.items.map((a) => a.id);

        expect(
            postPublicIds,
            'acc1 (kept) must still appear in public list after downgrade restriction'
        ).toContain(acc1Id);
        expect(
            postPublicIds,
            'acc2 (planRestricted=true) must NOT appear in public list'
        ).not.toContain(acc2Id);
        expect(
            postPublicIds,
            'acc3 (planRestricted=true) must NOT appear in public list'
        ).not.toContain(acc3Id);

        // ────────────────────────────────────────────────────────────────────
        // ASSERT: owner's protected list still shows all accommodations
        //
        // The protected list uses accommodationService.list with
        // excludePlanRestricted=false for the owner's own scope. The host
        // sees all their accommodations regardless of planRestricted flag.
        // ────────────────────────────────────────────────────────────────────
        const postProtectedRes = await hostClient.get('/api/v1/protected/accommodations');
        expect(postProtectedRes.status).toBe(200);
        const postProtectedBody = (await postProtectedRes.json()) as {
            data: { items: Array<{ id: string }> };
            success: boolean;
        };

        expect(postProtectedBody.success).toBe(true);
        const postProtectedIds = postProtectedBody.data.items.map((a: { id: string }) => a.id);

        expect(postProtectedIds, 'acc1 must be visible in owner protected list').toContain(acc1Id);
        expect(
            postProtectedIds,
            'acc2 (planRestricted) must still be visible in owner protected list'
        ).toContain(acc2Id);
        expect(
            postProtectedIds,
            'acc3 (planRestricted) must still be visible in owner protected list'
        ).toContain(acc3Id);
    });
});
