/**
 * TanStack Query mutation hook for the accommodation import-from-URL feature.
 *
 * Fires `POST /api/v1/protected/accommodations/import-from-url` and returns
 * the unwrapped response on success — either the finalized
 * {@link AccommodationImportResponse} (`200`), or (for slow/blocked sources —
 * HOS-50 / SPEC-277 R3) an {@link AccommodationImportAsyncStartResponse} run
 * handle (`202`) to poll via `useAccommodationImportStatusQuery` (T-014).
 *
 * The endpoint lives under `/protected/` (not `/admin/`) because the import
 * flow is initiated by authenticated users (hosts or admins) and the server
 * uses session identity to scope the request — not admin-level permissions.
 *
 * @module useAccommodationImportMutation
 */

import type {
    AccommodationImportAsyncStartResponse,
    AccommodationImportResponse
} from '@repo/schemas';
import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/**
 * Input payload for the import mutation.
 * Mirrors the validated fields of `AccommodationImportRequestSchema`.
 */
export interface AccommodationImportInput {
    /** Public listing URL to scrape. */
    readonly url: string;
    /** Must be `true` — the user explicitly confirmed the legal notice. */
    readonly legalConfirmed: true;
}

/** API envelope returned by the protected endpoint. */
interface ImportApiEnvelope {
    readonly success: boolean;
    readonly data: AccommodationImportResponse | AccommodationImportAsyncStartResponse;
}

/**
 * Narrows an import-from-URL response to the async `202` dispatch shape
 * (HOS-50 / SPEC-277 R3 T-015 — admin twin of the web guard in
 * `apps/web/src/lib/api/endpoints-protected.ts`).
 *
 * The endpoint is a single route with a dual response shape: `fetchApi`
 * resolves for both `200` and `202`, so callers narrow structurally instead
 * of switching on the HTTP status. `runId` only ever appears on the async
 * start response, never on the synchronous {@link AccommodationImportResponse}.
 *
 * @param data - The unwrapped result of `mutation.mutateAsync(...)`.
 * @returns `true` when `data` is the async run-handle shape.
 */
export function isAsyncImportStart(
    data: AccommodationImportResponse | AccommodationImportAsyncStartResponse
): data is AccommodationImportAsyncStartResponse {
    return 'runId' in data;
}

/**
 * Hook that exposes a TanStack Query mutation for importing accommodation data
 * from an external listing URL.
 *
 * @example
 * ```tsx
 * const mutation = useAccommodationImportMutation();
 * const result = await mutation.mutateAsync({ url: 'https://…', legalConfirmed: true });
 * if (isAsyncImportStart(result)) {
 *   // 202 — start polling via useAccommodationImportStatusQuery(result).
 * }
 * ```
 */
export const useAccommodationImportMutation = () => {
    return useMutation({
        mutationFn: async (
            input: AccommodationImportInput
        ): Promise<AccommodationImportResponse | AccommodationImportAsyncStartResponse> => {
            const response = await fetchApi<ImportApiEnvelope>({
                path: '/api/v1/protected/accommodations/import-from-url',
                method: 'POST',
                body: input
            });

            // Unwrap the `{ success, data }` envelope — callers receive the
            // inner data directly.
            return response.data.data;
        }
    });
};
