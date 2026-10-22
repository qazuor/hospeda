/**
 * Healthchecks.io ping helper tests (HOS-1742).
 *
 * Covers the no-op guard when either env var is missing, the three ping URLs
 * (start / success / fail) with the environment slug prefix, the swallowed
 * timeout, swallowed network/HTTP errors, and that the ping key never leaks
 * into the warn log.
 *
 * @module test/utils/healthchecks-ping
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWarn, mockEnv } = vi.hoisted(() => ({
    mockWarn: vi.fn(),
    mockEnv: {} as Record<string, string | undefined>
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { warn: mockWarn }
}));

vi.mock('../../src/utils/env', () => ({
    get env() {
        return mockEnv;
    }
}));

import {
    buildHealthchecksPingUrl,
    HEALTHCHECKS_MONITORED_JOBS,
    pingHealthchecks
} from '../../src/utils/healthchecks-ping';

const JOB = 'billing-reconciliation-sweep';

type FetchMock = ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

function makeFetch(): FetchMock {
    return vi.fn<typeof globalThis.fetch>(async () => new Response('ok', { status: 200 }));
}

function makeNeverResolvingFetch(): FetchMock {
    return vi.fn<typeof globalThis.fetch>(
        (_url: string | URL | Request, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                });
            })
    );
}

/** Fails the test if any assertion ever sees the ping key in a log payload. */
function expectNoKeyLeak(): void {
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(mockWarn.mock.calls[0]);
    expect(serialized).not.toContain('k1');
}

describe('pingHealthchecks — no-op when a var is missing (TEST:1742:1)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not call fetch without a ping key, without a prefix, or without both', async () => {
        const missingKey = makeFetch();
        await pingHealthchecks({
            job: JOB,
            signal: 'success',
            config: { slugPrefix: 'staging' },
            fetch: missingKey
        });
        expect(missingKey).not.toHaveBeenCalled();

        const missingPrefix = makeFetch();
        await pingHealthchecks({
            job: JOB,
            signal: 'success',
            config: { pingKey: 'k1' },
            fetch: missingPrefix
        });
        expect(missingPrefix).not.toHaveBeenCalled();

        const fetchFn = makeFetch();
        await pingHealthchecks({ job: JOB, signal: 'success', fetch: fetchFn });
        expect(fetchFn).not.toHaveBeenCalled();

        expect(mockWarn).not.toHaveBeenCalled();
    });

    it('reads the two vars from the injected env fallback', async () => {
        mockEnv.HOSPEDA_HEALTHCHECKS_PING_KEY = 'k1';
        mockEnv.HOSPEDA_HEALTHCHECKS_SLUG_PREFIX = 'staging';
        const fetchFn = makeFetch();

        await pingHealthchecks({ job: JOB, signal: 'success', fetch: fetchFn });

        expect(fetchFn).toHaveBeenCalledTimes(1);
    });
});

