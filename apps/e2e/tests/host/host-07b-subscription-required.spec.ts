/**
 * HOST-07b — Subscription required: republish blocked when subscription is
 *             cancelled / expired.
 *
 * Actors: HOST whose subscription was cancelled and is past its period_end.
 * Tags: @p0 @host @billing @resilience
 *
 * Preconditions:
 *   - Host with role='HOST' and a `cancelled` subscription whose
 *     `current_period_end` is in the past.
 *   - One DRAFT accommodation owned by the host.
 *
 * What this validates:
 *  1. PATCH /api/v1/admin/accommodations/:id with `lifecycleState: 'ACTIVE'`
 *     is rejected with 402/403 (paywall) when the host has no active
 *     subscription.
 *  2. The error response identifies the subscription gate (code or message
 *     mentioning subscription/paywall), giving the UI enough to render a
 *     localized CTA.
 *  3. DB invariant: the accommodation remains in DRAFT after the rejected
 *     PATCH — the publish never partially happened.
 *
 * @see SPEC-092 spec.md § HOST-07
 */

import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createSubscription,
    createUser,
    forceVerifyEmail
} from '../../fixtures/api-helpers.ts';
import { execSQL, forcePeriodEndPast, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-07b: subscription_required on republish @p0 @host @billing @resilience', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('cancelled+expired host: PATCH ACTIVE rejected, accommodation stays DRAFT', async ({
        page
    }) => {
        // Paywall enforcement requires billing to be configured
        // (HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN set). Without it, the entitlement
        // middleware falls back to "draft defaults" and grants write access regardless
        // of subscription state. Mark fixme when billing is not configured.
        if (!process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN) {
            test.fixme(
                true,
                'HOST-07b: billing not configured — paywall enforcement unavailable (set HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN to run)'
            );
            return;
        }

        // ── Setup: host with cancelled+expired subscription + DRAFT acc ───
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        const planRows = await execSQL<{ id: string }>(
            'SELECT id FROM billing_plans WHERE active = true ORDER BY created_at ASC LIMIT 1'
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No billing plan in seed — HOST-07b cannot run');
            return;
        }

        const { subscriptionId } = await createSubscription({
            userId: host.id,
            planId,
            status: 'active'
        });

        // Cancel + force period_end past so the gate is unambiguously closed.
        await execSQL(
            `UPDATE billing_subscriptions
             SET status = 'cancelled',
                 cancel_at_period_end = true,
                 canceled_at = NOW()
             WHERE id = $1`,
            [subscriptionId]
        );
        await forcePeriodEndPast(subscriptionId);

        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'DRAFT',
            slugPrefix: 'host-07b-acc'
        });

        // ── 1. PATCH ACTIVE rejected with 402/403 ─────────────────────────
        const publishResponse = await page.request.patch(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            {
                data: { lifecycleState: 'ACTIVE' },
                headers: { cookie: host.sessionCookie }
            }
        );
        expect(
            [402, 403].includes(publishResponse.status()),
            `expected paywall (402/403) on republish without subscription, got ${publishResponse.status()}`
        ).toBe(true);

        // ── 2. Error response identifies the subscription gate ────────────
        let bodyText = '';
        try {
            bodyText = await publishResponse.text();
        } catch {
            bodyText = '';
        }
        expect(
            /subscription|paywall|payment_required|FORBIDDEN/i.test(bodyText),
            `expected subscription-gate signal in body, got: ${bodyText.slice(0, 200)}`
        ).toBe(true);

        // ── 3. DB invariant: accommodation remained DRAFT ─────────────────
        const accAfter = await execSQL<{ lifecycle_state: string }>(
            'SELECT lifecycle_state FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        expect(accAfter[0]?.lifecycle_state).toBe('DRAFT');
    });
});
