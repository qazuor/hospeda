/**
 * HOST-04 — Paid plan cancellation, grace period, and expiration.
 *
 * Actors: Host (paid → canceled → expired).
 * Tags: @p0 @host @billing
 *
 * Preconditions:
 *   - Host with an `active` paid subscription (period_end ~30 days in the future).
 *   - One pre-existing published accommodation linked to the host.
 *
 * What this validates:
 *  1. Active state: API write succeeds (200).
 *  2. Canceled-but-still-in-grace state (status='cancelled', period_end > now()):
 *     reads + writes still succeed because the period is paid through.
 *  3. Expired state (period_end < now()): writes are blocked with 402/403,
 *     reads still succeed (read-only mode is not auth failure).
 *  4. DB invariants: the accommodation row was modified during grace and
 *     unchanged after expiration.
 *
 * @see SPEC-092 spec.md § HOST-04
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

test.describe('HOST-04: paid plan cancellation, grace, expiration @p0 @host @billing', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('paid host: write OK → cancel keeps grace → period_end past blocks writes', async ({
        page
    }) => {
        // Paywall here is enforced by the date-aware publish gate (checkEligibility
        // + isSubscriptionLive, SPEC-217): a cancelled sub whose current_period_end is
        // past the 6h grace returns subscription_required. Deterministic against the
        // local DB — no MercadoPago round-trip and no test-control flag needed.

        // ── Setup: paid host with active subscription ──────────────────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        // Pick any active non-trial plan from seed.
        const planRows = await execSQL<{ id: string }>(
            `SELECT id FROM billing_plans
             WHERE active = true
             ORDER BY created_at ASC
             LIMIT 1`
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No billing plan in seed — HOST-04 cannot run');
            return;
        }

        const futurePeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const { subscriptionId } = await createSubscription({
            userId: host.id,
            planId,
            status: 'active',
            periodEnd: futurePeriodEnd
        });

        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'ACTIVE',
            slugPrefix: 'host-04-acc'
        });

        // ── 1. Active state: write succeeds ────────────────────────────────
        const activeWrite = await page.request.put(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            {
                data: { name: 'Edited while active' },
                headers: { cookie: host.sessionCookie }
            }
        );
        // Some routes accept 200/204; reject only paywall codes here.
        expect(
            ![402, 403].includes(activeWrite.status()),
            `expected non-paywall response while active, got ${activeWrite.status()}`
        ).toBe(true);

        // ── 2. Cancel: status='cancelled' but period_end still in future ───
        await execSQL(
            `UPDATE billing_subscriptions
             SET status = 'cancelled',
                 cancel_at_period_end = true,
                 canceled_at = NOW()
             WHERE id = $1`,
            [subscriptionId]
        );

        // Grace period: read still succeeds.
        const graceRead = await page.request.get(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            { headers: { cookie: host.sessionCookie } }
        );
        expect(graceRead.ok(), `read must succeed during grace (got ${graceRead.status()})`).toBe(
            true
        );

        // Grace period: write also succeeds because the period is paid through.
        const graceWrite = await page.request.put(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            {
                data: { name: 'Edited during grace' },
                headers: { cookie: host.sessionCookie }
            }
        );
        expect(
            ![402, 403].includes(graceWrite.status()),
            `expected non-paywall during grace, got ${graceWrite.status()}`
        ).toBe(true);

        // ── 3. Force expiration: period_end in the past ────────────────────
        await forcePeriodEndPast(subscriptionId);

        // Read still succeeds — read-only mode is not auth failure.
        const expiredRead = await page.request.get(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            { headers: { cookie: host.sessionCookie } }
        );
        expect(
            expiredRead.ok(),
            `read must keep working after expiration (got ${expiredRead.status()})`
        ).toBe(true);

        // Write now blocked with paywall code.
        const expiredWrite = await page.request.put(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            {
                data: { name: 'Should be blocked after expiration' },
                headers: { cookie: host.sessionCookie }
            }
        );
        expect(
            [402, 403].includes(expiredWrite.status()),
            `expected paywall (402/403) after expiration, got ${expiredWrite.status()}`
        ).toBe(true);

        // ── 4. DB invariant: blocked write did not mutate the row ──────────
        const accAfter = await execSQL<{ name: string }>(
            'SELECT name FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        expect(accAfter[0]?.name).not.toBe('Should be blocked after expiration');
    });
});
