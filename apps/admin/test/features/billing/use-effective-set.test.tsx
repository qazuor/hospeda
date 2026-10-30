import { VerticalEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type EffectiveSetSubject,
    EffectiveSetSubjectProvider
} from '@/features/billing/effective-set-subject';
import { useEffectiveSet } from '@/features/billing/use-effective-set';

const mockFetchApi = vi.fn();
vi.mock('@/lib/api/client', () => ({ fetchApi: (...args: unknown[]) => mockFetchApi(...args) }));

const userId = '11111111-1111-4111-8111-111111111111';
const subject = { userId, vertical: VerticalEnum.ACCOMMODATION };
const response = {
    userId,
    vertical: VerticalEnum.ACCOMMODATION,
    hasLiveNonTrialTitle: false,
    entitlements: { respond_reviews: 1 },
    limits: { max_accommodations: 'Infinity' }
};

function wrapper(value: EffectiveSetSubject | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
            <EffectiveSetSubjectProvider value={value}>{children}</EffectiveSetSubjectProvider>
        </QueryClientProvider>
    );
}

describe('TEST:B13a:23 AC:B13a:23 useEffectiveSet', () => {
    beforeEach(() => {
        mockFetchApi.mockReset();
        mockFetchApi.mockResolvedValue({ data: { data: response } });
    });

    it('opens staff screens without a subject and makes no request', () => {
        const { result } = renderHook(useEffectiveSet, { wrapper: wrapper(null) });
        expect(result.current.has('respond_reviews')).toBe(true);
        expect(result.current.limit('max_accommodations')).toBe(Number.POSITIVE_INFINITY);
        expect(mockFetchApi).not.toHaveBeenCalled();
    });

    it('reads the exact subject path and decodes Infinity', async () => {
        const { result } = renderHook(useEffectiveSet, { wrapper: wrapper(subject) });
        await waitFor(() => expect(result.current.has('respond_reviews')).toBe(true));
        expect(mockFetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/users/${userId}/effective-set?vertical=accommodation`
        });
        expect(result.current.limit('max_accommodations')).toBe(Number.POSITIVE_INFINITY);
        expect(result.current.has('can_embed_video')).toBe(false);
        expect(result.current.limit('max_photos_per_accommodation')).toBe(0);
    });

    it('fails closed when the request errors', async () => {
        mockFetchApi.mockRejectedValue(new Error('read failed'));
        const { result } = renderHook(useEffectiveSet, { wrapper: wrapper(subject) });
        await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
        expect(result.current.has('respond_reviews')).toBe(false);
        expect(result.current.limit('max_accommodations')).toBe(0);
    });
});
