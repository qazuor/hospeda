import { MercadoPagoPaymentProvider, PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from './revocation-route-fixtures';
import { startPlanChangeScenario, withCompositionRollback } from './succession-wiring-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-10-05T12:00:00.000Z') });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'fixture signup' }]
});
let server: FakeProviderServer;
let provider: MercadoPagoPaymentProvider;
let app: ReturnType<typeof initApp>;

const pathOf = (id: string) => `/api/v1/protected/billing-subscription/${id}/plan-change`;
const postPlanChange = (subscriptionId: string, ownerId: string, billingOptionId: string) =>
    app.request(pathOf(subscriptionId), {
        method: 'POST',
        headers: actorHeaders({ id: ownerId, role: 'USER', permissions: [] }),
        body: JSON.stringify({ billingOptionId, payerEmail: 'payer@example.test' })
    });

interface ErrorBody {
    readonly error: {
        readonly code: string;
        readonly reason: string;
        readonly details?: {
            readonly reason?: string;
            readonly retryAfter?: number;
        };
    };
}

const errorOf = async (response: Response): Promise<ErrorBody> =>
    (await response.json()) as ErrorBody;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    server = await startFakeProviderServer({ provider: fake, clock });
    provider = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    injectClock({ clock });
    injectPaymentProvider({ provider });
    app = initApp({ clock, paymentProvider: provider });
});
afterAll(async () => {
    await server.close();
    await testDb.teardown();
});

describe('TEST:B8b:24 plan change answers a transient provider failure as a retryable 503', () => {
    it('answers a throttled preapproval (429) with 503 PROVIDER_BUSY, once and on the retry', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            // HOS-2195: a real HTTP 429 on the successor preapproval, as MercadoPago sends it.
            server.setThrottle({
                throttle: { status: 429, paths: [/^\/preapproval$/], retryAfter: 42 }
            });
            try {
                const first = await postPlanChange(
                    row.subscriptionId,
                    row.userId,
                    row.targetOptionId
                );
                expect(first.status, await first.clone().text()).toBe(503);
                expect(first.headers.get('Retry-After')).toBe('42');
                expect((await errorOf(first)).error).toMatchObject({
                    code: 'PROVIDER_RATE_LIMITED',
                    reason: 'PROVIDER_BUSY',
                    details: { reason: 'PROVIDER_BUSY', retryAfter: 42 }
                });

                const retry = await postPlanChange(
                    row.subscriptionId,
                    row.userId,
                    row.targetOptionId
                );
                expect(retry.status, await retry.clone().text()).toBe(503);
                expect(retry.headers.get('Retry-After')).toBe('42');
                expect((await errorOf(retry)).error).toMatchObject({
                    code: 'PROVIDER_RATE_LIMITED',
                    reason: 'PROVIDER_BUSY',
                    details: { reason: 'PROVIDER_BUSY', retryAfter: 42 }
                });
            } finally {
                server.setThrottle({ throttle: undefined });
            }
        });
    });

    it('answers a provider outage (5xx) with 503 PROVIDER_UNAVAILABLE and no Retry-After', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await startPlanChangeScenario(tx, {
                provider,
                clock,
                approve: async (authorizationId) => {
                    await fake.approve({ authorizationId });
                }
            });
            // The fake server maps a provider outage to a real HTTP 503 for the adapter.
            const authorize = vi.spyOn(fake, 'authorize').mockRejectedValue(
                new PaymentProviderError({
                    code: 'UNAVAILABLE',
                    capability: 'authorize',
                    message: 'Mercado Pago request failed (503)',
                    cause: { status: 503, body: '' }
                })
            );
            try {
                const response = await postPlanChange(
                    row.subscriptionId,
                    row.userId,
                    row.targetOptionId
                );
                expect(response.status, await response.clone().text()).toBe(503);
                expect(response.headers.get('Retry-After')).toBeNull();
                expect((await errorOf(response)).error).toMatchObject({
                    code: 'SERVICE_UNAVAILABLE',
                    reason: 'PROVIDER_UNAVAILABLE',
                    details: { reason: 'PROVIDER_UNAVAILABLE' }
                });
                expect(authorize).toHaveBeenCalledTimes(1);
            } finally {
                authorize.mockRestore();
            }
        });
    });
});
