import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanChangeCheckoutPending } from '@/components/account/PlanChangeCheckoutPending.client';

const successorId = '123e4567-e89b-42d3-a456-426614172344';
const checkoutUrl = 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=p-2344';
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.useRealTimers();
    fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            success: true,
            data: { subscriptionId: successorId, outcome: 'ABANDONED' }
        })
    }));
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('HOS-2344: PlanChangeCheckoutPending', () => {
    it('links to the same open checkout', () => {
        // Arrange + Act
        render(
            <PlanChangeCheckoutPending
                successorId={successorId}
                checkoutUrl={checkoutUrl}
                locale="es"
            />
        );

        // Assert
        const resume = screen.getByTestId('my-subscription-plan-change-resume');
        expect(resume.getAttribute('href')).toBe(checkoutUrl);
        expect(resume.textContent).toBe('Retomar el checkout en Mercado Pago');
    });

    it('hides the resume link when there is no displayable checkout', () => {
        render(
            <PlanChangeCheckoutPending
                successorId={successorId}
                checkoutUrl={null}
                locale="es"
            />
        );

        expect(screen.queryByTestId('my-subscription-plan-change-resume')).toBeNull();
        expect(screen.getByTestId('my-subscription-plan-change-cancel')).toBeTruthy();
    });

    it('cancels the successor through S40 and confirms it', async () => {
        const timeout = vi.spyOn(window, 'setTimeout');
        render(
            <PlanChangeCheckoutPending
                successorId={successorId}
                checkoutUrl={checkoutUrl}
                locale="es"
            />
        );

        fireEvent.click(screen.getByTestId('my-subscription-plan-change-cancel'));

        await waitFor(() =>
            expect(screen.getByTestId('my-subscription-plan-change-cancelled').textContent).toBe(
                'Cancelamos el cambio de plan. Tu plan actual sigue igual.'
            )
        );
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain(`/billing/subscriptions/${successorId}/pending-attempt-cancellation`);
        expect(init.method).toBe('POST');
        expect(screen.queryByTestId('my-subscription-plan-change-resume')).toBeNull();
        expect(timeout).toHaveBeenCalled();
    });

    it('shows an error when S40 refuses', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: async () => ({
                success: false,
                error: { code: 'ALREADY_EXISTS', message: 'taken', reason: 'COMMITMENT_TAKEN' }
            })
        });
        render(
            <PlanChangeCheckoutPending
                successorId={successorId}
                checkoutUrl={checkoutUrl}
                locale="es"
            />
        );

        fireEvent.click(screen.getByTestId('my-subscription-plan-change-cancel'));

        await waitFor(() =>
            expect(screen.getByTestId('my-subscription-plan-change-cancel-error')).toBeTruthy()
        );
        expect(screen.queryByTestId('my-subscription-plan-change-cancelled')).toBeNull();
    });
});
