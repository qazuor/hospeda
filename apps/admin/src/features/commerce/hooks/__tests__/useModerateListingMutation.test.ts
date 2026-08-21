// @vitest-environment jsdom
/**
 * Tests for `useModerateListingMutation` (HOS-686).
 *
 * The hook is the panel's half of AC-26: it decides WHICH endpoint the reject
 * button hits. Two ways it can be wrong and still look right in the browser:
 *
 *  1. It posts to `${endpoint}/reviews/${id}/moderate` — the review endpoint,
 *     the one anybody grepping "moderate" under commerce meets first. A stale
 *     id in that path answers 404, not "wrong endpoint".
 *  2. It posts the right body to the right path for the WRONG vertical, because
 *     both hooks are built by the same factory.
 *
 * Both are asserted on the exact path handed to `fetchApi`.
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { createCommerceEntityHooks } from '../createCommerceEntityHooks';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const LISTING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const gastronomyHooks = createCommerceEntityHooks<{ id: string }>({
    entityName: 'gastronomies',
    apiEndpoint: '/api/v1/admin/gastronomies'
});

const experienceHooks = createCommerceEntityHooks<{ id: string }>({
    entityName: 'experiences',
    apiEndpoint: '/api/v1/admin/experiences'
});

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('useModerateListingMutation — posts to the LISTING moderate endpoint', () => {
    it.each([
        ['gastronomy', gastronomyHooks, '/api/v1/admin/gastronomies'],
        ['experience', experienceHooks, '/api/v1/admin/experiences']
    ] as const)('%s: POSTs { moderationState } to %s/:id/moderate', async (_name, hooks, base) => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { id: LISTING_ID } }
        } as never);

        const { result } = renderHook(() => hooks.useModerateListingMutation(LISTING_ID), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({ moderationState: ModerationStatusEnum.REJECTED });

        await waitFor(() => expect(mockedFetchApi).toHaveBeenCalledTimes(1));
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `${base}/${LISTING_ID}/moderate`,
            method: 'POST',
            body: { moderationState: ModerationStatusEnum.REJECTED }
        });
    });

    it('is a different endpoint from the review-moderation hook — the HOS-589 §6.7 trap', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { id: LISTING_ID } }
        } as never);

        const { result } = renderHook(
            () => ({
                listing: gastronomyHooks.useModerateListingMutation(LISTING_ID),
                review: gastronomyHooks.useModerateReviewMutation()
            }),
            { wrapper: createWrapper() }
        );

        await result.current.listing.mutateAsync({
            moderationState: ModerationStatusEnum.REJECTED
        });
        await result.current.review.mutateAsync({ reviewId: 'r-1', decision: 'REJECTED' });

        const paths = mockedFetchApi.mock.calls.map((call) => (call[0] as { path: string }).path);
        expect(paths).toEqual([
            `/api/v1/admin/gastronomies/${LISTING_ID}/moderate`,
            '/api/v1/admin/gastronomies/reviews/r-1/moderate'
        ]);
    });

    it('unwraps the response envelope to the entity', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { id: LISTING_ID } }
        } as never);

        const { result } = renderHook(
            () => gastronomyHooks.useModerateListingMutation(LISTING_ID),
            { wrapper: createWrapper() }
        );

        const returned = await result.current.mutateAsync({
            moderationState: ModerationStatusEnum.APPROVED
        });

        expect(returned).toEqual({ id: LISTING_ID });
    });

    it('surfaces a rejection instead of swallowing it', async () => {
        // The cell shows an error toast off the thrown error. Swallowing it here
        // would make a 403 look like a successful takedown.
        mockedFetchApi.mockRejectedValue(new Error('Forbidden'));

        const { result } = renderHook(
            () => gastronomyHooks.useModerateListingMutation(LISTING_ID),
            { wrapper: createWrapper() }
        );

        await expect(
            result.current.mutateAsync({ moderationState: ModerationStatusEnum.REJECTED })
        ).rejects.toThrow('Forbidden');
    });
});
