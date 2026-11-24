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
    DEPLOY_PURGE_CONFIRM_MS,
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

/** Advance far enough to pass both purges and every retry backoff. */
async function runAllTimers(): Promise<void> {
    const totalBackoff = Array.from({ length: DEPLOY_PURGE_MAX_ATTEMPTS }, (_, i) => i)
        .map((i) => DEPLOY_PURGE_RETRY_BASE_MS * (i + 1))
        .reduce((a, b) => a + b, 0);
    await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_CONFIRM_MS + totalBackoff + 1000);
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

        // Primary + confirmation.
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`);
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toEqual({ tags: ['prod:all'] });
        const [, second] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(JSON.parse(String(second.body))).toEqual({ tags: ['prod:all'] });
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

    it('logs the tag it purged, which is the only operational evidence it ran', async () => {
        // Greppable in `hops logs web`. Without this line a working purge and a
        // silently skipped one look identical from the outside.
        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('prod:all'));
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('deploy cache purge OK'));
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('(primary)'));
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('(confirmation)'));
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
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('issues NO purge within 95 s of the first request (HOS-2577 regression)', async () => {
        // Staging's old container is removed ~95 s after the new one starts
        // (60 s start period + 5 s proxy wait + ~30 s drain). The 45 s delay
        // purged inside that window and the old build re-cached its HTML.
        const pending = schedulePurgeOnDeploy();

        await vi.advanceTimersByTimeAsync(95_000);
        expect(fetchMock).not.toHaveBeenCalled();

        await runAllTimers();
        await pending;
    });

    it('waits long enough to outlast a rolling-update overlap', () => {
        expect(DEPLOY_PURGE_SETTLE_MS).toBeGreaterThanOrEqual(95_000);
        expect(DEPLOY_PURGE_SETTLE_MS).toBeLessThan(DEPLOY_PURGE_CONFIRM_MS);
    });
});

describe('the confirmation purge', () => {
    it('is later than the primary and still bounded', () => {
        expect(DEPLOY_PURGE_CONFIRM_MS).toBeGreaterThan(DEPLOY_PURGE_SETTLE_MS);
        expect(DEPLOY_PURGE_CONFIRM_MS).toBeLessThanOrEqual(600_000);
    });

    it('issues the primary at the settle delay and the confirmation at its own', async () => {
        const pending = schedulePurgeOnDeploy();

        await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_SETTLE_MS - 1);
        expect(fetchMock).toHaveBeenCalledTimes(0);

        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_CONFIRM_MS - DEPLOY_PURGE_SETTLE_MS - 1);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await pending;
    });

    it('still runs when the primary purge gave up after every attempt', async () => {
        fetchMock
            .mockImplementationOnce(() => Promise.resolve(cfHttpError()))
            .mockImplementationOnce(() => Promise.resolve(cfHttpError()))
            .mockImplementationOnce(() => Promise.resolve(cfHttpError()))
            .mockImplementation(() => Promise.resolve(cfOk()));

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(fetchMock).toHaveBeenCalledTimes(DEPLOY_PURGE_MAX_ATTEMPTS + 1);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('(primary)'));
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('(confirmation)'));
        expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('(primary)'));
    });

    it('labels which purge alerted Sentry', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(cfHttpError()));

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        const messages = captureMessage.mock.calls.map((c) => String(c[0]));
        expect(messages).toHaveLength(2);
        expect(messages[0]).toContain('(primary)');
        expect(messages[1]).toContain('(confirmation)');
    });

    it('settles only after the confirmation purge finished', async () => {
        let settled = false;
        const pending = schedulePurgeOnDeploy();
        void pending?.then(() => {
            settled = true;
        });

        await vi.advanceTimersByTimeAsync(DEPLOY_PURGE_SETTLE_MS + 1000);
        expect(settled).toBe(false);

        await runAllTimers();
        await pending;
        expect(settled).toBe(true);
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
        // One schedule: primary + confirmation, not 3 x 2.
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not purge again on later requests', async () => {
        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(schedulePurgeOnDeploy()).toBeNull();
        await runAllTimers();

        expect(fetchMock).toHaveBeenCalledTimes(2);
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

        // 2 attempts for the primary + 1 for the confirmation.
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(console.error).not.toHaveBeenCalled();
    });

    it('treats a 200 with success:false as a failure, not a success', async () => {
        fetchMock.mockImplementation(() => Promise.resolve(cfRejected()));

        const pending = schedulePurgeOnDeploy();
        await runAllTimers();
        await pending;

        expect(fetchMock).toHaveBeenCalledTimes(DEPLOY_PURGE_MAX_ATTEMPTS * 2);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('deploy cache purge FAILED')
        );
        // Names the tag left stale, not just that something failed.
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('prod:all'));
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

        expect(fetchMock).toHaveBeenCalledTimes(DEPLOY_PURGE_MAX_ATTEMPTS * 2);

        // The alert has to be ACTIONABLE at 3 AM: which namespace is stale, and
        // why Cloudflare refused. Asserting only the `[HOS-427]` prefix would
        // pass for a message that says nothing.
        const [message, options] = captureMessage.mock.calls[0] as [string, { level: string }];
        expect(message).toContain('[HOS-427]');
        expect(message).toContain('prod:all');
        expect(message).toContain('403');
        expect(options.level).toBe('error');
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
