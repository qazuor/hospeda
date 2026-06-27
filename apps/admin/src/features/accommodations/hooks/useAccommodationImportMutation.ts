/**
 * TanStack Query mutation hook for the accommodation import-from-URL feature.
 *
 * Fires `POST /api/v1/protected/accommodations/import-from-url` and returns
 * the unwrapped {@link AccommodationImportResponse} on success.
 *
 * The endpoint lives under `/protected/` (not `/admin/`) because the import
 * flow is initiated by authenticated users (hosts or admins) and the server
 * uses session identity to scope the request — not admin-level permissions.
 *
 * @module useAccommodationImportMutation
 */

import { fetchApi } from '@/lib/api/client';
import type { AccommodationImportResponse } from '@repo/schemas';
import { useMutation } from '@tanstack/react-query';

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
    readonly data: AccommodationImportResponse;
}

/**
 * Hook that exposes a TanStack Query mutation for importing accommodation data
 * from an external listing URL.
 *
 * @example
 * ```tsx
 * const mutation = useAccommodationImportMutation();
 * await mutation.mutateAsync({ url: 'https://…', legalConfirmed: true });
 * ```
 */
export const useAccommodationImportMutation = () => {
    return useMutation({
        mutationFn: async (
            input: AccommodationImportInput
        ): Promise<AccommodationImportResponse> => {
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
