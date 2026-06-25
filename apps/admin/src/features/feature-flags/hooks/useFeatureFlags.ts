import { fetchApi } from '@/lib/api/fetch-api';
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
            const response = await fetchApi(`${apiEndpoint}?${queryParams.toString()}`);
            return response as FeatureFlagListResponse;
        };

        return { queryKey, queryFn };
    };

    const useGetById = (id: string) => {
        const queryKey = [entityName, 'byId', id];

        const queryFn = async () => {
            const response = await fetchApi(`${apiEndpoint}/${id}`);
            return response as FeatureFlag;
        };

        return { queryKey, queryFn };
    };

    const useCreate = () => {
        const mutationFn = async (data: Partial<FeatureFlag>) => {
            const response = await fetchApi(apiEndpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response as FeatureFlag;
        };

        return { mutationFn };
    };

    const useUpdate = () => {
        const mutationFn = async ({ id, data }: { id: string; data: Partial<FeatureFlag> }) => {
            const response = await fetchApi(`${apiEndpoint}/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
            return response as FeatureFlag;
        };

        return { mutationFn };
    };

    const useDelete = () => {
        const mutationFn = async (id: string) => {
            await fetchApi(`${apiEndpoint}/${id}`, {
                method: 'DELETE'
            });
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
            const response = await fetchApi(`${apiEndpoint}/${id}/toggle`, {
                method: 'POST',
                body: JSON.stringify({ isActive, reason })
            });
            return response as FeatureFlag;
        };

        return { mutationFn };
    };

    const useAuditLog = (flagId: string) => {
        const queryKey = [entityName, 'auditLog', flagId];

        const queryFn = async () => {
            const response = await fetchApi(`${apiEndpoint}/${flagId}/audit`);
            return response as Array<Record<string, unknown>>;
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
