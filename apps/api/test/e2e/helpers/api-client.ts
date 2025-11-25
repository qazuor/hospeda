import type { Actor } from '@repo/service-core';
import { expect } from 'vitest';
import { createAuthenticatedRequest } from '../../helpers/auth.js';

/**
 * Reusable API client for E2E tests
 * Provides authenticated HTTP methods and response assertion utilities
 */
export class E2EApiClient {
    constructor(
        private app: any,
        private actor: Actor
    ) {}

    /**
     * Make authenticated GET request
     * @param path - API path (e.g., '/api/v1/clients')
     * @param query - Optional query parameters
     * @returns Response object
     */
    async get(path: string, query?: Record<string, any>) {
        const queryString = query ? `?${new URLSearchParams(query).toString()}` : '';
        const headers = createAuthenticatedRequest(this.actor);

        return await this.app.request(`${path}${queryString}`, {
            method: 'GET',
            headers: headers.headers
        });
    }

    /**
     * Make authenticated POST request
     * @param path - API path
     * @param body - Request body
     * @returns Response object
     */
    async post(path: string, body: any) {
        const headers = createAuthenticatedRequest(this.actor);

        return await this.app.request(path, {
            method: 'POST',
            headers: headers.headers,
            body: JSON.stringify(body)
        });
    }

    /**
     * Make authenticated PUT request
     * @param path - API path
     * @param body - Request body
     * @returns Response object
     */
    async put(path: string, body: any) {
        const headers = createAuthenticatedRequest(this.actor);

        return await this.app.request(path, {
            method: 'PUT',
            headers: headers.headers,
            body: JSON.stringify(body)
        });
    }

    /**
     * Make authenticated PATCH request
     * @param path - API path
     * @param body - Request body
     * @returns Response object
     */
    async patch(path: string, body: any) {
        const headers = createAuthenticatedRequest(this.actor);

        return await this.app.request(path, {
            method: 'PATCH',
            headers: headers.headers,
            body: JSON.stringify(body)
        });
    }

    /**
     * Make authenticated DELETE request
     * @param path - API path
     * @returns Response object
     */
    async delete(path: string) {
        const headers = createAuthenticatedRequest(this.actor);

        return await this.app.request(path, {
            method: 'DELETE',
            headers: headers.headers
        });
    }

    /**
     * Parse JSON response and assert success
     * @param response - Response object
     * @param expectedStatus - Expected HTTP status code (default: 200)
     * @returns Parsed response data
     */
    async expectSuccess(response: Response, expectedStatus = 200) {
        expect(response.status).toBe(expectedStatus);
        const data = await response.json();
        expect(data.success).toBe(true);
        return data.data;
    }

    /**
     * Parse JSON response and assert error
     * @param response - Response object
     * @param expectedStatus - Expected HTTP status code
     * @returns Parsed error object
     */
    async expectError(response: Response, expectedStatus: number) {
        expect(response.status).toBe(expectedStatus);
        const data = await response.json();
        expect(data.success).toBe(false);
        return data.error;
    }

    /**
     * Parse JSON response and assert paginated success
     * @param response - Response object
     * @returns Parsed response with data and pagination
     */
    async expectPaginatedSuccess(response: Response) {
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.pagination).toBeDefined();
        return {
            data: result.data,
            pagination: result.pagination
        };
    }

    /**
     * Assert response contains specific error code
     * @param response - Response object
     * @param errorCode - Expected error code
     */
    async expectErrorCode(response: Response, errorCode: string) {
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error.code).toBe(errorCode);
    }

    /**
     * Assert response contains validation errors
     * @param response - Response object
     * @returns Validation errors array
     */
    async expectValidationErrors(response: Response) {
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error.code).toBe('VALIDATION_ERROR');
        expect(Array.isArray(error.error.details)).toBe(true);
        return error.error.details;
    }
}
