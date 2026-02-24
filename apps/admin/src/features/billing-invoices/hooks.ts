import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query keys for invoice-related queries
 */
export const invoiceQueryKeys = {
    invoices: {
        all: ['billing-invoices'] as const,
        lists: () => [...invoiceQueryKeys.invoices.all, 'list'] as const,
        list: (filters: Record<string, unknown>) =>
            [...invoiceQueryKeys.invoices.lists(), filters] as const,
        details: () => [...invoiceQueryKeys.invoices.all, 'detail'] as const,
        detail: (id: string) => [...invoiceQueryKeys.invoices.details(), id] as const
    }
};

/**
 * Fetch invoices with filters
 */
async function fetchInvoices(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '' && value !== 'all') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: Record<string, unknown>[];
        pagination: Record<string, unknown>;
    }>({
        path: `/api/v1/billing/invoices?${params.toString()}`
    });
    // QZPay returns { success, data: [], pagination } - transform to { items, pagination }
    return { items: result.data.data, pagination: result.data.pagination };
}

/**
 * Fetch a single invoice by ID
 */
async function fetchInvoice(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/invoices/${id}`
    });
    return result.data.data;
}

/**
 * Pay an invoice
 */
async function payInvoice(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/invoices/${id}/pay`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Void an invoice
 */
async function voidInvoice(id: string) {
    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/billing/invoices/${id}/void`,
        method: 'POST'
    });
    return result.data.data;
}

/**
 * Hook to fetch invoices
 */
export const useInvoicesQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: invoiceQueryKeys.invoices.list(filters),
        queryFn: () => fetchInvoices(filters),
        staleTime: 60_000
    });
};

/**
 * Hook to fetch a single invoice
 */
export const useInvoiceQuery = (id: string) => {
    return useQuery({
        queryKey: invoiceQueryKeys.invoices.detail(id),
        queryFn: () => fetchInvoice(id),
        staleTime: 60_000,
        enabled: !!id
    });
};

/**
 * Hook to pay an invoice
 */
export const usePayInvoiceMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => payInvoice(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.invoices.lists() });
        }
    });
};

/**
 * Hook to void an invoice
 */
export const useVoidInvoiceMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => voidInvoice(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.invoices.lists() });
        }
    });
};
