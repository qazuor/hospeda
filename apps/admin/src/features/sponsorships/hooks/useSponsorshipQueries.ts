import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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

    const response = await fetch(`${API_BASE}/sponsorships?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch sponsorships: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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

    const response = await fetch(`${API_BASE}/public/sponsorship-levels?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch sponsorship levels: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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

    const response = await fetch(`${API_BASE}/public/sponsorship-packages?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch sponsorship packages: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update sponsorship status (approve/cancel)
 */
async function updateSponsorshipStatus(id: string, status: string) {
    const response = await fetch(`${API_BASE}/sponsorships/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update sponsorship: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Toggle sponsorship level active status
 */
async function toggleLevelActive(id: string, isActive: boolean) {
    const response = await fetch(`${API_BASE}/admin/sponsorship-levels/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update level: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Toggle sponsorship package active status
 */
async function togglePackageActive(id: string, isActive: boolean) {
    const response = await fetch(`${API_BASE}/admin/sponsorship-packages/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update package: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            updateSponsorshipStatus(id, status),
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
