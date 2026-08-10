/**
 * @file purge-on-deploy.test.ts
 * @description Tests for the once-per-deploy edge-cache purge (HOS-427).
 *
 * The load-bearing case in this file is `waits out the container overlap before
 * purging`. Coolify starts the new container before removing the old one, so a
 * purge fired the moment this process serves its first request can be followed
 * by a request served by the OLD container, which re-caches the previous build's
 * HTML. Nothing reports that: the Cloudflare call succeeds, the log says
 * success, and every other assertion in this file still passes. An
 * implementation with the delay removed is indistinguishable from a correct one
 * except through that one test.
 *
 * The second theme is negative: in every configuration that should not purge —
 * local dev, CI, missing credentials, unresolvable namespace — NO network call
 * may happen at all. A test suite that quietly talked to Cloudflare would be a
 * defect of its own.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetCacheTagEnvironment } from '../../../src/lib/cache/cache-tag-environment';
import {
    _resetPurgeOnDeploy,
    DEPLOY_PURGE_MAX_ATTEMPTS,
    DEPLOY_PURGE_RETRY_BASE_MS,
    DEPLOY_PURGE_SETTLE_MS,
    planDeployPurge,
    schedulePurgeOnDeploy
} from '../../../src/lib/cache/purge-on-deploy';

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock('@sentry/astro', () => ({ captureMessage }));

const ZONE = 'test-zone-id';
const TOKEN = 'test-api-token';

/** Cloudflare's success envelope. */
const cfOk = () => new Response(JSON.stringify({ success: true }), { status: 200 });

/** A 200 that means failure — the shape that makes status-only checks lie. */
const cfRejected = () =>
    new Response(JSON.stringify({ success: false, errors: [{ code: 1234 }] }), { status: 200 });

/** A hard HTTP failure, e.g. the 403 a rate-limit burst produces. */
const cfHttpError = () => new Response('rate limited', { status: 403 });

let fetchMock: ReturnType<typeof vi.fn>;
let originalEnv: NodeJS.ProcessEnv;

/** Advance far enough to pass the settle delay and every retry backoff. */
async function runAllTimers(): Promise<void> {
    const totalBackoff = Array.from({ length: DEPLOY_PURGE_MAX_ATTEMPTS }, (_, i) => i)
        .map((i) => DEPLOY_PURGE_RETRY_BASE_MS * (i + 1))
        .reduce((a, b) => a + b, 0);
    await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_SETTLE_MS + totalBackoff + 1000);
}

beforeEach(() => {
    vi.useFakeTimers();
    originalEnv = process.env;
    process.env = { ...originalEnv };
    process.env.HOSPEDA_DEPLOY_ENV = 'prod';
    process.env.CLOUDFLARE_ZONE_ID = ZONE;
    process.env.CLOUDFLARE_API_TOKEN = TOKEN;

    _resetPurgeOnDeploy();
    _resetCacheTagEnvironment();
    captureMessage.mockClear();

    fetchMock = vi.fn().mockImplementation(() => Promise.resolve(cfOk()));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    _resetPurgeOnDeploy();
    _resetCacheTagEnvironment();
});

