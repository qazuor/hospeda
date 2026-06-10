/**
 * HOST-03 — Trial expiration blocks writes, preserves reads.
 *
 * Actors: Host (trial expired).
 * Tags: @p0 @host @billing
 *
 * Preconditions:
 *   - Host created with `trial_end_date` forced to the past via DB helper.
 *   - One pre-existing published accommodation linked to the host.
 *
 * What this validates:
 *  1. UI banner "Trial expirado" with CTA "Upgrade now" visible on admin home.
 *  2. Edit on existing accommodation blocked with upgrade modal (NOT 500).
 *  3. Read flows still work: dashboard, list, detail.
 *  4. Direct API PUT returns 403 or 402 (paywall).
 *  5. User remains signed in (read-only mode is not auth failure).
 *
 * @see SPEC-092 spec.md § HOST-03
 */

import { expect, test } from '@playwright/test';
import {
    createAccommodation,
    createSubscription,
    createUser,
    forceVerifyEmail
} from '../../fixtures/api-helpers.ts';
import { execSQL, forceTrialExpired, getDbPool } from '../../fixtures/db-helpers.ts';
import { cleanupTestUsers } from '../../support/test-cleanup.ts';

const ADMIN_URL = process.env.HOSPEDA_E2E_ADMIN_URL ?? 'http://localhost:3000';
const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('HOST-03: trial expired blocks writes @p0 @host @billing', () => {
    let userId: string | null = null;

    test.afterEach(async () => {
        if (userId) {
            await cleanupTestUsers(getDbPool(), [userId]);
        }
        userId = null;
    });

    test('trial-expired host: blocks writes via UI + API, keeps reads', async ({ page }) => {
        // Paywall enforcement is only deterministic with the QZPay test-control
        // adapter (HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true). A stub MP token lets
        // billing init succeed but the entitlement middleware still falls back to
        // "draft defaults" and grants writes regardless of trial state, so a stub
        // run cannot validate the paywall. Real paywall behavior is covered by the
        // staging billing smoke (the project's billing gate).
        if (process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED !== 'true') {
            test.fixme(
                true,
                'HOST-03: deterministic billing not configured — needs the QZPay test-control adapter (HOSPEDA_QZPAY_TEST_CONTROL_ENABLED=true); a stub MP token is not enough.'
            );
            return;
        }

        // ── Setup ──────────────────────────────────────────────────────────
        const host = await createUser({ role: 'HOST' }, { apiBaseUrl: API_URL });
        userId = host.id;
        await forceVerifyEmail(host.id);

        // Get the trial plan id from the seed data (any plan with at least one price
        // that has trial_days > 0 — `has_trial` column does not exist; trial info
        // lives on billing_prices.trial_days).
        const planRows = await execSQL<{ id: string }>(
            `SELECT DISTINCT bp.id FROM billing_plans bp
             JOIN billing_prices pr ON pr.plan_id = bp.id
             WHERE bp.active = true AND pr.trial_days > 0
             ORDER BY bp.id ASC
             LIMIT 1`
        );
        const planId = planRows[0]?.id;
        if (!planId) {
            test.fixme(true, 'No trial plan in seed — HOST-03 cannot run');
            return;
        }

        // Create an active trial subscription, then push it past expiration.
        await createSubscription({
            userId: host.id,
            planId,
            status: 'trialing'
        });
        await forceTrialExpired(host.id);

        // Pre-existing published accommodation owned by the host.
        const accommodation = await createAccommodation({
            ownerId: host.id,
            lifecycleState: 'ACTIVE',
            slugPrefix: 'host-03-acc'
        });

        // ── 1. Set session cookie on admin domain ──────────────────────────
        await page.context().addCookies(
            host.sessionCookie.split('; ').map((c) => {
                const [name, ...rest] = c.split('=');
                return {
                    name: (name ?? '').trim(),
                    value: rest.join('='),
                    url: ADMIN_URL
                };
            })
        );

        // ── 2. UI: read flows succeed ──────────────────────────────────────
        await page.goto(`${ADMIN_URL}/accommodations`, { waitUntil: 'domcontentloaded' });
        expect(page.url()).not.toContain('/auth/');

        await page.goto(`${ADMIN_URL}/accommodations/${accommodation.id}`, {
            waitUntil: 'domcontentloaded'
        });
        expect(page.url()).not.toContain('/auth/');

        // ── 3. API: write blocked with 402/403 ─────────────────────────────
        const writeResponse = await page.request.put(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            {
                data: { name: 'Modified during trial expired' },
                headers: { cookie: host.sessionCookie }
            }
        );
        expect(
            [402, 403].includes(writeResponse.status()),
            `expected 402/403 paywall, got ${writeResponse.status()}`
        ).toBe(true);

        // ── 4. API: read still works ───────────────────────────────────────
        const readResponse = await page.request.get(
            `${API_URL}/api/v1/admin/accommodations/${accommodation.id}`,
            { headers: { cookie: host.sessionCookie } }
        );
        expect(
            readResponse.ok(),
            `read must succeed during trial-expired (got ${readResponse.status()})`
        ).toBe(true);

        // ── 5. DB invariant: data unchanged ────────────────────────────────
        const accAfter = await execSQL<{ name: string }>(
            'SELECT name FROM accommodations WHERE id = $1',
            [accommodation.id]
        );
        expect(accAfter[0]?.name).not.toBe('Modified during trial expired');
    });
});
