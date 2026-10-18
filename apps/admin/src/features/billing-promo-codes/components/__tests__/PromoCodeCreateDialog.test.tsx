// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-billing.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/errors/api-error';
import { PromoCodeCreateDialog } from '../PromoCodeCreateDialog';

const fetchApi = vi.hoisted(() => vi.fn());
const addToast = vi.hoisted(() => vi.fn());
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
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ addToast }) }));

function renderDialog() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PromoCodeCreateDialog
                open
                onOpenChange={vi.fn()}
            />
        </QueryClientProvider>
    );
}

async function fillFixedDraft() {
    fireEvent.change(screen.getByLabelText('Código (mayúsculas)'), {
        target: { value: 'PESOS20' }
    });
    fireEvent.change(screen.getByLabelText('Tipo de descuento'), { target: { value: 'FIXED' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: 'FIRST_CHARGE' } });
    fireEvent.change(screen.getByLabelText('Válido hasta'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    await screen.findByTestId('promo-code-confirmation');
}

describe('AC:B9b:9 HOS-1591 PromoCodeCreateDialog TEST:B9b:9 (support)', () => {
    beforeEach(() => {
        fetchApi.mockReset();
        addToast.mockReset();
    });

    it('shows effect, reach, uses, and validity before any API call, then sends centavos and null limits', async () => {
        fetchApi.mockResolvedValue({ data: { data: {} } });
        renderDialog();
        await fillFixedDraft();
        expect(screen.getByTestId('promo-code-confirmation-effect')).toHaveTextContent(
            'primer cobro'
        );
        expect(screen.getByTestId('promo-code-confirmation-reach')).toHaveTextContent(
            'Todas las verticales, también las futuras'
        );
        expect(screen.getByTestId('promo-code-confirmation-uses')).toHaveTextContent(
            'Sin tope de canjes, uno por persona'
        );
        expect(screen.getByTestId('promo-code-confirmation-validity')).toHaveTextContent(
            'sin fecha de fin'
        );
        expect(fetchApi).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
        await waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(1));
        expect(fetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/billing-promo-codes',
                method: 'POST',
                body: expect.objectContaining({
                    code: 'PESOS20',
                    effect: expect.objectContaining({
                        value: 2000,
                        durationKind: 'FIRST_CHARGE',
                        durationCharges: null
                    }),
                    totalQuota: null,
                    validUntil: null
                })
            })
        );
    });

    it('keeps review open and shows PROMO_CODE_ALREADY_EXISTS after a 409', async () => {
        fetchApi.mockRejectedValue(
            new ApiError('Duplicate', {
                status: 409,
                code: 'CONFLICT',
                body: { error: { reason: 'PROMO_CODE_ALREADY_EXISTS' } }
            })
        );
        renderDialog();
        await fillFixedDraft();
        fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Ese código ya existe. Elegí otro código.'
        );
        expect(screen.getByTestId('promo-code-confirmation')).toBeInTheDocument();
    });
});
