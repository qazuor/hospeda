import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    ExchangeRateConfigUpdateInput,
    ExchangeRateCreateInput,
    ExchangeRateFilters,
    ExchangeRateHistoryFilters,
    FetchNowResponse
} from './types';

const API_BASE = '/api/v1';

/**
 * Query keys for exchange rate queries
 */
export const exchangeRateQueryKeys = {
    rates: {
        all: ['exchange-rates'] as const,
        lists: () => [...exchangeRateQueryKeys.rates.all, 'list'] as const,
        list: (filters: ExchangeRateFilters) =>
            [...exchangeRateQueryKeys.rates.lists(), filters] as const
    },
    history: {
        all: ['exchange-rates-history'] as const,
        lists: () => [...exchangeRateQueryKeys.history.all, 'list'] as const,
        list: (filters: ExchangeRateHistoryFilters) =>
            [...exchangeRateQueryKeys.history.lists(), filters] as const
    },
    config: {
        all: ['exchange-rates-config'] as const
    }
};

/**
 * Fetch current exchange rates with filters
 */
async function fetchRates(filters: ExchangeRateFilters = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const response = await fetch(`${API_BASE}/public/exchange-rates?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch rates: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch exchange rate history with filters
 */
async function fetchRateHistory(filters: ExchangeRateHistoryFilters = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const response = await fetch(
        `${API_BASE}/protected/exchange-rates/history?${params.toString()}`,
        {
            credentials: 'include'
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch rate history: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch exchange rate configuration
 */
async function fetchConfig() {
    const response = await fetch(`${API_BASE}/protected/exchange-rates/config`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Create manual exchange rate override
 */
async function createManualOverride(payload: ExchangeRateCreateInput) {
    const response = await fetch(`${API_BASE}/protected/exchange-rates`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
            error.message || `Failed to create manual override: ${response.statusText}`
        );
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete manual exchange rate override
 */
async function deleteManualOverride(id: string) {
    const response = await fetch(`${API_BASE}/protected/exchange-rates/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete override: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update exchange rate configuration
 */
async function updateConfig(payload: ExchangeRateConfigUpdateInput) {
    const response = await fetch(`${API_BASE}/protected/exchange-rates/config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update config: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Trigger immediate rate fetch
 */
async function triggerFetchNow(): Promise<FetchNowResponse> {
    const response = await fetch(`${API_BASE}/protected/exchange-rates/fetch-now`, {
        method: 'POST',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to trigger fetch: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch exchange rates with filters
 */
export const useExchangeRatesQuery = (filters: ExchangeRateFilters = {}) => {
    return useQuery({
        queryKey: exchangeRateQueryKeys.rates.list(filters),
        queryFn: () => fetchRates(filters),
        staleTime: 30_000 // 30 seconds - rates change frequently
    });
};

/**
 * Hook to fetch exchange rate history
 */
export const useExchangeRateHistoryQuery = (filters: ExchangeRateHistoryFilters = {}) => {
    return useQuery({
        queryKey: exchangeRateQueryKeys.history.list(filters),
        queryFn: () => fetchRateHistory(filters),
        staleTime: 60_000 // 1 minute
    });
};

/**
 * Hook to fetch exchange rate configuration
 */
export const useExchangeRateConfigQuery = () => {
    return useQuery({
        queryKey: exchangeRateQueryKeys.config.all,
        queryFn: fetchConfig,
        staleTime: 300_000 // 5 minutes - config rarely changes
    });
};

/**
 * Hook to create manual override
 */
export const useCreateManualOverrideMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: ExchangeRateCreateInput) => createManualOverride(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: exchangeRateQueryKeys.rates.lists() });
        }
    });
};

/**
 * Hook to delete manual override
 */
export const useDeleteManualOverrideMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteManualOverride(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: exchangeRateQueryKeys.rates.lists() });
        }
    });
};

/**
 * Hook to update configuration
 */
export const useUpdateConfigMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: ExchangeRateConfigUpdateInput) => updateConfig(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: exchangeRateQueryKeys.config.all });
        }
    });
};

/**
 * Hook to trigger immediate fetch
 */
export const useTriggerFetchNowMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => triggerFetchNow(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: exchangeRateQueryKeys.rates.lists() });
        }
    });
};
