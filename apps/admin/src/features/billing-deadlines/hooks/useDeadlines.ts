import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { DEADLINE_HALVES } from '../config/deadline-halves';

/** The two independently versioned deadline API halves. */
export type DeadlineHalf = keyof typeof DEADLINE_HALVES;
type DeadlineVersion = { readonly version: number; readonly values: Record<string, unknown> };
type DeadlinePreview = {
    readonly currentVersion: number;
    readonly currentValue: unknown;
    readonly newValue: unknown;
    readonly message: string;
};

/** Returns the query cache key for a deadline half. */
export function deadlinesQueryKey(half: DeadlineHalf) {
    return ['deadlines', half] as const;
}

/** Reads the current version and values for one deadline half. */
export function useDeadlineVersion({ half }: { readonly half: DeadlineHalf }) {
    const config = DEADLINE_HALVES[half];
    return useQuery({
        queryKey: deadlinesQueryKey(half),
        queryFn: async (): Promise<DeadlineVersion> => {
            const response = await fetchApi<{ data: DeadlineVersion }>({ path: config.basePath });
            return response.data.data;
        },
        retry: false
    });
}

/** Previews one proposed deadline change. */
export function usePreviewDeadlineChange({ half }: { readonly half: DeadlineHalf }) {
    const config = DEADLINE_HALVES[half];
    return useMutation({
        mutationFn: async ({
            key,
            value
        }: {
            readonly key: number;
            readonly value: unknown;
        }): Promise<DeadlinePreview> => {
            const response = await fetchApi<{ data: DeadlinePreview }>({
                path: `${config.basePath}/preview`,
                method: 'POST',
                body: { key, value }
            });
            return response.data.data;
        },
        retry: false
    });
}

/** Publishes one confirmed deadline change and refreshes its half. */
export function useChangeDeadline({ half }: { readonly half: DeadlineHalf }) {
    const config = DEADLINE_HALVES[half];
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            key,
            value,
            expectedVersion
        }: {
            readonly key: number;
            readonly value: unknown;
            readonly expectedVersion: number;
        }): Promise<DeadlineVersion> => {
            const response = await fetchApi<{ data: DeadlineVersion }>({
                path: config.basePath,
                method: 'POST',
                body: { key, value, expectedVersion, confirmed: true }
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: deadlinesQueryKey(half) }),
        retry: false
    });
}
