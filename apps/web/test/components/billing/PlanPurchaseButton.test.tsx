/**
 * @file PlanPurchaseButton.test.tsx
 * @description Unit tests for the PlanPurchaseButton React island.
 *
 * Covers: unauthenticated redirect, loading state, checkout success, API errors,
 * network errors, double-submit prevention, error clearing, correct POST payload,
 * promo code field reveal, validate → preview, invalid code → localized error
 * (errorCode → i18n mapping, English errorMessage discarded), and checkout
 * forwarding the promoCode (including comp sentinel URL path).
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanPurchaseButton } from '../../../src/components/billing/PlanPurchaseButton.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Mock auth-client module to control `useSession` return value.
 * The mock factory is hoisted by Vitest so it runs before imports.
 */
vi.mock('../../../src/lib/auth-client', () => ({
    useSession: vi.fn()
}));

/**
 * Mock i18n to avoid locale file loading in JSDOM.
 * Returns the fallback string directly, which is how the component calls t().
 */
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        // Minimal es-only stand-in mirroring the real `_one`/`_other` locale
        // templates for the three count-driven promo-preview keys (HOS-253).
        // `tPlural`'s real signature has no fallback param — it always resolves
        // from the locale dictionary — so this dispatches on `key` + `params`
        // instead of a passed-in template, matching the pattern used by other
        // component test mocks (e.g. CalendarSection.test.tsx).
        tPlural: (key: string, count: number, params?: Record<string, unknown>) => {
            const p = params ?? {};
            switch (key) {
                case 'billing.checkout.promoApply.discountPercentCycle':
                    return count === 1
                        ? `${p.percent}% de descuento por ${p.months} mes`
                        : `${p.percent}% de descuento por ${p.months} meses`;
                case 'billing.checkout.promoApply.discountFixedCycle':
                    return count === 1
                        ? `$${p.amount} de descuento por ${p.months} mes`
                        : `$${p.amount} de descuento por ${p.months} meses`;
                case 'billing.checkout.promoApply.trialExtension':
                    return count === 1
                        ? `${p.days} día de prueba gratis adicional`
                        : `${p.days} días de prueba gratis adicionales`;
                default:
                    return key;
            }
        }
    })
}));

/**
 * Mock urls module to produce predictable URL output in JSDOM.
 */
vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
        return `/${locale}${withSlash}`;
    }
}));

/**
 * Mock PlanPurchaseButton CSS Module — Vitest CSS module support is configured
 * with `classNameStrategy: 'non-scoped'` in vitest.config, but the Proxy
 * pattern is used as a belt-and-suspenders guard.
 */
vi.mock('../../../src/components/billing/PlanPurchaseButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { useSession } from '../../../src/lib/auth-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MockUseSession = ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * sessionStorage key PlanPurchaseButton stashes the local subscription id under
 * before an MP redirect, so the success page can poll it on return (HOS-151 Bug A).
 */
const PENDING_KEY = 'hospeda:checkout:pendingSubscriptionId';

/** Default props used across most tests. */
const defaultProps = {
    planSlug: 'plan_starter',
    // 120000 cents = $1200 ARS — formatPrice divides by 100 internally
    // to convert to the major-unit display value.
    monthlyPrice: 120000,
    annualPrice: 1200000,
    currency: 'ARS' as const,
    ctaText: 'Contratar',
    locale: 'es' as const
};

/**
 * Build a resolved fetch mock returning a given body with an optional ok flag.
 */
function buildFetchMock(opts: { ok?: boolean; body?: unknown; throws?: boolean } = {}) {
    const { ok = true, body, throws = false } = opts;

    if (throws) {
        return vi.fn().mockRejectedValue(new Error('Network failure'));
    }

    return vi.fn().mockResolvedValue({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(body ?? {})
    });
}

/**
 * Configure `useSession` mock to return an authenticated session.
 */
function mockAuthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: { user: { id: 'user-1', name: 'Juan', email: 'juan@example.com' } },
        isPending: false
    });
}

/**
 * Configure `useSession` mock to return an unauthenticated (no session) state.
 */
function mockUnauthenticated() {
    (useSession as MockUseSession).mockReturnValue({
        data: null,
        isPending: false
    });
}

/**
 * Configure `useSession` mock to return a pending (loading) state.
 */
function mockSessionPending() {
    (useSession as MockUseSession).mockReturnValue({
        data: null,
        isPending: true
    });
}

/**
 * Get the main checkout button.
 *
 * After adding the promo section there are multiple buttons in the DOM when the
 * user is authenticated. The primary CTA carries a stable
 * `data-testid="plan-cta-button"`, so we select by that — robust against DOM
 * order and against the promo buttons gaining their own aria-labels.
 */
function getMainButton(): HTMLElement {
    return screen.getByTestId('plan-cta-button');
}

// ---------------------------------------------------------------------------
// SPEC-131 skip flag
// ---------------------------------------------------------------------------

