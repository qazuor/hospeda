// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromoCodeCloseDialog } from '../PromoCodeCloseDialog';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es-AR',
        t: (key: string) =>
            key
                .split('.')
                .slice(1)
                .reduce((value: any, part) => value?.[part], es)
    })
}));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

describe('AC:B9b:9 HOS-1591 PromoCodeCloseDialog TEST:B9b:9 (support)', () => {
    it('states how many redemptions remain and posts the selected row id', async () => {
        fetchApi.mockResolvedValue({
            data: { data: { promoCodeId: '11111111-1111-4111-8111-111111111111' } }
        });
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <PromoCodeCloseDialog
                    promoCode={{
                        id: '11111111-1111-4111-8111-111111111111',
                        code: 'SPRING',
                        effect: {
                            kind: 'DISCOUNT',
                            discountKind: 'PERCENTAGE',
                            value: 20,
                            durationKind: 'FOREVER',
                            durationCharges: null
                        },
                        allVerticals: true,
                        verticals: null,
                        totalQuota: 5,
                        validFrom: '2026-01-01T00:00:00.000Z',
                        validUntil: null,
                        stackable: false,
                        usableWithAnotherActive: false,
                        closedAt: null,
                        closedBy: null,
                        createdAt: '2026-01-01T00:00:00.000Z',
                        redemptionCount: 3,
                        availability: 'OPEN'
                    }}
                    onOpenChange={vi.fn()}
                />
            </QueryClientProvider>
        );
        expect(screen.getByText('Las 3 redenciones ya hechas siguen igual.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar código' }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: '/api/v1/admin/billing-promo-codes/11111111-1111-4111-8111-111111111111/close',
                    method: 'POST'
                })
            )
        );
    });
});
