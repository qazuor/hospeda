import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query keys for sponsorship-related queries
 */
export const sponsorshipQueryKeys = {
    sponsorships: {
        all: ['sponsorships'] as const,
        lists: () => [...sponsorshipQueryKeys.sponsorships.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...sponsorshipQueryKeys.sponsorships.lists(), filters] as const,
        details: () => [...sponsorshipQueryKeys.sponsorships.all, 'detail'] as const,
        detail: (id: string) => [...sponsorshipQueryKeys.sponsorships.details(), id] as const
    },
    levels: {
        all: ['sponsorship-levels'] as const,
        lists: () => [...sponsorshipQueryKeys.levels.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...sponsorshipQueryKeys.levels.lists(), filters] as const
    },
    packages: {
        all: ['sponsorship-packages'] as const,
        lists: () => [...sponsorshipQueryKeys.packages.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...sponsorshipQueryKeys.packages.lists(), filters] as const
    }
};

/**
 * Fetch sponsorships with filters
 */
async function fetchSponsorships(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/admin/sponsorships?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetch sponsorship levels
 */
async function fetchSponsorshipLevels(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/admin/sponsorship-levels?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetch sponsorship packages
 */
async function fetchSponsorshipPackages(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { items: Record<string, unknown>[]; pagination: Record<string, unknown> };
    }>({
        path: `/api/v1/admin/sponsorship-packages?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Update sponsorship status (approve/cancel)
 */
async function updateSponsorshipStatus(id: string, sponsorshipStatus: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/sponsorships/${id}`,
        method: 'PATCH',
        body: { sponsorshipStatus }
    });
    return result.data.data;
}

/**
 * Create a sponsorship via admin endpoint.
 * SPEC-117 D-SPONSORSHIP.1 — wires the Create button on /billing/sponsorships.
 * SPEC-117 follow-up #1 — admin POST /sponsorships now mounted.
 */
async function createSponsorship(data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/admin/sponsorships',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Update a sponsorship via admin endpoint (full PUT).
 * Used for editing fields like logoUrl, linkUrl, dates, etc. Status changes
 * use `updateSponsorshipStatus` (PATCH) instead.
 */
async function updateSponsorship(id: string, data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/sponsorships/${id}`,
        method: 'PUT',
        body: data
    });
    return result.data.data;
}

/**
 * Soft-delete a sponsorship via admin endpoint.
 */
async function deleteSponsorship(id: string) {
    const result = await fetchApi<{ success: boolean; data: { success: boolean } }>({
        path: `/api/v1/admin/sponsorships/${id}`,
        method: 'DELETE'
    });
    return result.data.data;
}

/**
 * Create a sponsorship package.
 * SPEC-117 D-SPONSORSHIP.1 — wires the Create button on /billing/sponsorships (Packages tab).
 */
async function createSponsorshipPackage(data: Record<string, unknown>) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: '/api/v1/admin/sponsorship-packages',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

/**
 * Toggle sponsorship level active status
 */
async function toggleLevelActive(id: string, isActive: boolean) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/sponsorship-levels/${id}`,
        method: 'PATCH',
        body: { isActive }
    });
    return result.data.data;
}

/**
 * Toggle sponsorship package active status
 */
async function togglePackageActive(id: string, isActive: boolean) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/admin/sponsorship-packages/${id}`,
        method: 'PATCH',
        body: { isActive }
    });
    return result.data.data;
}

/**
 * Hook to fetch sponsorships
 */
export const useSponsorshipsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: sponsorshipQueryKeys.sponsorships.list(filters),
        queryFn: () => fetchSponsorships(filters),
        staleTime: 30_000
    });
};

/**
 * Hook to fetch sponsorship levels
 */
export const useSponsorshipLevelsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: sponsorshipQueryKeys.levels.list(filters),
        queryFn: () => fetchSponsorshipLevels(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to fetch sponsorship packages
 */
export const useSponsorshipPackagesQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: sponsorshipQueryKeys.packages.list(filters),
        queryFn: () => fetchSponsorshipPackages(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to update sponsorship status
 */
export const useUpdateSponsorshipStatusMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, sponsorshipStatus }: { id: string; sponsorshipStatus: string }) =>
            updateSponsorshipStatus(id, sponsorshipStatus),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sponsorshipQueryKeys.sponsorships.lists() });
        }
    });
};

/**
 * Hook to toggle sponsorship level active status
 */
export const useToggleLevelActiveMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            toggleLevelActive(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sponsorshipQueryKeys.levels.lists() });
        }
    });
};

/**
 * Hook to create a sponsorship.
 */
export const useCreateSponsorshipMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createSponsorship(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sponsorshipQueryKeys.sponsorships.lists() });
        }
    });
};

/**
 * Hook to update a sponsorship (full PUT). For status-only changes use
 * `useUpdateSponsorshipStatusMutation` instead.
 */
export const useUpdateSponsorshipMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
            updateSponsorship(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: sponsorshipQueryKeys.sponsorships.lists() });
            queryClient.invalidateQueries({
                queryKey: sponsorshipQueryKeys.sponsorships.detail(variables.id)
            });
        }
    });
};

/**
 * Hook to soft-delete a sponsorship.
 */
export const useDeleteSponsorshipMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteSponsorship(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sponsorshipQueryKeys.sponsorships.lists() });
        }
    });
};

/**
 * Hook to create a sponsorship package.
 */
export const useCreateSponsorshipPackageMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => createSponsorshipPackage(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sponsorshipQueryKeys.packages.lists() });
        }
    });
};

/**
 * Hook to toggle sponsorship package active status
 */
export const useTogglePackageActiveMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            togglePackageActive(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sponsorshipQueryKeys.packages.lists() });
        }
    });
};
