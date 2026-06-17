/**
 * @file use-api-query.ts
 * @description Typed React Query helpers for the Hospeda mobile API.
 *
 * This module provides two thin wrappers around TanStack Query that integrate
 * with the {@link apiFetch} client from `./client`:
 *
 * - **`useApiQuery`** — for GET / read queries (data fetching).
 * - **`useApiMutation`** — for mutating operations (POST / PUT / PATCH / DELETE).
 *
 * ## Pattern for entity hooks (T-011, T-012, …)
 *
 * Sub-tasks that build entity-specific data hooks MUST compose these primitives
 * rather than calling `useQuery` / `useMutation` directly. This ensures:
 *
 * 1. The API tier guard in `apiFetch` is always active.
 * 2. Schema validation (`ApiSchemaError`) is always enforced.
 * 3. The abort signal is always wired (proper request cancellation).
 * 4. Consistent query-key structure across all entity hooks.
 *
 * @example Fetch a public accommodation list
 * ```ts
 * import { z } from 'zod';
 * import { AccommodationPublicSchema } from '@repo/schemas';
 * import { useApiQuery } from '@/lib/api/use-api-query';
 *
 * const AccommodationListSchema = z.object({
 *   items: z.array(AccommodationPublicSchema),
 *   pagination: z.object({ total: z.number(), page: z.number() }).passthrough(),
 * });
 *
 * export function useAccommodations(page: number) {
 *   return useApiQuery({
 *     queryKey: ['accommodations', 'list', page],
 *     path: '/api/v1/public/accommodations',
 *     query: { page, pageSize: 12 },
 *     schema: AccommodationListSchema,
 *   });
 *   // Return type: UseQueryResult<{ items: AccommodationPublic[], pagination: … }>
 * }
 * ```
 *
 * @example Fetch a single destination (enabled guard)
 * ```ts
 * import { DestinationPublicSchema } from '@repo/schemas';
 * import { useApiQuery } from '@/lib/api/use-api-query';
 *
 * export function useDestination(slug: string | undefined) {
 *   return useApiQuery({
 *     queryKey: ['destinations', 'detail', slug ?? ''],
 *     path: `/api/v1/public/destinations/${slug}`,
 *     schema: DestinationPublicSchema,
 *     enabled: !!slug,
 *   });
 * }
 * ```
 *
 * @example Mutation (create bookmark)
 * ```ts
 * import { BookmarkSchema } from '@repo/schemas';
 * import { useApiMutation } from '@/lib/api/use-api-query';
 *
 * export function useCreateBookmark() {
 *   return useApiMutation({
 *     path: '/api/v1/protected/bookmarks',
 *     method: 'POST',
 *     schema: BookmarkSchema,
 *   });
 * }
 * // Usage: const mutation = useCreateBookmark();
 * //        mutation.mutate({ accommodationId: 'abc' });
 * ```
 *
 * @module api/use-api-query
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
    QueryFunctionContext,
    UseMutationResult,
    UseQueryResult
} from '@tanstack/react-query';
import type { ZodTypeAny } from 'zod';
import { apiFetch } from './client';
import type { HttpMethod } from './types';

// ---------------------------------------------------------------------------
// useApiQuery
// ---------------------------------------------------------------------------

/**
 * Input parameters for {@link useApiQuery}.
 *
 * @template S - Zod schema type that validates the `data` payload.
 */
export interface UseApiQueryInput<S extends ZodTypeAny> {
    /**
     * TanStack Query cache key. Must be a non-empty readonly array.
     * Convention: `['entity', 'variant', ...params]`
     * (e.g. `['accommodations', 'list', page]`).
     */
    readonly queryKey: readonly unknown[];

    /**
     * API path relative to the base URL. Must start with `/api/v1/public/`
     * or `/api/v1/protected/`. Paths starting with `/api/v1/admin/` are
     * rejected at runtime by `apiFetch`.
     */
    readonly path: string;

    /**
     * Optional query parameters. Values are coerced to strings;
     * `undefined` / `null` values are omitted from the URL.
     */
    readonly query?: Record<string, string | number | boolean | null | undefined>;

    /**
     * Zod schema for the `data` payload inside the API success envelope.
     * The inferred type `S['_output']` becomes the `data` type of the result.
     */
    readonly schema: S;

    /**
     * Whether the query should execute. Mirrors TanStack Query's `enabled`
     * option. Defaults to `true`.
     *
     * @example Guard on a required param
     * ```ts
     * enabled: !!slug
     * ```
     */
    readonly enabled?: boolean;

