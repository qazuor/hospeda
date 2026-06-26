import { fetchApi } from '@/lib/api/client';
import type { FeatureFlag, FeatureFlagAdminSearch } from '@repo/schemas';

export interface FeatureFlagListResponse {
    items: FeatureFlag[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export function createFeatureFlagHooks() {
    const entityName = 'feature-flags';
    const apiEndpoint = `/api/v1/admin/${entityName}`;

    const useList = (search?: FeatureFlagAdminSearch) => {
        const queryParams = new URLSearchParams();
        if (search?.search) queryParams.set('search', search.search);
        if (search?.isActive !== undefined) queryParams.set('isActive', String(search.isActive));
        if (search?.enabled !== undefined) queryParams.set('enabled', String(search.enabled));
        if (search?.page) queryParams.set('page', String(search.page));
        if (search?.pageSize) queryParams.set('pageSize', String(search.pageSize));

        const queryKey = [entityName, 'list', queryParams.toString()];

        const queryFn = async () => {
            const response = await fetchApi<FeatureFlagListResponse>({
                path: `${apiEndpoint}?${queryParams.toString()}`
            });
            return response.data;
        };

        return { queryKey, queryFn };
    };

    const useGetById = (id: string) => {
        const queryKey = [entityName, 'byId', id];

        const queryFn = async () => {
            const response = await fetchApi<FeatureFlag>({ path: `${apiEndpoint}/${id}` });
            return response.data;
        };

        return { queryKey, queryFn };
    };

    const useCreate = () => {
        const mutationFn = async (data: Partial<FeatureFlag>) => {
            const response = await fetchApi<FeatureFlag>({
                path: apiEndpoint,
                method: 'POST',
                body: data
            });
            return response.data;
        };

        return { mutationFn };
    };

    const useUpdate = () => {
        const mutationFn = async ({ id, data }: { id: string; data: Partial<FeatureFlag> }) => {
            const response = await fetchApi<FeatureFlag>({
                path: `${apiEndpoint}/${id}`,
                method: 'PATCH',
                body: data
            });
            return response.data;
        };

        return { mutationFn };
    };

    const useDelete = () => {
        const mutationFn = async (id: string) => {
            await fetchApi({ path: `${apiEndpoint}/${id}`, method: 'DELETE' });
        };

        return { mutationFn };
    };

    const useToggle = () => {
        const mutationFn = async ({
            id,
            isActive,
            reason
        }: {
            id: string;
            isActive: boolean;
            reason?: string;
        }) => {
            const response = await fetchApi<FeatureFlag>({
                path: `${apiEndpoint}/${id}/toggle`,
                method: 'POST',
                body: { isActive, reason }
            });
            return response.data;
        };

        return { mutationFn };
    };

    const useAuditLog = (flagId: string) => {
        const queryKey = [entityName, 'auditLog', flagId];

        const queryFn = async () => {
            const response = await fetchApi<Array<Record<string, unknown>>>({
                path: `${apiEndpoint}/${flagId}/audit`
            });
            return response.data;
        };

        return { queryKey, queryFn };
    };

    return {
        useList,
        useGetById,
        useCreate,
        useUpdate,
        useDelete,
        useToggle,
        useAuditLog
    };
}
