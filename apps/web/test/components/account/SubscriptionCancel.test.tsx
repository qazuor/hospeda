import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionCancel } from '@/components/account/SubscriptionCancel.client';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: { cancellationPreview: vi.fn(), cancel: vi.fn() }
}));
beforeEach(() => vi.clearAllMocks());

const id = '123e4567-e89b-42d3-a456-426614174000';
describe('SubscriptionCancel island', () => {
    it('shows the preview and submits once in two clicks', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        } as never);
        vi.mocked(billingSubscriptionApi.cancel).mockResolvedValue({
            ok: true,
            data: {
                subscriptionId: id,
                outcome: 'SCHEDULED',
                serviceEndsAt: '2026-11-05T03:00:00.000Z'
            }
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        await screen.findByTestId('self-cancel-end');
        fireEvent.click(screen.getByTestId('self-cancel-confirm'));
        await waitFor(() => expect(screen.getByTestId('self-cancel-done')).toBeInTheDocument());
        expect(billingSubscriptionApi.cancel).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('¿Estás seguro?')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
    it('fails closed when preview is invalid', async () => {
        vi.mocked(billingSubscriptionApi.cancellationPreview).mockResolvedValue({
            ok: true,
            data: {}
        } as never);
        render(
            <SubscriptionCancel
                subscriptionId={id}
                locale="es"
            />
        );
        fireEvent.click(screen.getByTestId('self-cancel-open'));
        expect(await screen.findByText(/No pudimos leer qué pasa/)).toBeInTheDocument();
        expect(screen.queryByTestId('self-cancel-confirm')).not.toBeInTheDocument();
        expect(billingSubscriptionApi.cancel).not.toHaveBeenCalled();
    });
});
