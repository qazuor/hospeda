// @vitest-environment jsdom

import { PartnerTypeEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePartnerApplicationActions } from '../usePartnerApplicationActions';

const mocks = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ fetchApi: mocks.fetchApi }));

describe('usePartnerApplicationActions', () => {
    beforeEach(() => mocks.fetchApi.mockReset().mockResolvedValue({ data: { data: {} } }));

    it('uses each route body and invalidates the panel after success', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const wrapper = ({ children }: { readonly children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        );
        const { result } = renderHook(() => usePartnerApplicationActions(), { wrapper });

        await act(async () =>
            result.current.approve.mutateAsync({
                id: 'application-1',
                name: 'Partner',
                type: PartnerTypeEnum.BUSINESS,
                reason: 'Approved'
            })
        );
        expect(mocks.fetchApi).toHaveBeenLastCalledWith({
            path: '/api/v1/admin/partner-applications/application-1/approve',
            method: 'POST',
            body: { name: 'Partner', type: PartnerTypeEnum.BUSINESS, reason: 'Approved' }
        });

        await act(async () =>
            result.current.reject.mutateAsync({ id: 'application-2', reason: 'Rejected' })
        );
        expect(mocks.fetchApi).toHaveBeenLastCalledWith({
            path: '/api/v1/admin/partner-applications/application-2/reject',
            method: 'POST',
            body: { reason: 'Rejected' }
        });

        await act(async () =>
            result.current.cancelWait.mutateAsync({
                id: 'application-3',
                reason: 'Wait no longer applies'
            })
        );
        expect(mocks.fetchApi).toHaveBeenLastCalledWith({
            path: '/api/v1/admin/partner-applications/application-3/cancel-wait',
            method: 'POST',
            body: { reason: 'Wait no longer applies' }
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['partner-application-panel'] });
    });
});
