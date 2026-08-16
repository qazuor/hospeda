/**
 * @file CheckoutStatusPoller.test.tsx
 * @description Unit tests for the checkout success-page polling island
 * (HOS-151 Bug A, HOS-191 Path C F2).
 *
 * Covers: (H-78) no pending id → the identity-scoped source is consulted rather
 * than surrendering with zero requests, the remapped `'trial'` status counts as
 * resolved, a transient error keeps the watch alive, and the terminal state
 * offers two concrete exits; pending id + active status → success (and the id
 * is cleared); neither source ever resolving → bounded terminal state instead
 * of spinning forever; and (HOS-191) link-preapproval linking before the poll
 * starts — success/already proceeds to poll, a 409 IDOR is a hard error with no
 * poll of EITHER source, a non-fatal error (422) still falls through.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: { getSubscriptionStatus: vi.fn(), linkPreapproval: vi.fn() },
    userApi: { getSubscription: vi.fn() }
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
import { billingApi, userApi } from '../../../src/lib/api/endpoints-protected';
import {
    clearPendingCheckoutSubId,
    readPendingCheckoutSubId
} from '../../../src/lib/billing/checkout-pending';
import {
    CHECKOUT_POLL_MAX_ATTEMPTS,
    totalPollBudgetMs
} from '../../../src/lib/billing/checkout-poll-schedule';

const mockGetStatus = billingApi.getSubscriptionStatus as ReturnType<typeof vi.fn>;
const mockLinkPreapproval = billingApi.linkPreapproval as ReturnType<typeof vi.fn>;
const mockGetMySubscription = userApi.getSubscription as ReturnType<typeof vi.fn>;
const mockReadId = readPendingCheckoutSubId as ReturnType<typeof vi.fn>;
const mockClearId = clearPendingCheckoutSubId as ReturnType<typeof vi.fn>;

const VERIFYING_TITLE = 'Verificando estado del pago...';
const SUCCESS_TITLE = '¡Tu suscripción está activa!';
const UNRESOLVED_TITLE = 'Seguimos confirmando tu pago';
const LINK_ERROR_TITLE = 'No pudimos vincular tu pago';

const props = {
    locale: 'es' as const,
    miCuentaUrl: '/es/mi-cuenta/',
    supportUrl: '/es/contacto/',
    preapprovalId: null as string | null
};

function statusResult(status: string) {
    return { ok: true as const, data: { status, mpSubscriptionId: null, activatedAt: null } };
}

/** A `GET /users/me/subscription` payload with no subscription resolved. */
function noSubscription() {
    return { ok: true as const, data: { subscription: null } };
}

/**
 * A `GET /users/me/subscription` payload. Note the status vocabulary is the
 * REMAPPED one that endpoint returns (`'trial'`, not `'trialing'`; `comp`
 * arrives as `'active'` plus `isComplimentary`), which is exactly the trap this
 * fallback has to get right.
 */
function mySubscription(status: string, isComplimentary = false) {
    return {
        ok: true as const,
        data: { subscription: { id: 'sub-1', planSlug: 'host-basic', status, isComplimentary } }
    };
}

/** Advance past the whole retry budget, flushing React state updates. */
async function advancePastBudget() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(totalPollBudgetMs() + 60_000);
    });
}

