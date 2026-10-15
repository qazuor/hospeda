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

    it('maps summarized record count and the last attempt instant from a read', async () => {
        const { server, adapter } = await setup();
        const created = await adapter.authorize(input);
        await server.provider.declineCharge({
            authorizationId: created.authorizationId,
            declineReason: 'declined'
        });
        const actual = await adapter.readAuthorization({
            authorizationId: created.authorizationId
        });
        expect(actual.snapshot.chargeRecordCount).toBe(1);
        expect(actual.snapshot.lastChargedAt).toBe(clock.now().toISOString());
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

    it('TEST:1685:1 reads a provider-moved next payment date over HTTP', async () => {
        const { server, adapter } = await setup();
        const created = await adapter.authorize(input);
        await server.provider.approve({ authorizationId: created.authorizationId });
        const moved = new Date('2026-11-01T03:00:00.000Z');
        server.provider.moveNextCharge({ authorizationId: created.authorizationId, at: moved });
        const actual = await adapter.readAuthorization({
            authorizationId: created.authorizationId
        });
        expect(actual.snapshot.nextChargeAt).toBe(moved.toISOString());
    });

    it('reads approved charges and RP12 card validation by id', async () => {
        const { server, adapter } = await setup();
        const created = await adapter.authorize(input);
        await server.provider.approve({ authorizationId: created.authorizationId });
        const validation = await server.provider.changeCard({
            authorizationId: created.authorizationId,
            passes: true
        });
        if (!validation) throw new Error('Expected RP12 card validation');
        const expected = await server.provider.readCharge({ chargeId: validation.chargeId });
        const actual = await adapter.readCharge({ chargeId: validation.chargeId });
        expect(actual.snapshot).toEqual(expected.snapshot);
        expect(actual.snapshot.purpose).toBe('cardValidation');
        expect(actual.readAt).toEqual(clock.now());
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

describe('TEST:B11:27 (support) the adapter reads a chargeback and a refunded charge', () => {
    async function approvedCharge() {
        const context = await setup({
            honestAbout: [
                { lie: 'M8', why: 'these cases read a charge approved the moment it is asked' }
            ],
            withoutBehaviour: [
                { behaviour: 'RP12', why: 'these cases exercise regular charge behaviour' }
            ]
        });
        const created = await context.adapter.authorize(input);
        await context.server.provider.approve({ authorizationId: created.authorizationId });
        const { chargeId } = await context.server.provider.charge({
            authorizationId: created.authorizationId,
            amount: input.amount,
            reference: 'cycle-1'
        });
        return { ...context, chargeId };
    }

    it('(e) RC-8 branch 1: a charged-back charge reads chargedBack true and approved over HTTP', async () => {
        const { server, adapter, chargeId } = await approvedCharge();
        await server.provider.chargeBack({ chargeId });

        const { snapshot } = await adapter.readCharge({ chargeId });

        expect(snapshot.chargedBack).toBe(true);
        expect(snapshot.status).toBe('approved');
        expect(snapshot.declineReason).toBeNull();
    });

    it('(f) a wholly refunded charge reads approved with its refund and no chargeback', async () => {
        const { server, adapter, chargeId } = await approvedCharge();
        await server.provider.refund({ chargeId, amount: input.amount, reference: 'refund-all' });

        const { snapshot } = await adapter.readCharge({ chargeId });

        expect(snapshot.status).toBe('approved');
        expect(snapshot.refundedAmount).toEqual(input.amount);
        expect(snapshot.chargedBack).toBe(false);
    });

    it('(h) any other provider status still fails closed: the read throws, nothing reads approved', async () => {
        const body = {
            id: 'charge-x',
            date_created: '2026-10-01T03:00:00.000Z',
            preapproval_id: 'auth-x',
            external_reference: 'sub-x',
            transaction_amount: 15,
            currency_id: 'ARS',
            amount_refunded: 0
        };
        for (const status of ['cancelled', 'in_mediation', 'authorized', 'refunded_partially']) {
            const adapter = new MercadoPagoPaymentProvider({
                clock,
                accessToken: 'test-token',
                fetch: async () =>
                    new Response(JSON.stringify({ ...body, status }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' }
                    })
            });
            await expect(adapter.readCharge({ chargeId: 'charge-x' })).rejects.toMatchObject({
                code: 'UNAVAILABLE'
            });
        }
    });

    it('(g) a charge without chargeback reads chargedBack false', async () => {
        const { server, adapter, chargeId } = await approvedCharge();

        const actual = await adapter.readCharge({ chargeId });
        const expected = await server.provider.readCharge({ chargeId });

        expect(actual.snapshot.chargedBack).toBe(false);
        expect(actual.snapshot).toEqual(expected.snapshot);
    });
});
