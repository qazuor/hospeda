import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveSetApi } from '@/lib/api/endpoints-protected';
import { clearEntitlementsCache, getEntitlementsCached } from '@/lib/entitlements-cache';

vi.mock('@/lib/api/endpoints-protected', () => ({ effectiveSetApi: { get: vi.fn() } }));
const resolved = (
    vertical: 'accommodation' | 'tourist',
    entitlements: Record<string, number> = {}
) => ({
    userId: 'user',
    vertical,
    hasLiveNonTrialTitle: false,
    entitlements,
    limits: { cap: Number.POSITIVE_INFINITY }
});

describe('HOS-1646 · cliente web de capacidades · entitlements cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearEntitlementsCache();
    });
    it('caches separately by vertical', async () => {
        vi.mocked(effectiveSetApi.get).mockImplementation(
            async ({ vertical }) =>
                ({ ok: true, data: resolved(vertical, { [vertical]: 1 }) }) as never
        );
        const a = await getEntitlementsCached({ vertical: 'accommodation' });
        const b = await getEntitlementsCached({ vertical: 'tourist' });
        expect(a.entitlements).toEqual({ accommodation: 1 });
        expect(b.entitlements).toEqual({ tourist: 1 });
        expect(effectiveSetApi.get).toHaveBeenCalledTimes(2);
    });
    it('shares one in-flight request per vertical', async () => {
        let resolve!: (value: never) => void;
        vi.mocked(effectiveSetApi.get).mockReturnValue(
            new Promise((r) => {
                resolve = r;
            }) as never
        );
        const first = getEntitlementsCached({ vertical: 'accommodation' });
        const second = getEntitlementsCached({ vertical: 'accommodation' });
        resolve({ ok: true, data: resolved('accommodation', { x: 1 }) } as never);
        expect(await first).toEqual(await second);
        expect(effectiveSetApi.get).toHaveBeenCalledTimes(1);
    });
    it('fails closed on failure and retries instead of caching the failure', async () => {
        vi.mocked(effectiveSetApi.get)
            .mockResolvedValueOnce({ ok: false, error: { message: 'must not escape' } } as never)
            .mockResolvedValueOnce({
                ok: true,
                data: resolved('accommodation', { x: 1 })
            } as never);
        const failed = await getEntitlementsCached({ vertical: 'accommodation' });
        expect(failed).toMatchObject({ entitlements: {}, limits: {}, failed: true });
        const retry = await getEntitlementsCached({ vertical: 'accommodation' });
        expect(retry.entitlements).toEqual({ x: 1 });
        expect(effectiveSetApi.get).toHaveBeenCalledTimes(2);
    });
    it('records the requested vertical in the endpoint query input', async () => {
        vi.mocked(effectiveSetApi.get).mockResolvedValue({
            ok: true,
            data: resolved('tourist')
        } as never);
        await getEntitlementsCached({ vertical: 'tourist' });
        expect(effectiveSetApi.get).toHaveBeenCalledWith({
            vertical: 'tourist',
            cookieHeader: undefined
        });
    });
});
