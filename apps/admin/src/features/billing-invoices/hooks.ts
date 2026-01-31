import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/v1';

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

    const response = await fetch(`${API_BASE}/billing/invoices?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch a single invoice by ID
 */
async function fetchInvoice(id: string) {
    const response = await fetch(`${API_BASE}/billing/invoices/${id}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch invoice: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Pay an invoice
 */
async function payInvoice(id: string) {
    const response = await fetch(`${API_BASE}/billing/invoices/${id}/pay`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to pay invoice: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Void an invoice
 */
async function voidInvoice(id: string) {
    const response = await fetch(`${API_BASE}/billing/invoices/${id}/void`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to void invoice: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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
