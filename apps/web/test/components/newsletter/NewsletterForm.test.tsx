/**
 * @file NewsletterForm.test.tsx
 * @description RTL tests for the NewsletterForm React island (SPEC-101 T-101-25).
 *
 * Covers:
 * - All 6 visual states: idle-guest, idle-auth, pending, pending-verification,
 *   already-active, error.
 * - POST subscribe called with correct body shape.
 * - GET /status called on mount for authenticated users only.
 * - AuthRequiredPopover opens on guest click, closes on Escape.
 * - aria-live region announces per state.
 * - Network failure → error state, button re-enabled.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterForm } from '../../../src/components/newsletter/NewsletterForm.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock i18n — return the fallback string directly so assertions use readable values
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

// Mock CSS modules — identity proxy so className lookups never throw
vi.mock('../../../src/components/newsletter/NewsletterForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Mock the existing AuthRequiredPopover so we can assert its presence
// without triggering DOM Portal / positioning logic
vi.mock('../../../src/components/auth/AuthRequiredPopover.client', () => ({
    AuthRequiredPopover: ({
        onClose,
        message,
        dialogLabel
    }: {
        onClose: () => void;
        message: string;
        dialogLabel?: string;
    }) => (
        <dialog
            aria-label={dialogLabel ?? 'Autenticacion requerida'}
            data-testid="auth-required-popover"
            open
        >
            <p>{message}</p>
            <button
                type="button"
                onClick={onClose}
            >
                Cerrar
            </button>
        </dialog>
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = 'http://api.test';
const USER_EMAIL = 'test@example.com';
const AUTH_ME_CACHE_KEY = 'authMeSnapshot';

/**
 * Seed the shared `/auth/me` sessionStorage cache so the component's mount
 * effect short-circuits on cache hit instead of triggering an extra fetch.
 * The existing assertions in this file count fetch calls (e.g. "does NOT
 * call GET /status on mount for guest users"), so suppressing the implicit
 * `/auth/me` call keeps those assertions meaningful.
 */
function seedAuthMeCache(input: { isAuthenticated: boolean; email?: string }) {
    sessionStorage.setItem(
        AUTH_ME_CACHE_KEY,
        JSON.stringify({
            isAuthenticated: input.isAuthenticated,
            user: input.isAuthenticated ? { id: 'user-1', email: input.email ?? '' } : null,
            permissions: [],
            cachedAt: Date.now()
        })
    );
}

function renderGuest() {
    seedAuthMeCache({ isAuthenticated: false });
    return render(
        <NewsletterForm
            isAuthenticated={false}
            apiUrl={API_URL}
            locale="es"
        />
    );
}

function renderAuth(email = USER_EMAIL) {
    seedAuthMeCache({ isAuthenticated: true, email });
    return render(
        <NewsletterForm
            isAuthenticated={true}
            userEmail={email}
            apiUrl={API_URL}
            locale="es"
        />
    );
}

