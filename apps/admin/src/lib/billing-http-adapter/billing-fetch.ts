/**
 * Billing API fetch utility
 *
 * Makes billing API requests using the centralized fetchApi client and
 * unwraps the response body envelope.
 */
import { fetchApi } from '../api/client';

/**
 * Configuration options for the HTTP billing adapter.
 *
 * @remarks
 * The `apiUrl` field is kept for backwards compatibility but is no longer used
 * internally. The centralized `fetchApi` client resolves the base URL from the
 * `VITE_API_URL` environment variable automatically.
 *
 * The `getAuthToken` field is also unused. Better Auth handles authentication
 * via session cookies (`credentials: 'include'`) through the centralized client.
 */
export interface HttpAdapterConfig {
    /**
     * Base API URL (e.g., 'http://localhost:3001').
     *
     * @deprecated Not used internally. The centralized fetchApi client resolves
     * the base URL from the VITE_API_URL environment variable.
     */
    apiUrl: string;

    /**
     * Optional function to get an authentication token.
     *
     * @deprecated Not used internally. Better Auth manages authentication
     * automatically via session cookies included in every request.
     */
    getAuthToken?: () => Promise<string | null>;
}

/**
 * Makes a billing API request using the centralized fetchApi client and
 * unwraps the response body envelope (supports both `{ data: T }` and bare `T`).
 *
 * @param path - The billing endpoint path (e.g., '/api/v1/protected/billing/customers')
 * @param method - HTTP method
 * @param body - Optional request body
 * @returns The unwrapped response value typed as T
 */
export async function billingFetch<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
): Promise<T> {
    const { data } = await fetchApi<{ data: T } | T>({ path, method, body });
    // Unwrap API envelope `{ data: T }` when present, otherwise return bare value
    if (data !== null && typeof data === 'object' && 'data' in (data as object)) {
        return (data as { data: T }).data;
    }
    return data as T;
}
