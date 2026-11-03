// @vitest-environment jsdom

import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FixRequestRowActions } from '../FixRequestRowActions';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es-AR',
        t: (key: string) => key,
        tPlural: (key: string) => key
    })
}));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

const item = {
    fixRequestId: '00000000-0000-4000-8000-000000000001',
    vertical: VerticalEnum.VENUE,
    listingId: '10000000-0000-4000-8000-000000000002',
    listingName: 'Sala Norte',
    listingSlug: 'sala-norte',
    publicationStatus: PublicationStatusEnum.PUBLISHED,
    reason: 'Descripción',
    suggestedDate: null,
    overdue: false,
    ageDays: 2,
    openedAt: '2026-10-31T12:00:00.000Z',
    ownerReportedFixedAt: null
} as const;

describe('TEST:1704:7 AC:1704:8 row moderation disclosure', () => {
    it('does not read moderation state before disclosure and reads the selected listing after click', async () => {
        fetchApi.mockResolvedValue({
            data: {
                data: {
                    publicationStatus: 'PUBLISHED',
                    fixRequest: {
                        reason: item.reason,
                        suggestedDate: null,
                        openedAt: item.openedAt,
                        ownerReportedFixedAt: null
                    }
                }
            }
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <FixRequestRowActions item={item} />
            </QueryClientProvider>
        );
        expect(screen.getByTestId(`fix-request-actions-${item.fixRequestId}`)).toBeInTheDocument();
        expect(fetchApi).not.toHaveBeenCalled();
        fireEvent.click(
            screen.getByRole('button', { name: 'admin-entities.fixRequestList.moderate' })
        );
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith({
                path: `/api/v1/admin/venues/${item.listingId}/moderation`,
                method: 'GET'
            })
        );
        expect(
            await screen.findByTestId('listing-moderation-action-CLOSE_FIX_REQUEST')
        ).toBeInTheDocument();
    });
});
