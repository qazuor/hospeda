import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEntitlementsCache, useMyEntitlements } from '@/hooks/useMyEntitlements';
import { effectiveSetApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/endpoints-protected', () => ({ effectiveSetApi: { get: vi.fn() } }));
const session = vi.fn();
vi.mock('@/lib/auth-client', () => ({ useSession: () => session() }));
describe('HOS-1646 · cliente web de capacidades · useMyEntitlements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearEntitlementsCache();
        session.mockReturnValue({ data: { user: { id: 'u' } }, isPending: false });
    });
    it('uses positive resolved values, 0 for missing, and Infinity for unlimited limits', async () => {
        vi.mocked(effectiveSetApi.get).mockResolvedValue({
            ok: true,
            data: {
                entitlements: { paid: 1, zero: 0 },
                limits: { cap: Number.POSITIVE_INFINITY },
                hasLiveNonTrialTitle: false,
                userId: 'u',
                vertical: 'accommodation'
            }
        } as never);
        const { result } = renderHook(() => useMyEntitlements({ vertical: 'accommodation' }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.has('paid')).toBe(true);
        expect(result.current.has('zero')).toBe(false);
        expect(result.current.has('missing')).toBe(false);
        expect(result.current.limit('cap')).toBe(Number.POSITIVE_INFINITY);
        expect(result.current.limit('missing')).toBe(0);
    });
    it('returns absence and error on failed reads', async () => {
        vi.mocked(effectiveSetApi.get).mockResolvedValue({
            ok: false,
            error: { message: 'API message' }
        } as never);
        const { result } = renderHook(() => useMyEntitlements({ vertical: 'accommodation' }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.has('paid')).toBe(false);
        expect(result.current.limit('cap')).toBe(0);
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).not.toBe('API message');
    });
    it('does not call the endpoint without a session', async () => {
        session.mockReturnValue({ data: null, isPending: false });
        const { result } = renderHook(() => useMyEntitlements({ vertical: 'accommodation' }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.has('paid')).toBe(false);
        expect(effectiveSetApi.get).not.toHaveBeenCalled();
    });
});
