// @vitest-environment jsdom
/**
 * TEST:7.3:7 (HOS-1875, AC:7:8) — the venue editor's save path.
 *
 * `useVenuePage` must send a foreign venue's `businessLines` through the
 * dedicated ACC:27 route FIRST, and only then the rest of the payload through
 * the general update. The order matters: a content field of a section the new
 * line brings (e.g. `nightInfo` on adding `nightlife`) would otherwise answer
 * 409 `SECTION_ABSENT` against the old selection.
 *
 * The test mocks the global `fetch`, never the API client: what it proves is the
 * requests that leave the browser.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVenuePage } from '../hooks/useVenuePage';

const VENUE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
/** `useAuthContext` is globally mocked by the admin test setup with this id. */
const USER_ID = 'test_user_id';
const BUSINESS_LINES_PATH = `/api/v1/admin/venues/${VENUE_ID}/business-lines`;
const GENERAL_PATH = `/api/v1/admin/venues/${VENUE_ID}`;

const fetchMock = vi.fn();

/** A fetch response shaped like the API's `{ success, data }` envelope. */
function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

/** Wraps the hook in the query client it needs. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false }
        }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

/**
 * Answers the detail GET and every mutation with an envelope carrying `ownerId`,
 * so the page knows whether the listing is foreign.
 */
function respondWith(ownerId: string, mutationStatus = 200) {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        if (method === 'GET') {
            return jsonResponse({
                success: true,
                data: { id: VENUE_ID, ownerId, name: 'Venue' }
            });
        }
        return jsonResponse(
            {
                success: mutationStatus < 400,
                data: { id: VENUE_ID, ownerId, name: 'Venue' }
            },
            mutationStatus
        );
    });
}

/** Every non-GET request the page made, in order. */
function mutations() {
    return fetchMock.mock.calls
        .filter(([, init]) => ((init as RequestInit | undefined)?.method ?? 'GET') !== 'GET')
        .map(([url, init]) => ({
            url: String(url),
            method: (init as RequestInit).method,
            body: JSON.parse(String((init as RequestInit).body))
        }));
}

/** Mounts the page and waits for the detail query to settle. */
async function mountPage() {
    const { result } = renderHook(() => useVenuePage(VENUE_ID), {
        wrapper: createWrapper()
    });
    await waitFor(() => expect(result.current.entity).toBeDefined());
    return result;
}

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('TEST:7.3:7 useVenuePage business-lines save path (ACC:27)', () => {
    it('sends a foreign businessLines first and the rest through the general update after', async () => {
        // Arrange
        respondWith(OWNER_ID);
        const result = await mountPage();

        // Act
        await result.current.updateMutation.mutateAsync({
            businessLines: ['food', 'nightlife'],
            name: 'Nuevo nombre'
        });

        // Assert: two calls, the classification first and alone.
        const calls = mutations();
        expect(calls).toHaveLength(2);
        expect(calls[0]).toEqual({
            url: expect.stringContaining(BUSINESS_LINES_PATH),
            method: 'PATCH',
            body: { businessLines: ['food', 'nightlife'] }
        });
        expect(calls[1]?.url).toContain(GENERAL_PATH);
        expect(calls[1]?.body).toEqual({ name: 'Nuevo nombre' });
        expect(calls[1]?.body).not.toHaveProperty('businessLines');
    });

    it('makes one call when a foreign payload only carries businessLines', async () => {
        // Arrange
        respondWith(OWNER_ID);
        const result = await mountPage();

        // Act
        await result.current.updateMutation.mutateAsync({
            businessLines: ['food', 'nightlife']
        });

        // Assert
        const calls = mutations();
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual({
            url: expect.stringContaining(BUSINESS_LINES_PATH),
            method: 'PATCH',
            body: { businessLines: ['food', 'nightlife'] }
        });
    });

    it('keeps an own venue on the single general update, businessLines included', async () => {
        // Arrange
        respondWith(USER_ID);
        const result = await mountPage();

        // Act
        await result.current.updateMutation.mutateAsync({
            businessLines: ['food', 'nightlife'],
            name: 'Nuevo nombre'
        });

        // Assert
        const calls = mutations();
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url).toContain(GENERAL_PATH);
        expect(calls[0]?.body).toEqual({
            businessLines: ['food', 'nightlife'],
            name: 'Nuevo nombre'
        });
    });

    it('does not send the general update when the classification call fails', async () => {
        // Arrange
        respondWith(OWNER_ID, 500);
        const result = await mountPage();

        // Act + Assert
        await expect(
            result.current.updateMutation.mutateAsync({
                businessLines: ['food', 'nightlife'],
                name: 'Nuevo nombre'
            })
        ).rejects.toThrow();
        expect(mutations()).toHaveLength(1);
    });
});
