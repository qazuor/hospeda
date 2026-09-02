/**
 * @file TrialExtensionForm.test.tsx
 * @description RTL tests for the trial-extension promo form (HOS-1012 T-039).
 *
 * Covers:
 *  - The success message renders the date the SERVER persisted, never a date
 *    the client projected from `extraDays`
 *  - The dashboard is asked to refresh after a successful apply
 *  - A refusal (no trial running, code already used) surfaces the server's
 *    message and leaves the field usable for another attempt
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialExtensionForm } from '../../../src/components/account/TrialExtensionForm.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/TrialExtensionForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (_key: string, fallback?: string, params?: Record<string, unknown>): string => {
        const raw = fallback ?? _key;
        if (!params) return raw;
        return Object.keys(params).reduce(
            (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
            raw
        );
    };
    return { createT: () => t, createTranslations: () => ({ t }) };
});

vi.mock('../../../src/lib/format-utils', () => ({
    formatDate: ({ date }: { date: string }) => `formatted:${date}`
}));

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({ error, fallback }: { error?: { message?: string }; fallback: string }) =>
        error?.message ?? fallback
}));

const mockApplyPromoCode = vi.fn();
vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: {
        applyPromoCode: (...args: unknown[]) => mockApplyPromoCode(...args)
    }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';

/** A date no client-side projection would produce (in the past, odd time). */
const PERSISTED_TRIAL_END = '2026-02-03T04:05:06.000Z';

describe('TrialExtensionForm (HOS-1012 T-039)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the trial end the server persisted, not one projected client-side', async () => {
        // Arrange
        mockApplyPromoCode.mockResolvedValue({
            ok: true,
            data: { effectKind: 'trial_extension', extraDays: 60, trialEnd: PERSISTED_TRIAL_END }
        });
        const onApplied = vi.fn();
        render(
            <TrialExtensionForm
                locale="es"
                subscriptionId={SUBSCRIPTION_ID}
                onApplied={onApplied}
            />
        );

        // Act
        await userEvent.type(screen.getByRole('textbox'), 'LANZAMIENTO60');
        await userEvent.click(screen.getByRole('button', { name: /Aplicar/ }));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent(
                `formatted:${PERSISTED_TRIAL_END}`
            );
        });
        expect(mockApplyPromoCode).toHaveBeenCalledWith({
            code: 'LANZAMIENTO60',
            subscriptionId: SUBSCRIPTION_ID
        });
        // The dashboard must re-read the subscription so the header date agrees.
        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it('surfaces the refusal when no trial is running and keeps the field usable', async () => {
        // Arrange — the 422 the route answers when there is nothing to extend.
        mockApplyPromoCode.mockResolvedValue({
            ok: false,
            error: {
                message: 'No trial is currently running on this account.'
            }
        });
        render(
            <TrialExtensionForm
                locale="es"
                subscriptionId={SUBSCRIPTION_ID}
            />
        );

        // Act
        await userEvent.type(screen.getByRole('textbox'), 'FREEMONTH');
        await userEvent.click(screen.getByRole('button', { name: /Aplicar/ }));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                'No trial is currently running on this account.'
            );
        });
        // Still a form, not a success state — the code was not consumed.
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('does not call the endpoint with an empty code', async () => {
        render(
            <TrialExtensionForm
                locale="es"
                subscriptionId={SUBSCRIPTION_ID}
            />
        );

        expect(screen.getByRole('button', { name: /Aplicar/ })).toBeDisabled();
        expect(mockApplyPromoCode).not.toHaveBeenCalled();
    });
});