describe('CheckoutStatusPoller (HOS-151 Bug A)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('H-78 — no stashed id must not mean giving up without asking', () => {
        /**
         * The defect this reproduces. The buyer paid, MercadoPago redirected
         * back, and the page rendered "está tardando más de lo normal" without
         * having made a single status request — the message described a delay
         * that had never been measured, because nothing was ever asked. The
         * stashed sessionStorage id is the only thing the page consulted, and
         * when it is absent (a different tab, storage disabled, a reload after
         * it was cleared) the page had no second source.
         *
         * `GET /users/me/subscription` is that second source: it is scoped by
         * session identity rather than by a value the browser had to carry
         * across a third-party redirect, so it answers in exactly the cases
         * where the stashed id does not.
         */
        it('consults the identity-scoped source when there is no pending id', async () => {
            mockReadId.mockReturnValue(null);
            mockGetMySubscription.mockResolvedValue(mySubscription('active'));

            render(<CheckoutStatusPoller {...props} />);

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(SUCCESS_TITLE);
            });
            expect(mockGetMySubscription).toHaveBeenCalled();
            // There is no local id, so the id-scoped endpoint is not callable.
            expect(mockGetStatus).not.toHaveBeenCalled();
        });

        it("treats the remapped 'trial' status as resolved, not as still-pending", async () => {
            // `/users/me/subscription` remaps `trialing` → `'trial'`. Matching
            // only the raw enum would never resolve a card-first trial — the
            // single most common paid outcome since HOS-171.
            mockReadId.mockReturnValue(null);
            mockGetMySubscription.mockResolvedValue(mySubscription('trial'));

            render(<CheckoutStatusPoller {...props} />);

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(SUCCESS_TITLE);
            });
        });

        it('keeps waiting while the identity-scoped source reports no subscription yet', async () => {
            vi.useFakeTimers();
            mockReadId.mockReturnValue(null);
            mockGetMySubscription.mockResolvedValue(noSubscription());

            render(<CheckoutStatusPoller {...props} />);

            // It must be VERIFYING, not already surrendered.
            expect(screen.getByRole('heading')).toHaveTextContent(VERIFYING_TITLE);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(30_000);
            });

            // Still watching, and it has retried rather than asked once.
            expect(mockGetMySubscription.mock.calls.length).toBeGreaterThan(1);
        });

        it('ends in a terminal state that offers two concrete ways out', async () => {
            vi.useFakeTimers();
            mockReadId.mockReturnValue(null);
            mockGetMySubscription.mockResolvedValue(noSubscription());

            render(<CheckoutStatusPoller {...props} />);
            await advancePastBudget();

            expect(screen.getByRole('heading')).toHaveTextContent(UNRESOLVED_TITLE);

            // "There must be an exit" — the account page AND support, because a
            // buyer whose payment never resolved needs a human, not just a link
            // back to a page that will also show nothing.
            const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
            expect(hrefs).toContain('/es/mi-cuenta/');
            expect(hrefs).toContain('/es/contacto/');
        });

        it('stops polling once the budget is exhausted', async () => {
            vi.useFakeTimers();
            mockReadId.mockReturnValue(null);
            mockGetMySubscription.mockResolvedValue(noSubscription());

            render(<CheckoutStatusPoller {...props} />);
            await advancePastBudget();

            const callsAtTimeout = mockGetMySubscription.mock.calls.length;

            await act(async () => {
                await vi.advanceTimersByTimeAsync(120_000);
            });

            expect(mockGetMySubscription.mock.calls.length).toBe(callsAtTimeout);
        });

        it('resolves from the identity source even when the id-scoped poll keeps saying pending', async () => {
            // The production shape of H-78: the local row was linked
            // server-side by the heuristic linker, so the subscription was
            // live even though the id-scoped poll had not caught up.
            vi.useFakeTimers();
            mockReadId.mockReturnValue('sub-uuid');
            mockGetStatus.mockResolvedValue(statusResult('pending_provider'));
            mockGetMySubscription.mockResolvedValue(mySubscription('active'));

            render(<CheckoutStatusPoller {...props} />);

            await act(async () => {
                await vi.advanceTimersByTimeAsync(30_000);
            });

            expect(screen.getByRole('heading')).toHaveTextContent(SUCCESS_TITLE);
        });
    });

    it('resolves to the success state and clears the id once the subscription is active', async () => {
        mockReadId.mockReturnValue('sub-uuid');
        mockGetStatus.mockResolvedValue(statusResult('active'));
        mockGetMySubscription.mockResolvedValue(noSubscription());

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

    it('degrades to the bounded terminal state when neither source ever resolves', async () => {
        vi.useFakeTimers();
        mockReadId.mockReturnValue('sub-uuid');
        // Both sources stay negative → the poller must eventually stop, not spin.
        mockGetStatus.mockResolvedValue(statusResult('pending_provider'));
        mockGetMySubscription.mockResolvedValue(noSubscription());

        render(<CheckoutStatusPoller {...props} />);
        await advancePastBudget();

        expect(screen.getByRole('heading')).toHaveTextContent(UNRESOLVED_TITLE);
        expect(mockClearId).toHaveBeenCalledOnce();
        expect(mockGetStatus.mock.calls.length).toBeLessThanOrEqual(CHECKOUT_POLL_MAX_ATTEMPTS);
    });

    it('keeps watching a transient API error instead of surrendering on it', async () => {
        vi.useFakeTimers();
        mockReadId.mockReturnValue('sub-uuid');
        // First attempt throws, then the subscription turns up active.
        mockGetStatus
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValue(statusResult('active'));
        mockGetMySubscription.mockResolvedValue(noSubscription());

        render(<CheckoutStatusPoller {...props} />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000);
        });

        expect(screen.getByRole('heading')).toHaveTextContent(SUCCESS_TITLE);
    });

    describe('HOS-191 Path C — link-preapproval before polling', () => {
        it('links successfully and proceeds to poll to success', async () => {
            mockReadId.mockReturnValue('sub-uuid');
            mockLinkPreapproval.mockResolvedValue({
                ok: true,
                data: { outcome: 'linked', localSubscriptionId: 'sub-uuid' }
            });
            mockGetStatus.mockResolvedValue(statusResult('active'));
            mockGetMySubscription.mockResolvedValue(noSubscription());

            render(
                <CheckoutStatusPoller
                    {...props}
                    preapprovalId="mp-preapproval-1"
                />
            );

            await waitFor(() => {
                expect(mockLinkPreapproval).toHaveBeenCalledWith({
                    preapprovalId: 'mp-preapproval-1',
                    localSubscriptionId: 'sub-uuid'
                });
            });
            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(SUCCESS_TITLE);
            });
            expect(mockGetStatus).toHaveBeenCalledWith({ localId: 'sub-uuid' });
        });

        it('shows a hard error and never polls on a 409 IDOR response', async () => {
            mockReadId.mockReturnValue('sub-uuid');
            mockLinkPreapproval.mockResolvedValue({
                ok: false,
                error: { status: 409, message: 'IDOR' }
            });
            mockGetMySubscription.mockResolvedValue(noSubscription());

            render(
                <CheckoutStatusPoller
                    {...props}
                    preapprovalId="mp-preapproval-1"
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(LINK_ERROR_TITLE);
            });
            expect(mockGetStatus).not.toHaveBeenCalled();
            // A hard IDOR must stop everything — including the identity-scoped
            // fallback, which would otherwise resolve someone else's checkout
            // into a success screen for this buyer.
            expect(mockGetMySubscription).not.toHaveBeenCalled();
            expect(mockClearId).toHaveBeenCalledOnce();
        });

        it('treats a non-409 link error (e.g. 422) as non-fatal and falls through to polling', async () => {
            mockReadId.mockReturnValue('sub-uuid');
            mockLinkPreapproval.mockResolvedValue({
                ok: false,
                error: { status: 422, message: 'not_found' }
            });
            mockGetStatus.mockResolvedValue(statusResult('active'));
            mockGetMySubscription.mockResolvedValue(noSubscription());

            render(
                <CheckoutStatusPoller
                    {...props}
                    preapprovalId="mp-preapproval-1"
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('heading')).toHaveTextContent(SUCCESS_TITLE);
            });
            expect(mockGetStatus).toHaveBeenCalledWith({ localId: 'sub-uuid' });
        });
    });
});
