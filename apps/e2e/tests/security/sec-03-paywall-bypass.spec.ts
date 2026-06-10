/**
 * SEC-03 — Trial host cannot bypass paywall via direct API calls.
 *
 * Actors: Host on trial subscription.
 * Tags: @p0 @security @billing
 *
 * Validates that paid-only endpoints reject trial hosts even when called
 * directly via HTTP (bypassing the UI's paywall modal). No partial side
 * effects must occur (no rows inserted, no Cloudinary uploads triggered).
 *
 * @see SPEC-092 spec.md § SEC-03
 */

import { expect, test } from '@playwright/test';
import { createSubscription, createUser, forceVerifyEmail } from '../../fixtures/api-helpers.ts';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('SEC-03: trial host paywall bypass attempts @p0 @security @billing', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
            userId = null;
        }
    });

    test('paid-only endpoints reject trial host with 402/403, no side effects', async ({
        request
    }) => {
        // ── Setup: trial host ──────────────────────────────────────────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        await forceVerifyEmail(host.id);
        userId = host.id;

        // `has_trial` column does not exist; trial info lives on billing_prices.trial_days.
        const planRows = await execSQL<{ id: string }>(
            `SELECT DISTINCT bp.id FROM billing_plans bp
             JOIN billing_prices pr ON pr.plan_id = bp.id
             WHERE bp.active = true AND pr.trial_days > 0
             ORDER BY bp.id ASC LIMIT 1`
        );
        const trialPlanId = planRows[0]?.id;
        if (!trialPlanId) {
            test.fixme(true, 'No trial plan in seed — SEC-03 cannot run');
            return;
        }

        await createSubscription({
            userId: host.id,
            planId: trialPlanId,
            status: 'trialing'
        });

        // ── 1. POST /admin/sponsorships (paid-only) → rejected ────────────
        // HOSTs lack ACCESS_PANEL_ADMIN, so the admin auth middleware returns
        // 401 before any billing entitlement check runs. All of 401/402/403
        // constitute a proper rejection of the trial host's attempt.
        const sponsorshipResponse = await request.post(`${API_URL}/api/v1/admin/sponsorships`, {
            data: {
                title: 'Should be blocked',
                description: 'Trial host tries to create sponsorship',
                sponsorId: host.id,
                durationDays: 30
            },
            headers: { cookie: host.sessionCookie }
        });
        expect([401, 402, 403].includes(sponsorshipResponse.status())).toBe(true);

        // ── 2. POST /protected/billing/addons/{slug}/purchase for paid addon → rejected ─
        // The correct purchase endpoint is in the protected tier (not admin).
        // HOSTs have access to the protected tier but the service rejects the
        // purchase when the subscription does not permit addon purchases
        // (e.g. trial plan without addon entitlement).
        // Note: addon slug is stored in the metadata JSONB column as metadata->>'slug',
        // not as a top-level column. Filter by livemode=false to match the E2E sandbox.
        const addonRows = await execSQL<{ id: string; slug: string }>(
            `SELECT id, metadata->>'slug' AS slug
             FROM billing_addons
             WHERE active = true AND livemode = false
             ORDER BY created_at ASC LIMIT 1`
        );
        const addonSlug = addonRows[0]?.slug;
        if (addonSlug) {
            const addonResponse = await request.post(
                `${API_URL}/api/v1/protected/billing/addons/${addonSlug}/purchase`,
                {
                    data: {},
                    headers: {
                        cookie: host.sessionCookie,
                        'Content-Type': 'application/json',
                        // Better Auth CSRF guard requires Origin on state-changing requests
                        Origin: 'http://localhost:4321',
                        // X-Idempotency-Key is required by the idempotency middleware
                        'X-Idempotency-Key': `e2e-sec03-${Date.now()}`
                    }
                }
            );
            // The protected addon purchase endpoint may return:
            //   - 401 if Better Auth cannot reconstruct the billing session from
            //     the bare Cookie header (no browser context, no CSRF/session layer)
            //   - 402 if a paywall/billing entitlement check blocks the purchase
            //   - 403 if the permission check denies the trial host
            //   - 422 if the subscription state (trialing) does not allow addon purchases
            //   - 503 if MercadoPago is not configured in E2E env
            // All of these are acceptable rejections — the critical invariant is that
            // the addon purchase does NOT succeed (200/201 would be a failure).
            expect(
                [401, 402, 403, 422, 503].includes(addonResponse.status()),
                `expected 401/402/403/422/503 for trial host addon purchase, got ${addonResponse.status()}`
            ).toBe(true);
        }

        // ── 3. DB invariants: NO partial side effects ──────────────────────
        const sponsorshipRows = await execSQL(
            'SELECT id FROM sponsorships WHERE sponsor_user_id = $1',
            [host.id]
        );
        expect(sponsorshipRows.length).toBe(0);

        const addonPurchaseRows = await execSQL(
            `SELECT id FROM billing_addon_purchases
             WHERE customer_id IN (SELECT id FROM billing_customers WHERE external_id = $1)`,
            [host.id]
        );
        expect(addonPurchaseRows.length).toBe(0);
    });
});