/**
 * SPEC-111 (Astro 6 bump) introduced a regression in 13 async-state tests
 * within this file. `setLoading(true)` inside the click handler does not
 * propagate to the DOM by the time `await user.click()` resolves — even
 * though pre-bump the same tests passed. Workaround tracked in SPEC-131.
 *
 * Affected describe blocks: `loading state`, `checkout success`,
 * `no double-submit`, `error clears on retry`, `POST payload`.
 *
 * Set this to `false` (or run with the suite locally) when working on
 * SPEC-131 to investigate the timing fix. Other describe blocks in this
 * file (`unauthenticated user`, `API error`, `network error`,
 * `idle state rendering`) remain enabled.
 *
 * See `.qtm/specs/SPEC-131-plan-purchase-button-async-state-tests/spec.md`.
 */
// SPEC-131 resolved: the root cause was apiClient.request() calling getBaseUrl() outside
// its try/catch, causing validateWebEnv() to throw in test environments where PUBLIC_API_URL
// is unset. The fix: (1) move URL computation inside try/catch in client.ts so env errors
// return { ok: false } instead of throwing; (2) add PUBLIC_API_URL + PUBLIC_SITE_URL to
// vitest.config.ts test.env so fetch mocks are reachable; (3) update the endpoint assertion
// from the legacy /checkout path (SPEC-126 deprecated) to /subscriptions/start-paid.
const SPEC_131_PENDING = false;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();

    // Stub window.location.href using Object.defineProperty — JSDOM does not
    // allow direct assignment to location.href in strict mode.
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanPurchaseButton', () => {
    // -----------------------------------------------------------------------
    // 1. Unauthenticated redirect
    // -----------------------------------------------------------------------

    describe('unauthenticated user', () => {
        it('redirects to sign-in page with redirect param when clicked', async () => {
            // Arrange
            mockUnauthenticated();
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act — unauthenticated: only one button in DOM (no promo section)
            const button = getMainButton();
            await user.click(button);

            // Assert
            expect(window.location.href).toContain('/es/auth/signin/');
            expect(window.location.href).toContain('redirect=');
            expect(window.location.href).toContain(encodeURIComponent('/es/suscriptores/planes/'));
        });

        it('does not call fetch when unauthenticated', async () => {
            // Arrange
            mockUnauthenticated();
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('also redirects when session is still pending', async () => {
            // Arrange — isPending: true means !isAuthenticated evaluates true
            mockSessionPending();
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            expect(window.location.href).toContain('/es/auth/signin/');
        });
    });

    // -----------------------------------------------------------------------
    // 2. Loading state
    // -----------------------------------------------------------------------

    describe.skipIf(SPEC_131_PENDING)('loading state', () => {
        it('disables the button while checkout request is in flight', async () => {
            // Arrange — never-resolving fetch keeps loading state active
            mockAuthenticated();
            const fetchMock = vi.fn().mockReturnValue(new Promise(() => undefined));
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act — multiple buttons present (main CTA + promo toggle); target main by aria-label
            await user.click(getMainButton());

            // Assert
            expect(getMainButton()).toBeDisabled();
        });

        it('sets aria-busy="true" on the button during loading', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            expect(getMainButton()).toHaveAttribute('aria-busy', 'true');
        });

        it('shows processing text while loading', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert — fallback text from mocked t() is the literal fallback arg
            expect(screen.getByText('Procesando...')).toBeInTheDocument();
        });

        it('shows spinner element while loading', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
            const user = userEvent.setup();
            const { container } = render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert — spinner has aria-hidden="true" and the CSS class name
            const spinner = container.querySelector('[aria-hidden="true"]');
            expect(spinner).toBeInTheDocument();
        });

        it('changes aria-label to processing label during loading', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert — aria-label uses the processingAriaLabel fallback
            expect(getMainButton()).toHaveAttribute('aria-label', 'Procesando pago');
        });
    });

    // -----------------------------------------------------------------------
    // 3. Success — redirects to checkoutUrl
    // -----------------------------------------------------------------------

    describe.skipIf(SPEC_131_PENDING)('checkout success', () => {
        it('redirects to checkoutUrl from API response on success', async () => {
            // Arrange
            mockAuthenticated();
            const checkoutUrl = 'https://mp.com/checkout/xxx';
            vi.stubGlobal(
                'fetch',
                buildFetchMock({
                    ok: true,
                    body: {
                        data: {
                            checkoutUrl,
                            orderId: 'order-1',
                            amount: 1200,
                            currency: 'ARS',
                            expiresAt: null
                        }
                    }
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act — target main CTA button (promo toggle is also in the DOM)
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(window.location.href).toBe(checkoutUrl);
            });
        });

        it('re-enables the button after successful redirect attempt', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                buildFetchMock({
                    ok: true,
                    body: {
                        data: {
                            checkoutUrl: 'https://mp.com/ok',
                            orderId: 'o1',
                            amount: 0,
                            currency: 'ARS',
                            expiresAt: null
                        }
                    }
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert — loading state cleared (finally block ran)
            await waitFor(() => {
                expect(getMainButton()).not.toBeDisabled();
            });
        });

        it('does not show error message on success', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                buildFetchMock({
                    ok: true,
                    body: {
                        data: {
                            checkoutUrl: 'https://mp.com/ok',
                            orderId: 'o1',
                            amount: 0,
                            currency: 'ARS',
                            expiresAt: null
                        }
                    }
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 4. API error (non-ok response)
    // -----------------------------------------------------------------------

    describe('API error', () => {
        it('shows inline error message when API returns non-ok response', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                buildFetchMock({ ok: false, body: { error: 'Payment failed' } })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(
                    'No pudimos iniciar el pago. Intenta de nuevo.'
                );
            });
        });

        it('re-enables button after API error', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', buildFetchMock({ ok: false }));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(getMainButton()).not.toBeDisabled();
            });
        });

        it('shows error when response is ok but checkoutUrl is missing from body', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', buildFetchMock({ ok: true, body: { data: {} } }));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
        });

        it('shows error when response body has no data envelope', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', buildFetchMock({ ok: true, body: null }));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 5. Network error (fetch throws)
    // -----------------------------------------------------------------------

    describe('network error', () => {
        it('shows inline error message when fetch throws', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', buildFetchMock({ throws: true }));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(
                    'No pudimos iniciar el pago. Intenta de nuevo.'
                );
            });
        });

        it('re-enables button after network error', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', buildFetchMock({ throws: true }));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());

            // Assert
            await waitFor(() => {
                expect(getMainButton()).not.toBeDisabled();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 6. No double-submit
    // -----------------------------------------------------------------------

    describe.skipIf(SPEC_131_PENDING)('no double-submit', () => {
        it('fires only one fetch call when button is clicked twice rapidly', async () => {
            // Arrange
            mockAuthenticated();
            // First click triggers a slow request; button is disabled until it resolves.
            let resolveFirst!: (v: unknown) => void;
            const slowFetch = vi.fn().mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveFirst = resolve;
                })
            );
            vi.stubGlobal('fetch', slowFetch);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            const button = getMainButton();

            // Act — first click starts request; second click ignored because button disabled
            await user.click(button);
            // Button is now disabled, so userEvent won't fire a click on it
            await user.click(button);

            // Assert — only one fetch call despite two click attempts
            expect(slowFetch).toHaveBeenCalledTimes(1);

            // Resolve the pending request to avoid open handles (inside act to flush state)
            await act(async () => {
                resolveFirst({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                checkoutUrl: 'https://mp.com/x',
                                orderId: 'o',
                                amount: 0,
                                currency: 'ARS',
                                expiresAt: null
                            }
                        })
                });
                await Promise.resolve();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 7. Error clears on next click
    // -----------------------------------------------------------------------

    describe.skipIf(SPEC_131_PENDING)('error clears on retry', () => {
        it('clears the previous error message when user clicks again', async () => {
            // Arrange
            mockAuthenticated();
            // First call fails, second call never resolves (keeps loading state)
            let resolveSecond!: (v: unknown) => void;
            const fetchMock = vi
                .fn()
                .mockRejectedValueOnce(new Error('First attempt fails'))
                .mockReturnValueOnce(
                    new Promise((resolve) => {
                        resolveSecond = resolve;
                    })
                );
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // First click — produces error
            await user.click(getMainButton());
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            // Act — second click should clear error
            await user.click(getMainButton());

            // Assert — error gone immediately (setError(null) runs synchronously at top of handleClick)
            await waitFor(() => {
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });

            // Cleanup — resolve to avoid open promise handle (inside act to flush state)
            await act(async () => {
                resolveSecond({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                checkoutUrl: 'https://mp.com/y',
                                orderId: 'o2',
                                amount: 0,
                                currency: 'ARS',
                                expiresAt: null
                            }
                        })
                });
                await Promise.resolve();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 8. Correct POST payload
    // -----------------------------------------------------------------------

    describe.skipIf(SPEC_131_PENDING)('POST payload', () => {
        it('sends the correct planId in the request body', async () => {
            // Arrange
            mockAuthenticated();
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: 'https://mp.com/z',
                        orderId: 'o3',
                        amount: 0,
                        currency: 'ARS',
                        expiresAt: null
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(
                <PlanPurchaseButton
                    {...defaultProps}
                    planSlug="plan_pro"
                />
            );

            // Act
            await user.click(getMainButton());
            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalled();
            });

            // Assert — body contains planSlug + billingInterval (default 'monthly')
            const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(requestInit.body as string) as {
                planSlug: string;
                billingInterval: string;
            };
            expect(body).toEqual({ planSlug: 'plan_pro', billingInterval: 'monthly' });
        });

        it('sends POST method with Content-Type application/json', async () => {
            // Arrange
            mockAuthenticated();
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: 'https://mp.com/w',
                        orderId: 'o4',
                        amount: 0,
                        currency: 'ARS',
                        expiresAt: null
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());
            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalled();
            });

            // Assert
            const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(requestInit.method).toBe('POST');
            expect((requestInit.headers as Record<string, string>)['Content-Type']).toBe(
                'application/json'
            );
        });

        it('sends credentials: include with every checkout request', async () => {
            // Arrange
            mockAuthenticated();
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: 'https://mp.com/v',
                        orderId: 'o5',
                        amount: 0,
                        currency: 'ARS',
                        expiresAt: null
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());
            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalled();
            });

            // Assert
            const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(requestInit.credentials).toBe('include');
        });

        it('hits the correct checkout endpoint URL', async () => {
            // Arrange
            mockAuthenticated();
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: 'https://mp.com/u',
                        orderId: 'o6',
                        amount: 0,
                        currency: 'ARS',
                        expiresAt: null
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(getMainButton());
            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalled();
            });

            // Assert — endpoint path matches the component's actual checkout path.
            // NOTE: /billing/checkout was the legacy endpoint deprecated in SPEC-126;
            // the component now uses /billing/subscriptions/start-paid.
            const [url] = fetchMock.mock.calls[0] as [string];
            expect(url).toContain('/api/v1/protected/billing/subscriptions/start-paid');
        });
    });

    // -----------------------------------------------------------------------
    // 9. Idle state rendering
    // -----------------------------------------------------------------------

    describe('idle state rendering', () => {
        it('shows the ctaText in idle state', () => {
            // Arrange
            mockAuthenticated();
            render(
                <PlanPurchaseButton
                    {...defaultProps}
                    ctaText="Contratar"
                />
            );

            // Assert
            expect(screen.getByText('Contratar')).toBeInTheDocument();
        });

        it('shows the formatted price in idle state for ARS currency', () => {
            // Arrange
            mockAuthenticated();
            render(
                <PlanPurchaseButton
                    {...defaultProps}
                    // 120000 cents = $1200 ARS; the component divides by 100
                    // for display.
                    monthlyPrice={120000}
                    currency="ARS"
                />
            );

            // Assert — formatPrice uses es-AR locale: "$ 1.200"
            expect(screen.getByText(/1\.200/)).toBeInTheDocument();
        });

        it('shows the formatted price in idle state for USD currency', () => {
            // Arrange
            mockAuthenticated();
            render(
                <PlanPurchaseButton
                    {...defaultProps}
                    // 1200 cents = $12 USD
                    monthlyPrice={1200}
                    currency="USD"
                />
            );

            // Assert
            expect(screen.getByText(/USD 12/)).toBeInTheDocument();
        });

        it('renders button with aria-label containing ctaText and price in idle state', () => {
            // Arrange
            mockAuthenticated();
            render(
                <PlanPurchaseButton
                    {...defaultProps}
                    ctaText="Contratar"
                    monthlyPrice={120000}
                    currency="ARS"
                />
            );

            // Assert — aria-label format: "{ctaText} — {formattedPrice}"
            const button = getMainButton();
            expect(button).toHaveAttribute('aria-label');
            expect(button.getAttribute('aria-label')).toContain('Contratar');
        });

        it('has aria-busy="false" in idle state', () => {
            // Arrange
            mockAuthenticated();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Assert
            expect(getMainButton()).toHaveAttribute('aria-busy', 'false');
        });

        it('is not disabled in idle state', () => {
            // Arrange
            mockAuthenticated();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Assert
            expect(getMainButton()).not.toBeDisabled();
        });
    });

    // -----------------------------------------------------------------------
    // 10. Promo code — field reveal
    // -----------------------------------------------------------------------

    describe('promo code — field reveal', () => {
        it('shows promo toggle link when user is authenticated', () => {
            // Arrange
            mockAuthenticated();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Assert — the toggle text comes from the mocked t() which returns the fallback
            expect(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            ).toBeInTheDocument();
        });

        it('does not show promo toggle when user is unauthenticated', () => {
            // Arrange
            mockUnauthenticated();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Assert
            expect(screen.queryByText('¿Tenés un código de descuento?')).not.toBeInTheDocument();
        });

        it('expands the promo input when the toggle is clicked', async () => {
            // Arrange
            mockAuthenticated();
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );

            // Assert
            expect(screen.getByPlaceholderText('Ingresá tu código')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
        });

        it('shows the label for the promo input after expanding', async () => {
            // Arrange
            mockAuthenticated();
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Act
            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );

            // Assert
            expect(screen.getByText('Código de descuento')).toBeInTheDocument();
        });

        it('promo section is visible for a monthly plan with no annual price', () => {
            // Default interval is 'monthly', so a plan without an annual price is
            // still purchasable → the promo section stays visible.
            mockAuthenticated();
            render(
                <PlanPurchaseButton
                    {...defaultProps}
                    annualPrice={null}
                />
            );

            expect(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            ).toBeInTheDocument();
        });

        it('promo section is hidden when the annual interval is selected but the plan has no annual price', async () => {
            // Wrapping the island in a [data-billing="annual"] ancestor makes the
            // MutationObserver resolve the interval to 'annual' on mount. With
            // annualPrice=null this yields isAnnualUnavailable=true, so
            // showPromoSection=false and the toggle must NOT render.
            mockAuthenticated();
            render(
                <div data-billing="annual">
                    <PlanPurchaseButton
                        {...defaultProps}
                        annualPrice={null}
                    />
                </div>
            );

            await waitFor(() => {
                expect(
                    screen.queryByText('¿Tenés un código de descuento?')
                ).not.toBeInTheDocument();
            });
        });
    });

    // -----------------------------------------------------------------------
    // 11. Promo code — validate → preview
    // -----------------------------------------------------------------------

    describe('promo code — validate renders preview', () => {
        it('shows preview text after a valid discount percentage code is applied', async () => {
            // Arrange
            mockAuthenticated();
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        data: {
                            valid: true,
                            effectPreview: {
                                effectKind: 'discount',
                                valueKind: 'percentage',
                                value: 20,
                                durationCycles: 3,
                                extraDays: null,
                                finalAmount: 96000
                            }
                        }
                    })
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Expand promo section
            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );

            // Type code and click Apply
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'WELCOME20');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            // Assert — the rendered preview text, not just element presence.
            await waitFor(() => {
                expect(screen.getByRole('status')).toHaveTextContent(
                    '20% de descuento por 3 meses'
                );
            });
        });

        it('shows "Gratis para siempre" preview for comp code', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'comp',
                                    valueKind: null,
                                    value: null,
                                    durationCycles: null,
                                    extraDays: null,
                                    finalAmount: null
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'COMPFREE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            // Assert — comp text from fallback
            await waitFor(() => {
                expect(screen.getByRole('status')).toHaveTextContent('Gratis para siempre');
            });
        });

        it('shows the DISCOUNT amount (value), not the final price, for a fixed discount', async () => {
            // Regression: a fixed discount preview must render `value` (the amount
            // OFF) — NOT `finalAmount` (the resulting price). value=50000c ($500
            // off) with finalAmount=150000c ($1500 to pay) must show "500".
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'discount',
                                    valueKind: 'fixed',
                                    value: 50000,
                                    durationCycles: null,
                                    extraDays: null,
                                    finalAmount: 150000
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'FIXED500');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                expect(screen.getByRole('status')).toHaveTextContent('500');
            });
            // The final price (1.500) must NOT appear as if it were the discount.
            expect(screen.getByRole('status')).not.toHaveTextContent('1.500');
        });

        it('shows the fixed-discount amount and cycle count for a multi-cycle fixed discount', async () => {
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'discount',
                                    valueKind: 'fixed',
                                    value: 50000,
                                    durationCycles: 3,
                                    extraDays: null,
                                    finalAmount: 150000
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'FIXED500X3');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                expect(screen.getByRole('status')).toHaveTextContent(
                    '$500 de descuento por 3 meses'
                );
            });
        });

        it('uses the SINGULAR form ("1 mes") for a single-cycle percentage discount', async () => {
            // Regression (BETA-202): a 1-cycle discount must read "por 1 mes"
            // (singular), never the pluralised "por 1 meses".
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'discount',
                                    valueKind: 'percentage',
                                    value: 30,
                                    durationCycles: 1,
                                    extraDays: null,
                                    finalAmount: 105000
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'BIENVENIDO30');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                // Anchored regex — `toHaveTextContent('...1 mes')` alone is a
                // substring match and would also pass on the buggy "1 meses"
                // output ("1 mes" ⊂ "1 meses"). `$` closes the door on that.
                expect(screen.getByRole('status')).toHaveTextContent(
                    /^30% de descuento por 1 mes$/
                );
            });
            // Belt-and-suspenders: the pluralised copy must NOT leak through.
            expect(screen.getByRole('status')).not.toHaveTextContent('1 meses');
        });

        it('uses the SINGULAR form ("1 mes") for a single-cycle fixed discount', async () => {
            // Regression (BETA-202): mirrors the percentage case for the
            // fixed-amount branch.
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'discount',
                                    valueKind: 'fixed',
                                    value: 50000,
                                    durationCycles: 1,
                                    extraDays: null,
                                    finalAmount: 100000
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'FIXED500X1');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                // Anchored regex — see the percentage case above for why a bare
                // substring assertion is insufficient here.
                expect(screen.getByRole('status')).toHaveTextContent(
                    /^\$500 de descuento por 1 mes$/
                );
            });
            expect(screen.getByRole('status')).not.toHaveTextContent('1 meses');
        });

        it('shows the trial-extension days for a trial_extension code', async () => {
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'trial_extension',
                                    valueKind: null,
                                    value: null,
                                    durationCycles: null,
                                    extraDays: 7,
                                    finalAmount: null
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'FREEMONTH');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                expect(screen.getByRole('status')).toHaveTextContent(
                    '7 días de prueba gratis adicionales'
                );
            });
        });

        it('uses the SINGULAR form ("1 día ... adicional") for a 1-day trial extension', async () => {
            // Regression (HOS-252): a trial_extension of exactly 1 day must read
            // "1 día de prueba gratis adicional" (singular), never the pluralised
            // "1 días de prueba gratis adicionales".
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'trial_extension',
                                    valueKind: null,
                                    value: null,
                                    durationCycles: null,
                                    extraDays: 1,
                                    finalAmount: null
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'ONEDAY');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                // Anchored regex — `toHaveTextContent('1 día')` alone is a
                // substring match and would also pass on the buggy "1 días"
                // output ("1 día" ⊂ "1 días"). `$` closes the door on that.
                expect(screen.getByRole('status')).toHaveTextContent(
                    /^1 día de prueba gratis adicional$/
                );
            });
            // Belt-and-suspenders: the pluralised copy must NOT leak through.
            expect(screen.getByRole('status')).not.toHaveTextContent('1 días');
        });

        it('clears an applied promo when the billing interval changes', async () => {
            // Regression: a code previewed against the monthly price must not
            // silently carry over to the annual checkout. Switching the interval
            // resets the promo back to the idle input state.
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'comp',
                                    valueKind: null,
                                    value: null,
                                    durationCycles: null,
                                    extraDays: null,
                                    finalAmount: null
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            const { container } = render(
                <div data-billing="monthly">
                    <PlanPurchaseButton {...defaultProps} />
                </div>
            );

            // Apply a promo on the monthly interval.
            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'COMPFREE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));
            await waitFor(() => {
                expect(screen.getByRole('status')).toHaveTextContent('Gratis para siempre');
            });

            // Flip the interval to annual (the plan has an annual price, so the
            // promo section stays visible — but the applied preview must clear).
            const root = container.querySelector('[data-billing]') as HTMLElement;
            act(() => {
                root.setAttribute('data-billing', 'annual');
            });

            await waitFor(() => {
                expect(screen.queryByRole('status')).not.toBeInTheDocument();
            });
            // Back to the idle input state, ready for re-entry against the new price.
            expect(screen.getByPlaceholderText('Ingresá tu código')).toBeInTheDocument();
        });

        it('shows "Quitar" button after valid code is applied', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'comp',
                                    valueKind: null,
                                    value: null,
                                    durationCycles: null,
                                    extraDays: null,
                                    finalAmount: null
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'COMPFREE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument();
            });
        });

        it('resets to input state when "Quitar" is clicked', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: true,
                                effectPreview: {
                                    effectKind: 'comp',
                                    valueKind: null,
                                    value: null,
                                    durationCycles: null,
                                    extraDays: null,
                                    finalAmount: null
                                }
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'COMPFREE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));
            await waitFor(() => screen.getByRole('button', { name: 'Quitar' }));

            // Act — remove
            await user.click(screen.getByRole('button', { name: 'Quitar' }));

            // Assert — input field returns
            expect(screen.getByPlaceholderText('Ingresá tu código')).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // 12. Promo code — invalid code → error
    // -----------------------------------------------------------------------

    describe('promo code — invalid code shows error', () => {
        it('maps the server errorCode to a localized message and DISCARDS the English errorMessage', async () => {
            // Regression (U8): the API always returns `errorMessage` in hardcoded
            // English. The component must ignore it and translate `errorCode`
            // instead, so the user never sees raw English at checkout.
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: false,
                                errorCode: 'PROMO_CODE_EXPIRED',
                                errorMessage: 'This promo code has expired'
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'EXPIRED');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            // Assert — localized message shown (mocked t() returns the fallback arg);
            // the English errorMessage must NOT appear.
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent('Este código ya venció.');
            });
            expect(screen.getByRole('alert')).not.toHaveTextContent('This promo code has expired');
        });

        // One assertion per mapped code path. `it.each` gives each code its own
        // test node so a single regression is reported in isolation (a `for`
        // loop would mask cases after the first failure). Covers ALL 9 codes
        // returned by `validatePromoCode()` — including the catch-all
        // `PROMO_CODE_VALIDATION_ERROR`, which maps to the generic "couldn't
        // verify" copy (a distinct switch arm from the `default`).
        it.each([
            ['PROMO_CODE_NOT_FOUND', 'No encontramos ese código. Revisá que esté bien escrito.'],
            ['PROMO_CODE_INACTIVE', 'Este código ya no está activo.'],
            ['PROMO_CODE_EXPIRED', 'Este código ya venció.'],
            ['PROMO_CODE_MAX_USES', 'Este código alcanzó su límite de usos.'],
            ['PROMO_CODE_MAX_USES_PER_USER', 'Ya usaste este código la cantidad máxima de veces.'],
            ['PROMO_CODE_PLAN_RESTRICTION', 'Este código no es válido para el plan seleccionado.'],
            ['PROMO_CODE_NEW_USERS_ONLY', 'Este código es solo para clientes nuevos.'],
            ['PROMO_CODE_MIN_AMOUNT', 'Tu compra no alcanza el mínimo requerido para este código.'],
            ['PROMO_CODE_VALIDATION_ERROR', 'No pudimos verificar el código. Intentá de nuevo.']
        ] as const)('maps errorCode %s to its localized message', async (errorCode, expected) => {
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: { valid: false, errorCode } })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'CODE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(expected);
            });
        });

        it('falls back to the generic invalid message for an unknown errorCode', async () => {
            // A future/unrecognized server code must never leak raw English; it
            // routes to the generic "invalid code" copy.
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: false,
                                errorCode: 'PROMO_CODE_SOME_NEW_CODE',
                                errorMessage: 'Brand new English reason'
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'NEWCODE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(
                    'El código ingresado no es válido. Revisalo e intentá de nuevo.'
                );
            });
            expect(screen.getByRole('alert')).not.toHaveTextContent('Brand new English reason');
        });

        it('shows generic error when validate API returns non-ok status', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Internal server error' })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'BADCODE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(
                    'No pudimos verificar el código. Intentá de nuevo.'
                );
            });
        });

        it('shows generic error when validate fetch throws', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'BADCODE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
        });

        it('uses fallback errorInvalid message when errorMessage is absent but valid is false', async () => {
            // Arrange
            mockAuthenticated();
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: () =>
                        Promise.resolve({
                            data: {
                                valid: false
                                // no errorMessage
                            }
                        })
                })
            );
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'BADCODE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));

            // Assert — fallback text from mocked t()
            await waitFor(() => {
                expect(screen.getByRole('alert')).toHaveTextContent(
                    'El código ingresado no es válido. Revisalo e intentá de nuevo.'
                );
            });
        });
    });

    // -----------------------------------------------------------------------
    // 13. Promo code — forwarded to checkout
    // -----------------------------------------------------------------------

    describe.skipIf(SPEC_131_PENDING)('promo code — forwarded to checkout', () => {
        it('includes promoCode in checkout POST body when a valid code was applied', async () => {
            // Arrange
            mockAuthenticated();

            // First fetch call: validate endpoint returns valid code
            // Second fetch call: checkout endpoint (getSubscription is also mocked in fetchCurrentPlanSlug)
            const validateBody = {
                data: {
                    valid: true,
                    effectPreview: {
                        effectKind: 'discount',
                        valueKind: 'percentage',
                        value: 50,
                        durationCycles: null,
                        extraDays: null,
                        finalAmount: 60000
                    }
                }
            };
            const checkoutBody = {
                data: {
                    checkoutUrl: 'https://mp.com/checkout/promo',
                    localSubscriptionId: 'sub-uuid',
                    expiresAt: new Date(Date.now() + 86400000).toISOString()
                }
            };

            let callCount = 0;
            const fetchMock = vi.fn().mockImplementation(() => {
                callCount++;
                // First call = validate, second call = checkout
                const body = callCount === 1 ? validateBody : checkoutBody;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(body)
                });
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            // Expand and apply promo
            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'SUMMER50');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));
            await waitFor(() => screen.getByRole('status'));

            // Click main checkout button
            await user.click(screen.getByRole('button', { name: /Contratar/ }));

            // Assert — the checkout fetch body contains the promoCode
            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledTimes(2);
            });

            const checkoutCall = fetchMock.mock.calls[1] as [string, RequestInit];
            const body = JSON.parse(checkoutCall[1].body as string) as Record<string, unknown>;
            expect(body.promoCode).toBe('SUMMER50');
        });

        it('navigates to comp sentinel URL when appliedEffect is comp', async () => {
            // Arrange — server returns comp sentinel URL (not MP)
            mockAuthenticated();
            const sentinelUrl = 'https://hospeda.com.ar/es/suscriptores/comp-success';

            let callCount = 0;
            const fetchMock = vi.fn().mockImplementation(() => {
                callCount++;
                const body =
                    callCount === 1
                        ? {
                              data: {
                                  valid: true,
                                  effectPreview: {
                                      effectKind: 'comp',
                                      valueKind: null,
                                      value: null,
                                      durationCycles: null,
                                      extraDays: null,
                                      finalAmount: null
                                  }
                              }
                          }
                        : {
                              data: {
                                  checkoutUrl: sentinelUrl,
                                  localSubscriptionId: 'comp-sub-uuid',
                                  expiresAt: new Date(Date.now() + 86400000).toISOString(),
                                  appliedEffect: 'comp'
                              }
                          };
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(body)
                });
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'COMPFREE');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));
            await waitFor(() => screen.getByRole('status'));

            await user.click(screen.getByRole('button', { name: /Contratar/ }));

            // Assert — navigates to the sentinel URL with `?effect=comp` appended
            // (HOS-110 F1: flags the granted effect so the success page renders
            // the correct copy instead of defaulting to "verifying payment").
            await waitFor(() => {
                expect(window.location.href).toBe(`${sentinelUrl}?effect=comp`);
            });
        });

        it('flags an ignored promo code on an ordinary MP redirect', async () => {
            // Arrange — the server accepted a trial_extension code on a checkout with
            // no trial to lengthen, so it did nothing and says so (promoCodeIgnored).
            // This is the ONLY thing promoCodeIgnored means since HOS-171. It used to
            // mean "a discount was discarded because the trial took priority" — that
            // precedence is gone: a discount and a trial coexist now, so a discount is
            // never discarded in favour of a trial.
            mockAuthenticated();
            const mpUrl = 'https://mp.test/checkout/preapproval-abc';

            let callCount = 0;
            const fetchMock = vi.fn().mockImplementation(() => {
                callCount++;
                const body =
                    callCount === 1
                        ? {
                              data: {
                                  valid: true,
                                  effectPreview: {
                                      effectKind: 'trial_extension',
                                      valueKind: null,
                                      value: null,
                                      durationCycles: null,
                                      extraDays: 30,
                                      finalAmount: 120000
                                  }
                              }
                          }
                        : {
                              data: {
                                  checkoutUrl: mpUrl,
                                  localSubscriptionId: 'paid-sub-uuid',
                                  expiresAt: new Date(Date.now() + 86400000).toISOString(),
                                  promoCodeIgnored: true
                              }
                          };
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve(body)
                });
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(
                screen.getByRole('button', { name: '¿Tenés un código de descuento?' })
            );
            await user.type(screen.getByPlaceholderText('Ingresá tu código'), 'FREEMONTH');
            await user.click(screen.getByRole('button', { name: 'Aplicar' }));
            await waitFor(() => screen.getByRole('status'));

            await user.click(screen.getByRole('button', { name: /Contratar/ }));

            // Assert — a real MP redirect carrying only the promoIgnored flag. There
            // is no `?effect=` param: a trial is not an effect any more.
            await waitFor(() => {
                expect(window.location.href).toBe(`${mpUrl}?promoIgnored=1`);
            });
            // It is a real preapproval, so the success page must be able to poll it.
            expect(window.sessionStorage.getItem(PENDING_KEY)).toBe('paid-sub-uuid');
        });

        it('does not include promoCode in checkout body when no promo was applied', async () => {
            // Arrange — no promo interaction; direct checkout click
            mockAuthenticated();
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: 'https://mp.com/checkout/no-promo',
                        localSubscriptionId: 'sub-x',
                        expiresAt: new Date(Date.now() + 86400000).toISOString()
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(screen.getByRole('button', { name: /Contratar/ }));

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalled();
            });

            const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(requestInit.body as string) as Record<string, unknown>;
            expect(body).not.toHaveProperty('promoCode');
        });
    });

    // -----------------------------------------------------------------------
    // 14. HOS-151 Bug A — persist localSubscriptionId before the MP redirect
    // -----------------------------------------------------------------------

    describe('HOS-151 Bug A: sessionStorage pending-subscription id', () => {
        beforeEach(() => {
            window.sessionStorage.clear();
        });
        afterEach(() => {
            window.sessionStorage.clear();
        });

        it('stashes the localSubscriptionId for a real MP redirect (no immediate effect) before navigating', async () => {
            mockAuthenticated();
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: 'https://mp.com/checkout/paid',
                        localSubscriptionId: 'paid-sub-uuid',
                        expiresAt: new Date(Date.now() + 86400000).toISOString()
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(screen.getByRole('button', { name: /Contratar/ }));

            await waitFor(() => {
                expect(window.location.href).toBe('https://mp.com/checkout/paid');
            });
            // The id must be persisted so the success page can poll on return.
            expect(window.sessionStorage.getItem(PENDING_KEY)).toBe('paid-sub-uuid');
        });

        it('DOES stash the id for a trial — it redirects to MP like any paid checkout', async () => {
            // Card-first (HOS-171): a trial is `free_trial` on the paid preapproval,
            // so the server returns a real MercadoPago redirect and NO appliedEffect
            // marker. It therefore needs the id stashed for the success page to poll,
            // exactly like a plain paid checkout. This used to be the opposite: a
            // trial was granted without a card, returned an in-app sentinel, and
            // skipped the poller entirely.
            mockAuthenticated();
            const mpUrl = 'https://mp.test/checkout/trial-preapproval';
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: mpUrl,
                        localSubscriptionId: 'trial-sub-uuid',
                        expiresAt: new Date(Date.now() + 86400000).toISOString()
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(screen.getByRole('button', { name: /Contratar/ }));

            await waitFor(() => {
                // No `?effect=` param — nothing to flag, it is an ordinary redirect.
                expect(window.location.href).toBe(mpUrl);
            });
            expect(window.sessionStorage.getItem(PENDING_KEY)).toBe('trial-sub-uuid');
        });

        it('does NOT stash the id for a comp grant (in-app sentinel)', async () => {
            mockAuthenticated();
            const sentinelUrl = 'https://hospeda.com.ar/es/suscriptores/checkout/success/';
            const fetchMock = buildFetchMock({
                ok: true,
                body: {
                    data: {
                        checkoutUrl: sentinelUrl,
                        localSubscriptionId: 'comp-sub-uuid',
                        expiresAt: new Date(Date.now() + 86400000).toISOString(),
                        appliedEffect: 'comp'
                    }
                }
            });
            vi.stubGlobal('fetch', fetchMock);
            const user = userEvent.setup();
            render(<PlanPurchaseButton {...defaultProps} />);

            await user.click(screen.getByRole('button', { name: /Contratar/ }));

            await waitFor(() => {
                expect(window.location.href).toBe(`${sentinelUrl}?effect=comp`);
            });
            expect(window.sessionStorage.getItem(PENDING_KEY)).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // BETA-183 — monthly MP email-mismatch notice (layer 1, notice only)
    // -----------------------------------------------------------------------

    describe('monthly MP email notice (BETA-183)', () => {
        it('shows the notice with the user email on an authenticated monthly checkout', () => {
            mockAuthenticated();
            render(<PlanPurchaseButton {...defaultProps} />);

            const notice = screen.getByTestId('monthly-email-notice');
            expect(notice).toBeInTheDocument();
            // The user's signup email is interpolated into the copy so they can
            // match (or switch) their MercadoPago account before the redirect.
            expect(notice).toHaveTextContent('juan@example.com');
        });

        it('does NOT show the notice when the user is unauthenticated', () => {
            mockUnauthenticated();
            render(<PlanPurchaseButton {...defaultProps} />);

            expect(screen.queryByTestId('monthly-email-notice')).not.toBeInTheDocument();
        });

        it('does NOT show the notice on annual billing (annual has no email constraint)', async () => {
            mockAuthenticated();
            // The billing interval is driven by the closest [data-billing] ancestor
            // (a vanilla-JS toggle outside the island). Wrapping in an annual
            // container makes the island observe 'annual' on mount.
            render(
                <div data-billing="annual">
                    <PlanPurchaseButton {...defaultProps} />
                </div>
            );

            await waitFor(() => {
                expect(screen.queryByTestId('monthly-email-notice')).not.toBeInTheDocument();
            });
        });
    });
});