describe('the purge it issues', () => {
    it('purges exactly the namespaced catch-all for a prod deployment', async () => {
        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`);
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ tags: ['prod:all'] });
    });

    it('purges the preview namespace on staging, never production', async () => {
        process.env.HOSPEDA_DEPLOY_ENV = 'preview';
        _resetCacheTagEnvironment();

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(JSON.parse(String(init.body))).toEqual({ tags: ['preview:all'] });
    });

    it('never asks Cloudflare to flush the whole zone', async () => {
        // staging and production are ONE Cloudflare zone: a `purge_everything`
        // from a staging deploy would empty production's cache.
        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
            expect(String(init.body)).not.toContain('purge_everything');
        }
    });

    it('authenticates with the configured token', async () => {
        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    });
});

describe('the settle delay (the container-overlap guard)', () => {
    it('issues NO purge before the settle delay has elapsed', async () => {
        const pending = schedulePurgeOnDeploy();

        await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_SETTLE_MS - 1);
        expect(
            fetchMock,
            'purged during the window where the OLD container can still serve'
        ).not.toHaveBeenCalled();

        await runAllTimers();
        await pending;
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('waits long enough to outlast a rolling-update overlap', () => {
        // A delay of a couple of seconds would pass every other test here while
        // still landing inside the overlap in production.
        expect(DEPLOY_PURGE_SETTLE_MS).toBeGreaterThanOrEqual(30_000);
        // ...and must stay a small fraction of the 300s s-maxage it shortens.
        expect(DEPLOY_PURGE_SETTLE_MS).toBeLessThan(120_000);
    });
});

describe('it fires once per process', () => {
    it('collapses concurrent first requests into a single purge', async () => {
        const first = schedulePurgeOnDeploy();
        const second = schedulePurgeOnDeploy();
        const third = schedulePurgeOnDeploy();

        await runAllTimers();
        await first;

        expect(second).toBeNull();
        expect(third).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not purge again on later requests', async () => {
        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(schedulePurgeOnDeploy()).toBeNull();
        await runAllTimers();

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('deployments that must not purge', () => {
    it('makes no network call when the namespace cannot be resolved', async () => {
        process.env.HOSPEDA_DEPLOY_ENV = 'not-a-namespace';
        _resetCacheTagEnvironment();

        expect(schedulePurgeOnDeploy()).toBeNull();
        await runAllTimers();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(['dev', 'test'])('makes no network call in the %s environment', async (env) => {
        process.env.HOSPEDA_DEPLOY_ENV = env;
        _resetCacheTagEnvironment();

        expect(schedulePurgeOnDeploy()).toBeNull();
        await runAllTimers();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
        'CLOUDFLARE_ZONE_ID',
        'CLOUDFLARE_API_TOKEN'
    ])('makes no network call when %s is unset', async (key) => {
        delete process.env[key];

        expect(schedulePurgeOnDeploy()).toBeNull();
        await runAllTimers();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('says out loud that it skipped, so a missing credential is not silent', async () => {
        delete process.env.CLOUDFLARE_ZONE_ID;

        schedulePurgeOnDeploy();

        expect(console.info).toHaveBeenCalledWith(
            expect.stringContaining('deploy cache purge skipped')
        );
    });
});

describe('failure handling', () => {
    it('retries a hard HTTP failure, then succeeds', async () => {
        fetchMock
            .mockImplementationOnce(() => Promise.resolve(cfHttpError()))
            .mockImplementationOnce(() => Promise.resolve(cfOk()));

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(console.error).not.toHaveBeenCalled();
    });

    it('treats a 200 with success:false as a failure, not a success', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(cfRejected()));

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(fetchMock).toHaveBeenCalledTimes(DEPLOY_PURGE_MAX_ATTEMPTS);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('deploy cache purge FAILED')
        );
    });

    it('survives a network error instead of throwing', async () => {
        fetchMock.mockImplementation(() => Promise.reject(new Error('ECONNRESET')));

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();

        await expect(pending).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });

    it('gives up after a bounded number of attempts and alerts Sentry', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(cfHttpError()));

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(fetchMock).toHaveBeenCalledTimes(DEPLOY_PURGE_MAX_ATTEMPTS);
        expect(captureMessage).toHaveBeenCalledWith(
            expect.stringContaining('[HOS-427]'),
            expect.objectContaining({ level: 'error' })
        );
    });

    it('spaces retries out rather than hammering the shared rate limit', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(cfHttpError()));

        const pending = schedulePurgeOnDeploy();

        await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_SETTLE_MS + 1);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Cloudflare's Free plan allows 5 tag-purges per minute; an immediate
        // retry would just collect the same 403 that caused it.
        await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_RETRY_BASE_MS - 100);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await runAllTimers();
        await pending;
    });
});

describe('planDeployPurge', () => {
    it('names the tag it would purge', () => {
        expect(planDeployPurge()).toEqual({
            kind: 'run',
            tag: 'prod:all',
            credentials: { zoneId: ZONE, apiToken: TOKEN }
        });
    });

    it('explains why it skipped', () => {
        delete process.env.CLOUDFLARE_API_TOKEN;

        const plan = planDeployPurge();

        expect(plan.kind).toBe('skip');
        expect(plan.kind === 'skip' && plan.reason).toContain('CLOUDFLARE');
    });
});
