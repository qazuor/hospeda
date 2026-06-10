/**
 * @file AiSearchPanel.test.tsx
 * @description Comprehensive RTL tests for the AiSearchPanel React island (SPEC-199 T-020).
 *
 * Coverage:
 * - Anonymous user: redirects to login, no API call made
 * - Authenticated user: POSTs to correct path with { query, locale }
 * - Loading state: spinner / Analizando text visible while request in flight
 * - Success (fallbackToKeyword: false): navigates with serialized mappedParams, sets sessionStorage
 * - Success (fallbackToKeyword: true): navigates with q=<rawQuery>, no sessionStorage set
 * - Error 403 (quota/entitlement): upgrade prompt alert + CTA link, no navigation
 * - Error 429 (rate limit): rate-limit message alert
 * - Error 0 (network): service error alert + keyword fallback CTA button
 * - Keyword fallback CTA: navigates with q=<query>
 * - Panel toggle: open/close resets state
 * - Input: submit disabled when empty, enabled with text, char count updates
 * - Locale propagation: locale forwarded correctly in API body and navigation URLs
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSearchPanelProps } from '../../../src/components/ai-search/AiSearchPanel.client';
import { AiSearchPanel } from '../../../src/components/ai-search/AiSearchPanel.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

/**
 * i18n mock: returns fallback when provided, otherwise the key.
 * Supports simple {{param}} interpolation so character count "{{count}}/500"
 * renders as "3/500" in tests.
 */
vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            const base = fallback ?? _key;
            if (!params) {
                return base;
            }
            return Object.entries(params).reduce(
                (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
                base
            );
        }
    })
}));

vi.mock('@/lib/analytics/posthog-client', () => ({
    trackEvent: vi.fn()
}));

vi.mock('@/lib/middleware-helpers', () => ({
    buildLoginRedirect: vi.fn(
        ({ locale, currentUrl }: { locale: string; currentUrl: string }) =>
            `/${locale}/auth/signin/?returnUrl=${encodeURIComponent(currentUrl)}`
    )
}));

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        postProtected: vi.fn()
    }
}));

// CSS module proxy — each className lookup returns the property name.
vi.mock('../../../src/components/ai-search/AiSearchPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/ai-search/NlSearchInput.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { apiClient } from '@/lib/api/client';
import { buildLoginRedirect } from '@/lib/middleware-helpers';

// ─── Test helpers ──────────────────────────────────────────────────────────────

const DEFAULT_PROPS: AiSearchPanelProps = {
    locale: 'es',
    isAuthenticated: false,
    currentUrl: '/es/alojamientos/'
};

/** Click the trigger button to open the panel. */
function openPanel(): void {
    const trigger = screen.getByRole('button', { name: /buscá con ia/i });
    fireEvent.click(trigger);
}

/** Change the NL search textarea value. */
function typeQuery(query: string): void {
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: query } });
}

/** Click the submit button. */
function clickSubmit(): void {
    const submitBtn = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(submitBtn);
}

/**
 * Build a success ApiResult for AiSearchIntentResponseData.
 * Defaults to fallbackToKeyword=false with typical CABIN+pool params.
 */
function buildSuccessResult(
    opts: {
        fallbackToKeyword?: boolean;
        rawQuery?: string;
        mappedParams?: Record<string, unknown>;
        confidence?: number;
    } = {}
) {
    const {
        fallbackToKeyword = false,
        rawQuery = 'cabaña con pileta',
        mappedParams = { type: 'CABIN', hasPool: 'true' },
        confidence = 0.9
    } = opts;
    return {
        ok: true as const,
        data: {
            fallbackToKeyword,
            confidence,
            mappedParams,
            intent: { kind: 'search', confidence, entities: {}, rawQuery }
        }
    };
}

