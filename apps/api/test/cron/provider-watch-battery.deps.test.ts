/** HOS-1512: the production wiring of the provider watch battery cron. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    env: {
        HOSPEDA_HEALTHCHECKS_SLUG_PREFIX: 'staging' as string | undefined,
        HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'fixture-credential' as string | undefined,
        HOSPEDA_MERCADO_PAGO_API_BASE_URL: 'https://api.mercadopago.test',
        HOSPEDA_MERCADO_PAGO_TIMEOUT: 5000,
        HOSPEDA_PROVIDER_WATCH_PAYER_EMAIL: 'watch-payer@hospeda.test' as string | undefined,
        HOSPEDA_SITE_URL: 'https://hospeda.test'
    },
    ping: vi.fn(async () => undefined),
    authorization: vi.fn(async () => ({
        month: '2026-11',
        maxChargeMinor: 100,
        accountId: '100000001',
        consumedByRunId: undefined as string | undefined
    }))
}));

vi.mock('../../src/utils/env.js', () => ({ env: h.env }));
vi.mock('../../src/utils/healthchecks-ping.js', () => ({ pingHealthchecks: h.ping }));
vi.mock('@repo/service-core', async (original) => ({
    ...(await original<typeof import('@repo/service-core')>()),
    PlatformSettingsService: class {
        getProviderWatchAuthorization = h.authorization;
    }
}));
vi.mock('../../src/utils/clock.js', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-11-02T10:00:00.000Z') } })
}));

import { createProviderWatchBatteryDeps } from '../../src/cron/jobs/provider-watch-battery.job';

describe('createProviderWatchBatteryDeps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.env.HOSPEDA_HEALTHCHECKS_SLUG_PREFIX = 'staging';
        h.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = 'fixture-credential';
    });

    it('derives the account from the environment the watchdog already uses', () => {
        const deps = createProviderWatchBatteryDeps();
        expect(deps.resolveAccount()).toBe('sandbox');
        h.env.HOSPEDA_HEALTHCHECKS_SLUG_PREFIX = 'prod';
        expect(deps.resolveAccount()).toBe('production');
        h.env.HOSPEDA_HEALTHCHECKS_SLUG_PREFIX = undefined;
        expect(deps.resolveAccount()).toBeNull();
    });

    it('refuses to build a transport without an access token', () => {
        h.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = undefined;
        expect(() => createProviderWatchBatteryDeps().buildTransport({})).toThrow(
            'is not set: nothing to measure with'
        );
    });

    it('builds a transport that talks to the configured base URL with the credential', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(new Response('{"tags":[]}', { status: 200 }));
        const transport = createProviderWatchBatteryDeps().buildTransport({});
        await transport({ method: 'GET', path: '/users/me' });
        const [url, init] = fetchSpy.mock.calls[0] ?? [];
        expect(String(url)).toBe('https://api.mercadopago.test/users/me');
        expect((init?.headers as Record<string, string>).authorization).toBe(
            'Bearer fixture-credential'
        );
        fetchSpy.mockRestore();
    });

    it('reads the authorization from the platform setting and the clock from the injected one', async () => {
        const deps = createProviderWatchBatteryDeps();
        await expect(deps.readAuthorization()).resolves.toEqual({
            month: '2026-11',
            maxChargeMinor: 100,
            accountId: '100000001'
        });
        h.authorization.mockResolvedValueOnce({
            month: '2026-11',
            maxChargeMinor: 100,
            accountId: '100000001',
            consumedByRunId: 'run-1'
        });
        await expect(deps.readAuthorization()).resolves.toMatchObject({ consumedByRunId: 'run-1' });
        h.authorization.mockResolvedValueOnce(null as never);
        await expect(deps.readAuthorization()).resolves.toBeNull();
        expect(deps.now().toISOString()).toBe('2026-11-02T10:00:00.000Z');
    });

    it('takes the payer email and the return URL from the environment', () => {
        expect(createProviderWatchBatteryDeps().readSettings()).toEqual({
            payerEmail: 'watch-payer@hospeda.test',
            returnUrl: 'https://hospeda.test'
        });
    });

    it('measures the shipped catalog', async () => {
        const { WATCH_CATALOG } = await import('@repo/payments');
        expect(createProviderWatchBatteryDeps().catalog).toBe(WATCH_CATALOG);
        expect(WATCH_CATALOG.length).toBeGreaterThan(0);
    });

    it('pings the watchdog check named after the job', async () => {
        await createProviderWatchBatteryDeps().pingWatchdog();
        expect(h.ping).toHaveBeenCalledWith({ job: 'provider-watch-battery', signal: 'success' });
    });
});
