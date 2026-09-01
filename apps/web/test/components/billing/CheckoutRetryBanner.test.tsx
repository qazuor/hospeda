/**
 * @file CheckoutRetryBanner.test.tsx
 * @description Unit tests for the checkout-retry subscription-page banner
 * (HOS-937 step 4).
 *
 * Covers the four `recovery` outcomes from `POST .../checkout-retry` — most
 * importantly `'authorized'`, which must NEVER redirect the user to pay
 * again — plus the no-`retryCheckoutId` no-regression case (the page must
 * behave exactly as it did before this component existed) and the
 * one-click-one-attempt guard.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: { checkoutRetry: vi.fn() }
}));

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/billing/CheckoutRetryBanner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { CheckoutRetryBanner } from '../../../src/components/billing/CheckoutRetryBanner.client';
import { billingApi } from '../../../src/lib/api/endpoints-protected';

const mockCheckoutRetry = billingApi.checkoutRetry as ReturnType<typeof vi.fn>;

const CHECKING_TITLE = 'Verificando tu pago...';
const REDIRECTING_TITLE = 'Te estamos redirigiendo a Mercado Pago...';
const ACTIVE_TITLE = 'Tu suscripción ya está activa';
const CONFIRMING_TITLE = 'Estamos confirmando tu pago';
const CONFIRMING_TIMED_OUT_TITLE = 'Todavía estamos confirmando tu pago';
const ERROR_TITLE = 'No pudimos verificar tu pago';

const LOCAL_ID = 'sub-local-001';

function okResult(data: {
    recovery: 'authorized' | 'pending' | 'cancelled' | 'confirming';
    checkoutUrl: string | null;
}) {
    return { ok: true as const, data };
}

/** Redefine `window.location` so `.href = ...` is observable, not a real navigation. */
function stubLocationHref(): ReturnType<typeof vi.fn> {
    const hrefAssignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: {
            ...originalLocation,
            set href(v: string) {
                hrefAssignSpy(v);
            }
        } as Location
    });
    return hrefAssignSpy;
}

describe('CheckoutRetryBanner (HOS-937 step 4)', () => {
    let originalLocation: Location;

    beforeEach(() => {
        vi.clearAllMocks();
        originalLocation = window.location;
    });

    afterEach(() => {
        vi.useRealTimers();
        window.location = originalLocation;
    });

    describe('no-regression: no retryCheckoutId', () => {
        it('renders nothing and never calls the endpoint', () => {
            const { container } = render(
                <CheckoutRetryBanner
                    locale="es"
                    retryCheckoutId={null}
                />
            );

            expect(container).toBeEmptyDOMElement();
            expect(mockCheckoutRetry).not.toHaveBeenCalled();
        });
    });

    describe('the four recoveries', () => {
        it("'authorized' — already active, NEVER redirects to pay again", async () => {
            const hrefAssignSpy = stubLocationHref();
            mockCheckoutRetry.mockResolvedValue(
                okResult({ recovery: 'authorized', checkoutUrl: null })
            );

            render(
                <CheckoutRetryBanner
                    locale="es"
                    retryCheckoutId={LOCAL_ID}
                />
            );

            expect(screen.getByRole('heading')).toHaveTextContent(CHECKING_TITLE);

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(ACTIVE_TITLE);
            });
            // The whole point of this recovery: charging the user twice.
            expect(hrefAssignSpy).not.toHaveBeenCalled();
            expect(mockCheckoutRetry).toHaveBeenCalledWith({ localId: LOCAL_ID });
        });

        it("'pending' — redirects to the SAME preapproval's checkoutUrl", async () => {
            const hrefAssignSpy = stubLocationHref();
            mockCheckoutRetry.mockResolvedValue(
                okResult({ recovery: 'pending', checkoutUrl: 'https://mp.test/init/same' })
            );

            render(
                <CheckoutRetryBanner
                    locale="es"
                    retryCheckoutId={LOCAL_ID}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(REDIRECTING_TITLE);
            });
            expect(hrefAssignSpy).toHaveBeenCalledWith('https://mp.test/init/same');
        });

        it("'cancelled' — redirects to the FRESH preapproval's checkoutUrl", async () => {
            const hrefAssignSpy = stubLocationHref();
            mockCheckoutRetry.mockResolvedValue(
                okResult({ recovery: 'cancelled', checkoutUrl: 'https://mp.test/init/fresh' })
            );

            render(
                <CheckoutRetryBanner
                    locale="es"
                    retryCheckoutId={LOCAL_ID}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(REDIRECTING_TITLE);
            });
            expect(hrefAssignSpy).toHaveBeenCalledWith('https://mp.test/init/fresh');
        });

        it("'confirming' — never redirects, retries a bounded number of times, then offers manual retry", async () => {
            vi.useFakeTimers();
            const hrefAssignSpy = stubLocationHref();
            mockCheckoutRetry.mockResolvedValue(
                okResult({ recovery: 'confirming', checkoutUrl: null })
            );

            render(
                <CheckoutRetryBanner
                    locale="es"
                    retryCheckoutId={LOCAL_ID}
                />
            );

            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(screen.getByRole('heading')).toHaveTextContent(CONFIRMING_TITLE);

            // Advance well past the bounded retry budget.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(60_000);
            });

            expect(screen.getByRole('heading')).toHaveTextContent(CONFIRMING_TIMED_OUT_TITLE);
            expect(hrefAssignSpy).not.toHaveBeenCalled();
            // Bounded: it must have stopped calling, not kept polling forever.
            const callsAtTimeout = mockCheckoutRetry.mock.calls.length;
            await act(async () => {
                await vi.advanceTimersByTimeAsync(60_000);
            });
            expect(mockCheckoutRetry.mock.calls.length).toBe(callsAtTimeout);

            // Manual retry button re-dispatches exactly once more.
            screen.getByRole('button', { name: 'Reintentar' }).click();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(mockCheckoutRetry.mock.calls.length).toBe(callsAtTimeout + 1);
        });

        it('a hard error (e.g. 404/422) shows the error state with a manual retry option', async () => {
            mockCheckoutRetry.mockResolvedValue({
                ok: false,
                error: { status: 422, message: 'not eligible' }
            });

            render(
                <CheckoutRetryBanner
                    locale="es"
                    retryCheckoutId={LOCAL_ID}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(ERROR_TITLE);
            });
            expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
        });
    });

    describe('one click, one attempt', () => {
        it('dispatches exactly one call on mount for a given retryCheckoutId', async () => {
            mockCheckoutRetry.mockResolvedValue(
                okResult({ recovery: 'authorized', checkoutUrl: null })
            );

            render(
                <CheckoutRetryBanner
                    locale="es"
                    retryCheckoutId={LOCAL_ID}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(ACTIVE_TITLE);
            });
            expect(mockCheckoutRetry).toHaveBeenCalledTimes(1);
        });
    });
});