/** Build an error ApiResult with the given HTTP status code. */
function buildErrorResult(status: number) {
    return {
        ok: false as const,
        error: {
            status,
            message: `HTTP ${status}`,
            code: status === 403 ? 'LIMIT_REACHED' : undefined
        }
    };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });

    sessionStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AiSearchPanel', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Panel rendering
    // ─────────────────────────────────────────────────────────────────────────

    describe('panel rendering', () => {
        it('renders the trigger button on mount', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            expect(screen.getByRole('button', { name: /buscá con ia/i })).toBeInTheDocument();
        });

        it('panel body is not rendered before trigger is clicked', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('panel opens when trigger is clicked', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            openPanel();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('panel has open attribute on the dialog element', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            openPanel();
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('open');
        });

        it('trigger button has aria-expanded=false before open', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            const trigger = screen.getByRole('button', { name: /buscá con ia/i });
            expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });

        it('trigger button has aria-expanded=true after open', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            openPanel();
            const trigger = screen.getByRole('button', { name: /buscá con ia/i });
            expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });

        it('close button is rendered inside the open panel', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            openPanel();
            expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
        });

        it('panel closes when close button is clicked', () => {
            render(<AiSearchPanel {...DEFAULT_PROPS} />);
            openPanel();
            fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('shows login hint for anonymous users when panel is open', () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={false}
                />
            );
            openPanel();
            expect(screen.getByText(/búsqueda inteligente está disponible/i)).toBeInTheDocument();
        });

        it('does NOT show login hint for authenticated users', () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            expect(
                screen.queryByText(/búsqueda inteligente está disponible/i)
            ).not.toBeInTheDocument();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Anonymous user flow
    // ─────────────────────────────────────────────────────────────────────────

    describe('anonymous user flow', () => {
        it('calls buildLoginRedirect with locale and currentUrl on submit', async () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={false}
                />
            );
            openPanel();
            typeQuery('cabaña para 4 personas');
            clickSubmit();

            await waitFor(() => {
                expect(buildLoginRedirect).toHaveBeenCalledWith(
                    expect.objectContaining({ locale: 'es', currentUrl: '/es/alojamientos/' })
                );
            });
        });

        it('does NOT call apiClient.postProtected for anonymous users', async () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={false}
                />
            );
            openPanel();
            typeQuery('cabaña para 4 personas');
            clickSubmit();

            await waitFor(() => {
                expect(buildLoginRedirect).toHaveBeenCalled();
            });
            expect(apiClient.postProtected).not.toHaveBeenCalled();
        });

        it('sets window.location.href to the login URL', async () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={false}
                />
            );
            openPanel();
            typeQuery('cabaña para 4 personas');
            clickSubmit();

            await waitFor(() => {
                expect(window.location.href).toContain('/es/auth/signin/');
            });
        });

        it('returnUrl is encoded in the signin redirect URL', async () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={false}
                    currentUrl="/es/alojamientos/"
                />
            );
            openPanel();
            typeQuery('algo');
            clickSubmit();

            await waitFor(() => {
                expect(window.location.href).toContain(
                    `returnUrl=${encodeURIComponent('/es/alojamientos/')}`
                );
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Authenticated user — API call
    // ─────────────────────────────────────────────────────────────────────────

    describe('authenticated user — API call', () => {
        it('calls apiClient.postProtected with the correct path', async () => {
            vi.mocked(apiClient.postProtected).mockReturnValue(new Promise(() => undefined));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel céntrico para 2');
            clickSubmit();

            await waitFor(() => {
                expect(apiClient.postProtected).toHaveBeenCalledWith(
                    expect.objectContaining({
                        path: '/api/v1/protected/ai/search-intent'
                    })
                );
            });
        });

        it('forwards query and locale in the request body', async () => {
            vi.mocked(apiClient.postProtected).mockReturnValue(new Promise(() => undefined));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel céntrico para 2');
            clickSubmit();

            await waitFor(() => {
                expect(apiClient.postProtected).toHaveBeenCalledWith(
                    expect.objectContaining({
                        body: { query: 'hotel céntrico para 2', locale: 'es' }
                    })
                );
            });
        });

        it('trims leading/trailing whitespace from query before sending', async () => {
            vi.mocked(apiClient.postProtected).mockReturnValue(new Promise(() => undefined));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('  hotel  ');
            clickSubmit();

            await waitFor(() => {
                expect(apiClient.postProtected).toHaveBeenCalledWith(
                    expect.objectContaining({
                        body: expect.objectContaining({ query: 'hotel' })
                    })
                );
            });
        });

        it('forwards locale=en correctly when prop is "en"', async () => {
            vi.mocked(apiClient.postProtected).mockReturnValue(new Promise(() => undefined));
            render(
                <AiSearchPanel
                    locale="en"
                    isAuthenticated={true}
                    currentUrl="/en/accommodations/"
                />
            );
            openPanel();
            typeQuery('cabin near the river');
            clickSubmit();

            await waitFor(() => {
                expect(apiClient.postProtected).toHaveBeenCalledWith(
                    expect.objectContaining({
                        body: expect.objectContaining({ locale: 'en' })
                    })
                );
            });
        });

        it('does not call API when query is only whitespace', () => {
            vi.mocked(apiClient.postProtected).mockReturnValue(new Promise(() => undefined));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('   ');
            // Submit button should be disabled for whitespace-only query
            const submitBtn = screen.getByRole('button', { name: /buscar/i });
            expect(submitBtn).toBeDisabled();
            expect(apiClient.postProtected).not.toHaveBeenCalled();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Loading state
    // ─────────────────────────────────────────────────────────────────────────

    describe('loading state', () => {
        it('shows "Analizando..." text while request is in flight', async () => {
            vi.mocked(apiClient.postProtected).mockReturnValue(new Promise(() => undefined));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel céntrico');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByText(/analizando/i)).toBeInTheDocument();
            });
        });

        it('submit button is disabled while loading', async () => {
            vi.mocked(apiClient.postProtected).mockReturnValue(new Promise(() => undefined));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña');
            clickSubmit();

            await waitFor(() => {
                const submitBtn = screen.getByRole('button', { name: /analizando/i });
                expect(submitBtn).toBeDisabled();
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Success — fallbackToKeyword: false
    // ─────────────────────────────────────────────────────────────────────────

    describe('success with fallbackToKeyword: false', () => {
        it('navigates to /[locale]/alojamientos/ with serialized mappedParams', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(
                buildSuccessResult({ mappedParams: { type: 'CABIN', hasPool: 'true' } })
            );
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña con pileta');
            clickSubmit();

            await waitFor(() => {
                expect(window.location.href).toContain('/es/alojamientos/');
                expect(window.location.href).toContain('type=CABIN');
                expect(window.location.href).toContain('hasPool=true');
            });
        });

        it('writes mappedParams JSON to sessionStorage.ai_search_chips', async () => {
            const mappedParams = { type: 'CABIN', hasPool: 'true' };
            vi.mocked(apiClient.postProtected).mockResolvedValue(
                buildSuccessResult({ mappedParams })
            );
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña con pileta');
            clickSubmit();

            await waitFor(() => {
                const stored = sessionStorage.getItem('ai_search_chips');
                expect(stored).not.toBeNull();
                expect(JSON.parse(stored ?? '{}')).toEqual(mappedParams);
            });
        });

        it('navigation URL uses locale from props', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(
                buildSuccessResult({ mappedParams: { type: 'HOTEL' } })
            );
            render(
                <AiSearchPanel
                    locale="pt"
                    isAuthenticated={true}
                    currentUrl="/pt/alojamentos/"
                />
            );
            openPanel();
            typeQuery('hotel');
            clickSubmit();

            await waitFor(() => {
                expect(window.location.href).toContain('/pt/alojamientos/');
            });
        });

        it('navigates to /[locale]/alojamientos/ without params when mappedParams is empty', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(
                buildSuccessResult({ mappedParams: {} })
            );
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('alojamiento');
            clickSubmit();

            await waitFor(() => {
                expect(window.location.href).toBe('/es/alojamientos/');
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Success — fallbackToKeyword: true
    // ─────────────────────────────────────────────────────────────────────────

    describe('success with fallbackToKeyword: true', () => {
        it('navigates with q=<rawQuery> when fallbackToKeyword is true', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(
                buildSuccessResult({
                    fallbackToKeyword: true,
                    rawQuery: 'algún lugar lindo',
                    confidence: 0.3
                })
            );
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('algún lugar lindo');
            clickSubmit();

            await waitFor(() => {
                expect(window.location.href).toContain(
                    `q=${encodeURIComponent('algún lugar lindo')}`
                );
            });
        });

        it('does NOT write to sessionStorage.ai_search_chips on keyword fallback', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(
                buildSuccessResult({ fallbackToKeyword: true, rawQuery: 'anything' })
            );
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('anything');
            clickSubmit();

            await waitFor(() => {
                expect(window.location.href).toContain('q=');
            });
            expect(sessionStorage.getItem('ai_search_chips')).toBeNull();
        });

        it('shows the fallback notice in the panel after low-confidence response', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(
                buildSuccessResult({
                    fallbackToKeyword: true,
                    rawQuery: 'no idea',
                    confidence: 0.1
                })
            );
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('no idea');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByText(/no pudimos interpretar/i)).toBeInTheDocument();
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Error — 403 quota / entitlement
    // ─────────────────────────────────────────────────────────────────────────

    describe('403 response (quota exhausted)', () => {
        it('shows an alert with the quota-exhausted message', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(403));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel para 2');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
            expect(screen.getByRole('alert').textContent).toMatch(/límite mensual/i);
        });

        it('renders an upgrade CTA link inside the alert', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(403));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel para 2');
            clickSubmit();

            await waitFor(() => {
                const ctaLink = screen.getByRole('link', { name: /ver planes/i });
                expect(ctaLink).toBeInTheDocument();
                expect(ctaLink).toHaveAttribute('href', expect.stringContaining('/planes/'));
            });
        });

        it('does NOT navigate after 403 (no window.location.href change)', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(403));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel para 2');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
            expect(window.location.href).toBe('');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Error — 429 rate limit
    // ─────────────────────────────────────────────────────────────────────────

    describe('429 response (rate limit)', () => {
        it('shows the rate-limit alert message', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(429));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña para 4');
            clickSubmit();

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toBeInTheDocument();
                expect(alert.textContent).toMatch(/demasiadas/i);
            });
        });

        it('does NOT navigate after 429', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(429));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
            expect(window.location.href).toBe('');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Error — network / service unavailable (status 0)
    // ─────────────────────────────────────────────────────────────────────────

    describe('network error (status 0)', () => {
        it('shows service-error message in an alert', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(0));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña con pileta');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
            expect(screen.getByRole('alert').textContent).toMatch(/no está disponible/i);
        });

        it('shows keyword fallback CTA button inside the alert', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(0));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña con pileta');
            clickSubmit();

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /buscar por palabras clave/i })
                ).toBeInTheDocument();
            });
        });

        it('clicking keyword fallback CTA navigates with q=<query>', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(0));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña con pileta');
            clickSubmit();

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /buscar por palabras clave/i })
                ).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /buscar por palabras clave/i }));

            expect(window.location.href).toContain(`q=${encodeURIComponent('cabaña con pileta')}`);
        });

        it('502 response also triggers network error path', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(502));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByRole('alert').textContent).toMatch(/no está disponible/i);
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Panel state reset on close
    // ─────────────────────────────────────────────────────────────────────────

    describe('panel state reset on close', () => {
        it('reopening the panel after error shows clean state (no alert)', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue(buildErrorResult(429));
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('hotel');
            clickSubmit();

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            // Close
            fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            // Reopen
            openPanel();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('reopening the panel shows empty textarea', async () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña');

            // Close and reopen
            fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
            openPanel();

            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveValue('');
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Input surface (NlSearchInput integration)
    // ─────────────────────────────────────────────────────────────────────────

    describe('NlSearchInput integration', () => {
        it('submit button is disabled when textarea is empty', () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            expect(screen.getByRole('button', { name: /buscar/i })).toBeDisabled();
        });

        it('submit button is enabled once text is entered', () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña');
            expect(screen.getByRole('button', { name: /buscar/i })).not.toBeDisabled();
        });

        it('submit button is disabled again after clearing text', () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('cabaña');
            typeQuery('');
            expect(screen.getByRole('button', { name: /buscar/i })).toBeDisabled();
        });

        it('shows character count updating as user types', () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            typeQuery('abc');
            expect(screen.getByText('3/500')).toBeInTheDocument();
        });

        it('shows 0/500 initially', () => {
            render(
                <AiSearchPanel
                    {...DEFAULT_PROPS}
                    isAuthenticated={true}
                />
            );
            openPanel();
            expect(screen.getByText('0/500')).toBeInTheDocument();
        });
    });
});