    /**
     * Per-query override of the global `staleTime` (milliseconds).
     * Useful for data that changes more frequently than the 5-minute default
     * (e.g. live search results).
     */
    readonly staleTime?: number;
}

/**
 * Typed wrapper around `useQuery` that fetches data via {@link apiFetch}.
 *
 * The abort signal from `QueryFunctionContext` is forwarded to `apiFetch`,
 * so TanStack Query's query cancellation (unmount, refetch superseding a
 * pending request) automatically aborts the underlying fetch.
 *
 * @template S - Zod schema type. The hook return type is inferred as
 *   `UseQueryResult<S['_output']>`.
 *
 * @param input - Query configuration.
 * @returns TanStack `UseQueryResult` with `data` typed as `S['_output']`.
 *
 * @example
 * ```ts
 * const { data, isLoading, error } = useApiQuery({
 *   queryKey: ['destinations', 'list'],
 *   path: '/api/v1/public/destinations',
 *   schema: DestinationListSchema,
 * });
 * ```
 */
export const useApiQuery = <S extends ZodTypeAny>({
    queryKey,
    path,
    query,
    schema,
    enabled = true,
    staleTime
}: UseApiQueryInput<S>): UseQueryResult<S['_output']> => {
    return useQuery<S['_output']>({
        queryKey,
        queryFn: async ({ signal }: QueryFunctionContext): Promise<S['_output']> => {
            const { data } = await apiFetch({ path, query, schema, signal });
            return data;
        },
        enabled,
        ...(staleTime !== undefined && { staleTime })
    });
};

// ---------------------------------------------------------------------------
// useApiMutation
// ---------------------------------------------------------------------------

/**
 * Input parameters for {@link useApiMutation}.
 *
 * @template S - Zod schema type for the mutation response `data` payload.
 * @template TVariables - Type of the variables passed to `mutation.mutate()`.
 */
export interface UseApiMutationInput<S extends ZodTypeAny, TVariables = unknown> {
    /**
     * API path relative to the base URL. Must start with `/api/v1/public/`
     * or `/api/v1/protected/`.
     *
     * For dynamic paths (e.g. `/api/v1/protected/bookmarks/:id`), either
     * pass a static path and append the ID in `buildPath`, or build the path
     * from `TVariables` using a `pathFn` — see the note below.
     */
    readonly path: string;

    /**
     * HTTP method for the mutation. Defaults to `'POST'`.
     */
    readonly method?: HttpMethod;

    /**
     * Zod schema for the `data` payload in the mutation response.
     */
    readonly schema: S;

    /**
     * Optional transform applied to `variables` before they are sent as the
     * request body. Use this to reshape the mutation input into the wire format
     * expected by the API without polluting the call site.
     *
     * @param variables - The raw mutation variables from `mutation.mutate(vars)`.
     * @returns The request body to serialize as JSON.
     */
    readonly transformBody?: (variables: TVariables) => unknown;
}

/**
 * Typed wrapper around `useMutation` that calls the API via {@link apiFetch}.
 *
 * Mutations do not wire an abort signal because RN has no equivalent of
 * React 18 concurrent mode cancellation for mutations. Network retries for
 * mutations are disabled by default in the {@link queryClient} defaults.
 *
 * @template S - Zod schema type. The mutation `data` result is typed as
 *   `S['_output']`.
 * @template TVariables - Variables type passed to `mutation.mutate()`.
 *   Defaults to `unknown` — override for stricter call-site typing.
 *
 * @param input - Mutation configuration.
 * @returns TanStack `UseMutationResult<S['_output'], Error, TVariables>`.
 *
 * @example
 * ```ts
 * const mutation = useApiMutation({
 *   path: '/api/v1/protected/bookmarks',
 *   method: 'POST',
 *   schema: BookmarkSchema,
 * });
 * mutation.mutate({ accommodationId: 'abc-123' });
 * ```
 */
export const useApiMutation = <S extends ZodTypeAny, TVariables = unknown>({
    path,
    method = 'POST',
    schema,
    transformBody
}: UseApiMutationInput<S, TVariables>): UseMutationResult<S['_output'], Error, TVariables> => {
    return useMutation<S['_output'], Error, TVariables>({
        mutationFn: async (variables: TVariables): Promise<S['_output']> => {
            const body = transformBody ? transformBody(variables) : variables;
            const { data } = await apiFetch({ path, method, body, schema });
            return data;
        }
    });
};
