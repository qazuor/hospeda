/**
 * @file SendPaymentLinkCard.test.tsx
 * @description Regression coverage for HOS-411.
 *
 * Before HOS-411, "Generar link" called `mutateAsync()` with no
 * `onError`/`try`/`catch` and nothing in the page read `.error`, so a 422
 * from the two AC-11 gates failed completely silently: no toast, no inline
 * text, no state change. These tests cover the two halves of the fix:
 * (1) the button now shows an error toast on failure, and (2) the two gates
 * disable the button up front with a visible reason instead of letting the
 * admin click into a guaranteed failure.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { useSendPartnerPaymentLinkMutation } from '@/features/partners/hooks/usePartnerQuery';
import { ApiError } from '@/lib/errors';
import { getSendLinkDisabledReason, SendPaymentLinkCard } from '../SendPaymentLinkCard';

type SendLinkMutation = ReturnType<typeof useSendPartnerPaymentLinkMutation>;

/**
 * Minimal `useSendPartnerPaymentLinkMutation(id)` stand-in for these tests.
 * The component only reads `isPending`, `data`, and `mutate` — the rest of
 * `UseMutationResult` is irrelevant here.
 */
function buildMutation(overrides: {
    readonly isPending?: boolean;
    readonly data?: { paymentUrl: string; planId: string };
    readonly mutate?: ReturnType<typeof vi.fn>;
}) {
    return {
        isPending: overrides.isPending ?? false,
        data: overrides.data,
        mutate: overrides.mutate ?? vi.fn()
    } as unknown as SendLinkMutation;
}

describe('getSendLinkDisabledReason', () => {
    it('should gate on content approval first (mirrors isPartnerContentApprovedForPayment)', () => {
        const reason = getSendLinkDisabledReason({ contentApprovedAt: null, planId: 'plan-1' });
        expect(reason).toMatch(/contenido/i);
    });

    it('should gate on missing plan once content is approved', () => {
        const reason = getSendLinkDisabledReason({
            contentApprovedAt: new Date('2026-01-01'),
            planId: null
        });
        expect(reason).toMatch(/plan/i);
    });

    it('should return null when content is approved and a plan is assigned', () => {
        const reason = getSendLinkDisabledReason({
            contentApprovedAt: new Date('2026-01-01'),
            planId: 'plan-1'
        });
        expect(reason).toBeNull();
    });
});

describe('SendPaymentLinkCard', () => {
    it('should disable the button and show the reason when content is not approved', () => {
        render(
            <SendPaymentLinkCard
                partner={{ contentApprovedAt: null, planId: 'plan-1' }}
                mutation={buildMutation({})}
                addToast={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: 'Generar link' })).toBeDisabled();
        expect(
            screen.getByText(/contenido del partner todavía no fue aprobado/i)
        ).toBeInTheDocument();
    });

    it('should disable the button and show the reason when no plan is assigned', () => {
        render(
            <SendPaymentLinkCard
                partner={{ contentApprovedAt: new Date('2026-01-01'), planId: null }}
                mutation={buildMutation({})}
                addToast={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: 'Generar link' })).toBeDisabled();
        expect(screen.getByText(/no tiene un plan de facturación asignado/i)).toBeInTheDocument();
    });

    it('should enable the button and show no reason when eligible', () => {
        render(
            <SendPaymentLinkCard
                partner={{ contentApprovedAt: new Date('2026-01-01'), planId: 'plan-1' }}
                mutation={buildMutation({})}
                addToast={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: 'Generar link' })).toBeEnabled();
        expect(screen.queryByText(/todavía no fue aprobado/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/no tiene un plan/i)).not.toBeInTheDocument();
    });

    it('should toast the backend 422 message on failure (the HOS-411 regression)', async () => {
        const addToast = vi.fn();
        const backendError = new ApiError(
            'Partner content has not been approved yet. Review the partner content before enabling payment.',
            { status: 422, code: 'VALIDATION_ERROR' }
        );
        const mutate = vi.fn(
            (_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
                options?.onError?.(backendError);
            }
        );

        render(
            <SendPaymentLinkCard
                partner={{ contentApprovedAt: new Date('2026-01-01'), planId: 'plan-1' }}
                mutation={buildMutation({ mutate })}
                addToast={addToast}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'Generar link' }));

        expect(mutate).toHaveBeenCalledTimes(1);
        expect(addToast).toHaveBeenCalledWith({
            message:
                'Partner content has not been approved yet. Review the partner content before enabling payment.',
            variant: 'error'
        });
    });

    it('should fall back to a generic message when the error is not an ApiError', async () => {
        const addToast = vi.fn();
        const mutate = vi.fn(
            (_variables: unknown, options?: { onError?: (error: unknown) => void }) => {
                options?.onError?.(new Error('network down'));
            }
        );

        render(
            <SendPaymentLinkCard
                partner={{ contentApprovedAt: new Date('2026-01-01'), planId: 'plan-1' }}
                mutation={buildMutation({ mutate })}
                addToast={addToast}
            />
        );

        await userEvent.click(screen.getByRole('button', { name: 'Generar link' }));

        expect(addToast).toHaveBeenCalledWith({
            message: 'No pudimos generar el link de pago. Intentá de nuevo.',
            variant: 'error'
        });
    });

    it('should show the payment URL on success', () => {
        render(
            <SendPaymentLinkCard
                partner={{ contentApprovedAt: new Date('2026-01-01'), planId: 'plan-1' }}
                mutation={buildMutation({
                    data: { paymentUrl: 'https://mp.example/checkout/abc', planId: 'plan-1' }
                })}
                addToast={vi.fn()}
            />
        );

        expect(screen.getByDisplayValue('https://mp.example/checkout/abc')).toBeInTheDocument();
    });
});
