/**
 * SPEC-167 T-020 — keepSelections honored + restore-on-upgrade + idempotent re-apply.
 *
 * Three scenarios that extend the T-019 happy-path coverage with the
 * explicit-selection and upgrade-restoration surfaces:
 *
 * SCENARIO 1 — keepSelections OVERRIDES the default (most-recently-updated) sort:
 *   Host has 3 accommodations (cap → 1 on owner-basico).
 *   Default sort would keep acc1 (most-recently-updated).
 *   Host sends keepSelections.accommodationIds = [acc3Id] (the OLDEST).
 *   Expected: acc3 stays active, acc1 + acc2 become planRestricted.
 *   Also: photoKeepMap on acc2 pins specific gallery URLs for the photo-restriction
 *   primitive (acc2 has 8 gallery photos; host keeps the first 4 URLs explicitly).
 *
 * SCENARIO 2 — restore-on-upgrade reverses the restriction:
 *   Starting from scenario-1's post-state (acc1 + acc2 restricted, acc3 active).
 *   Upgrade trigger: call applyUpgradeRestorations directly with the high-plan
 *   ID (owner-pro, cap=3 → unlimited-ish for the 3 accommodations in play).
 *   Expected: planRestricted cleared on acc1 + acc2; archived photos of acc2
 *   restored back into gallery (count conservation).
 *   Promotions: both promo1 + promo2 restored (pro cap = 3, was 0).
 *
 * SCENARIO 3 — idempotent re-apply of a completed cron run:
 *   Starting from scenario-1's post-state (acc3 kept, acc1+acc2 restricted).
 *   Run cron handler a SECOND time.
 *   Expected: the schedule is already status='applied' → no row is due →
 *   result.processed=0, result.details.applied=0, planRestricted state unchanged.
 *   The pre-stamp (SPEC-194) guarantees this: once status='applied' the row
 *   is invisible to findDueScheduledChanges.
 *
 * **Upgrade-trigger choice (documented per task instructions):**
 *   We call `applyUpgradeRestorations` directly (from the service layer)
 *   rather than routing through the webhook or admin-hook path. Rationale:
 *   - The webhook path requires firing a simulated MP payment event, which
 *     adds ~100 lines of setup (checkout creation, payment stub, event
 *     dispatch) for zero extra coverage — the restoration logic is the same
 *     function in all call sites.
 *   - The admin-hook path (onAfterSubscriptionChangePlan) requires an admin
 *     actor + a billing.subscriptions.changePlan call, which again adds
 *     setup that is already exercised in plan-upgrade.test.ts.
 *   - Calling the service directly is the approach plan-downgrade-cron.test.ts
 *     already establishes for calling `applyScheduledPlanChangesJob.handler`;
 *     both test the "real implementation minus the HTTP wrapper".
 *   - The service function is already integration-tested at the unit level
 *     (plan-upgrade-restoration.service.test.ts). The e2e value here is
 *     verifying that the full DB round-trip (restrict → upgrade → restore)
 *     produces the correct final state, which the direct service call gives us.
 *
 * @module test/e2e/flows/billing/downgrade-restriction-selections
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between the
// vi.mock factory (which captures it at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// The downgrade restriction + upgrade restoration flows do NOT call the MP
// payment adapter in this test (mp_subscription_id is NULL — no real preapproval
// is registered). The stub is still required because the QZPay billing middleware
// initializes the adapter eagerly at app boot without it reaches the MP network.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — downgrade-restriction-selections.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import {
    accommodationMedia,
    accommodations,
    billingSubscriptions,
    destinations,
    eq,
    ownerPromotions
} from '@repo/db';
import type { InsertAccommodationMedia } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { applyScheduledPlanChangesJob } from '../../../../src/cron/jobs/apply-scheduled-plan-changes.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { applyUpgradeRestorations } from '../../../../src/services/plan-upgrade-restoration.service.js';
import { createMockActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestPrice, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Construct the stub once per test file and wire it into the ref.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Plan caps (mirrors billing catalog)
// ---------------------------------------------------------------------------

const BASICO_ACC_CAP = 1;
const BASICO_PROMO_CAP = 0;
const BASICO_PHOTO_CAP = 5; // gallery + featured ≤ 5 → gallery slots = 4

const PRO_ACC_CAP = 3;
const PRO_PROMO_CAP = 3;
const PRO_PHOTO_CAP = 15;

// acc2 gallery count (will be over cap after downgrade restriction)
const ACC2_GALLERY_COUNT = 8;
// After basico restriction: keep 4 gallery slots → archive 4
const ACC2_GALLERY_KEPT_DEFAULT = BASICO_PHOTO_CAP - 1; // 4 (gallery slots)
const ACC2_GALLERY_OVERFLOW = ACC2_GALLERY_COUNT - ACC2_GALLERY_KEPT_DEFAULT; // 4

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
// Actor builder
// ---------------------------------------------------------------------------

/**
 * Host actor with the minimum permissions needed to schedule a plan change and
 * read own accommodations via the protected list route.
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
 * Every photo includes `moderationState: 'APPROVED'` to satisfy the
 * AccommodationPublicSchema validator so the public list route does not 500.
 */
