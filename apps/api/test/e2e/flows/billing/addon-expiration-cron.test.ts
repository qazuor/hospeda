/**
 * Addon expiration cron expires past-due addon purchases (SPEC-143 T-143-31).
 *
 * Validates the production addon-expiry cron handler end-to-end against
 * a real Postgres + real qzpay-billing instance. The cron runs in
 * production at 5:00 UTC daily; tests invoke its handler directly with
 * a synthetic CronJobContext.
 *
 * Production code under test:
 *   - `apps/api/src/cron/jobs/addon-expiry.job.ts:addonExpiryJob.handler`
 *   - `AddonExpirationService.processExpiredAddons` →
 *      `expireAddon` per row
 *   - `AddonEntitlementService.removeAddonEntitlements` removes the
 *      customer-level entitlement grants tied to the purchase
 *   - `billing_addon_purchases` row updated to status='expired'
 *
 * Eligibility. `findExpiredAddons` returns rows where:
 *   - status='active'
 *   - expiresAt IS NOT NULL
 *   - expiresAt <= now
 *   - deletedAt IS NULL
 *
 * The cron also processes warning notifications (3 days and 1 day
 * before expiry) and reconciliation of failed entitlement removals.
 * Those phases are out of scope for T-143-31; this file pins only the
 * expiration leg.
 *
 * @module test/e2e/flows/billing/addon-expiration-cron
 */

import { vi } from 'vitest';

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — addon-expiration-cron.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { and, billingCustomerEntitlements, eq, sql } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { addonExpiryJob } from '../../../../src/cron/jobs/addon-expiry.job.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Canonical addon slug from packages/billing/src/config/addons.config.ts.
 * `AddonEntitlementService.removeAddonEntitlements` only works when the
 * slug maps to a real entry via `getAddonBySlug` — synthetic slugs are
 * ignored. visibility-boost-7d grants the FEATURED_LISTING entitlement
 * for 7 days.
 */
const ADDON_SLUG = 'visibility-boost-7d';

/** Entitlement key granted by the canonical visibility-boost-7d addon. */
const FEATURED_LISTING_KEY = 'featured_listing';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Minimal CronJobContext for invoking the addon-expiry handler outside
 * the scheduler. Logger is a no-op set to keep test output clean.
 */
function buildCronContext(dryRun = false): Parameters<typeof addonExpiryJob.handler>[0] {
    return {
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined
        },
        startedAt: new Date(),
        dryRun
    };
}

