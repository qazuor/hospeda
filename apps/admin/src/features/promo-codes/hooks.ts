import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    CreatePromoCodePayload,
    PromoCode,
    PromoCodeFilters,
    UpdatePromoCodePayload
} from './types';

const API_BASE = '/api/v1';

/**
 * Query keys for promo code-related queries
 */
export const promoCodeQueryKeys = {
    promoCodes: {
        all: ['promo-codes'] as const,
        lists: () => [...promoCodeQueryKeys.promoCodes.all, 'list'] as const,
        list: (filters: PromoCodeFilters) =>
            [...promoCodeQueryKeys.promoCodes.lists(), filters] as const,
        details: () => [...promoCodeQueryKeys.promoCodes.all, 'detail'] as const,
        detail: (id: string) => [...promoCodeQueryKeys.promoCodes.details(), id] as const
    }
};

/**
 * Mock promo codes data (fallback)
 */
const MOCK_PROMO_CODES: ReadonlyArray<PromoCode> = [
    {
        id: '1',
        code: 'HOSPEDA_FREE',
        description: 'Acceso gratuito permanente a la plataforma. Uso interno.',
        type: 'percentage',
        discountValue: 100,
        maxUses: null,
        maxUsesPerUser: null,
        usedCount: 12,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
        applicablePlans: ['owner', 'complex', 'tourist'],
        isStackable: false,
        isActive: true,
        requiresFirstPurchase: false,
        minimumAmount: null,
        status: 'active'
    },
    {
        id: '2',
        code: 'LANZAMIENTO50',
        description: '50% de descuento por lanzamiento. Primeros 3 meses.',
        type: 'percentage',
        discountValue: 50,
        maxUses: 500,
        maxUsesPerUser: 1,
        usedCount: 234,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2025-04-30'),
        applicablePlans: ['owner', 'complex'],
        isStackable: false,
        isActive: true,
        requiresFirstPurchase: true,
        minimumAmount: null,
        status: 'active'
    },
    {
        id: '3',
        code: 'TEMPORADABAJA',
        description: '20% de descuento temporada baja. Válido primeros 2 meses.',
        type: 'percentage',
        discountValue: 20,
        maxUses: 200,
        maxUsesPerUser: 1,
        usedCount: 87,
        validFrom: new Date('2024-05-01'),
        validUntil: new Date('2025-08-31'),
        applicablePlans: ['owner'],
        isStackable: true,
        isActive: true,
        requiresFirstPurchase: false,
        minimumAmount: 500000,
        status: 'active'
    },
    {
        id: '4',
        code: 'REFERIDO10',
        description: '10% de descuento por referido. Aplicable siempre.',
        type: 'percentage',
        discountValue: 10,
        maxUses: null,
        maxUsesPerUser: null,
        usedCount: 456,
        validFrom: new Date('2024-01-01'),
        validUntil: null,
        applicablePlans: ['owner', 'complex', 'tourist'],
        isStackable: true,
        isActive: true,
        requiresFirstPurchase: false,
        minimumAmount: null,
        status: 'active'
    },
    {
        id: '5',
        code: 'VERANO2024',
        description: '25% descuento temporada de verano.',
        type: 'percentage',
        discountValue: 25,
        maxUses: 150,
        maxUsesPerUser: 1,
        usedCount: 150,
        validFrom: new Date('2024-12-01'),
        validUntil: new Date('2025-02-28'),
        applicablePlans: ['owner', 'complex'],
        isStackable: false,
        isActive: false,
        requiresFirstPurchase: false,
        minimumAmount: null,
        status: 'expired'
    },
    {
        id: '6',
        code: 'DESCUENTO5000',
        description: 'ARS $5000 de descuento en primera suscripción.',
        type: 'fixed',
        discountValue: 500000,
        maxUses: 100,
        maxUsesPerUser: 1,
        usedCount: 34,
        validFrom: new Date('2024-01-01'),
        validUntil: new Date('2025-12-31'),
        applicablePlans: ['owner', 'complex'],
        isStackable: false,
        isActive: true,
        requiresFirstPurchase: true,
        minimumAmount: 1000000,
        status: 'active'
    }
];

/**
 * Fetch promo codes with filters
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function fetchPromoCodes(filters: PromoCodeFilters = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    try {
        // TODO: Update endpoint when API is ready
        // Expected endpoint: GET /api/v1/billing/promo-codes
        const response = await fetch(`${API_BASE}/billing/promo-codes?${params.toString()}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch promo codes: ${response.statusText}`);
        }

        const json = await response.json();
        return json.data;
    } catch (error) {
        // Fallback to mock data if API is not available
        console.warn('API not available, using mock data:', error);
        return {
            items: MOCK_PROMO_CODES,
            pagination: {
                total: MOCK_PROMO_CODES.length,
                page: filters.page || 1,
                limit: filters.limit || 20
            }
        };
    }
}

/**
 * Create a new promo code
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function createPromoCode(payload: CreatePromoCodePayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: POST /api/v1/billing/promo-codes
    const response = await fetch(`${API_BASE}/billing/promo-codes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to create promo code: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Update an existing promo code
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function updatePromoCode({ id, ...payload }: UpdatePromoCodePayload) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PUT /api/v1/billing/promo-codes/:id
    const response = await fetch(`${API_BASE}/billing/promo-codes/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to update promo code: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Toggle promo code active status
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function togglePromoCodeActive(id: string, isActive: boolean) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: PATCH /api/v1/billing/promo-codes/:id
    const response = await fetch(`${API_BASE}/billing/promo-codes/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to toggle promo code: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Delete a promo code
 * TODO: Replace with actual API endpoint once qzpay-hono billing routes are implemented
 */
async function deletePromoCode(id: string) {
    // TODO: Update endpoint when API is ready
    // Expected endpoint: DELETE /api/v1/billing/promo-codes/:id
    const response = await fetch(`${API_BASE}/billing/promo-codes/${id}`, {
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to delete promo code: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch promo codes
 */
export function usePromoCodesQuery(filters: PromoCodeFilters = {}) {
    return useQuery({
        queryKey: promoCodeQueryKeys.promoCodes.list(filters),
        queryFn: () => fetchPromoCodes(filters),
        staleTime: 60_000
    });
}

/**
 * Hook to create a new promo code
 */
export function useCreatePromoCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreatePromoCodePayload) => createPromoCode(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}

/**
 * Hook to update a promo code
 */
export function useUpdatePromoCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: UpdatePromoCodePayload) => updatePromoCode(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}

/**
 * Hook to toggle promo code active status
 */
export function useTogglePromoCodeActiveMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            togglePromoCodeActive(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}

/**
 * Hook to delete a promo code
 */
export function useDeletePromoCodeMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deletePromoCode(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: promoCodeQueryKeys.promoCodes.lists() });
        }
    });
}
