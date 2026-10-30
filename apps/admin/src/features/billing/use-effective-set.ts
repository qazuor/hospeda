import { type AdminEffectiveSetResponse, AdminEffectiveSetResponseSchema } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { type EffectiveSetSubject, useEffectiveSetSubject } from './effective-set-subject';

/** HOS-1638 AC:B13a:23: the resolved gates for an admin screen's subject. */
export interface UseEffectiveSetResult {
    readonly subject: EffectiveSetSubject | null;
    readonly has: (key: string) => boolean;
    readonly limit: (key: string) => number;
    readonly isLoading: boolean;
    readonly error: Error | null;
}

/** HOS-1638 AC:B13a:23: reads V3; missing keys and read errors fail closed. */
export function useEffectiveSet(): UseEffectiveSetResult {
    const subject = useEffectiveSetSubject();
    const { data, isLoading, error } = useQuery<AdminEffectiveSetResponse>({
        queryKey: ['billing', 'effective-set', subject?.userId, subject?.vertical],
        enabled: subject !== null,
        queryFn: async () => {
            if (!subject) throw new Error('Effective set subject is required');
            const response = await fetchApi<{ data: unknown }>({
                path: `/api/v1/admin/users/${subject.userId}/effective-set?vertical=${subject.vertical}`
            });
            return AdminEffectiveSetResponseSchema.parse(response.data.data);
        },
        staleTime: 60_000,
        retry: 1
    });

    if (subject === null) {
        return {
            subject: null,
            has: () => true,
            limit: () => Number.POSITIVE_INFINITY,
            isLoading: false,
            error: null
        };
    }
    return {
        subject,
        has: (key) => {
            if (error || !data) return false;
            const value = data.entitlements[key];
            return value === 'Infinity' || (typeof value === 'number' && value > 0);
        },
        limit: (key) => {
            if (error || !data) return 0;
            const value = data.limits[key];
            return value === 'Infinity' ? Number.POSITIVE_INFINITY : (value ?? 0);
        },
        isLoading,
        error: error instanceof Error ? error : null
    };
}
