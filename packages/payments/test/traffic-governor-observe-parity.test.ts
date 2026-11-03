import type { Clock } from '@repo/billing-verticals-contract';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { PaymentProviderError } from '../src/provider/errors';
import { ProviderTrafficGovernor } from '../src/provider/traffic-governor';

const clock: Clock = { now: () => new Date('2026-10-01T03:00:00.000Z') };
const authorizationResponse = {
    id: 'auth-1',
    external_reference: 'subscription-1',
    status: 'authorized',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 15,
        currency_id: 'ARS'
    },
    summarized: { charged_quantity: 0, last_charged_date: null },
    last_modified: null,
    next_payment_date: null,
    init_point: null
};

async function scenario(args: {
    readonly withGovernor: boolean;
    readonly method: 'readAuthorization' | 'authorize';
    readonly responses: readonly (number | 'network')[];
    readonly retryAfter?: string;
}) {
    let attempt = 0;
    const fetchCalls: Array<{
        readonly url: string;
        readonly method: string;
        readonly headers: Headers;
        readonly body?: string;
    }> = [];
    const sleepCalls: number[] = [];
    const provider = new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'test-token',
        baseUrl: 'https://mp.example.test',
        sleep: async (ms) => {
            sleepCalls.push(ms);
        },
        fetch: async (input, init) => {
            fetchCalls.push({
                url: String(input),
                method: init?.method ?? 'GET',
                headers: new Headers(init?.headers),
                ...(init?.body === undefined ? {} : { body: String(init.body) })
            });
            const next = args.responses[Math.min(attempt, args.responses.length - 1)];
            attempt += 1;
            if (next === 'network') throw new TypeError('network down');
            const headers = args.retryAfter === undefined ? {} : { 'Retry-After': args.retryAfter };
            return new Response(
                next === 200
                    ? JSON.stringify(authorizationResponse)
                    : JSON.stringify({ message: 'Too Many Requests', status: next }),
                { status: next, headers }
            );
        },
        ...(args.withGovernor ? { governor: new ProviderTrafficGovernor({ mode: 'observe' }) } : {})
    });
    let outcome: unknown;
    try {
        outcome =
            args.method === 'readAuthorization'
                ? await provider.readAuthorization({ authorizationId: 'auth-1' })
                : await provider.authorize({
                      reference: 'subscription-1',
                      amount: { amountMinor: 1500, currency: 'ARS' },
                      cadence: { everyMonths: 1 },
                      reason: 'Monthly',
                      returnUrl: 'https://example.test/return'
                  });
    } catch (error) {
        if (!(error instanceof PaymentProviderError)) throw error;
        outcome = {
            code: error.code,
            transient: error.transient,
            governorRejected: error.governorRejected
        };
    }
    return { fetchCalls, sleepCalls, outcome };
}

describe('observe/off transport parity', () => {
    it.each([
        { name: 'success', method: 'readAuthorization' as const, responses: [200] },
        {
            name: '429 with Retry-After',
            method: 'readAuthorization' as const,
            responses: [429, 200],
            retryAfter: '1'
        },
        {
            name: '429 without Retry-After',
            method: 'readAuthorization' as const,
            responses: [429, 200]
        },
        { name: '503', method: 'readAuthorization' as const, responses: [503, 200] },
        {
            name: 'network error',
            method: 'readAuthorization' as const,
            responses: ['network' as const, 200]
        },
        { name: 'POST 429', method: 'authorize' as const, responses: [429] }
    ])('preserves fetch, sleep, and result behavior for $name (kills observe-mode behavior drift)', async (testCase) => {
        const off = await scenario({ withGovernor: false, ...testCase });
        const observe = await scenario({ withGovernor: true, ...testCase });
        expect(observe).toEqual(off);
        expect(observe.outcome).not.toMatchObject({ governorRejected: true });
    });
});
