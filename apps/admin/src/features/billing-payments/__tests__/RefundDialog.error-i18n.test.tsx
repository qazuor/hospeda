/**
 * RefundDialog — error i18n migration tests (SPEC-183 Phase 3 T-010).
 *
 * Verifies that when the refund mutation fails, the toast message concatenates
 * the localized prefix with `translateAdminApiError` output — NOT raw error.message.
 *
 * Pattern in RefundDialog:
 *   `${t('..refundError')} ${translateAdminApiError({ error: error as ApiErrorShape, t })}`
 */

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payment } from '../types';

// ---- Hoist mock so factory runs before module initialization -----------------
const { mockTranslateAdminApiError } = vi.hoisted(() => ({
    mockTranslateAdminApiError: vi.fn(() => 'translated-error')
}));

vi.mock('@/lib/errors', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/errors')>();
    return {
        ...actual,
        translateAdminApiError: mockTranslateAdminApiError
    };
});

// ---- Mock utils used by RefundDialog ----------------------------------------
vi.mock('../utils', () => ({
    formatArs: (amount: number) => `$${amount}`,
    formatDate: (date: string) => date
}));

// ---- Fake addToast -----------------------------------------------------------
const mockAddToast = vi.fn();

// ---- Fake refund mutation that captures the onError callback ----------------
let capturedOnError: ((error: Error) => void) | null = null;

const mockRefundMutation = {
    mutate: vi.fn(
        (
            _payload: unknown,
            callbacks: {
                onSuccess?: () => void;
                onError?: (error: Error) => void;
            }
        ) => {
            capturedOnError = callbacks.onError ?? null;
        }
    ),
    isPending: false
};

import { RefundDialog } from '../RefundDialog';

const FAKE_PAYMENT: Payment = {
    id: 'pay_123',
    userName: 'Test User',
    userEmail: 'test@test.com',
    amount: 5000,
    status: 'completed',
    date: '2026-01-01',
    method: 'mercado_pago',
    planName: 'Plan Test',
    subscriptionId: 'sub_123',
    invoiceId: 'inv_123',
    transactionId: 'txn_123'
};

describe('RefundDialog — error i18n (SPEC-183 T-010)', () => {
    beforeEach(() => {
        mockTranslateAdminApiError.mockClear();
        mockAddToast.mockClear();
        mockRefundMutation.mutate.mockClear();
        capturedOnError = null;
    });

    it('calls translateAdminApiError when refund mutation errors', async () => {
        render(
            <RefundDialog
                payment={FAKE_PAYMENT}
                open={true}
                onOpenChange={vi.fn()}
                refundMutation={
                    mockRefundMutation as unknown as ReturnType<
                        typeof import('../hooks').useRefundPaymentMutation
                    >
                }
                addToast={mockAddToast}
            />
        );

        // Fill in reason (required by the submit guard)
        const reasonTextarea = screen.getByPlaceholderText(
            'admin-billing.payments.refundDialog.reasonPlaceholder'
        );
        fireEvent.change(reasonTextarea, { target: { value: 'Test reason' } });

        // Click confirm
        const confirmBtn = screen.getByText('admin-billing.payments.refundDialog.confirmButton');
        fireEvent.click(confirmBtn);

        // The mutation was called — trigger the error callback
        expect(mockRefundMutation.mutate).toHaveBeenCalled();
        expect(capturedOnError).not.toBeNull();

        const serverError = new Error('Refund failed on server');
        capturedOnError!(serverError);

        await waitFor(() => {
            expect(mockTranslateAdminApiError).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: serverError,
                    t: expect.any(Function)
                })
            );
        });

        // Toast message contains the adapter output, not raw error.message
        expect(mockAddToast).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('translated-error'),
                variant: 'error'
            })
        );
    });
});