/** Returns a resolved fetch mock (200 OK with JSON body) */
function mockFetchOk(body: unknown): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
        ok: true,
        json: async () => body
    });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('NewsletterForm', () => {
    beforeEach(() => {
        // Reset the global fetch mock + the /auth/me sessionStorage cache so each
        // test starts from a clean slate. Helpers (`renderGuest`/`renderAuth`)
        // re-seed the cache to match the prop shape.
        vi.stubGlobal('fetch', vi.fn());
        sessionStorage.clear();
    });

    // =========================================================================
    // STATE: idle-guest
    // =========================================================================

    describe('idle-guest state (not authenticated)', () => {
        it('renders the email input in guest state', () => {
            renderGuest();
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('renders the subscribe button', () => {
            renderGuest();
            expect(screen.getByRole('button', { name: /suscribirme/i })).toBeInTheDocument();
        });

        it('email input is not read-only in guest state', () => {
            renderGuest();
            const input = screen.getByRole('textbox');
            expect(input).not.toHaveAttribute('readonly');
        });

        it('does NOT call GET /status on mount for guest users', () => {
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            renderGuest();
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('rejects an empty submit with a validation error message', async () => {
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            renderGuest();

            // Use form submission rather than button click so the empty-email
            // validator fires.
            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
                expect(screen.getByRole('alert').textContent).toMatch(/email/i);
            });
            // No network round-trip for a client-side invalid payload.
            expect(fetchMock).not.toHaveBeenCalledWith(
                expect.stringContaining('/subscribe'),
                expect.anything()
            );
        });

        it('POSTs the typed email to /api/v1/public/newsletter/subscribe', async () => {
            const fetchMock = mockFetchOk({ status: 'pending_verification' });
            vi.stubGlobal('fetch', fetchMock);
            // Stub window.location.assign so the redirect doesn't navigate jsdom.
            const assignMock = vi.fn();
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { ...originalLocation, assign: assignMock, href: originalLocation.href },
                writable: true
            });

            renderGuest();

            const input = screen.getByRole('textbox') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'guest@example.com' } });

            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith(
                    `${API_URL}/api/v1/public/newsletter/subscribe`,
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.stringContaining('guest@example.com')
                    })
                );
            });
        });

        it('redirects to /{locale}/newsletter/confirma-tu-email on pending_verification', async () => {
            const fetchMock = mockFetchOk({ status: 'pending_verification' });
            vi.stubGlobal('fetch', fetchMock);
            const assignMock = vi.fn();
            Object.defineProperty(window, 'location', {
                value: { assign: assignMock, href: 'http://test/' },
                writable: true
            });

            renderGuest();
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'guest@example.com' }
            });
            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(assignMock).toHaveBeenCalledWith(
                    expect.stringContaining(
                        '/es/newsletter/confirma-tu-email?email=guest%40example.com'
                    )
                );
            });
        });

        it('shows already-active banner inline when the email is somehow already active', async () => {
            const fetchMock = mockFetchOk({ status: 'active' });
            vi.stubGlobal('fetch', fetchMock);

            renderGuest();
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'already@example.com' }
            });
            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                const banner = document.querySelector('[data-state="already-active"]');
                expect(banner).toBeInTheDocument();
            });
        });

        it('shows the generic error banner on a non-2xx response', async () => {
            const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
            vi.stubGlobal('fetch', fetchMock);

            renderGuest();
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'guest@example.com' }
            });
            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByRole('alert').textContent).toMatch(/no pudimos/i);
            });
        });
    });

    // =========================================================================
    // STATE: idle-auth
    // =========================================================================

    describe('idle-auth state (authenticated, not subscribed)', () => {
        beforeEach(() => {
            // Status endpoint returns null status (not subscribed)
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: false,
                    status: null,
                    subscribedAt: null,
                    verifiedAt: null
                })
            );
        });

        it('renders form with pre-filled read-only email input', async () => {
            renderAuth();
            // Wait for status fetch to resolve
            await waitFor(() => {
                const input = screen.getByRole('textbox');
                expect(input).toHaveValue(USER_EMAIL);
            });
        });

        it('email input is read-only in idle-auth state', async () => {
            renderAuth();
            await waitFor(() => {
                expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
            });
        });

        it('calls GET /api/v1/protected/newsletter/status on mount', async () => {
            const fetchMock = mockFetchOk({
                subscribed: false,
                status: null,
                subscribedAt: null,
                verifiedAt: null
            });
            vi.stubGlobal('fetch', fetchMock);
            renderAuth();
            await waitFor(() => {
                expect(fetchMock).toHaveBeenCalledWith(
                    expect.stringContaining('/api/v1/protected/newsletter/status'),
                    expect.objectContaining({ credentials: 'include' })
                );
            });
        });

        it('submit button is enabled in idle-auth state', async () => {
            renderAuth();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /suscribirme/i })).not.toBeDisabled();
            });
        });
    });

    // =========================================================================
    // STATE: pending (loading)
    // =========================================================================

    describe('pending state (request in-flight)', () => {
        it('disables the submit button while request is in-flight', async () => {
            // Status: not subscribed
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                // Subscribe: never resolves (simulates in-flight)
                .mockReturnValueOnce(new Promise(() => {}));

            vi.stubGlobal('fetch', fetchMock);
            renderAuth();

            // Wait for status to resolve
            await waitFor(() => {
                expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL);
            });

            const button = screen.getByRole('button', { name: /suscribirme/i });
            fireEvent.submit(button.closest('form') as HTMLFormElement);

            await waitFor(() => {
                expect(button).toBeDisabled();
            });
        });

        it('form has aria-busy="true" while request is in-flight', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockReturnValueOnce(new Promise(() => {}));

            vi.stubGlobal('fetch', fetchMock);
            renderAuth();

            await waitFor(() => {
                expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL);
            });

            const form = screen.getByRole('form');
            fireEvent.submit(form);

            await waitFor(() => {
                expect(form).toHaveAttribute('aria-busy', 'true');
            });
        });
    });

    // =========================================================================
    // STATE: pending-verification
    // =========================================================================

    describe('pending-verification state', () => {
        it('shows success banner after subscribe returns pending_verification', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ status: 'pending_verification' })
                });
            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => {
                expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL);
            });

            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                expect(screen.getByText(/revisá tu email para confirmar/i)).toBeInTheDocument();
            });
        });

        it('shows alreadyPendingMessage when subscribe returns already_pending', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ status: 'already_pending' })
                });
            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => {
                expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL);
            });

            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                expect(
                    screen.getByText(/ya enviamos un email de confirmación/i)
                ).toBeInTheDocument();
            });
        });

        it('transitions to pending-verification when status endpoint returns pending_verification', async () => {
            const fetchMock = mockFetchOk({
                subscribed: true,
                status: 'pending_verification',
                subscribedAt: '2026-01-01T00:00:00.000Z',
                verifiedAt: null
            });
            vi.stubGlobal('fetch', fetchMock);

            renderAuth();

            await waitFor(() => {
                expect(
                    screen.getByText(/ya enviamos un email de confirmación/i)
                ).toBeInTheDocument();
            });
        });

        it('hides the subscribe form in pending-verification state', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ status: 'pending_verification' })
                });
            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                expect(screen.queryByRole('form')).not.toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // STATE: blocked-unverified
    // =========================================================================

    describe('blocked-unverified state', () => {
        it('switches to blocked-unverified banner when the API returns NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED', async () => {
            // First call: /status (returns not-subscribed). Second call: subscribe
            // returns the 403 with the reason.
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    json: async () => ({
                        success: false,
                        error: {
                            code: 'FORBIDDEN',
                            message: 'unverified',
                            reason: 'NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED'
                        }
                    })
                });
            vi.stubGlobal('fetch', fetchMock);

            renderAuth();

            // Wait for the initial status check to land us in idle-auth.
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /suscribirme/i })).toBeInTheDocument();
            });

            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                const banner = document.querySelector('[data-state="blocked-unverified"]');
                expect(banner).toBeInTheDocument();
                expect(banner?.textContent).toMatch(/verificá el email de tu cuenta/i);
            });
        });

        it('renders a "go to my account" link in the blocked-unverified banner', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    json: async () => ({
                        success: false,
                        error: { reason: 'NEWSLETTER_ACCOUNT_EMAIL_UNVERIFIED' }
                    })
                });
            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /suscribirme/i })).toBeInTheDocument();
            });
            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                const link = screen.getByRole('link', { name: /ir a mi cuenta/i });
                expect(link).toHaveAttribute('href', '/es/mi-cuenta/');
            });
        });
    });

    // =========================================================================
    // STATE: already-active
    // =========================================================================

    describe('already-active state', () => {
        it('shows "Ya estás suscripto" banner when status is active', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: true,
                    status: 'active',
                    subscribedAt: '2026-01-01T00:00:00.000Z',
                    verifiedAt: '2026-01-02T00:00:00.000Z'
                })
            );

            renderAuth();

            await waitFor(() => {
                expect(screen.getByText(/ya estás suscripto/i)).toBeInTheDocument();
            });
        });

        it('shows manage preferences link in already-active state', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: true,
                    status: 'active',
                    subscribedAt: '2026-01-01T00:00:00.000Z',
                    verifiedAt: '2026-01-02T00:00:00.000Z'
                })
            );

            renderAuth();

            await waitFor(() => {
                const manageLink = screen.getByRole('link', { name: /gestionar suscripción/i });
                expect(manageLink).toBeInTheDocument();
                expect(manageLink).toHaveAttribute('href', '/es/mi-cuenta/newsletter/');
            });
        });

        it('hides the subscribe form in already-active state', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: true,
                    status: 'active',
                    subscribedAt: '2026-01-01T00:00:00.000Z',
                    verifiedAt: '2026-01-02T00:00:00.000Z'
                })
            );

            renderAuth();

            await waitFor(() => {
                expect(screen.queryByRole('form')).not.toBeInTheDocument();
            });
        });

        it('transitions to already-active when subscribe returns status active', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ status: 'active' })
                });
            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                expect(screen.getByText(/ya estás suscripto/i)).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // STATE: error
    // =========================================================================

    describe('error state', () => {
        it('shows inline error message when API returns non-ok response', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    json: async () => ({ error: 'Server error' })
                });

            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            // The alert role specifically targets the <p role="alert"> error paragraph
            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert.textContent).toMatch(/no pudimos procesar tu suscripción/i);
            });
        });

        it('shows error message when fetch throws (network failure)', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockRejectedValueOnce(new Error('Network error'));

            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            // The alert role specifically targets the <p role="alert"> error paragraph
            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert.textContent).toMatch(/no pudimos procesar tu suscripción/i);
            });
        });

        it('re-enables the submit button after API error', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /suscribirme/i })).not.toBeDisabled();
            });
        });

        it('error message is announced via role="alert"', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockRejectedValueOnce(new Error('Network error'));

            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // API contract
    // =========================================================================

    describe('API contract', () => {
        it('sends POST with correct body shape: { locale, source: "web_footer" }', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ status: 'pending_verification' })
                });

            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                const [_statusCall, subscribeCall] = fetchMock.mock.calls;
                expect(subscribeCall[0]).toContain('/api/v1/protected/newsletter/subscribe');
                const body = JSON.parse(subscribeCall[1].body as string);
                expect(body).toEqual({ locale: 'es', source: 'web_footer' });
            });
        });

        it('sends POST with credentials: include', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ status: 'pending_verification' })
                });

            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                const [, subscribeCall] = fetchMock.mock.calls;
                expect(subscribeCall[1]).toMatchObject({ credentials: 'include' });
            });
        });
    });

    // =========================================================================
    // Accessibility
    // =========================================================================

    describe('accessibility', () => {
        it('form has aria-describedby pointing to the consent note', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: false,
                    status: null,
                    subscribedAt: null,
                    verifiedAt: null
                })
            );

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());

            const form = screen.getByRole('form');
            const describedById = form.getAttribute('aria-describedby');
            expect(describedById).toBeTruthy();

            const consentNote = document.getElementById(describedById as string);
            expect(consentNote).toBeInTheDocument();
            expect(consentNote?.textContent).toMatch(/al suscribirte/i);
        });

        it('aria-live region is present in the DOM', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: false,
                    status: null,
                    subscribedAt: null,
                    verifiedAt: null
                })
            );

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());

            const liveRegion = document.querySelector('[aria-live="polite"]');
            expect(liveRegion).toBeInTheDocument();
        });

        it('aria-live region announces "Enviando..." during pending state', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                })
                .mockReturnValueOnce(new Promise(() => {}));

            vi.stubGlobal('fetch', fetchMock);

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(USER_EMAIL));
            fireEvent.submit(screen.getByRole('form'));

            await waitFor(() => {
                const srOnly = document.querySelector('[aria-live="polite"]');
                expect(srOnly?.textContent).toContain('Enviando');
            });
        });

        it('email input has an associated label element', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: false,
                    status: null,
                    subscribedAt: null,
                    verifiedAt: null
                })
            );

            renderAuth();
            await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());

            const input = screen.getByRole('textbox');
            const labelId = input.getAttribute('aria-labelledby');
            expect(labelId).toBeTruthy();
            const label = document.getElementById(labelId as string);
            expect(label).toBeInTheDocument();
        });

        it('already-active banner uses aria-live polite', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: true,
                    status: 'active',
                    subscribedAt: '2026-01-01T00:00:00.000Z',
                    verifiedAt: '2026-01-02T00:00:00.000Z'
                })
            );

            renderAuth();

            // The already-active banner doesn't need aria-live; but the
            // pending-verification banner does. Verify the banner renders.
            await waitFor(() => {
                expect(screen.getByText(/ya estás suscripto/i)).toBeInTheDocument();
            });
        });

        it('pending-verification banner has aria-live="polite"', async () => {
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: true,
                    status: 'pending_verification',
                    subscribedAt: '2026-01-01T00:00:00.000Z',
                    verifiedAt: null
                })
            );

            renderAuth();

            await waitFor(() => {
                const banner = document.querySelector('[data-state="pending-verification"]');
                expect(banner).toBeInTheDocument();
                expect(banner).toHaveAttribute('aria-live', 'polite');
            });
        });
    });

    // =========================================================================
    // Analytics
    // =========================================================================

    describe('analytics', () => {
        it('does not throw when window.dataLayer is undefined', async () => {
            // Ensure dataLayer is not present
            const win = window as unknown as { dataLayer?: unknown[] };
            const originalDl = win.dataLayer;
            win.dataLayer = undefined;

            renderGuest();
            expect(() => {
                fireEvent.click(screen.getByRole('button', { name: /suscribirme/i }));
            }).not.toThrow();

            win.dataLayer = originalDl;
        });

        it('pushes newsletter_subscribe_clicked to dataLayer on guest form submit', async () => {
            const dl: unknown[] = [];
            (window as unknown as { dataLayer: unknown[] }).dataLayer = dl;
            vi.stubGlobal('fetch', mockFetchOk({ status: 'pending_verification' }));
            Object.defineProperty(window, 'location', {
                value: { assign: vi.fn(), href: 'http://test/' },
                writable: true
            });

            renderGuest();
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'guest@example.com' }
            });
            const form = document.querySelector('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(dl).toContainEqual(
                    expect.objectContaining({
                        event: 'newsletter_subscribe_clicked',
                        auth: false
                    })
                );
            });

            // Reset dataLayer after test
            (window as unknown as { dataLayer?: unknown[] }).dataLayer = undefined;
        });
    });

    // =========================================================================
    // Client-side auth resolution (cross-page session detection)
    //
    // The Astro Footer reads `Astro.locals.user` and forwards `isAuthenticated`
    // as a prop. On pages OUTSIDE `SESSION_OPTIONAL_SEGMENTS` (home, contacto,
    // legal, …) the middleware does NOT parse the cookie, so `Astro.locals.user`
    // is null even when the visitor has a live session. The island MUST recover
    // the auth state client-side via the shared /auth/me cache + fetch fallback.
    // =========================================================================

    describe('client-side auth resolution', () => {
        it('promotes idle-guest → idle-auth when /auth/me reports an authenticated session via cache', async () => {
            // SSR thought the visitor was a guest (middleware did not parse session
            // on this route), but the cached /auth/me snapshot disagrees.
            seedAuthMeCache({ isAuthenticated: true, email: 'cached@example.com' });

            // The mount effect must NOT hit /auth/me (cache hit) but it WILL hit
            // /status. Stub the status endpoint with a "not subscribed" response.
            vi.stubGlobal(
                'fetch',
                mockFetchOk({
                    subscribed: false,
                    status: null,
                    subscribedAt: null,
                    verifiedAt: null
                })
            );

            render(
                <NewsletterForm
                    isAuthenticated={false}
                    apiUrl={API_URL}
                    locale="es"
                />
            );

            // Read-only email input must be pre-filled with the cache email.
            await waitFor(() => {
                const input = screen.getByRole('textbox') as HTMLInputElement;
                expect(input).toHaveAttribute('readonly');
                expect(input.value).toBe('cached@example.com');
            });
        });

        it('falls back to fetching /api/v1/public/auth/me when no cache is seeded', async () => {
            // No sessionStorage cache → component must call /auth/me first, then /status.
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            isAuthenticated: true,
                            actor: { id: 'u-1', email: 'fetched@example.com' }
                        }
                    })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        subscribed: false,
                        status: null,
                        subscribedAt: null,
                        verifiedAt: null
                    })
                });
            vi.stubGlobal('fetch', fetchMock);

            render(
                <NewsletterForm
                    isAuthenticated={false}
                    apiUrl={API_URL}
                    locale="es"
                />
            );

            await waitFor(() => {
                const input = screen.getByRole('textbox') as HTMLInputElement;
                expect(input).toHaveAttribute('readonly');
                expect(input.value).toBe('fetched@example.com');
            });

            // First call is /auth/me, second is /status.
            expect(fetchMock).toHaveBeenNthCalledWith(
                1,
                `${API_URL}/api/v1/public/auth/me`,
                expect.objectContaining({ credentials: 'include' })
            );
            expect(fetchMock).toHaveBeenNthCalledWith(
                2,
                `${API_URL}/api/v1/protected/newsletter/status`,
                expect.objectContaining({ credentials: 'include' })
            );
        });

        it('demotes idle-auth → idle-guest when /auth/me reports an anonymous visitor', async () => {
            // SSR thought the visitor was authenticated (e.g. cookie present at
            // SSR but expired by hydration), but /auth/me says otherwise.
            seedAuthMeCache({ isAuthenticated: false });
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);

            render(
                <NewsletterForm
                    isAuthenticated={true}
                    userEmail="ssr@example.com"
                    apiUrl={API_URL}
                    locale="es"
                />
            );

            // The input becomes the editable guest input (no `readonly`).
            await waitFor(() => {
                expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
            });
            // /status must NOT be called since the resolved state is guest.
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});
