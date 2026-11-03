import type { AdminPartnerApplicationPanelQuery } from '@repo/schemas';
import { AdminPartnerApplicationPanelResponseSchema } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

export interface PartnerApplicationPanelInput {
    readonly view: AdminPartnerApplicationPanelQuery['view'];
    readonly page: number;
    readonly pageSize: number;
}

export const PARTNER_APPLICATION_PANEL_QUERY_KEY = ['partner-application-panel'] as const;

export function buildPartnerApplicationPanelPath({
    view,
    page,
    pageSize
}: PartnerApplicationPanelInput): string {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return `/api/v1/admin/partner-applications?${params.toString()}`;
}

/** Loads and validates one view of the admin partner application panel. */
export function usePartnerApplicationPanel(input: PartnerApplicationPanelInput) {
    return useQuery({
        queryKey: [...PARTNER_APPLICATION_PANEL_QUERY_KEY, input],
        retry: false,
        queryFn: async () => {
            const response = await fetchApi<{ data?: unknown }>({
                path: buildPartnerApplicationPanelPath(input),
                method: 'GET'
            });
            return AdminPartnerApplicationPanelResponseSchema.parse(response.data.data);
        }
    });
}
