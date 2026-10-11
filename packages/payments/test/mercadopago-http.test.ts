/** TEST:B3:43 (soporte): the API adapter crosses the fake's HTTP boundary. */
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';
import { startFakeProviderServer } from '../src/fake-server/fake-provider-server';
import { sanitizeApprovalUrl } from '../src/provider/approval-url';
import { confirmAuthorizationCreation } from '../src/provider/confirm-creation';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const input = {
    reference: 'sub-http',
    amount: { amountMinor: 1500, currency: 'ARS' },
    cadence: { everyMonths: 12 },
    reason: 'Plan anual',
    returnUrl: 'https://example.test/return'
} as const;
const servers: Array<{ close(): Promise<void> }> = [];

async function setup(
    options: Partial<Omit<ConstructorParameters<typeof FakePaymentProvider>[0], 'clock'>> = {}
) {
    const provider = new FakePaymentProvider({ clock, ...options });
    const server = await startFakeProviderServer({ provider, clock });
    servers.push(server);
    return {
        server,
        adapter: new MercadoPagoPaymentProvider({
            clock,
            baseUrl: server.url,
            accessToken: 'test-token'
        })
    };
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('MercadoPagoPaymentProvider HTTP (TEST:B3:43 soporte)', () => {
    it('uses the HTTP fake for broken and explicitly honest links', async () => {
        const { server, adapter } = await setup();
        const created = await adapter.authorize(input);
        expect(created.approvalUrl).toContain('activation=true');
        expect(sanitizeApprovalUrl(created).url).not.toContain('activation=true');
        expect(server.requests()[0]).toMatchObject({
            method: 'POST',
            path: '/preapproval',
            body: {
                external_reference: 'sub-http',
                auto_recurring: { transaction_amount: 15, frequency_type: 'months' }
            }
        });
        expect(server.requests()[0]?.body).not.toHaveProperty('free_trial');
        const honest = await setup({
            honestAbout: [{ lie: 'M10', why: 'This test checks the honest-link variant.' }]
        });
        const result = await honest.adapter.authorize({ ...input, reference: 'sub-http-honest' });
        expect(result.approvalUrl).not.toContain('activation=true');
    });

    it('maps reads field by field and stamps them with the adapter clock', async () => {
        const { server, adapter } = await setup();
        const created = await adapter.authorize(input);
        const expected = await server.provider.readAuthorization({
            authorizationId: created.authorizationId
        });
        const actual = await adapter.readAuthorization({
            authorizationId: created.authorizationId
        });
        expect(actual.snapshot).toEqual(expected.snapshot);
        expect(actual.readAt).toEqual(clock.now());
    });

    it('maps an authorized provider resource to the active domain status', async () => {
        const { server, adapter } = await setup();
        const created = await adapter.authorize(input);
        await server.provider.approve({ authorizationId: created.authorizationId });
        const actual = await adapter.readAuthorization({
            authorizationId: created.authorizationId
        });
        expect(actual.snapshot.status).toBe('active');
    });

    it('creation confirmation catches M1 and accepts the literal exemption', async () => {
        const ordinary = await setup();
        const created = await ordinary.adapter.authorize(input);
        const mismatch = await confirmAuthorizationCreation({
            provider: ordinary.adapter,
            authorizationId: created.authorizationId,
            sent: input
        });
        expect(mismatch).toMatchObject({
            outcome: 'notApplied',
            unapplied: expect.arrayContaining([expect.objectContaining({ field: 'cadence' })])
        });
        const honest = await setup({
            honestAbout: [
                { lie: 'M1', why: 'This test checks the explicitly honest creation case.' }
            ]
        });
        const honestCreated = await honest.adapter.authorize({
            ...input,
            reference: 'sub-http-honest-m1'
        });
        const confirmed = await confirmAuthorizationCreation({
            provider: honest.adapter,
            authorizationId: honestCreated.authorizationId,
            sent: { ...input, reference: 'sub-http-honest-m1' }
        });
        expect(confirmed).toMatchObject({ outcome: 'applied' });
    });

    it('refuses missing credentials, a stopped server, and an absent resource', async () => {
        const { server, adapter } = await setup();
        await expect(
            new MercadoPagoPaymentProvider({ clock, baseUrl: server.url }).authorize(input)
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        await expect(
            new MercadoPagoPaymentProvider({
                clock,
                baseUrl: 'http://127.0.0.1:1',
                accessToken: 'x',
                timeoutMs: 100
            }).authorize(input)
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        await expect(
            adapter.readAuthorization({ authorizationId: 'missing-id' })
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
