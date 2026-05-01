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

        const planRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_plans WHERE has_trial = true AND is_active = true ORDER BY created_at ASC LIMIT 1'
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

        // ── 1. POST /admin/sponsorships (paid-only) → 402/403 ──────────────
        const sponsorshipResponse = await request.post(`${API_URL}/api/v1/admin/sponsorships`, {
            data: {
                title: 'Should be blocked',
                description: 'Trial host tries to create sponsorship',
                sponsorId: host.id,
                durationDays: 30
            },
            headers: { cookie: host.sessionCookie }
        });
        expect([402, 403].includes(sponsorshipResponse.status())).toBe(true);

        // ── 2. POST /admin/billing/addon-purchases for paid addon → 402/403 ─
        const addonRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_addons WHERE is_active = true ORDER BY created_at ASC LIMIT 1'
        );
        const addonId = addonRows[0]?.id;
        if (addonId) {
            const addonResponse = await request.post(
                `${API_URL}/api/v1/admin/billing/addon-purchases`,
                {
                    data: { addonId, customerId: host.id },
                    headers: { cookie: host.sessionCookie }
                }
            );
            expect([402, 403].includes(addonResponse.status())).toBe(true);
        }

        // ── 3. DB invariants: NO partial side effects ──────────────────────
        const sponsorshipRows = await execSQL('SELECT id FROM sponsorships WHERE sponsor_id = $1', [
            host.id
        ]);
        expect(sponsorshipRows.length).toBe(0);

        const addonPurchaseRows = await execSQL(
            `SELECT id FROM billing_addon_purchases
             WHERE customer_id IN (SELECT id FROM billing_customers WHERE external_id = $1)`,
            [host.id]
        );
        expect(addonPurchaseRows.length).toBe(0);
    });
});
