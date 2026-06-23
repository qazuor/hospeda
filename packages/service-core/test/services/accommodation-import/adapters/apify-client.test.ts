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

import {
    getApifyDatasetItems,
    getApifyRunStatus,
    runApifyActor,
    startApifyRun
} from '../../../../src/services/accommodation-import/adapters/apify-client.js';

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
 * Creates a mock `fetch` that resolves with a response at an explicit status code
 * and a JSON body (used for 201 and other non-200/non-error codes).
 */
function mockFetchWithStatus(status: number, body: unknown): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: vi.fn().mockResolvedValue(body)
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

// ---------------------------------------------------------------------------
// startApifyRun
// ---------------------------------------------------------------------------

describe('startApifyRun', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const VALID_INPUT = {
        token: 'test-token-abc',
        actor: 'apify/airbnb-scraper',
        actorInput: { startUrls: [{ url: 'https://www.airbnb.com/rooms/1' }] }
    } as const;

    const WELL_FORMED_BODY = {
        data: {
            id: 'run-id-xyz',
            defaultDatasetId: 'dataset-id-abc',
            status: 'READY'
        }
    };

    describe('happy path', () => {
        it('should return runId and defaultDatasetId on a 201 response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(201, WELL_FORMED_BODY));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toEqual({ runId: 'run-id-xyz', defaultDatasetId: 'dataset-id-abc' });
        });

        it('should send the actor slug in tilde form in the URL', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(201, WELL_FORMED_BODY);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await startApifyRun({ ...VALID_INPUT, actor: 'dtrungtin/airbnb-scraper' });

            // Assert
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).toContain('/v2/acts/dtrungtin~airbnb-scraper/runs');
            expect(calledUrl).not.toContain('dtrungtin/airbnb-scraper');
        });

        it('should send the token in the Authorization header, never in the URL', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(201, WELL_FORMED_BODY);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await startApifyRun({ ...VALID_INPUT, token: 'super-secret-token' });

            // Assert
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).not.toContain('super-secret-token');
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer super-secret-token');
        });

        it('should send the actorInput as a JSON POST body', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(201, WELL_FORMED_BODY);
            vi.stubGlobal('fetch', mockFetch);
            const actorInput = { startUrls: [{ url: 'https://www.airbnb.com/rooms/99' }] };

            // Act
            await startApifyRun({ ...VALID_INPUT, actorInput });

            // Assert
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            expect(init.method).toBe('POST');
            expect(init.body).toBe(JSON.stringify(actorInput));
        });
    });

    describe('non-201 status codes degrade to null', () => {
        it('should return null on a 200 response (Apify uses 201 for run creation)', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, WELL_FORMED_BODY));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null on a 401 Unauthorized response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(401));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null on a 429 rate-limit response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(429));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null on a 500 server error', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(500));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('network / fetch errors degrade to null', () => {
        it('should return null when fetch throws a network error', async () => {
            // Arrange
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('malformed or missing response fields degrade to null', () => {
        it('should return null when response body has no data field', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(201, { error: 'unexpected' }));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when data.id is missing', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                mockFetchWithStatus(201, { data: { defaultDatasetId: 'ds-abc' } })
            );

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when data.defaultDatasetId is missing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(201, { data: { id: 'run-xyz' } }));

            // Act
            const result = await startApifyRun(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null for a malformed actor slug without calling fetch', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(201, WELL_FORMED_BODY);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            const result = await startApifyRun({ ...VALID_INPUT, actor: 'not-a-valid-slug' });

            // Assert
            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// getApifyRunStatus
// ---------------------------------------------------------------------------

describe('getApifyRunStatus', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const VALID_INPUT = {
        token: 'test-token-abc',
        runId: 'run-id-xyz'
    } as const;

    const WELL_FORMED_BODY = {
        data: {
            id: 'run-id-xyz',
            status: 'SUCCEEDED',
            defaultDatasetId: 'dataset-id-abc'
        }
    };

    describe('happy path', () => {
        it('should return status and defaultDatasetId on a 200 response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, WELL_FORMED_BODY));

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toEqual({ status: 'SUCCEEDED', defaultDatasetId: 'dataset-id-abc' });
        });

        it('should return RUNNING status correctly', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                mockFetchWithStatus(200, {
                    data: { id: 'run-id-xyz', status: 'RUNNING', defaultDatasetId: 'ds-abc' }
                })
            );

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result?.status).toBe('RUNNING');
        });

        it('should send the token in the Authorization header', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(200, WELL_FORMED_BODY);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await getApifyRunStatus({ ...VALID_INPUT, token: 'my-secret-token' });

            // Assert
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).not.toContain('my-secret-token');
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer my-secret-token');
        });

        it('should include the runId in the request URL', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(200, WELL_FORMED_BODY);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await getApifyRunStatus({ ...VALID_INPUT, runId: 'specific-run-id' });

            // Assert
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).toContain('/v2/actor-runs/specific-run-id');
        });

        it('should use GET method', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(200, WELL_FORMED_BODY);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await getApifyRunStatus(VALID_INPUT);

            // Assert
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            expect(init.method).toBe('GET');
        });
    });

    describe('non-200 status codes degrade to null', () => {
        it('should return null on a 401 Unauthorized response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(401));

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null on a 404 Not Found response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(404));

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null on a 500 server error', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(500));

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('network / fetch errors degrade to null', () => {
        it('should return null when fetch throws a network error', async () => {
            // Arrange
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('malformed or missing response fields degrade to null', () => {
        it('should return null when data.status is missing', async () => {
            // Arrange
            vi.stubGlobal(
                'fetch',
                mockFetchWithStatus(200, { data: { defaultDatasetId: 'ds-abc' } })
            );

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when data.defaultDatasetId is missing', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, { data: { status: 'SUCCEEDED' } }));

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null when response body has no data field', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, { error: 'unexpected' }));

            // Act
            const result = await getApifyRunStatus(VALID_INPUT);

            // Assert
            expect(result).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// getApifyDatasetItems
// ---------------------------------------------------------------------------

describe('getApifyDatasetItems', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const VALID_INPUT = {
        token: 'test-token-abc',
        datasetId: 'dataset-id-abc'
    } as const;

    describe('happy path', () => {
        it('should return the items array on a 200 response', async () => {
            // Arrange
            const items = [{ name: 'Cabaña del Río', rating: 9.2 }, { name: 'Loft Centro' }];
            vi.stubGlobal('fetch', mockFetchWithStatus(200, items));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual(items);
        });

        it('should return an empty array when the dataset is empty', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, []));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });

        it('should send the token in the Authorization header', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(200, []);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await getApifyDatasetItems({ ...VALID_INPUT, token: 'my-secret-token' });

            // Assert
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).not.toContain('my-secret-token');
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            const headers = init.headers as Record<string, string>;
            expect(headers.Authorization).toBe('Bearer my-secret-token');
        });

        it('should include the datasetId in the request URL', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(200, []);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await getApifyDatasetItems({ ...VALID_INPUT, datasetId: 'specific-dataset' });

            // Assert
            const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
            expect(calledUrl).toContain('/v2/datasets/specific-dataset/items');
        });

        it('should use GET method', async () => {
            // Arrange
            const mockFetch = mockFetchWithStatus(200, []);
            vi.stubGlobal('fetch', mockFetch);

            // Act
            await getApifyDatasetItems(VALID_INPUT);

            // Assert
            const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
            expect(init.method).toBe('GET');
        });
    });

    describe('non-200 status codes degrade to empty array', () => {
        it('should return [] on a 401 Unauthorized response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(401));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] on a 404 Not Found response', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(404));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] on a 500 server error', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchError(500));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('network / fetch errors degrade to empty array', () => {
        it('should return [] when fetch throws a network error', async () => {
            // Arrange
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('malformed response body degrades to empty array', () => {
        it('should return [] when response body is an object instead of an array', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, { items: [] }));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] when response body is null', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, null));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });

        it('should return [] when response body is a string', async () => {
            // Arrange
            vi.stubGlobal('fetch', mockFetchWithStatus(200, 'not-an-array'));

            // Act
            const result = await getApifyDatasetItems(VALID_INPUT);

            // Assert
            expect(result).toEqual([]);
        });
    });
});