function buildMedia(params: { readonly galleryCount: number }): Record<string, unknown> {
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

/**
 * Enumerate the first N gallery URLs from the media shape produced by buildMedia.
 * Used to construct the keepSelections.photoKeepMap in the test body.
 */
function galleryUrls(fromIndex: number, toIndex: number): string[] {
    return Array.from(
        { length: toIndex - fromIndex },
        (_, i) => `https://cdn.example.com/gallery-${fromIndex + i + 1}.jpg`
    );
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-167 T-020 — keepSelections + restore-on-upgrade + idempotent re-apply', () => {
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
    // acc1: most-recently-updated → default would keep this
    let acc1Id: string;
    // acc2: second most recent, has photos over-cap; host will NOT select this to keep
    let acc2Id: string;
    // acc3: oldest → default would restrict this; HOST SELECTS TO KEEP
    let acc3Id: string;

    // Promotion IDs (set in beforeEach)
    let promo1Id: string;
    let promo2Id: string;

    // Photo keep selections for acc2 (the host-selected gallery URLs to keep)
    let acc2PhotoKeepUrls: string[];

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

        // ── 1. Create billing plans ──────────────────────────────────────────
        // Plan names MUST match billing catalog slugs so the restriction
        // service can look up limits via getPlanBySlug(plan.name).
        const ownerBasico = await createTestPlan({
            name: 'owner-basico',
            entitlements: ['publish_accommodations', 'edit_accommodation_info', 'view_basic_stats'],
            limits: {
                max_accommodations: BASICO_ACC_CAP,
                max_active_promotions: BASICO_PROMO_CAP,
                max_photos_per_accommodation: BASICO_PHOTO_CAP
            }
        });
        ownerBasicoPlanId = ownerBasico.planId;

        await createTestPrice({
            planId: ownerBasicoPlanId,
            unitAmount: 1_500_000, // cheaper → basico is the downgrade target
            billingInterval: 'month'
        });

        const ownerPro = await createTestPlan({
            name: 'owner-pro',
            entitlements: [
                'publish_accommodations',
                'edit_accommodation_info',
                'view_basic_stats',
                'view_advanced_stats',
                'create_promotions'
            ],
            limits: {
                max_accommodations: PRO_ACC_CAP,
                max_active_promotions: PRO_PROMO_CAP,
                max_photos_per_accommodation: PRO_PHOTO_CAP
            }
        });
        ownerProPlanId = ownerPro.planId;

        await createTestPrice({
            planId: ownerProPlanId,
            unitAmount: 3_500_000, // more expensive → pro is the "high" plan
            billingInterval: 'month'
        });

        // ── 2. Create host user + billing customer ───────────────────────────
        const user = await createTestUser({
            email: `downgrade-selections-${Date.now()}@example.com`
        });
        hostUserId = user.id;

        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_sel_${user.id.slice(0, 8)}` }
        });
        hostCustomerId = customer.customerId;

        // currentPeriodEnd 60s in the past → applyAt will be past → cron-due.
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
            metadata: { source: 'test-factory-downgrade-selections' }
        });
        hostSubscriptionId = sub.subscriptionId;

        // ── 3. Create destination (FK for accommodations) ─────────────────────
        destId = randomUUID();
        await testDb
            .getDb()
            .insert(destinations)
            .values({
                id: destId,
                destinationType: 'CITY',
                path: `/test-dest-sel-${destId}`,
                slug: `test-dest-sel-${destId}`,
                name: `Selections Test Dest ${destId}`,
                summary: 'Selections test destination',
                description: 'Selections test destination for SPEC-167 T-020',
                location: { country: 'AR', state: 'ER', city: 'CDU' }
            } as typeof destinations.$inferInsert);

        // ── 4. Create 3 accommodations ────────────────────────────────────────
        // Insert with deterministic updatedAt offsets:
        //   acc1: most-recently-updated (would be KEPT by default sort)
        //   acc2: second, has 8 gallery photos (over cap), NOT selected by host to keep
        //   acc3: oldest (would be RESTRICTED by default) → HOST EXPLICITLY SELECTS THIS
        //
        // With keepSelections.accommodationIds = [acc3Id]:
        //   acc3 stays active (host selection overrides default)
        //   acc1 + acc2 become planRestricted (counter-intuitive but correct)

        acc1Id = randomUUID();
        await testDb
            .getDb()
            .insert(accommodations)
            .values({
                id: acc1Id,
                slug: `spec167-t020-acc1-${acc1Id.slice(0, 8)}`,
                name: 'Selections Test Acc 1 (most-recent, NOT selected)',
                summary: 'Most-recently-updated — default would keep this but host overrides',
                type: 'APARTMENT',
                description: 'Accommodation 1 for SPEC-167 T-020',
                ownerId: hostUserId,
                destinationId: destId,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC',
                planRestricted: false,
                updatedAt: new Date(now - 1000) // most recent
            } as typeof accommodations.$inferInsert);

        // acc2 has 8 gallery photos → over basico photo cap (4 gallery slots).
        // The host does NOT select acc2 to keep accommodations, BUT provides
        // a photoKeepMap for acc2 that pins the first 4 gallery URLs.
        // Since acc2 will be planRestricted, the photo restriction primitive
        // still runs on it in the cron path (it is a separate dimension).
        acc2Id = randomUUID();
        acc2PhotoKeepUrls = galleryUrls(0, ACC2_GALLERY_KEPT_DEFAULT); // first 4 URLs
        await testDb
            .getDb()
            .insert(accommodations)
            .values({
                id: acc2Id,
                slug: `spec167-t020-acc2-${acc2Id.slice(0, 8)}`,
                name: 'Selections Test Acc 2 (photo over-cap, NOT selected to keep)',
                summary: 'Will be planRestricted; photos archived — host pins kept URLs',
                type: 'HOUSE',
                description: 'Accommodation 2 for SPEC-167 T-020',
                ownerId: hostUserId,
                destinationId: destId,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC',
                planRestricted: false,
                media: buildMedia({ galleryCount: ACC2_GALLERY_COUNT }),
                updatedAt: new Date(now - 5000) // second most recent
            } as typeof accommodations.$inferInsert);

        // Seed acc2's photos into accommodation_media (SPEC-204 cutover).
        // The archive/restore primitives now read/write this table exclusively —
        // the JSONB blob above is kept for other consumers but ignored by the
        // photo-restriction logic.
        // 1 featured row (sort_order=0) + 8 gallery rows (sort_order 1..8).
        const featuredUrl = 'https://cdn.example.com/featured.jpg';
        const acc2MediaRows: InsertAccommodationMedia[] = [
            {
                accommodationId: acc2Id,
                url: featuredUrl,
                state: 'visible',
                isFeatured: true,
                sortOrder: 0,
                moderationState: 'APPROVED'
            },
            ...galleryUrls(0, ACC2_GALLERY_COUNT).map(
                (url, i): InsertAccommodationMedia => ({
                    accommodationId: acc2Id,
                    url,
                    state: 'visible',
                    isFeatured: false,
                    sortOrder: i + 1, // gallery starts at sort_order 1 (featured holds 0)
                    moderationState: 'APPROVED'
                })
            )
        ];
        await testDb.getDb().insert(accommodationMedia).values(acc2MediaRows);

        // acc3: oldest → host explicitly selects this one to keep.
        acc3Id = randomUUID();
        await testDb
            .getDb()
            .insert(accommodations)
            .values({
                id: acc3Id,
                slug: `spec167-t020-acc3-${acc3Id.slice(0, 8)}`,
                name: 'Selections Test Acc 3 (oldest — HOST KEEPS THIS)',
                summary: 'Oldest by updatedAt; host explicitly selects to keep active',
                type: 'CABIN',
                description: 'Accommodation 3 for SPEC-167 T-020',
                ownerId: hostUserId,
                destinationId: destId,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC',
                planRestricted: false,
                updatedAt: new Date(now - 10000) // oldest
            } as typeof accommodations.$inferInsert);

        // ── 5. Create 2 ACTIVE promotions (cap = 0 on owner-basico) ────────────
        const validFrom = new Date(now + 86400000);

        promo1Id = randomUUID();
        await testDb
            .getDb()
            .insert(ownerPromotions)
            .values({
                id: promo1Id,
                slug: `spec167-t020-promo1-${promo1Id.slice(0, 8)}`,
                ownerId: hostUserId,
                title: 'Selections Test Promo 1',
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
                slug: `spec167-t020-promo2-${promo2Id.slice(0, 8)}`,
                ownerId: hostUserId,
                title: 'Selections Test Promo 2',
                discountType: 'percentage',
                discountValue: 15,
                validFrom,
                lifecycleState: 'ACTIVE',
                planRestricted: false,
                updatedAt: new Date(now - 6000)
            } as typeof ownerPromotions.$inferInsert);

        // ── 6. Build API client ───────────────────────────────────────────────
        const hostActor = makeHostActor(hostUserId);
        hostClient = new E2EApiClient(app, hostActor);

        // Clear any stale entitlement cache entry.
        clearEntitlementCache(hostCustomerId);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // SCENARIO 1 — keepSelections OVERRIDES the default keep order
    // =========================================================================

    it('SCENARIO 1: host-selected accommodationId overrides default sort — oldest acc stays active, most-recent acc is restricted', async () => {
        // ── ARRANGE ────────────────────────────────────────────────────────────
        // Schedule the downgrade WITH explicit keepSelections:
        //   - accommodationIds = [acc3Id] → keep the OLDEST (overrides default)
        //   - photoKeepMap[acc2Id] = first 4 gallery URLs → pins photo subset
        //
        // Without keepSelections the default would keep acc1 (most-recently-updated).
        // With the selection, acc3 is kept and acc1+acc2 are restricted.
        const scheduleRes = await hostClient.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: ownerBasicoPlanId,
                billingInterval: 'monthly',
                keepSelections: {
                    accommodationIds: [acc3Id],
                    photoKeepMap: {
                        [acc2Id]: acc2PhotoKeepUrls
                    }
                }
            }
        );
        expect(scheduleRes.status).toBe(200);

        const scheduleBody = (await scheduleRes.json()) as { success: boolean; data: unknown };
        expect(scheduleBody.success).toBe(true);

        // Verify keepSelections is persisted in scheduledPlanChange.metadata.
        const preRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, hostSubscriptionId));
        expect(preRows).toHaveLength(1);
        const preSchedule = preRows[0]?.scheduledPlanChange as Record<string, unknown> | null;
        expect(preSchedule?.status).toBe('pending');
        expect(preSchedule?.newPlanId).toBe(ownerBasicoPlanId);
        // keepSelections is stored as JSON string in metadata (QZPayMetadata restriction)
        const preMetadata = preSchedule?.metadata as Record<string, unknown> | undefined;
        expect(
            preMetadata?.keepSelections,
            'keepSelections must be persisted in metadata'
        ).toBeDefined();
        const parsedSelections = JSON.parse(preMetadata?.keepSelections as string) as Record<
            string,
            unknown
        >;
        expect(parsedSelections.accommodationIds).toEqual([acc3Id]);
        expect((parsedSelections.photoKeepMap as Record<string, unknown>)[acc2Id]).toEqual(
            acc2PhotoKeepUrls
        );

        // ── ACT — run the cron ─────────────────────────────────────────────────
        const { ctx } = makeCronCtx();
        const cronResult = await applyScheduledPlanChangesJob.handler(ctx);

        // ── ASSERT: cron applied 1 row ─────────────────────────────────────────
        expect(cronResult.success).toBe(true);
        expect(cronResult.processed).toBe(1);
        expect(cronResult.errors).toBe(0);
        expect(cronResult.details).toMatchObject({ applied: 1, retried: 0, failed: 0, due: 1 });

        // ── ASSERT: accommodation planRestricted flags ─────────────────────────
        // keepSelections.accommodationIds = [acc3Id] → acc3 stays active
        // acc1 (most-recent, NOT selected) → restricted
        // acc2 (second, NOT selected) → restricted
        const postAccRows = await testDb
            .getDb()
            .select({ id: accommodations.id, planRestricted: accommodations.planRestricted })
            .from(accommodations)
            .where(eq(accommodations.ownerId, hostUserId));

        const postAccMap = Object.fromEntries(postAccRows.map((r) => [r.id, r.planRestricted]));

        expect(
            postAccMap[acc3Id],
            'acc3 (HOST-SELECTED oldest) must remain planRestricted=false — selection overrides default sort'
        ).toBe(false);
        expect(
            postAccMap[acc1Id],
            'acc1 (most-recently-updated, NOT in selection) must become planRestricted=true'
        ).toBe(true);
        expect(postAccMap[acc2Id], 'acc2 (NOT in selection) must become planRestricted=true').toBe(
            true
        );

        // ── ASSERT: promotions all restricted (cap = 0) ─────────────────────────
        const postPromoRows = await testDb
            .getDb()
            .select({ id: ownerPromotions.id, planRestricted: ownerPromotions.planRestricted })
            .from(ownerPromotions)
            .where(eq(ownerPromotions.ownerId, hostUserId));

        const postPromoMap = Object.fromEntries(postPromoRows.map((r) => [r.id, r.planRestricted]));
        expect(postPromoMap[promo1Id]).toBe(true);
        expect(postPromoMap[promo2Id]).toBe(true);

        // ── ASSERT: acc2 photos — host-pinned URLs kept, rest archived ──────────
        // After the cron runs archiveAccommodationPhotos with keepIds = first 4 URLs:
        //   visible non-featured count = ACC2_GALLERY_KEPT_DEFAULT (4)
        //   archived count             = ACC2_GALLERY_OVERFLOW (4)
        //   featured row remains visible (is_featured=true, state='visible')
        const postAcc2MediaRows = await testDb
            .getDb()
            .select({
                url: accommodationMedia.url,
                state: accommodationMedia.state,
                isFeatured: accommodationMedia.isFeatured
            })
            .from(accommodationMedia)
            .where(eq(accommodationMedia.accommodationId, acc2Id));

        const acc2FeaturedRows = postAcc2MediaRows.filter(
            (r) => r.isFeatured && r.state === 'visible'
        );
        const acc2VisibleGallery = postAcc2MediaRows.filter(
            (r) => !r.isFeatured && r.state === 'visible'
        );
        const acc2ArchivedRows = postAcc2MediaRows.filter((r) => r.state === 'archived');

        // Featured image row preserved.
        expect(
            acc2FeaturedRows,
            'acc2 featured row must remain visible after archive'
        ).toHaveLength(1);
        expect(acc2FeaturedRows[0]?.url).toBe('https://cdn.example.com/featured.jpg');

        // Photo conservation: visible gallery + archived = original gallery count.
        expect(
            acc2VisibleGallery.length + acc2ArchivedRows.length,
            'photo conservation: visible gallery + archived must equal ACC2_GALLERY_COUNT'
        ).toBe(ACC2_GALLERY_COUNT);

        // The host-pinned URLs must all be among the visible non-featured rows.
        const visibleGalleryUrlSet = new Set(acc2VisibleGallery.map((r) => r.url));
        for (const pinnedUrl of acc2PhotoKeepUrls) {
            expect(
                visibleGalleryUrlSet.has(pinnedUrl),
                `pinned URL ${pinnedUrl} must remain visible`
            ).toBe(true);
        }

        // Visible gallery count = gallery slots kept (4).
        expect(acc2VisibleGallery).toHaveLength(ACC2_GALLERY_KEPT_DEFAULT);
        // Archived count = overflow (gallery-5..gallery-8 = 4 items).
        expect(acc2ArchivedRows).toHaveLength(ACC2_GALLERY_OVERFLOW);

        // acc3 has no accommodation_media rows at all (no photos were seeded for it).
        const postAcc3MediaRows = await testDb
            .getDb()
            .select({ state: accommodationMedia.state })
            .from(accommodationMedia)
            .where(eq(accommodationMedia.accommodationId, acc3Id));
        const acc3ArchivedRows = postAcc3MediaRows.filter((r) => r.state === 'archived');
        expect(acc3ArchivedRows).toHaveLength(0);
    });

    // =========================================================================
    // SCENARIO 2 — restore-on-upgrade reverses the restriction
    // =========================================================================

    it('SCENARIO 2: upgrade to owner-pro restores planRestricted resources and archived photos', async () => {
        // ── ARRANGE — first get into the restricted state ──────────────────────
        // Schedule downgrade WITH keepSelections (acc3 kept, acc1+acc2 restricted)
        const scheduleRes = await hostClient.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: ownerBasicoPlanId,
                billingInterval: 'monthly',
                keepSelections: {
                    accommodationIds: [acc3Id],
                    photoKeepMap: { [acc2Id]: acc2PhotoKeepUrls }
                }
            }
        );
        expect(scheduleRes.status).toBe(200);

        // Run cron to apply the restriction.
        const { ctx: cronCtx1 } = makeCronCtx();
        const cronResult1 = await applyScheduledPlanChangesJob.handler(cronCtx1);
        expect(cronResult1.details).toMatchObject({ applied: 1, due: 1 });

        // Verify restricted state (pre-upgrade sanity).
        const preUpgradeAccRows = await testDb
            .getDb()
            .select({ id: accommodations.id, planRestricted: accommodations.planRestricted })
            .from(accommodations)
            .where(eq(accommodations.ownerId, hostUserId));
        const preUpgradeAccMap = Object.fromEntries(
            preUpgradeAccRows.map((r) => [r.id, r.planRestricted])
        );
        expect(preUpgradeAccMap[acc1Id]).toBe(true);
        expect(preUpgradeAccMap[acc2Id]).toBe(true);
        expect(preUpgradeAccMap[acc3Id]).toBe(false);

        // Verify acc2 has archived photos (pre-upgrade sanity).
        const preUpgradeAcc2MediaRows = await testDb
            .getDb()
            .select({ state: accommodationMedia.state })
            .from(accommodationMedia)
            .where(eq(accommodationMedia.accommodationId, acc2Id));
        const preUpgradeArchivedCount = preUpgradeAcc2MediaRows.filter(
            (r) => r.state === 'archived'
        ).length;
        expect(preUpgradeArchivedCount).toBe(ACC2_GALLERY_OVERFLOW);

        // ── ACT — trigger upgrade restoration directly via the service ──────────
        // See file JSDoc for rationale: calling applyUpgradeRestorations directly
        // avoids webhook/admin-hook complexity while still exercising the full
        // DB round-trip (restrict → restore).
        //
        // newPlanId = ownerProPlanId (high plan, cap=3 accommodations, cap=3 promos,
        // cap=15 photos) → headroom for all 3 accommodations, both promotions, and
        // all photos in archivedGallery.
        const summary = await applyUpgradeRestorations({
            userId: hostUserId,
            customerId: hostCustomerId,
            newPlanId: ownerProPlanId
        });

        // ── ASSERT: restoration summary ────────────────────────────────────────
        // acc1 + acc2 were restricted → both should be in summary.restored.accommodations
        expect(
            summary.restored.accommodations,
            'acc1 must be in restored.accommodations'
        ).toContain(acc1Id);
        expect(
            summary.restored.accommodations,
            'acc2 must be in restored.accommodations'
        ).toContain(acc2Id);
        expect(
            summary.restored.promotions.length,
            'both promos must be restored (cap=3, was 0)'
        ).toBe(2);
        expect(summary.restored.promotions).toContain(promo1Id);
        expect(summary.restored.promotions).toContain(promo2Id);

        // stillRestricted should be empty — pro cap (3) covers all 3 accommodations
        expect(summary.stillRestricted.accommodations).toHaveLength(0);
        expect(summary.stillRestricted.promotions).toHaveLength(0);

        // ── ASSERT: DB — accommodation planRestricted cleared ─────────────────
        const postUpgradeAccRows = await testDb
            .getDb()
            .select({ id: accommodations.id, planRestricted: accommodations.planRestricted })
            .from(accommodations)
            .where(eq(accommodations.ownerId, hostUserId));

        const postUpgradeAccMap = Object.fromEntries(
            postUpgradeAccRows.map((r) => [r.id, r.planRestricted])
        );

        expect(
            postUpgradeAccMap[acc1Id],
            'acc1 must be planRestricted=false after upgrade restoration'
        ).toBe(false);
        expect(
            postUpgradeAccMap[acc2Id],
            'acc2 must be planRestricted=false after upgrade restoration'
        ).toBe(false);
        expect(
            postUpgradeAccMap[acc3Id],
            'acc3 was never restricted — must stay planRestricted=false'
        ).toBe(false);

        // ── ASSERT: DB — promotion planRestricted cleared ─────────────────────
        const postUpgradePromoRows = await testDb
            .getDb()
            .select({ id: ownerPromotions.id, planRestricted: ownerPromotions.planRestricted })
            .from(ownerPromotions)
            .where(eq(ownerPromotions.ownerId, hostUserId));

        const postUpgradePromoMap = Object.fromEntries(
            postUpgradePromoRows.map((r) => [r.id, r.planRestricted])
        );
        expect(postUpgradePromoMap[promo1Id]).toBe(false);
        expect(postUpgradePromoMap[promo2Id]).toBe(false);

        // ── ASSERT: acc2 archived photos restored — count conservation ─────────
        // Before: visible gallery=4, archived=4.
        // After restore (pro cap=15 > 4 kept + 4 archived = 8 total):
        //   all archived rows should be flipped back to visible.
        // Conservation: visible non-featured + archived = original ACC2_GALLERY_COUNT.
        const postUpgradeAcc2MediaRows = await testDb
            .getDb()
            .select({
                url: accommodationMedia.url,
                state: accommodationMedia.state,
                isFeatured: accommodationMedia.isFeatured
            })
            .from(accommodationMedia)
            .where(eq(accommodationMedia.accommodationId, acc2Id));

        const postUpgradeFeaturedRows = postUpgradeAcc2MediaRows.filter(
            (r) => r.isFeatured && r.state === 'visible'
        );
        const postUpgradeVisibleGallery = postUpgradeAcc2MediaRows.filter(
            (r) => !r.isFeatured && r.state === 'visible'
        );
        const postUpgradeArchivedRows = postUpgradeAcc2MediaRows.filter(
            (r) => r.state === 'archived'
        );

        // Featured row preserved throughout.
        expect(
            postUpgradeFeaturedRows,
            'acc2 featured row must remain visible after upgrade restore'
        ).toHaveLength(1);
        expect(postUpgradeFeaturedRows[0]?.url).toBe('https://cdn.example.com/featured.jpg');

        // Photo conservation: visible gallery + archived = original ACC2_GALLERY_COUNT.
        expect(
            postUpgradeVisibleGallery.length + postUpgradeArchivedRows.length,
            'photo conservation: visible gallery + archived must equal ACC2_GALLERY_COUNT'
        ).toBe(ACC2_GALLERY_COUNT);

        // With pro cap=15 and only 8 photos total, all archived rows are restored.
        expect(
            postUpgradeArchivedRows,
            'all archived photos must be restored when pro cap (15) > total photos (8)'
        ).toHaveLength(0);
        expect(postUpgradeVisibleGallery).toHaveLength(ACC2_GALLERY_COUNT);

        // Photos restored by the service (movedCount > 0 for acc2).
        expect(
            summary.restored.photosByAccommodation[acc2Id],
            `acc2 movedCount must be ${ACC2_GALLERY_OVERFLOW}`
        ).toBe(ACC2_GALLERY_OVERFLOW);
    });

    // =========================================================================
    // SCENARIO 3 — idempotent re-apply: second cron run is a no-op
    // =========================================================================

    it('SCENARIO 3: re-running the cron after apply is a no-op (pre-stamp idempotency)', async () => {
        // ── ARRANGE — schedule and apply the downgrade once ───────────────────
        const scheduleRes = await hostClient.post(
            '/api/v1/protected/billing/subscriptions/change-plan',
            {
                newPlanId: ownerBasicoPlanId,
                billingInterval: 'monthly',
                keepSelections: { accommodationIds: [acc3Id] }
            }
        );
        expect(scheduleRes.status).toBe(200);

        // First cron run: applies the change + restriction.
        const { ctx: firstCtx } = makeCronCtx();
        const firstResult = await applyScheduledPlanChangesJob.handler(firstCtx);
        expect(firstResult.success).toBe(true);
        expect(firstResult.details).toMatchObject({ applied: 1, retried: 0, failed: 0, due: 1 });

        // Snapshot state after the first tick.
        const afterFirstRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, hostSubscriptionId));
        const afterFirstSchedule = afterFirstRows[0]?.scheduledPlanChange as Record<
            string,
            unknown
        >;
        expect(afterFirstSchedule.status).toBe('applied');
        expect(afterFirstSchedule.attemptCount).toBe(1);
        const resolvedAtAfterFirst = afterFirstSchedule.resolvedAt as string;
        expect(resolvedAtAfterFirst).toBeDefined();

        // Accommodation state after first tick: acc3 active, acc1+acc2 restricted.
        const afterFirstAccRows = await testDb
            .getDb()
            .select({ id: accommodations.id, planRestricted: accommodations.planRestricted })
            .from(accommodations)
            .where(eq(accommodations.ownerId, hostUserId));
        const afterFirstAccMap = Object.fromEntries(
            afterFirstAccRows.map((r) => [r.id, r.planRestricted])
        );
        expect(afterFirstAccMap[acc3Id]).toBe(false);
        expect(afterFirstAccMap[acc1Id]).toBe(true);
        expect(afterFirstAccMap[acc2Id]).toBe(true);

        // ── ACT — run the cron a SECOND time ─────────────────────────────────
        // The row is now status='applied'. findDueScheduledChanges filters on
        // status='pending', so the row is invisible to the second tick.
        const { ctx: secondCtx } = makeCronCtx();
        const secondResult = await applyScheduledPlanChangesJob.handler(secondCtx);

        // ── ASSERT: second tick is a clean no-op ──────────────────────────────
        expect(secondResult.success).toBe(true);
        expect(secondResult.processed).toBe(0);
        expect(secondResult.errors).toBe(0);
        expect(secondResult.details).toMatchObject({
            applied: 0,
            retried: 0,
            failed: 0,
            due: 0
        });

        // ── ASSERT: DB unchanged after the second tick ────────────────────────
        const afterSecondRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, hostSubscriptionId));
        const afterSecondSchedule = afterSecondRows[0]?.scheduledPlanChange as Record<
            string,
            unknown
        >;

        // Status and resolvedAt MUST NOT change on the second tick.
        expect(afterSecondSchedule.status).toBe('applied');
        expect(afterSecondSchedule.attemptCount).toBe(1);
        expect(afterSecondSchedule.resolvedAt).toBe(resolvedAtAfterFirst);

        // planRestricted flags MUST NOT change (still same as after first tick).
        const afterSecondAccRows = await testDb
            .getDb()
            .select({ id: accommodations.id, planRestricted: accommodations.planRestricted })
            .from(accommodations)
            .where(eq(accommodations.ownerId, hostUserId));
        const afterSecondAccMap = Object.fromEntries(
            afterSecondAccRows.map((r) => [r.id, r.planRestricted])
        );

        expect(afterSecondAccMap[acc3Id]).toBe(false);
        expect(afterSecondAccMap[acc1Id]).toBe(true);
        expect(afterSecondAccMap[acc2Id]).toBe(true);

        // Promotions also unchanged.
        const afterSecondPromoRows = await testDb
            .getDb()
            .select({ id: ownerPromotions.id, planRestricted: ownerPromotions.planRestricted })
            .from(ownerPromotions)
            .where(eq(ownerPromotions.ownerId, hostUserId));
        const afterSecondPromoMap = Object.fromEntries(
            afterSecondPromoRows.map((r) => [r.id, r.planRestricted])
        );
        expect(afterSecondPromoMap[promo1Id]).toBe(true);
        expect(afterSecondPromoMap[promo2Id]).toBe(true);
    });
});
