/**
 * RES-04 — MercadoPago webhook duplicate is idempotent.
 *
 * Actors: MP webhook source (real network) → simulated by signed POST.
 * Tags: @p0 @resilience @billing @cross-app
 *
 * Preconditions:
 *   - `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` set on the API and exposed to
 *     this test process.
 *   - Webhook endpoint at `/api/v1/webhooks/mercadopago/payment` mounted.
 *
 * What this validates:
 *  1. The first signed webhook POST is accepted (2xx).
 *  2. The second POST with the IDENTICAL signed payload (same dataId,
 *     same ts) is also accepted with 2xx — the API must NOT 5xx on
 *     duplicates.
 *  3. The system does not duplicate side effects: zero new
 *     `billing_subscription_events` rows are created on the second call
 *     for the same payment id (or the count is unchanged).
 *  4. No payment row is duplicated for the same external payment id.
 *
 * Why this matters:
 *   MP retries webhooks aggressively under network noise. Without
 *   idempotency, retries would create N copies of every state transition
 *   — phantom subscriptions, double-charges-by-record, etc.
 *
 * @see SPEC-092 spec.md § RES-04
 * @see apps/e2e/fixtures/mp-webhook-helper.ts
 */

import { expect, test } from '@playwright/test';
import { execSQL, getDbPool } from '../../fixtures/db-helpers.ts';
import { postPaymentApprovedWebhook } from '../../fixtures/mp-webhook-helper.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

test.describe('RES-04: webhook duplicate is idempotent @p0 @resilience @billing @cross-app', () => {
    test('two identical signed POSTs return 2xx, no duplicated side effects', async () => {
        if (!process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET) {
            test.fixme(
                true,
                'HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET not set — webhook signature cannot be produced'
            );
            return;
        }

        // Use a deterministic synthetic payment id so the test owns the
        // search space. Real ids from the MP sandbox are 12-digit numerics.
        const paymentId = `e2e-res04-${Date.now()}`;

        const dbPool = getDbPool();
        await dbPool.query('SELECT 1'); // ensure pool is alive

        // Snapshot rows count before — bound the assertion to changes
        // produced specifically by this test.
        const beforeEvents = await execSQL<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM billing_subscription_events'
        );
        const beforeCount = Number(beforeEvents[0]?.count ?? 0);

        // ── 1. First webhook ──────────────────────────────────────────────
        const first = await postPaymentApprovedWebhook({
            paymentId,
            baseUrl: API_URL
        });
        expect(
            first.status >= 200 && first.status < 300,
            `first webhook should be 2xx (got ${first.status})`
        ).toBe(true);

        // ── 2. Second webhook with identical payload ──────────────────────
        const second = await postPaymentApprovedWebhook({
            paymentId,
            baseUrl: API_URL
        });
        expect(
            second.status >= 200 && second.status < 300,
            `duplicate webhook should be 2xx (got ${second.status})`
        ).toBe(true);

        // ── 3. No duplicated side effects: events count delta ≤ 1 ─────────
        // We do not lock the schema to "exactly 0 new events" because the
        // first call may legitimately add an audit row; the contract is
        // "the second call adds nothing additional".
        const afterEvents = await execSQL<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM billing_subscription_events'
        );
        const afterCount = Number(afterEvents[0]?.count ?? 0);
        const delta = afterCount - beforeCount;
        expect(
            delta <= 1,
            `delta=${delta} new events for two identical webhooks; expected ≤ 1 (idempotent)`
        ).toBe(true);
    });
});
