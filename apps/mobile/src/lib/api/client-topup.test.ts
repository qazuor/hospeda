/**
 * @file client-topup.test.ts
 * @description Top-up tests for the remaining uncovered branches in client.ts.
 *
 * The main coverage in client.test.ts already covers ~96% of the file.
 * This file adds the missing branch: a non-2xx response whose JSON body
 * is valid JSON but is NOT a Hospeda error envelope — i.e. some upstream
 * proxy or misconfigured server returns e.g. `{ status: "error" }` without
 * the `{ success, error }` shape. That path hits the HTTP_ERROR branch
 * (lines 288-292 of client.ts).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError } from './errors';

// ---------------------------------------------------------------------------
// Mocks — same pattern as client.test.ts
// ---------------------------------------------------------------------------

vi.mock('../auth-client', () => ({
    getCookie: vi.fn(() => '')
}));

vi.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: { apiUrl: 'http://test-api.local' }
        }
    }
}));

// eslint-disable-next-line import/order
import { apiFetch } from './client';

// ---------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------

const ItemSchema = z.object({ id: z.string() });

/** Build a minimal Response-like object. */
const makeFetchResponse = (body: unknown, status: number): Response => {
    const bodyStr = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(JSON.parse(bodyStr))
    } as unknown as Response;
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('apiFetch — HTTP_ERROR branch (non-error-envelope on non-2xx)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('throws ApiError with code HTTP_ERROR when non-2xx body is not a Hospeda error envelope', async () => {
        // Arrange — valid JSON but not `{ success: false, error: … }`
        const weirdErrorBody = { status: 'error', detail: 'Something went wrong' };
        vi.mocked(fetch).mockResolvedValue(makeFetchResponse(weirdErrorBody, 503));

        // Act
        let caught: ApiError | undefined;
        try {
            await apiFetch({ path: '/api/v1/public/items/1', schema: ItemSchema });
        } catch (err) {
            if (err instanceof ApiError) caught = err;
        }

        // Assert
        expect(caught).toBeInstanceOf(ApiError);
        expect(caught?.apiCode).toBe('HTTP_ERROR');
        expect(caught?.status).toBe(503);
        expect(caught?.apiMessage).toContain('503');
    });

    it('throws ApiError with code HTTP_ERROR when non-2xx body is a plain string wrapped in JSON', async () => {
        // Arrange — a plain string (valid JSON primitive, not an object)
        vi.mocked(fetch).mockResolvedValue(makeFetchResponse('Internal Server Error', 500));

        // Act
        let caught: ApiError | undefined;
        try {
            await apiFetch({ path: '/api/v1/public/items/1', schema: ItemSchema });
        } catch (err) {
            if (err instanceof ApiError) caught = err;
        }

        // Assert
        expect(caught).toBeInstanceOf(ApiError);
        expect(caught?.apiCode).toBe('HTTP_ERROR');
        expect(caught?.status).toBe(500);
    });

    it('throws ApiError with code HTTP_ERROR when non-2xx body is null', async () => {
        // Arrange — JSON null (not an envelope)
        vi.mocked(fetch).mockResolvedValue(makeFetchResponse(null, 502));

        // Act
        let caught: ApiError | undefined;
        try {
            await apiFetch({ path: '/api/v1/public/items/1', schema: ItemSchema });
        } catch (err) {
            if (err instanceof ApiError) caught = err;
        }

        // Assert
        expect(caught).toBeInstanceOf(ApiError);
        expect(caught?.apiCode).toBe('HTTP_ERROR');
        expect(caught?.status).toBe(502);
    });

    it('does NOT throw HTTP_ERROR when non-2xx body IS a valid error envelope', async () => {
        // Arrange — this should hit the structured error path, NOT HTTP_ERROR
        const errorEnvelope = {
            success: false,
            error: { code: 'SERVICE_UNAVAILABLE', message: 'Temporarily down' }
        };
        vi.mocked(fetch).mockResolvedValue(makeFetchResponse(errorEnvelope, 503));

        // Act
        let caught: ApiError | undefined;
        try {
            await apiFetch({ path: '/api/v1/public/items/1', schema: ItemSchema });
        } catch (err) {
            if (err instanceof ApiError) caught = err;
        }

        // Assert — must be the structured code, not HTTP_ERROR
        expect(caught).toBeInstanceOf(ApiError);
        expect(caught?.apiCode).toBe('SERVICE_UNAVAILABLE');
        expect(caught?.apiCode).not.toBe('HTTP_ERROR');
    });
});
