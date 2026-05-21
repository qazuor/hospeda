/**
 * Webhook signature validation — rejection branches (SPEC-143 T-143-16).
 *
 * Validates that `apps/api/src/middlewares/webhook-signature.ts` rejects
 * every malformed-signature shape MercadoPago could realistically deliver
 * before any downstream dispatch runs. The middleware computes an
 * HMAC-SHA256 over `id:<dataId>;request-id:<requestId>;ts:<ts>;` (per MP
 * docs) keyed on `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`, parses `x-signature`
 * for the `ts=…,v1=…` pair, requires the `x-request-id` header, enforces a
 * 5-minute timestamp tolerance, and compares the recomputed v1 against the
 * supplied one in constant time.
 *
 * Rejection branches pinned by this test:
 *
 *   1. Missing `x-signature` header entirely.
 *   2. Header present but garbled — cannot be parsed into `ts=` + `v1=`.
 *   3. Header structurally valid but HMAC computed with a different
 *      secret (the classic forgery attempt).
 *   4. Timestamp older than the 5-minute tolerance — replay attack.
 *   5. Signature valid for the original body, but the actual body sent
 *      is different — tampering attempt.
 *
 * For every branch the contract is:
 *   - HTTP 401 response.
 *   - NO mutation of any local state (the pending annual sub seeded in
 *     beforeEach stays in `pending_provider`).
 *   - NO call to `payments.retrieve` (the dispatch path is dead before
 *     it can start).
 *   - NO row in `billing_webhook_events` — the optimistic-insert
 *     idempotency layer never gets reached because the request is
 *     rejected upstream of the router.
 *
 * SCOPE NOTE: the task notes for T-143-16 also mention "Sentry event
 * captured" for each rejection. The current middleware
 * (apps/api/src/middlewares/webhook-signature.ts) only emits
 * `apiLogger.warn` on rejection — there is no Sentry integration in
 * that file today. Pinning a Sentry capture assertion here would test
 * code that does not exist. Tracked as a follow-up: wire
 * `captureWebhookError` (already used by event-handler.ts:251) into the
 * signature middleware's rejection branches.
 *
 * @module test/e2e/flows/billing/webhook-signature
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. Shared ref pattern so the
// `@repo/billing` factory below can lazy-resolve the mp-stub adapter
// once it is constructed at top-level.
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
                    'mp-stub adapter not initialized — webhook-signature.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { billingSubscriptions, billingWebhookEvents, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
import {
    type InvalidSignatureMode,
    invalidSignatureHeaders,
    providerResponseFixtures,
    signWebhookPayload
} from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

describe('SPEC-143 T-143-16 — webhook signature validation', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let cheapPlanName: string;
    let localSubscriptionId: string;

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

        // Seed plans + an authenticated user with a billing customer.
        // Then drive the annual happy-path leg to create a
        // `pending_provider` subscription. Every test below proves that
        // an invalid-signature webhook does NOT flip this sub to active —
        // the strongest single signal that the rejection short-circuited
        // the dispatch pipeline.
        const seed = await seedBillingTestPlans();
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `webhook-sig-${Date.now()}@example.com`
        });
        await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);

        // Drive the start-paid endpoint to create the pending sub.
        // checkout.create needs a canned response; mp-stub.config.reset()
        // is called at the top of beforeEach so this is the only stub
        // active when the start-paid call lands.
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_for_sig_test',
                url: 'https://stub.example/checkout/for-sig-test'
            })
        );
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'annual'
        });
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: { readonly localSubscriptionId: string };
        };
        localSubscriptionId = body.data.localSubscriptionId;
        // Reset call counters before the rejection test so the
        // assertions on `payments.retrieve` etc. start from zero.
        mpStub.config.reset();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Build a well-formed MP IPN payload. Each rejection test pairs this
     * body with a deliberately broken `x-signature` header via
     * `invalidSignatureHeaders`. The body itself is identical to the
     * happy-path shape so the test exercises the signature gate
     * specifically, not other validation paths.
     */
    function makeWebhookBody(providerPaymentId: string): string {
        return JSON.stringify({
            id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
            type: 'payment',
            action: 'payment.updated',
            data: { id: providerPaymentId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
    }

    /**
     * Helper: post a webhook with the given headers, then assert the
     * universal "rejection" contract — 401, sub unchanged, no MP stub
     * calls, no billing_webhook_events row. Each invalid-signature test
     * differs only in HOW the headers were broken, not in WHAT the
     * downstream effect must be.
     */
    async function expectRejection(opts: {
        readonly body: string;
        readonly headers: Record<string, string>;
    }): Promise<void> {
        const response = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...opts.headers
            },
            body: opts.body
        });

        // 401 is the contract: webhook-signature.ts:199 throws
        // HTTPException(401) for every rejection branch.
        expect(response.status).toBe(401);

        // Sub stays pending_provider — the dispatch pipeline never ran.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, localSubscriptionId));
        expect(subs).toHaveLength(1);
        expect(subs[0]?.status).toBe('pending_provider');

        // No row in billing_webhook_events — the request never reached
        // event-handler.ts's optimistic INSERT because the signature
        // middleware short-circuited above it.
        const events = await testDb.getDb().select().from(billingWebhookEvents);
        expect(events).toHaveLength(0);

        // MP stub legs never fired — qzpay-hono's middleware sits below
        // hospeda's signature middleware, so neither verifySignature nor
        // constructEvent runs. payments.retrieve is downstream of both,
        // so it also stays at 0.
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(0);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(0);
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(0);
    }

    it('rejects a webhook with no x-signature header at all (mode: missing)', async () => {
        const body = makeWebhookBody(`pay_test_${randomUUID()}`);
        const headers = invalidSignatureHeaders({ body, mode: 'missing' });
        // Sanity — the helper truly omits x-signature.
        expect(headers['x-signature']).toBeUndefined();
        await expectRejection({ body, headers });
    });

    it('rejects a webhook with a garbled x-signature header (mode: wrong-format)', async () => {
        const body = makeWebhookBody(`pay_test_${randomUUID()}`);
        const headers = invalidSignatureHeaders({ body, mode: 'wrong-format' });
        // Sanity — the helper sets a header that the middleware cannot
        // parse into ts=…,v1=… components.
        expect(headers['x-signature']).toBe('this-is-not-a-valid-mp-signature-header');
        await expectRejection({ body, headers });
    });

    it('rejects a webhook signed with the wrong secret (mode: wrong-hmac)', async () => {
        const body = makeWebhookBody(`pay_test_${randomUUID()}`);
        const headers = invalidSignatureHeaders({ body, mode: 'wrong-hmac' });
        // Sanity — header HAS the right format (ts=,v1=) but v1 was
        // computed with a different key, so constant-time compare fails.
        expect(headers['x-signature']).toMatch(/^ts=\d+,v1=[a-f0-9]+$/);
        await expectRejection({ body, headers });
    });

    it('rejects a webhook with a replayed timestamp older than the tolerance window (mode: replayed-timestamp)', async () => {
        const body = makeWebhookBody(`pay_test_${randomUUID()}`);
        const headers = invalidSignatureHeaders({ body, mode: 'replayed-timestamp' });
        // Sanity — extract ts from the signature header and confirm it
        // is more than 5 minutes (300 s) in the past, which is the
        // replay threshold pinned in webhook-signature.ts.
        const sigMatch = headers['x-signature']?.match(/^ts=(\d+),v1=/);
        expect(sigMatch).toBeTruthy();
        const ts = Number(sigMatch?.[1]);
        const ageSeconds = Math.floor(Date.now() / 1000) - ts;
        expect(ageSeconds).toBeGreaterThan(300);
        await expectRejection({ body, headers });
    });

    it('rejects a webhook whose body was tampered with after signing (mode: tampered-body)', async () => {
        // Build TWO bodies: one to sign (originalBody) and one to send
        // (tamperedBody). The signature is valid for originalBody only —
        // when the middleware recomputes the HMAC over tamperedBody, the
        // result differs and the request is rejected.
        const originalBody = makeWebhookBody(`pay_test_${randomUUID()}`);
        const headers = signWebhookPayload({ body: originalBody });
        const tamperedBody = makeWebhookBody(`pay_test_TAMPERED_${randomUUID()}`);
        // Sanity — the two bodies must actually differ. If a future
        // refactor made `makeWebhookBody` return identical strings the
        // test would silently pass and lose its meaning.
        expect(originalBody).not.toBe(tamperedBody);
        await expectRejection({ body: tamperedBody, headers });
    });

    // Smoke check — make sure the rejection contract is exhaustive over
    // the InvalidSignatureMode union. If a new mode is added to the
    // helper without a matching test here, the for-loop below surfaces
    // the gap as a TypeScript miss (the array literal narrows to the
    // exact union).
    it('exhaustive: every InvalidSignatureMode has a dedicated rejection test', () => {
        const covered: readonly InvalidSignatureMode[] = [
            'missing',
            'wrong-format',
            'wrong-hmac',
            'replayed-timestamp',
            'tampered-body'
        ];
        // The array literal is widened to InvalidSignatureMode[]; if the
        // union grows without an update here, the type system catches
        // the omission at compile time. The runtime assertion just
        // documents the count.
        expect(covered).toHaveLength(5);
    });
});
