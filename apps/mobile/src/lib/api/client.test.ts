/**
 * @file client.test.ts
 * @description Unit tests for the Hospeda mobile API client.
 *
 * Tests run in the `node` Vitest environment (pure logic, no React Native
 * runtime needed). `fetch` and `getCookie` are mocked via `vi.mock`.
 *
 * Coverage targets (AAA pattern throughout):
 * - Success path: 2xx + valid Zod schema → returns `{ data }`
 * - Zod drift: 2xx + invalid payload → throws `ApiSchemaError`
 * - Non-2xx structured error → throws `ApiError` with code/message/status
 * - `success: false` envelope on 2xx → throws `ApiError`
 * - Admin-path guard → throws `Error` (no fetch call)
 * - Cookie header: attached when `getCookie()` returns a string
 * - Cookie header: omitted when `getCookie()` returns empty string (no session)
 * - Query parameters: serialised into URL, undefined values omitted
 * - Body serialisation: JSON body + Content-Type header
 * - Non-JSON response body on failure → throws `ApiError` with PARSE_ERROR
 * - Unexpected envelope shape → throws `ApiError` with UNEXPECTED_SHAPE
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, ApiSchemaError } from './errors';

// ---------------------------------------------------------------------------
// Mocks — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

// Mock the auth-client module so getCookie() does not reach expo-secure-store
vi.mock('../auth-client', () => ({
    // better-auth types getCookie as () => string; returns '' when no session.
    getCookie: vi.fn(() => '')
}));

// Mock expo-constants (used by client.ts to resolve apiBaseUrl)
vi.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: { apiUrl: 'http://test-api.local' }
        }
    }
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are declared (Vitest hoisting ensures this is safe)
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/order
import { getCookie } from '../auth-client';
// eslint-disable-next-line import/order
import { apiFetch } from './client';

// Typed helper for the mocked getCookie
const mockGetCookie = vi.mocked(getCookie);

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
});

type User = z.infer<typeof UserSchema>;

const validUser: User = { id: 'u-1', name: 'Alice', email: 'alice@example.com' };

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object that `fetch` will return. */
const makeFetchResponse = (body: unknown, status = 200): Response => {
    const bodyStr = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(JSON.parse(bodyStr))
    } as unknown as Response;
};

