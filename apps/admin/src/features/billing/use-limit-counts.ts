/**
 * Hooks for fetching current usage counts used by PlanLimitGate.
 *
 * Each hook fetches the caller's own resource count from the API with
 * `pageSize=1` so only the `pagination.total` field is relevant — no items
 * are transferred.  All hooks use a 60 s stale-time to match the TTL of
 * `useMyEntitlements`, keeping the limit check coherent within a session.
 *
 * Errors are captured in the `error` field; hooks never throw.
 *
 * @module features/billing/use-limit-counts
 */
import { useAuthContext } from '@/hooks/use-auth-context';
import { fetchApi } from '@/lib/api/client';
import { LifecycleStatusEnum } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Envelope shape returned by admin list endpoints:
 * `{ success: boolean; data: { items: unknown[]; pagination: { total: number } } }`
 */
interface AdminListEnvelope {
    success: boolean;
    data: {
        items: unknown[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    };
}

/**
 * Shared return shape for all count hooks.
 */
export interface UseLimitCountReturn {
    /** Current usage count, or 0 while loading or on error. */
    readonly count: number;
    readonly isLoading: boolean;
    readonly error: Error | null;
}

// ---------------------------------------------------------------------------
// Accommodation count
// ---------------------------------------------------------------------------

/** Stable query key for the current actor's accommodation count. */
export const MY_ACCOMMODATION_COUNT_QUERY_KEY = [
    'billing',
    'limit-counts',
    'accommodations'
] as const;

/**
 * Fetches the count of accommodations owned by the current actor.
 *
 * Uses `GET /api/v1/admin/accommodations?ownerId=<me>&pageSize=1` and reads
 * `pagination.total`.  The `ownerId` filter ensures the count reflects only
 * the actor's own accommodations regardless of admin-level access.
 *
 * @returns `{ count, isLoading, error }`
 *
 * @example
 * ```tsx
 * const { count: accommodationCount } = useAccommodationCount();
 * <PlanLimitGate limitKey={LimitKey.MAX_ACCOMMODATIONS} currentCount={accommodationCount}>
 *   <AccommodationForm />
 * </PlanLimitGate>
 * ```
 */
export function useAccommodationCount(): UseLimitCountReturn {
    const { user } = useAuthContext();
    const userId = user?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: [...MY_ACCOMMODATION_COUNT_QUERY_KEY, userId],
        queryFn: async (): Promise<number> => {
            const params = new URLSearchParams({ pageSize: '1' });
            if (userId) {
                params.set('ownerId', userId);
            }

            const result = await fetchApi<AdminListEnvelope>({
                path: `/api/v1/admin/accommodations?${params.toString()}`
            });

            return result.data?.data?.pagination?.total ?? 0;
        },
        enabled: Boolean(userId),
        staleTime: 60_000,
        retry: 1
    });

    return {
        count: data ?? 0,
        isLoading,
        error: error instanceof Error ? error : null
    };
}

// ---------------------------------------------------------------------------
// Active owner-promotion count
// ---------------------------------------------------------------------------

/** Stable query key for the current actor's active promotion count. */
export const MY_ACTIVE_PROMOTION_COUNT_QUERY_KEY = [
    'billing',
    'limit-counts',
    'active-promotions'
] as const;

/**
 * Fetches the count of ACTIVE owner promotions for the current actor.
 *
 * Uses `GET /api/v1/admin/owner-promotions?ownerId=<me>&lifecycleState=ACTIVE&pageSize=1`
 * and reads `pagination.total`.  The `ownerId` filter ensures the count
 * reflects only the actor's own promotions.
 *
 * @returns `{ count, isLoading, error }`
 *
 * @example
 * ```tsx
 * const { count: promoCount } = useActiveOwnerPromotionCount();
 * <PlanLimitGate limitKey={LimitKey.MAX_ACTIVE_PROMOTIONS} currentCount={promoCount}>
 *   <CreateButton />
 * </PlanLimitGate>
 * ```
 */
export function useActiveOwnerPromotionCount(): UseLimitCountReturn {
    const { user } = useAuthContext();
    const userId = user?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: [...MY_ACTIVE_PROMOTION_COUNT_QUERY_KEY, userId],
        queryFn: async (): Promise<number> => {
            const params = new URLSearchParams({
                pageSize: '1',
                lifecycleState: LifecycleStatusEnum.ACTIVE
            });
            if (userId) {
                params.set('ownerId', userId);
            }

            const result = await fetchApi<AdminListEnvelope>({
                path: `/api/v1/admin/owner-promotions?${params.toString()}`
            });

            return result.data?.data?.pagination?.total ?? 0;
        },
        enabled: Boolean(userId),
        staleTime: 60_000,
        retry: 1
    });

    return {
        count: data ?? 0,
        isLoading,
        error: error instanceof Error ? error : null
    };
}
