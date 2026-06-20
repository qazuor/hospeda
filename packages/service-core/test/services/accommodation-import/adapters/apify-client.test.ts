/**
 * Unit tests for the shared Apify client helper (SPEC-222 T-016)
 *
 * `fetch` is mocked globally via `vi.stubGlobal` — no real HTTP calls are made.
 *
 * Covers:
 * - Happy path: the endpoint returns a JSON array → the array is returned.
 * - Non-2xx response → `[]` returned, no throw.
 * - `fetch` throws (simulated network / timeout) → `[]` returned, no throw.
 * - The actor slug is inserted verbatim (slash preserved) in the URL path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runApifyActor } from '../../../../src/services/accommodation-import/adapters/apify-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock `fetch` that resolves with a 200 JSON array response.
 */
function mockFetchOk(body: unknown[]): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(body)
    });
}

/**
 * Creates a mock `fetch` that resolves with a non-2xx response.
 */
function mockFetchError(status: number): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: vi.fn().mockResolvedValue({ error: 'request failed' })
    });
}

/**
 * Minimal default input for `runApifyActor`.
 */
function makeInput(
    overrides?: Partial<Parameters<typeof runApifyActor>[0]>
): Parameters<typeof runApifyActor>[0] {
    return {
        token: 'test-token-abc',
        actor: 'apify/airbnb-scraper',
        actorInput: { startUrls: [{ url: 'https://www.airbnb.com/rooms/1' }] },
        timeoutMs: 5_000,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runApifyActor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('happy path', () => {
        it('should return the items array from a successful 200 response', async () => {
            // Arrange
            const items = [{ name: 'Cabaña del Río' }, { name: 'Loft Centro' }];
            vi.stubGlobal('fetch', mockFetchOk(items));

            // Act
            const result = await runApifyActor(makeInput());

            // Assert
            expect(result).toEqual(items);
        });

        it('should return an empty array when the endpoint returns an empty array', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchOk([]));

            // Act
            const result = await runApifyActor(makeInput());

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] when the endpoint returns an object instead of an array', async () => {
            // Arrange — some actors may erroneously return an object
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: vi.fn().mockResolvedValue({ items: [] })
                })
            );

            // Act
            const result = await runApifyActor(makeInput());

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('URL construction — actor slug encoding', () => {
        it('encodes owner/actor as the owner~actor single-segment form (Apify requires it)', async () => {
            // Regression: the raw `owner/actor` slug routes to a non-existent
            // Apify endpoint (HTTP 404). The REST API addresses an actor as a
            // single path segment using the tilde form `owner~actor`.
            // Arrange
            const mockFetch = mockFetchOk([]);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await runApifyActor(makeInput({ actor: 'dtrungtin/airbnb-scraper', token: 'tok' }));

            // Assert
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).toContain(
                '/v2/acts/dtrungtin~airbnb-scraper/run-sync-get-dataset-items'
            );
            // The raw slash form must NOT be used, and nothing is percent-encoded.
            expect(calledUrl).not.toContain('/v2/acts/dtrungtin/airbnb-scraper/');
            expect(calledUrl).not.toContain('%2F');
        });

        it('should send the token as an Authorization header, never in the URL', async () => {
            // Arrange
            const mockFetch = mockFetchOk([]);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await runApifyActor(makeInput({ token: 'my-secret-token' }));

            // Assert — token rides in the header, not the query string (no leak)
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).not.toContain('my-secret-token');
            expect(calledUrl).not.toContain('token=');
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer my-secret-token');
        });

        it('should return [] for a malformed actor slug without calling fetch', async () => {
            // Arrange
            const mockFetch = mockFetchOk([]);
            vi.stubGlobal('fetch', mockFetch);

            // Act — no owner/name shape
            const result = await runApifyActor(makeInput({ actor: 'not-a-valid-slug' }));

            // Assert
            expect(result).toEqual([]);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should send the actor input as a JSON POST body', async () => {
            // Arrange
            const mockFetch = mockFetchOk([]);
            vi.stubGlobal('fetch', mockFetch);
            const actorInput = { startUrls: [{ url: 'https://www.airbnb.com/rooms/99' }] };

            // Act
            await runApifyActor(makeInput({ actorInput }));

            // Assert
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            expect(init.method).toBe('POST');
            expect(init.body).toBe(JSON.stringify(actorInput));
        });
    });

    describe('error handling', () => {
        it('should return [] for a 401 Unauthorized response without throwing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(401));

            // Act
            const result = await runApifyActor(makeInput());

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] for a 404 Not Found response without throwing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(404));

            // Act
            const result = await runApifyActor(makeInput());

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] for a 500 server error response without throwing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(500));

            // Act
            const result = await runApifyActor(makeInput());

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] when fetch throws a network error without re-throwing', async () => {
            // Arrange
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

            // Act
            const result = await runApifyActor(makeInput());

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] when fetch throws an AbortError (simulated timeout) without re-throwing', async () => {
            // Arrange
            const abortError = new DOMException('The operation was aborted', 'AbortError');
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

            // Act
            const result = await runApifyActor(makeInput({ timeoutMs: 1 }));

            // Assert
            expect(result).toEqual([]);
        });
    });
});
