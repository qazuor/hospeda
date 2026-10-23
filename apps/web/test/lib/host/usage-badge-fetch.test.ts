import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveSetApi } from '@/lib/api/endpoints-protected';
import { fetchHostUsageBadge } from '@/lib/host/usage-badge';

vi.mock('@/lib/api/endpoints-protected', () => ({ effectiveSetApi: { get: vi.fn() } }));

const effectiveSet = (owner: string) => ({
    userId: owner,
    vertical: 'accommodation',
    hasLiveNonTrialTitle: owner === 'a',
    entitlements: { [owner]: 1 },
    limits: { max_accommodations: owner === 'a' ? 2 : 9 }
});

describe('TEST:1769:1 per-user server reads', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reads each cookie independently when the calls are serial within the cache TTL', async () => {
        vi.mocked(effectiveSetApi.get).mockImplementation(
            async ({ cookieHeader }) =>
                ({
                    ok: true,
                    data: effectiveSet(cookieHeader ?? 'anonymous')
                }) as never
        );

        const first = await fetchHostUsageBadge({ cookieHeader: 'a' });
        const second = await fetchHostUsageBadge({ cookieHeader: 'b' });

        expect(first.effectiveSet.entitlements).toEqual({ a: 1 });
        expect(second.effectiveSet.entitlements).toEqual({ b: 1 });
        expect(effectiveSetApi.get).toHaveBeenNthCalledWith(1, {
            vertical: 'accommodation',
            cookieHeader: 'a'
        });
        expect(effectiveSetApi.get).toHaveBeenNthCalledWith(2, {
            vertical: 'accommodation',
            cookieHeader: 'b'
        });
        expect(effectiveSetApi.get).toHaveBeenCalledTimes(2);
    });

    it('reads each cookie independently when requests overlap and resolve in reverse order', async () => {
        const resolvers = new Map<string, (value: never) => void>();
        vi.mocked(effectiveSetApi.get).mockImplementation(
            ({ cookieHeader }) =>
                new Promise((resolve) => {
                    resolvers.set(cookieHeader ?? 'anonymous', resolve as (value: never) => void);
                }) as never
        );

        const firstPromise = fetchHostUsageBadge({ cookieHeader: 'a' });
        const secondPromise = fetchHostUsageBadge({ cookieHeader: 'b' });
        resolvers.get('b')?.({ ok: true, data: effectiveSet('b') } as never);
        resolvers.get('a')?.({ ok: true, data: effectiveSet('a') } as never);
        const [first, second] = await Promise.all([firstPromise, secondPromise]);

        expect(first.effectiveSet.entitlements).toEqual({ a: 1 });
        expect(second.effectiveSet.entitlements).toEqual({ b: 1 });
        expect(effectiveSetApi.get).toHaveBeenCalledTimes(2);
        expect(effectiveSetApi.get).toHaveBeenCalledWith({
            vertical: 'accommodation',
            cookieHeader: 'a'
        });
        expect(effectiveSetApi.get).toHaveBeenCalledWith({
            vertical: 'accommodation',
            cookieHeader: 'b'
        });
    });
});

describe('TEST:1769:2 server and browser cache boundaries', () => {
    it('calls the cached reader without a cookie and keeps cookie out of its source body', async () => {
        const source = readFileSync(
            path.resolve(process.cwd(), 'src/lib/entitlements-cache.ts'),
            'utf8'
        );
        const cachedReader = source.slice(source.indexOf('export function getEntitlementsCached'));
        expect(cachedReader).not.toContain('cookieHeader');
        expect(cachedReader).toContain('fetchEntitlementsUncached({ vertical })');
        expect(source).toContain('effectiveSetApi.get({ vertical, cookieHeader })');
    });

    it('does not route the host server reader through the module cache', async () => {
        const source = readFileSync(
            path.resolve(process.cwd(), 'src/lib/host/usage-badge.ts'),
            'utf8'
        );
        expect(source).not.toContain('getEntitlementsCached');
    });
});

describe('TEST:1769:5 fail-safe host usage read', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        ['returns not-ok', async () => ({ ok: false, error: { message: 'failed' } })],
        [
            'throws',
            async () => {
                throw new Error('failed');
            }
        ]
    ])('%s without throwing or exposing a plan', async (_case, implementation) => {
        vi.mocked(effectiveSetApi.get).mockImplementation(implementation as never);
        const result = await fetchHostUsageBadge({ cookieHeader: 'a' });
        expect(result.effectiveSet.failed).toBe(true);
        expect(result.entitlementsReadOk).toBe(false);
        expect(result.hasOwnerPlan).toBe(false);
        expect(result.usageData).toBeNull();
    });

    it('marks successful reads and derives the owner plan from the effective set', async () => {
        vi.mocked(effectiveSetApi.get).mockResolvedValue({
            ok: true,
            data: effectiveSet('a')
        } as never);
        const result = await fetchHostUsageBadge({ cookieHeader: 'a' });
        expect(result.entitlementsReadOk).toBe(true);
        expect(result.hasOwnerPlan).toBe(result.effectiveSet.hasLiveNonTrialTitle);
    });
});