describe('SPEC-143 T-143-31 — addon expiration cron', () => {
    let customerId: string;
    let cheapPlanId: string;
    let subscriptionId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;

        const user = await createTestUser({
            email: `addon-expiration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active'
        });
        subscriptionId = sub.subscriptionId;

        // NOTE: we intentionally do NOT seed a billing_addons catalog
        // row. The cron's findExpiredAddons query
        // (addon-expiration.queries.ts:186) reads only the purchases
        // table, and removeAddonEntitlements resolves the addon
        // definition via the canonical `getAddonBySlug` config
        // (apps/api/src/services/addon-entitlement.service.ts:88) —
        // not from the DB. Seeding a catalog row would otherwise
        // expose a factory bug: createTestAddon does not set the
        // billing_interval column (NOT NULL in qzpay-drizzle), so any
        // call to createTestAddon() crashes with a NOT NULL violation.
        // Factory gap captured here for follow-up; out of scope for
        // this test file.
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Insert an active addon purchase whose expiresAt has already
     * passed. The factory does not expose billing_addon_purchases yet,
     * so the row is written via raw SQL. Inserts the corresponding
     * customer-level entitlement grant so `removeAddonEntitlements`
     * has something to revoke. Returns the purchase id.
     */
    async function seedExpiredAddonPurchase(input: {
        readonly expiresAtDaysAgo: number;
    }): Promise<string> {
        const purchaseId = randomUUID();
        const purchasedAt = new Date(Date.now() - (input.expiresAtDaysAgo + 7) * ONE_DAY_MS);
        const expiresAt = new Date(Date.now() - input.expiresAtDaysAgo * ONE_DAY_MS);

        // Use the canonical addon config to build entitlement_adjustments
        // in the JSONB shape the cron expects.
        const entitlementAdjustments = [{ entitlementKey: FEATURED_LISTING_KEY }];

        await testDb.getDb().execute(sql`
            INSERT INTO billing_addon_purchases (
                id, customer_id, subscription_id, addon_slug,
                status, purchased_at, expires_at,
                limit_adjustments, entitlement_adjustments, metadata
            ) VALUES (
                ${purchaseId}, ${customerId}, ${subscriptionId}, ${ADDON_SLUG},
                'active', ${purchasedAt}, ${expiresAt},
                ${'[]'}::jsonb, ${JSON.stringify(entitlementAdjustments)}::jsonb,
                ${'{}'}::jsonb
            )
        `);

        // Seed the customer-level entitlement grant that the addon
        // gave the customer at purchase time. removeAddonEntitlements
        // will scan this table and delete the row(s) matching the
        // addon's entitlement keys.
        await testDb
            .getDb()
            .insert(billingCustomerEntitlements)
            .values({
                customerId,
                entitlementKey: FEATURED_LISTING_KEY,
                source: 'addon',
                sourceId: purchaseId,
                livemode: false
            } as typeof billingCustomerEntitlements.$inferInsert);

        return purchaseId;
    }

    it('flips an expired addon purchase to status=expired and revokes the customer entitlement grant', async () => {
        // ARRANGE: addon expired 1 day ago.
        const purchaseId = await seedExpiredAddonPurchase({ expiresAtDaysAgo: 1 });

        // Sanity check the customer-level entitlement exists pre-cron.
        const preGrants = await testDb
            .getDb()
            .select()
            .from(billingCustomerEntitlements)
            .where(
                and(
                    eq(billingCustomerEntitlements.customerId, customerId),
                    eq(billingCustomerEntitlements.sourceId, purchaseId)
                )
            );
        expect(preGrants).toHaveLength(1);

        // ACT
        const result = await addonExpiryJob.handler(buildCronContext());

        // ASSERT: cron returned success and processed at least one row.
        expect(result.success).toBe(true);
        expect(result.processed).toBeGreaterThanOrEqual(1);

        // ASSERT: purchase row flipped to 'expired'. expireAddon
        // (addon-expiration.service.ts:220-234) runs the UPDATE with
        // status='expired' + updatedAt=now + entitlementRemovalPending
        // set to false because removal succeeded.
        const purchaseRow = (
            await testDb.getDb().execute(sql`
                SELECT status, entitlement_removal_pending
                FROM billing_addon_purchases
                WHERE id = ${purchaseId}
            `)
        ).rows[0] as { status: string; entitlement_removal_pending: boolean } | undefined;
        expect(purchaseRow?.status).toBe('expired');
        expect(purchaseRow?.entitlement_removal_pending).toBe(false);

        // ASSERT: customer-level entitlement grant tied to this
        // purchase was removed by AddonEntitlementService.
        // removeAddonEntitlements. The cron's reconciliation path
        // only fires when entitlement_removal_pending=true, which is
        // NOT this case.
        const postGrants = await testDb
            .getDb()
            .select()
            .from(billingCustomerEntitlements)
            .where(
                and(
                    eq(billingCustomerEntitlements.customerId, customerId),
                    eq(billingCustomerEntitlements.sourceId, purchaseId)
                )
            );
        expect(postGrants).toHaveLength(0);
    });

    it('is idempotent — a second cron run on an already-expired purchase does not reprocess it', async () => {
        // ARRANGE: prime the expiration state via a first run.
        const purchaseId = await seedExpiredAddonPurchase({ expiresAtDaysAgo: 2 });
        const firstRun = await addonExpiryJob.handler(buildCronContext());
        expect(firstRun.success).toBe(true);
        expect(firstRun.processed).toBeGreaterThanOrEqual(1);

        // Capture the updatedAt timestamp after the first run.
        // Drizzle's `execute(sql)` returns Postgres timestamp columns
        // as ISO-format strings (not Date instances), so compare as
        // strings throughout this test.
        const firstRunRow = (
            await testDb.getDb().execute(sql`
                SELECT updated_at FROM billing_addon_purchases WHERE id = ${purchaseId}
            `)
        ).rows[0] as { updated_at: string } | undefined;
        const firstRunUpdatedAt = firstRunRow?.updated_at;
        expect(typeof firstRunUpdatedAt).toBe('string');

        // Brief wait so a second UPDATE (if it landed) would produce
        // a different updated_at value. 50ms is enough — the column
        // is millisecond-precision timestamp with timezone.
        await new Promise((resolve) => setTimeout(resolve, 50));

        // ACT: second run.
        const secondRun = await addonExpiryJob.handler(buildCronContext());
        expect(secondRun.success).toBe(true);

        // ASSERT: updated_at unchanged. findExpiredAddons filters by
        // status='active' (addon-expiration.queries.ts:191), so the
        // already-expired purchase is excluded from the eligibility
        // set and no UPDATE lands for it. Comparing string equality
        // proves the row was untouched (Postgres normalizes timestamp
        // strings deterministically per row).
        const secondRunRow = (
            await testDb.getDb().execute(sql`
                SELECT status, updated_at FROM billing_addon_purchases WHERE id = ${purchaseId}
            `)
        ).rows[0] as { status: string; updated_at: string } | undefined;
        expect(secondRunRow?.status).toBe('expired');
        expect(secondRunRow?.updated_at).toBe(firstRunUpdatedAt);
    });

    it('leaves a non-expired addon purchase untouched (expiresAt still in the future)', async () => {
        // ARRANGE: an active addon purchase whose expiresAt is 1 day
        // in the FUTURE. findExpiredAddons filters on
        // expiresAt <= now, so this row is excluded.
        const purchaseId = randomUUID();
        const purchasedAt = new Date(Date.now() - 6 * ONE_DAY_MS);
        const expiresAt = new Date(Date.now() + ONE_DAY_MS);

        await testDb.getDb().execute(sql`
            INSERT INTO billing_addon_purchases (
                id, customer_id, subscription_id, addon_slug,
                status, purchased_at, expires_at,
                limit_adjustments, entitlement_adjustments, metadata
            ) VALUES (
                ${purchaseId}, ${customerId}, ${subscriptionId}, ${ADDON_SLUG},
                'active', ${purchasedAt}, ${expiresAt},
                ${'[]'}::jsonb, ${'[]'}::jsonb, ${'{}'}::jsonb
            )
        `);

        // ACT
        const result = await addonExpiryJob.handler(buildCronContext());
        expect(result.success).toBe(true);

        // ASSERT: purchase row UNCHANGED (status='active', no
        // expiration side-effects).
        const row = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_addon_purchases WHERE id = ${purchaseId}
            `)
        ).rows[0] as { status: string } | undefined;
        expect(row?.status).toBe('active');
    });
});
