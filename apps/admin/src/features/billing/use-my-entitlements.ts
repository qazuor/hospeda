/**
 * Hook for fetching the current user's plan entitlements.
 *
 * Calls GET /api/v1/protected/users/me/entitlements and returns a typed
 * convenience object so callers can do `has('can_use_rich_description')`
 * instead of checking raw string arrays.
 *
 * Caches the result for 60 s (matching the API-side cache TTL) so that
 * all entitlement-gated fields on the same page share a single in-flight
 * request.
 *
 * @module features/billing/use-my-entitlements
 */
import { fetchApi } from '@/lib/api/client';
import type { EntitlementKey, LimitKey } from '@repo/billing';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

/** Stable query key – shared across all components on the page. */
export const MY_ENTITLEMENTS_QUERY_KEY = ['billing', 'me', 'entitlements'] as const;

/** Zod schema matching the `/me/entitlements` response envelope. */
const MyEntitlementsResponseSchema = z.object({
    entitlements: z.array(z.string()),
    limits: z.record(z.string(), z.number()),
    plan: z
        .object({
            slug: z.string(),
            name: z.string(),
            status: z.string()
        })
        .nullable(),
    asOf: z.string()
});

/** Parsed response type from the entitlements endpoint. */
export type MyEntitlementsResponse = z.infer<typeof MyEntitlementsResponseSchema>;

/**
 * Fetches `/api/v1/protected/users/me/entitlements` and validates the
 * response shape with Zod.
 */
async function fetchMyEntitlements(): Promise<MyEntitlementsResponse> {
    const { data } = await fetchApi<{ data: unknown }>({
        path: '/api/v1/protected/users/me/entitlements'
    });

    // The API wraps its response in { data: ... }
    const payload = (data as { data?: unknown }).data ?? data;
    return MyEntitlementsResponseSchema.parse(payload);
}

/**
 * Return type for `useMyEntitlements`.
 */
export interface UseMyEntitlementsReturn {
    /**
     * Returns true if the current user's plan includes the given entitlement
     * key. Returns false while loading or on error (fail-closed).
     */
    readonly has: (key: EntitlementKey | string) => boolean;
    /**
     * Returns the numeric limit for a given limit key, or -1 (unlimited) when
     * the key is absent from the plan.
     */
    readonly limit: (key: LimitKey | string) => number;
    /** Raw plan metadata (null when the user has no active subscription). */
    readonly plan: MyEntitlementsResponse['plan'];
    readonly isLoading: boolean;
    readonly error: Error | null;
}

/**
 * Fetches and caches the current user's plan entitlements.
 *
 * @returns A typed convenience object for checking entitlement flags and
 *   limit values.
 *
 * @example
 * ```tsx
 * const { has, isLoading } = useMyEntitlements();
 * if (!isLoading && !has(EntitlementKey.CAN_USE_RICH_DESCRIPTION)) {
 *   return <PlainTextarea />;
 * }
 * return <RichEditor />;
 * ```
 */
export function useMyEntitlements(): UseMyEntitlementsReturn {
    const { data, isLoading, error } = useQuery({
        queryKey: MY_ENTITLEMENTS_QUERY_KEY,
        queryFn: fetchMyEntitlements,
        staleTime: 60_000,
        retry: 1
    });

    const entitlementSet = new Set(data?.entitlements ?? []);

    const has = (key: EntitlementKey | string): boolean => {
        return entitlementSet.has(key as string);
    };

    const limit = (key: LimitKey | string): number => {
        return data?.limits[key as string] ?? -1;
    };

    return {
        has,
        limit,
        plan: data?.plan ?? null,
        isLoading,
        error: error instanceof Error ? error : null
    };
}
