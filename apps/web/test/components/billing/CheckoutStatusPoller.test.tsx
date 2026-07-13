/**
 * @file CheckoutStatusPoller.test.tsx
 * @description Unit tests for the checkout success-page polling island
 * (HOS-151 Bug A).
 *
 * Covers: no pending id → immediate fallback; pending id + active status →
 * success (and the id is cleared); pending id that never activates → bounded
 * fallback after the timeout instead of spinning forever.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: { getSubscriptionStatus: vi.fn() }
}));

vi.mock('../../../src/lib/billing/checkout-pending', () => ({
    readPendingCheckoutSubId: vi.fn(),
    clearPendingCheckoutSubId: vi.fn()
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/billing/CheckoutStatusPoller.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { CheckoutStatusPoller } from '../../../src/components/billing/CheckoutStatusPoller.client';
import { billingApi } from '../../../src/lib/api/endpoints-protected';
import {
    clearPendingCheckoutSubId,
    readPendingCheckoutSubId
} from '../../../src/lib/billing/checkout-pending';

const mockGetStatus = billingApi.getSubscriptionStatus as ReturnType<typeof vi.fn>;
const mockReadId = readPendingCheckoutSubId as ReturnType<typeof vi.fn>;
const mockClearId = clearPendingCheckoutSubId as ReturnType<typeof vi.fn>;

const VERIFYING_TITLE = 'Verificando estado del pago...';
const SUCCESS_TITLE = '¡Tu suscripción está activa!';
const TIMEOUT_TITLE = 'Está tardando más de lo normal';

const props = { locale: 'es' as const, miCuentaUrl: '/es/mi-cuenta/' };

function statusResult(status: string) {
    return { ok: true as const, data: { status, mpSubscriptionId: null, activatedAt: null } };
}

describe('CheckoutStatusPoller (HOS-151 Bug A)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows the fallback immediately when there is no pending subscription id', () => {
        mockReadId.mockReturnValue(null);

        render(<CheckoutStatusPoller {...props} />);

        // No id to poll → straight to the non-alarming fallback, no spinning.
        expect(screen.getByRole('heading')).toHaveTextContent(TIMEOUT_TITLE);
        expect(mockGetStatus).not.toHaveBeenCalled();
    });

    it('resolves to the success state and clears the id once the subscription is active', async () => {
        mockReadId.mockReturnValue('sub-uuid');
        mockGetStatus.mockResolvedValue(statusResult('active'));

        render(<CheckoutStatusPoller {...props} />);

        // Starts on the verifying state.
        expect(screen.getByRole('heading')).toHaveTextContent(VERIFYING_TITLE);

        await waitFor(() => {
            expect(screen.getByRole('heading')).toHaveTextContent(SUCCESS_TITLE);
        });
        expect(mockGetStatus).toHaveBeenCalledWith({ localId: 'sub-uuid' });
        // The pending id is cleared so it never bleeds into a later checkout.
        expect(mockClearId).toHaveBeenCalledOnce();
        // The success CTA points at the account page.
        expect(screen.getByRole('link')).toHaveAttribute('href', '/es/mi-cuenta/');
    });

    it('degrades to the bounded fallback when the subscription never activates', async () => {
        vi.useFakeTimers();
        mockReadId.mockReturnValue('sub-uuid');
        // Always still pending → the poller must eventually give up, not spin forever.
        mockGetStatus.mockResolvedValue(statusResult('pending_provider'));

        render(<CheckoutStatusPoller {...props} />);

        // 45 attempts × 2s ≈ 90s. Advance past the timeout budget, wrapped in
        // act so the timer-driven React state updates flush before asserting.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(46 * 2000);
        });

        expect(screen.getByRole('heading')).toHaveTextContent(TIMEOUT_TITLE);
        expect(mockClearId).toHaveBeenCalledOnce();
        // It stopped polling (did not exceed the attempt cap).
        expect(mockGetStatus.mock.calls.length).toBeLessThanOrEqual(45);
    });
});
