import {
    CAPABILITY_METHODS,
    MERCADOPAGO_CAPABILITY_SUPPORT,
    type PaymentProvider,
    PaymentProviderError,
    PROVIDER_METHODS
} from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import {
    createSweepPacedProvider,
    RECONCILIATION_SWEEP_PROVIDER_PACING
} from '../../../../src/services/billing/reconciliation/sweep/sweep-provider-pacing.js';

const input = { value: 'same-input' };

function error(code: 'UNAVAILABLE' | 'NOT_FOUND' | 'REJECTED', message: string = code) {
    return new PaymentProviderError({ code, capability: 'read', message });
}

function providerDouble() {
    const methods = Object.fromEntries(
        PROVIDER_METHODS.map((method) => [method, vi.fn(async (_input: unknown) => method)])
    );
    return {
        ...methods,
        capabilitySupport: MERCADOPAGO_CAPABILITY_SUPPORT
    } as unknown as PaymentProvider;
}

describe('TEST:1737 sweep provider pacing', () => {
    it('TEST:1737:12 delegates every interface method faithfully and preserves this', async () => {
        const provider = providerDouble();
        const paced = createSweepPacedProvider({
            provider,
            pacing: { ...RECONCILIATION_SWEEP_PROVIDER_PACING, minIntervalMs: 0 },
            sleep: vi.fn(async (_ms: number) => {})
        });
        expect(paced.capabilitySupport).toBe(provider.capabilitySupport);
        for (const method of PROVIDER_METHODS) {
            const value = await paced[method](input as never);
            expect(value).toBe(method);
            const call = provider[method] as ReturnType<typeof vi.fn>;
            expect(call).toHaveBeenCalledTimes(1);
            expect(call.mock.calls[0]?.[0]).toBe(input);
        }
        const fake = new FakePaymentProvider({
            clock: { now: () => new Date('2026-10-11T12:00:00.000Z') }
        });
        const authorization = await fake.authorize({
            reference: 'pacing-this',
            amount: { amountMinor: 2000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'pacing test',
            returnUrl: 'https://example.test',
            payerEmail: 'pacing@example.test'
        });
        await fake.approve({ authorizationId: authorization.authorizationId });
        await expect(
            createSweepPacedProvider({
                provider: fake,
                pacing: RECONCILIATION_SWEEP_PROVIDER_PACING
            }).readAuthorization({ authorizationId: authorization.authorizationId })
        ).resolves.toMatchObject({ snapshot: { authorizationId: authorization.authorizationId } });
    });

    it('TEST:1737:13 does not retry writes after UNAVAILABLE', async () => {
        const writes = PROVIDER_METHODS.filter(
            (method) =>
                !(CAPABILITY_METHODS.read as readonly string[]).includes(method) &&
                !(CAPABILITY_METHODS.notify as readonly string[]).includes(method)
        );
        for (const method of writes) {
            const provider = providerDouble();
            const failure = error('UNAVAILABLE');
            (provider[method] as ReturnType<typeof vi.fn>).mockRejectedValue(failure);
            const sleep = vi.fn(async (_ms: number) => {});
            const paced = createSweepPacedProvider({
                provider,
                pacing: RECONCILIATION_SWEEP_PROVIDER_PACING,
                sleep
            });
            await expect(paced[method](input as never)).rejects.toBe(failure);
            expect(provider[method]).toHaveBeenCalledTimes(1);
            expect(sleep).not.toHaveBeenCalled();
        }
    });

    it('TEST:1737:14 propagates non-retryable read errors unchanged', async () => {
        for (const failure of [error('NOT_FOUND'), error('REJECTED'), new Error('ordinary')]) {
            const provider = providerDouble();
            (provider.readAuthorization as ReturnType<typeof vi.fn>).mockRejectedValue(failure);
            const paced = createSweepPacedProvider({
                provider,
                pacing: RECONCILIATION_SWEEP_PROVIDER_PACING,
                sleep: vi.fn(async (_ms: number) => {})
            });
            await expect(paced.readAuthorization(input as never)).rejects.toBe(failure);
            expect(provider.readAuthorization).toHaveBeenCalledTimes(1);
        }
    });

    it('TEST:1737:15 retries reads with capped exponential delays and returns recovery', async () => {
        const provider = providerDouble();
        const last = error('UNAVAILABLE', 'last');
        (provider.readCharge as ReturnType<typeof vi.fn>).mockRejectedValue(last);
        const sleep = vi.fn(async (_ms: number) => {});
        const paced = createSweepPacedProvider({
            provider,
            pacing: {
                maxAttempts: 3,
                baseDelayMs: 100,
                maxDelayMs: 150,
                maxRunDelayMs: 10000,
                minIntervalMs: 0
            },
            sleep
        });
        await expect(paced.readCharge(input as never)).rejects.toBe(last);
        expect(provider.readCharge).toHaveBeenCalledTimes(3);
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 150]);

        const listProvider = providerDouble();
        (listProvider.listCharges as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(error('UNAVAILABLE'))
            .mockRejectedValueOnce(error('UNAVAILABLE'))
            .mockResolvedValue('listed');
        const list = createSweepPacedProvider({
            provider: listProvider,
            pacing: { ...RECONCILIATION_SWEEP_PROVIDER_PACING, minIntervalMs: 0 },
            sleep: vi.fn(async (_ms: number) => {})
        });
        await expect(list.listCharges(input as never)).resolves.toBe('listed');
        expect(listProvider.listCharges).toHaveBeenCalledTimes(3);
    });

    it('TEST:1737:16 enforces a per-instance run delay budget', async () => {
        const provider = providerDouble();
        (provider.readCharge as ReturnType<typeof vi.fn>).mockRejectedValue(error('UNAVAILABLE'));
        const sleep = vi.fn(async (_ms: number) => {});
        const pacing = {
            maxAttempts: 5,
            baseDelayMs: 1000,
            maxDelayMs: 1000,
            maxRunDelayMs: 2500,
            minIntervalMs: 0
        };
        const paced = createSweepPacedProvider({ provider, pacing, sleep });
        await expect(paced.readCharge(input as never)).rejects.toThrow('UNAVAILABLE');
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 1000]);
        (provider.readAuthorization as ReturnType<typeof vi.fn>).mockRejectedValue(
            error('UNAVAILABLE')
        );
        await expect(paced.readAuthorization(input as never)).rejects.toThrow('UNAVAILABLE');
        expect(provider.readAuthorization).toHaveBeenCalledTimes(1);
        const newSleep = vi.fn(async (_ms: number) => {});
        const fresh = createSweepPacedProvider({ provider, pacing, sleep: newSleep });
        await expect(fresh.readAuthorization(input as never)).rejects.toThrow('UNAVAILABLE');
        expect(newSleep).toHaveBeenCalled();
    });

    it('TEST:1737:16 keeps later reads to one attempt after the run delay budget is exhausted', async () => {
        const provider = providerDouble();
        (provider.readCharge as ReturnType<typeof vi.fn>).mockRejectedValue(error('UNAVAILABLE'));
        (provider.readAuthorization as ReturnType<typeof vi.fn>).mockRejectedValue(
            error('UNAVAILABLE')
        );
        const sleep = vi.fn(async (_ms: number) => {});
        const paced = createSweepPacedProvider({
            provider,
            pacing: {
                maxAttempts: 5,
                baseDelayMs: 1000,
                maxDelayMs: 6000,
                maxRunDelayMs: 4500,
                minIntervalMs: 0
            },
            sleep
        });

        await expect(paced.readCharge(input as never)).rejects.toThrow('UNAVAILABLE');
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
        await expect(paced.readAuthorization(input as never)).rejects.toThrow('UNAVAILABLE');
        expect(provider.readAuthorization).toHaveBeenCalledTimes(1);
    });

    it('TEST:1737:17 spaces provider call starts using a wall clock and reserves concurrent slots', async () => {
        const provider = providerDouble();
        let now = 0;
        const sleep = vi.fn(async (ms: number) => {
            now += ms;
        });
        const paced = createSweepPacedProvider({
            provider,
            pacing: { ...RECONCILIATION_SWEEP_PROVIDER_PACING, minIntervalMs: 250 },
            sleep,
            now: () => now
        });
        await paced.readAuthorization(input as never);
        await paced.readAuthorization(input as never);
        await paced.readAuthorization(input as never);
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([250, 250]);
        now += 300;
        sleep.mockClear();
        await paced.readAuthorization(input as never);
        expect(sleep).not.toHaveBeenCalled();
        sleep.mockClear();
        await paced.decodeNotice(input as never);
        expect(sleep).not.toHaveBeenCalled();
        sleep.mockClear();
        now = 2000;
        await Promise.all([
            paced.readAuthorization(input as never),
            paced.readCharge(input as never)
        ]);
        // The first concurrent call reserves the immediate slot without sleeping.
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([250]);
    });
});