describe('buildHealthchecksPingUrl (TEST:1742:2, TEST:1742:5)', () => {
    it('builds the start, success, and fail URLs with the staging prefix', () => {
        const base = 'https://hc-ping.com/k1/staging-billing-reconciliation-sweep';

        expect(
            buildHealthchecksPingUrl({
                pingKey: 'k1',
                slugPrefix: 'staging',
                job: JOB,
                signal: 'start'
            })
        ).toBe(`${base}/start?create=0`);

        expect(
            buildHealthchecksPingUrl({
                pingKey: 'k1',
                slugPrefix: 'staging',
                job: JOB,
                signal: 'success'
            })
        ).toBe(`${base}?create=0`);

        expect(
            buildHealthchecksPingUrl({
                pingKey: 'k1',
                slugPrefix: 'staging',
                job: JOB,
                signal: 'fail'
            })
        ).toBe(`${base}/fail?create=0`);
    });

    it('uses the prod prefix in the slug', () => {
        expect(
            buildHealthchecksPingUrl({
                pingKey: 'k1',
                slugPrefix: 'prod',
                job: JOB,
                signal: 'success'
            })
        ).toBe('https://hc-ping.com/k1/prod-billing-reconciliation-sweep?create=0');
    });

    it('builds a URL for an unlisted job: the filter lives in the bootstrap', () => {
        expect(HEALTHCHECKS_MONITORED_JOBS).toEqual([
            'billing-reconciliation-sweep',
            'listing-coverage-reconciler',
            'listing-remote-deletion-retry'
        ]);
        expect(HEALTHCHECKS_MONITORED_JOBS).not.toContain('some-other-job');

        expect(
            buildHealthchecksPingUrl({
                pingKey: 'k1',
                slugPrefix: 'staging',
                job: 'some-other-job',
                signal: 'success'
            })
        ).toBe('https://hc-ping.com/k1/staging-some-other-job?create=0');
    });

    it('encodes each path segment so a slash in the key cannot break the route', () => {
        expect(
            buildHealthchecksPingUrl({
                pingKey: 'a/b',
                slugPrefix: 'staging',
                job: 'billing-reconciliation-sweep',
                signal: 'fail'
            })
        ).toBe('https://hc-ping.com/a%2Fb/staging-billing-reconciliation-sweep/fail?create=0');
    });
});

describe('pingHealthchecks — HTTP shape (TEST:1742:2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('pings with GET and the exact URL for each signal', async () => {
        const fetchFn = makeFetch();
        const config = { pingKey: 'k1', slugPrefix: 'staging' } as const;

        await pingHealthchecks({ job: JOB, signal: 'start', config, fetch: fetchFn });
        await pingHealthchecks({ job: JOB, signal: 'success', config, fetch: fetchFn });
        await pingHealthchecks({ job: JOB, signal: 'fail', config, fetch: fetchFn });

        expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
            'https://hc-ping.com/k1/staging-billing-reconciliation-sweep/start?create=0',
            'https://hc-ping.com/k1/staging-billing-reconciliation-sweep?create=0',
            'https://hc-ping.com/k1/staging-billing-reconciliation-sweep/fail?create=0'
        ]);
        for (const call of fetchFn.mock.calls) {
            expect(call[1]).toMatchObject({ method: 'GET' });
        }
        expect(mockWarn).not.toHaveBeenCalled();
    });
});

describe('pingHealthchecks — swallowed failures (TEST:1742:3, TEST:1742:4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('aborts a slow ping and warns without the ping key', async () => {
        const fetchFn = makeNeverResolvingFetch();

        await expect(
            pingHealthchecks({
                job: JOB,
                signal: 'start',
                config: { pingKey: 'k1', slugPrefix: 'staging' },
                fetch: fetchFn,
                timeoutMs: 20
            })
        ).resolves.toBeUndefined();

        expectNoKeyLeak();
        const payload = mockWarn.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload).toMatchObject({ job: JOB, signal: 'start' });
    });

    it('swallows a rejecting fetch and warns without the ping key', async () => {
        const fetchFn: FetchMock = vi.fn<typeof globalThis.fetch>(async () => {
            throw new Error('network down');
        });

        await expect(
            pingHealthchecks({
                job: JOB,
                signal: 'fail',
                config: { pingKey: 'k1', slugPrefix: 'staging' },
                fetch: fetchFn
            })
        ).resolves.toBeUndefined();

        expectNoKeyLeak();
        const payload = mockWarn.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload).toMatchObject({ job: JOB, signal: 'fail' });
    });

    it('treats a non-2xx response as a warned failure without the ping key', async () => {
        const fetchFn: FetchMock = vi.fn<typeof globalThis.fetch>(
            async () => new Response('not found', { status: 404 })
        );

        await expect(
            pingHealthchecks({
                job: JOB,
                signal: 'success',
                config: { pingKey: 'k1', slugPrefix: 'staging' },
                fetch: fetchFn
            })
        ).resolves.toBeUndefined();

        expectNoKeyLeak();
        const payload = mockWarn.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload).toMatchObject({ job: JOB, signal: 'success', status: 404 });
    });
});
