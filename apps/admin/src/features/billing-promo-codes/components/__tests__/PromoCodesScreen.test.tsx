// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromoCodesScreen } from '../PromoCodesScreen';

const state = vi.hoisted(() => ({ permissions: [] as string[] }));
const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@/hooks/use-user-permissions', () => ({ useUserPermissions: () => state.permissions }));
vi.mock('@/hooks/use-auth-context', () => ({ useAuthContext: () => ({ isLoading: false }) }));
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

const openCode = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'OPEN20',
    effect: {
        kind: 'DISCOUNT',
        discountKind: 'PERCENTAGE',
        value: 20,
        durationKind: 'N_CHARGES',
        durationCharges: 3
    },
    allVerticals: true,
    verticals: null,
    totalQuota: 10,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    stackable: false,
    usableWithAnotherActive: false,
    closedAt: null,
    closedBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    redemptionCount: 2,
    availability: 'OPEN'
} as const;
const closedCode = {
    ...openCode,
    id: '22222222-2222-4222-8222-222222222222',
    code: 'CLOSED20',
    closedAt: '2026-02-01T00:00:00.000Z',
    availability: 'CLOSED'
} as const;

function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PromoCodesScreen />
        </QueryClientProvider>
    );
}

describe('AC:B9b:9 HOS-1591 PromoCodesScreen TEST:B9b:9 (support)', () => {
    beforeEach(() => {
        state.permissions = [PermissionEnum.BILLING_MANAGE_PROMO_CODES];
        fetchApi.mockResolvedValue({
            data: {
                data: {
                    items: [openCode, closedCode],
                    pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 }
                }
            }
        });
    });

    it('does not render the screen without the action 21 permission', () => {
        state.permissions = [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
        renderScreen();
        expect(screen.queryByTestId('promo-codes-screen')).not.toBeInTheDocument();
    });

    it('renders each API row with its state and offers close only for open codes', async () => {
        renderScreen();
        const rows = await screen.findAllByTestId('promo-code-row');
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.getAttribute('data-promo-code'))).toEqual([
            'OPEN20',
            'CLOSED20'
        ]);
        expect(rows[0]).toHaveTextContent('Abierto');
        expect(rows[1]).toHaveTextContent('Cerrado');
        expect(screen.getAllByTestId('promo-code-close')).toHaveLength(1);
        fireEvent.click(screen.getByTestId('promo-code-close'));
        expect(await screen.findByTestId('promo-code-close-confirmation')).toBeInTheDocument();
    });
});
