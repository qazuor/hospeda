import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { runWithTrafficClass } from '../src/provider/traffic-context';
import { ProviderTrafficGovernor } from '../src/provider/traffic-governor';

afterEach(() => vi.useRealTimers());

describe('ProviderTrafficGovernor', () => {
    it('prioritizes interactive waiters after a refill (kills FIFO across classes)', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const governor = new ProviderTrafficGovernor({
            mode: 'enforce',
            ratePerSecond: 1,
            burst: 1,
            interactiveReserve: 0
        });
        await governor.acquire({ trafficClass: 'interactive', capability: 'read' });
        const background = governor.acquire({ trafficClass: 'background', capability: 'read' });
        const interactive = governor.acquire({ trafficClass: 'interactive', capability: 'read' });
        await vi.advanceTimersByTimeAsync(1000);
        await interactive;
        let backgroundResolved = false;
        void background.then(() => {
            backgroundResolved = true;
        });
        await Promise.resolve();
        expect(backgroundResolved).toBe(false);
        governor.stop();
    });

    it('resolves observe acquires immediately while recording virtual waits and failures (kills blocking observe)', async () => {
        const governor = new ProviderTrafficGovernor({
            mode: 'observe',
            ratePerSecond: 1,
            burst: 1,
            interactiveReserve: 0,
            now: () => 0
        });
        for (let index = 0; index < 4; index += 1) {
            await governor.acquire({ trafficClass: 'interactive', capability: 'read' });
            governor.observe({ trafficClass: 'interactive', capability: 'read', status: 200 });
        }
        const window = governor.flushWindow();
        expect(window?.waitMs.max).toBeGreaterThan(0);
        expect(window?.fastFailures).toBeGreaterThan(0);
        expect(window?.status2xx).toBe(4);
        expect(governor.flushWindow()).toBeUndefined();
    });

    it('opens a Retry-After cool-down and fast-fails interactive traffic (kills ignored Retry-After)', async () => {
        let now = 10_000;
        const governor = new ProviderTrafficGovernor({
            mode: 'enforce',
            now: () => now,
            random: () => 0
        });
        governor.observe({
            trafficClass: 'background',
            capability: 'read',
            status: 429,
            retryAfterMs: 7000
        });
        expect(governor.coolDownRemainingMs()).toBe(7000);
        await expect(
            governor.acquire({ trafficClass: 'interactive', capability: 'read', maxWaitMs: 1000 })
        ).rejects.toMatchObject({
            transient: { kind: 'RATE_LIMITED' },
            governorRejected: true
        });
        now += 7000;
        await governor.acquire({ trafficClass: 'interactive', capability: 'read' });
    });

    it('rejects before HTTP when an interactive cool-down exceeds its budget (kills request during fast-fail)', async () => {
        const governor = new ProviderTrafficGovernor({
            mode: 'enforce',
            now: () => 0,
            random: () => 0
        });
        governor.observe({
            trafficClass: 'background',
            capability: 'read',
            status: 429,
            retryAfterMs: 7000
        });
        const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
        const provider = new MercadoPagoPaymentProvider({
            clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
            accessToken: 'test-token',
            fetch,
            governor
        });
        await expect(
            provider.authorize({
                reference: 'subscription-1',
                amount: { amountMinor: 1500, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'Monthly',
                returnUrl: 'https://example.test/return'
            })
        ).rejects.toMatchObject({ transient: { kind: 'RATE_LIMITED' }, governorRejected: true });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('holds background adapter fetches until Retry-After ends (kills adapter bypass of cool-down)', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-01T03:00:00.000Z'));
        const governor = new ProviderTrafficGovernor({ mode: 'enforce', random: () => 0 });
        let calls = 0;
        const provider = new MercadoPagoPaymentProvider({
            clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
            accessToken: 'test-token',
            governor,
            readRetry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, maxTotalDelayMs: 0 },
            fetch: async () => {
                calls += 1;
                return calls === 1
                    ? new Response('{"message":"Too Many Requests","status":429}', {
                          status: 429,
                          headers: { 'Retry-After': '7' }
                      })
                    : new Response(
                          JSON.stringify({
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
                          }),
                          { status: 200 }
                      );
            }
        });
        await expect(
            provider.readAuthorization({ authorizationId: 'auth-1' })
        ).rejects.toMatchObject({
            transient: { kind: 'RATE_LIMITED' }
        });
        const resumed = runWithTrafficClass({
            context: { trafficClass: 'background' },
            fn: () => provider.readAuthorization({ authorizationId: 'auth-1' })
        });
        await vi.advanceTimersByTimeAsync(6999);
        expect(calls).toBe(1);
        await vi.advanceTimersByTimeAsync(1);
        await expect(resumed).resolves.toMatchObject({ snapshot: { authorizationId: 'auth-1' } });
        expect(calls).toBe(2);
        governor.stop();
    });

    it('keeps the interactive reserve unavailable to background requests (kills reserve removal)', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const governor = new ProviderTrafficGovernor({
            mode: 'enforce',
            ratePerSecond: 1,
            burst: 3,
            interactiveReserve: 1
        });
        await governor.acquire({ trafficClass: 'background', capability: 'read' });
        await governor.acquire({ trafficClass: 'background', capability: 'read' });
        const background = governor.acquire({ trafficClass: 'background', capability: 'read' });
        const interactive = governor.acquire({
            trafficClass: 'interactive',
            capability: 'authorize'
        });
        await interactive;
        let backgroundResolved = false;
        void background.then(() => {
            backgroundResolved = true;
        });
        await Promise.resolve();
        expect(backgroundResolved).toBe(false);
        governor.stop();
    });

    it('rejects pending work on explicit or context abort (kills ignored abort signals)', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const governor = new ProviderTrafficGovernor({
            mode: 'enforce',
            ratePerSecond: 1,
            burst: 1,
            interactiveReserve: 0
        });
        await governor.acquire({ trafficClass: 'interactive', capability: 'read' });
        const explicit = new AbortController();
        const explicitWait = governor.acquire({
            trafficClass: 'background',
            capability: 'read',
            signal: explicit.signal
        });
        explicit.abort();
        await expect(explicitWait).rejects.toMatchObject({ governorRejected: true });
        const contextual = new AbortController();
        const contextualWait = runWithTrafficClass({
            context: { trafficClass: 'background', signal: contextual.signal },
            fn: () => governor.acquire({ trafficClass: 'background', capability: 'read' })
        });
        contextual.abort();
        await expect(contextualWait).rejects.toMatchObject({ governorRejected: true });
        governor.stop();
    });

    it('uses jittered exponential backoff and resets it on 2xx (kills sequence drift)', () => {
        let now = 0;
        const governor = new ProviderTrafficGovernor({
            mode: 'observe',
            now: () => now,
            random: () => 1
        });
        governor.observe({ trafficClass: 'background', capability: 'read', status: 429 });
        expect(governor.coolDownRemainingMs()).toBe(2000);
        now += 2000;
        governor.observe({ trafficClass: 'background', capability: 'read', status: 429 });
        expect(governor.coolDownRemainingMs()).toBe(4000);
        now += 4000;
        governor.observe({ trafficClass: 'background', capability: 'read', status: 200 });
        governor.observe({ trafficClass: 'background', capability: 'read', status: 429 });
        expect(governor.coolDownRemainingMs()).toBe(2000);
    });

    it('bounds both jitter strategies and caps exponential backoff (kills unbounded cooldowns)', () => {
        for (const random of [0, 1]) {
            const withRetryAfter = new ProviderTrafficGovernor({
                mode: 'observe',
                now: () => 0,
                random: () => random
            });
            withRetryAfter.observe({
                trafficClass: 'background',
                capability: 'read',
                status: 429,
                retryAfterMs: 7000
            });
            expect(withRetryAfter.coolDownRemainingMs()).toBe(random === 0 ? 7000 : 8000);
            const backoff = new ProviderTrafficGovernor({
                mode: 'observe',
                now: () => 0,
                random: () => random
            });
            for (let count = 0; count < 8; count += 1)
                backoff.observe({ trafficClass: 'background', capability: 'read', status: 429 });
            expect(backoff.coolDownRemainingMs()).toBe(60_000);
        }
    });

    it('counts no traffic as no window and reports classes separately (kills lost class counters)', () => {
        const windows: string[] = [];
        const governor = new ProviderTrafficGovernor({
            mode: 'observe',
            onWindow: (window) => windows.push(window.trafficClass)
        });
        expect(governor.flushWindow()).toBeUndefined();
        governor.observe({
            trafficClass: 'interactive',
            capability: 'read',
            status: 429,
            retryAfterMs: 1000
        });
        governor.observe({ trafficClass: 'background', capability: 'cancel', status: 503 });
        expect(governor.flushWindow()?.trafficClass).toBe('interactive');
        expect(windows).toEqual(['interactive', 'background']);
    });

    it('accounts a classless adapter request as interactive and marks it unclassified (kills silent default class)', async () => {
        const windows: Array<{ readonly trafficClass: string; readonly unclassified: number }> = [];
        const governor = new ProviderTrafficGovernor({
            mode: 'observe',
            onWindow: (window) =>
                windows.push({
                    trafficClass: window.trafficClass,
                    unclassified: window.unclassified
                })
        });
        const provider = new MercadoPagoPaymentProvider({
            clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
            accessToken: 'test-token',
            governor,
            fetch: async () =>
                new Response(
                    JSON.stringify({
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
                    }),
                    { status: 200 }
                )
        });
        await provider.readAuthorization({ authorizationId: 'auth-1' });
        governor.flushWindow();
        expect(windows).toEqual([{ trafficClass: 'interactive', unclassified: 1 }]);
    });
});