/** Build a response whose .json() rejects (simulates non-JSON body). */
const makeNonJsonResponse = (status: number): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
    }) as unknown as Response;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('apiFetch', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Default: no session cookie (better-auth returns '' when no session)
        mockGetCookie.mockReturnValue('');
        // Default: fetch is not mocked (individual tests override this)
        vi.stubGlobal('fetch', vi.fn());
    });

    // -----------------------------------------------------------------------
    // Success path
    // -----------------------------------------------------------------------

    describe('success path', () => {
        it('returns parsed data when 2xx + valid schema', async () => {
            // Arrange
            const envelope = { success: true, data: validUser };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(envelope, 200));

            // Act
            const result = await apiFetch({
                path: '/api/v1/public/users/u-1',
                schema: UserSchema
            });

            // Assert
            expect(result.data).toEqual(validUser);
            expect(result.data.id).toBe('u-1');
        });

        it('calls fetch with the correct URL', async () => {
            // Arrange
            const envelope = { success: true, data: validUser };
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse(envelope, 200));

            // Act
            await apiFetch({
                path: '/api/v1/public/users/u-1',
                schema: UserSchema
            });

            // Assert
            expect(fetchMock).toHaveBeenCalledOnce();
            const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('http://test-api.local/api/v1/public/users/u-1');
        });

        it('defaults to GET method', async () => {
            // Arrange
            const envelope = { success: true, data: validUser };
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse(envelope));

            // Act
            await apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema });

            // Assert
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(init.method).toBe('GET');
        });

        it('passes custom HTTP method', async () => {
            // Arrange
            const envelope = { success: true, data: validUser };
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse(envelope, 201));

            // Act
            await apiFetch({
                path: '/api/v1/protected/users',
                method: 'POST',
                body: { name: 'Alice' },
                schema: UserSchema
            });

            // Assert
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(init.method).toBe('POST');
        });
    });

    // -----------------------------------------------------------------------
    // Cookie header
    // -----------------------------------------------------------------------

    describe('cookie header', () => {
        it('attaches Cookie header when getCookie() returns a string', async () => {
            // Arrange
            mockGetCookie.mockReturnValue('hospeda_cookie=abc123; Path=/');
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse({ success: true, data: validUser }));

            // Act
            await apiFetch({ path: '/api/v1/protected/users/u-1', schema: UserSchema });

            // Assert
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect((init.headers as Record<string, string>).Cookie).toBe(
                'hospeda_cookie=abc123; Path=/'
            );
        });

        it('omits Cookie header when getCookie() returns empty string (no session)', async () => {
            // Arrange — better-auth returns '' when no session cookie is stored
            mockGetCookie.mockReturnValue('');
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse({ success: true, data: validUser }));

            // Act
            await apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema });

            // Assert
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect((init.headers as Record<string, string>).Cookie).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Request body
    // -----------------------------------------------------------------------

    describe('request body', () => {
        it('sets Content-Type: application/json when body is provided', async () => {
            // Arrange
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse({ success: true, data: validUser }));

            // Act
            await apiFetch({
                path: '/api/v1/protected/users',
                method: 'POST',
                body: { name: 'Bob' },
                schema: UserSchema
            });

            // Assert
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect((init.headers as Record<string, string>)['Content-Type']).toBe(
                'application/json'
            );
            expect(init.body).toBe(JSON.stringify({ name: 'Bob' }));
        });

        it('does not set Content-Type when no body', async () => {
            // Arrange
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse({ success: true, data: validUser }));

            // Act
            await apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema });

            // Assert
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Query parameters
    // -----------------------------------------------------------------------

    describe('query parameters', () => {
        it('serialises query params into the URL', async () => {
            // Arrange
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse({ success: true, data: validUser }));

            // Act
            await apiFetch({
                path: '/api/v1/public/users',
                query: { page: 1, pageSize: 10, locale: 'es' },
                schema: UserSchema
            });

            // Assert
            const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('page=1');
            expect(url).toContain('pageSize=10');
            expect(url).toContain('locale=es');
        });

        it('omits undefined and null query values', async () => {
            // Arrange
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse({ success: true, data: validUser }));

            // Act
            await apiFetch({
                path: '/api/v1/public/users',
                query: { page: 1, locale: undefined, status: null },
                schema: UserSchema
            });

            // Assert
            const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('page=1');
            expect(url).not.toContain('locale');
            expect(url).not.toContain('status');
        });
    });

    // -----------------------------------------------------------------------
    // Admin path guard
    // -----------------------------------------------------------------------

    describe('admin path guard', () => {
        it('throws before calling fetch when path starts with /api/v1/admin', async () => {
            // Arrange
            const fetchMock = vi.mocked(fetch);

            // Act + Assert
            await expect(
                apiFetch({ path: '/api/v1/admin/users', schema: UserSchema })
            ).rejects.toThrow(/admin/i);

            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('throws for nested admin paths', async () => {
            // Arrange
            const fetchMock = vi.mocked(fetch);

            // Act + Assert
            await expect(
                apiFetch({ path: '/api/v1/admin/accommodations/123', schema: UserSchema })
            ).rejects.toThrow(/Mobile API client may not call admin endpoints/);

            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // ApiSchemaError (Zod drift)
    // -----------------------------------------------------------------------

    describe('schema validation (ApiSchemaError)', () => {
        it('throws ApiSchemaError when 2xx data does not match schema', async () => {
            // Arrange — missing required `email` field
            const envelope = { success: true, data: { id: 'u-1', name: 'Alice' } };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(envelope, 200));

            // Act + Assert
            await expect(
                apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema })
            ).rejects.toThrow(ApiSchemaError);
        });

        it('ApiSchemaError carries zodError with issue details', async () => {
            // Arrange
            const badData = { id: 123, name: null }; // wrong types
            const envelope = { success: true, data: badData };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(envelope));

            // Act
            let caught: ApiSchemaError | undefined;
            try {
                await apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema });
            } catch (err) {
                if (err instanceof ApiSchemaError) caught = err;
            }

            // Assert
            expect(caught).toBeInstanceOf(ApiSchemaError);
            expect(caught?.zodError.issues.length).toBeGreaterThan(0);
            expect(caught?.receivedData).toEqual(badData);
        });
    });

    // -----------------------------------------------------------------------
    // ApiError — non-2xx responses
    // -----------------------------------------------------------------------

    describe('non-2xx responses (ApiError)', () => {
        it('throws ApiError on 404 with structured error body', async () => {
            // Arrange
            const errorBody = {
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(errorBody, 404));

            // Act + Assert
            await expect(
                apiFetch({ path: '/api/v1/public/users/missing', schema: UserSchema })
            ).rejects.toThrow(ApiError);
        });

        it('ApiError carries correct status, code, and message on 404', async () => {
            // Arrange
            const errorBody = {
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found', reason: 'DELETED' }
            };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(errorBody, 404));

            // Act
            let caught: ApiError | undefined;
            try {
                await apiFetch({ path: '/api/v1/public/users/missing', schema: UserSchema });
            } catch (err) {
                if (err instanceof ApiError) caught = err;
            }

            // Assert
            expect(caught).toBeInstanceOf(ApiError);
            expect(caught?.status).toBe(404);
            expect(caught?.apiCode).toBe('NOT_FOUND');
            expect(caught?.apiMessage).toBe('User not found');
            expect(caught?.reason).toBe('DELETED');
        });

        it('throws ApiError with HTTP_ERROR code on non-JSON error body', async () => {
            // Arrange
            vi.mocked(fetch).mockResolvedValue(makeNonJsonResponse(500));

            // Act
            let caught: ApiError | undefined;
            try {
                await apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema });
            } catch (err) {
                if (err instanceof ApiError) caught = err;
            }

            // Assert
            expect(caught).toBeInstanceOf(ApiError);
            expect(caught?.apiCode).toBe('PARSE_ERROR');
            expect(caught?.status).toBe(500);
        });

        it('throws ApiError on 401 Unauthorized', async () => {
            // Arrange
            const errorBody = {
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
            };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(errorBody, 401));

            // Act
            let caught: ApiError | undefined;
            try {
                await apiFetch({
                    path: '/api/v1/protected/users/me',
                    schema: UserSchema
                });
            } catch (err) {
                if (err instanceof ApiError) caught = err;
            }

            // Assert
            expect(caught?.status).toBe(401);
            expect(caught?.apiCode).toBe('UNAUTHORIZED');
        });
    });

    // -----------------------------------------------------------------------
    // success: false envelope on 2xx body
    // -----------------------------------------------------------------------

    describe('success: false envelope on 2xx', () => {
        it('throws ApiError when 200 body has success: false', async () => {
            // Arrange — unusual but possible: server sends 200 with error envelope
            const errorBody = {
                success: false,
                error: { code: 'FORBIDDEN', message: 'Access denied' }
            };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(errorBody, 200));

            // Act
            let caught: ApiError | undefined;
            try {
                await apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema });
            } catch (err) {
                if (err instanceof ApiError) caught = err;
            }

            // Assert
            expect(caught).toBeInstanceOf(ApiError);
            expect(caught?.apiCode).toBe('FORBIDDEN');
            expect(caught?.status).toBe(200);
        });
    });

    // -----------------------------------------------------------------------
    // Unexpected envelope shape
    // -----------------------------------------------------------------------

    describe('unexpected envelope shape', () => {
        it('throws ApiError with UNEXPECTED_SHAPE when body lacks success field', async () => {
            // Arrange — e.g. a misconfigured proxy returns { data: … } without success
            const weirdBody = { data: validUser, status: 'ok' };
            vi.mocked(fetch).mockResolvedValue(makeFetchResponse(weirdBody, 200));

            // Act
            let caught: ApiError | undefined;
            try {
                await apiFetch({ path: '/api/v1/public/users/u-1', schema: UserSchema });
            } catch (err) {
                if (err instanceof ApiError) caught = err;
            }

            // Assert
            expect(caught).toBeInstanceOf(ApiError);
            expect(caught?.apiCode).toBe('UNEXPECTED_SHAPE');
        });
    });

    // -----------------------------------------------------------------------
    // AbortSignal pass-through
    // -----------------------------------------------------------------------

    describe('AbortSignal', () => {
        it('passes signal to fetch', async () => {
            // Arrange
            const controller = new AbortController();
            const fetchMock = vi.mocked(fetch);
            fetchMock.mockResolvedValue(makeFetchResponse({ success: true, data: validUser }));

            // Act
            await apiFetch({
                path: '/api/v1/public/users/u-1',
                schema: UserSchema,
                signal: controller.signal
            });

            // Assert
            const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(init.signal).toBe(controller.signal);
        });
    });
});
