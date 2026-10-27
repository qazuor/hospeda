// @vitest-environment jsdom
/**
 * Tests for `useModerateListingMutation` (HOS-1684, AC-1684:2).
 *
 * The hook decides WHICH listing the server moderates and WHAT it is asked to
 * do: a wrong vertical plural hits another listing (or answers 404), and a
 * body with a field added or dropped is a 400 — or worse, a `LIFT` that closes
 * a fix request the admin wanted to keep. Both are asserted on the exact path
 * and the whole body handed to `fetchApi`.
 */

import type { ListingModerationAction } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    buildModerateListingPath,
    useModerateListingMutation
} from '../useModerateListingMutation';
import type { PurgeListingVertical } from '../usePurgeListingOnRequestMutation';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const LISTING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

function createClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
}

function answer(data: unknown) {
    mockedFetchApi.mockResolvedValue({ data: { success: true, data }, status: 200 });
}

const VERTICALS = [
    ['accommodation', '/api/v1/admin/accommodations'],
    ['venue', '/api/v1/admin/venues'],
    ['experience', '/api/v1/admin/experiences']
] as const satisfies readonly (readonly [PurgeListingVertical, string])[];

const BODIES: readonly ListingModerationAction[] = [
    { action: 'REQUEST_FIX', reason: 'Fotos de otra ficha', suggestedDate: '2026-11-01' },
    { action: 'REQUEST_FIX', reason: 'Fotos de otra ficha', suggestedDate: null },
    { action: 'TAKE_DOWN', reason: 'Contenido engañoso' },
    { action: 'LIFT', reason: 'Ya lo corrigió', keepFixRequest: false },
    { action: 'LIFT', reason: 'Falta un detalle', keepFixRequest: true },
    { action: 'CLOSE_FIX_REQUEST', reason: 'Ya está bien' }
];

afterEach(() => {
    vi.clearAllMocks();
});

describe('TEST:1684:3 AC-1684:2 the mutation posts the action to its vertical moderate route', () => {
    for (const [vertical, base] of VERTICALS) {
        it.each(BODIES)(`${vertical}: POSTs %j untouched to ${base}/:id/moderate`, async (body) => {
            // Arrange
            answer({ publicationStatus: 'MODERATED', fixRequestOpen: true });
            const { result } = renderHook(() => useModerateListingMutation(), {
                wrapper: createWrapper(createClient())
            });

            // Act
            await result.current.mutateAsync({ vertical, id: LISTING_ID, body });

            // Assert
            expect(mockedFetchApi).toHaveBeenCalledTimes(1);
            expect(mockedFetchApi.mock.calls[0]?.[0]).toEqual({
                path: `${base}/${LISTING_ID}/moderate`,
                method: 'POST',
                body
            });
        });
    }

    it('builds the path from the vertical plural', () => {
        // Arrange / Act / Assert
        expect(buildModerateListingPath({ vertical: 'venue', id: LISTING_ID })).toBe(
            `/api/v1/admin/venues/${LISTING_ID}/moderate`
        );
    });

    it('resolves to the parsed { publicationStatus, fixRequestOpen }', async () => {
        // Arrange
        answer({ publicationStatus: 'UNPUBLISHED_BY_BILLING', fixRequestOpen: false, extra: 1 });
        const { result } = renderHook(() => useModerateListingMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act
        const outcome = await result.current.mutateAsync({
            vertical: 'accommodation',
            id: LISTING_ID,
            body: { action: 'LIFT', reason: 'ok', keepFixRequest: false }
        });

        // Assert
        expect(outcome).toEqual({
            publicationStatus: 'UNPUBLISHED_BY_BILLING',
            fixRequestOpen: false
        });
    });

    it('rejects an answer without fixRequestOpen instead of showing it', async () => {
        // Arrange
        answer({ publicationStatus: 'MODERATED' });
        const { result } = renderHook(() => useModerateListingMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act + Assert
        await expect(
            result.current.mutateAsync({
                vertical: 'experience',
                id: LISTING_ID,
                body: { action: 'TAKE_DOWN', reason: 'x' }
            })
        ).rejects.toThrow();
    });

    it.each(VERTICALS)('%s: invalidates the queries of its vertical', async (vertical, base) => {
        // Arrange
        answer({ publicationStatus: 'MODERATED', fixRequestOpen: false });
        const queryClient = createClient();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useModerateListingMutation(), {
            wrapper: createWrapper(queryClient)
        });

        // Act
        await result.current.mutateAsync({
            vertical,
            id: LISTING_ID,
            body: { action: 'TAKE_DOWN', reason: 'x' }
        });

        // Assert
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: [vertical === 'venue' ? 'gastronomies' : base.replace('/api/v1/admin/', '')]
        });
    });

    it('rejects when the route answers an error, so the caller can show it', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('Request failed (409)'));
        const { result } = renderHook(() => useModerateListingMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act + Assert
        await expect(
            result.current.mutateAsync({
                vertical: 'venue',
                id: LISTING_ID,
                body: { action: 'LIFT', reason: 'x', keepFixRequest: false }
            })
        ).rejects.toThrow('Request failed (409)');
    });
});
