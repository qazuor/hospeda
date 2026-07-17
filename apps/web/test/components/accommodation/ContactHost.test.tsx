/**
 * @file ContactHost.test.tsx
 * @description Unit tests for the ContactHost React island.
 * Tests all three rendering modes, accessibility features, and error paths.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactHost } from '../../../src/components/accommodation/ContactHost.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (params && fallback) {
                return Object.entries(params).reduce(
                    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
                    fallback
                );
            }
            return fallback ?? _key;
        },
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path }: { locale: string; path?: string }) => `/${locale}/${path ?? ''}/`
}));

vi.mock('../../../src/components/accommodation/ContactHost.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/shared/feedback/LoadingButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_META = {
    type: 'CABIN',
    destinationId: 'dest-colon',
    destinationName: 'Colón',
    price: 12000,
    currency: 'ARS',
    ownerId: 'owner-9'
} as const;

const ACTIVE_ACCOMMODATION = {
    id: 'acc-001',
    lifecycleState: 'ACTIVE' as const,
    deletedAt: null,
    ...ACCOMMODATION_META
};

const INACTIVE_ACCOMMODATION = {
    id: 'acc-001',
    lifecycleState: 'ARCHIVED' as const,
    deletedAt: null,
    ...ACCOMMODATION_META
};

const DELETED_ACCOMMODATION = {
    id: 'acc-001',
    lifecycleState: 'ACTIVE' as const,
    deletedAt: '2024-01-01T00:00:00Z',
    ...ACCOMMODATION_META
};

const CURRENT_USER = { id: 'user-001', name: 'Ana', email: 'ana@example.com' };

const LOCALE = 'es' as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContactHost', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // Mode determination
    // -------------------------------------------------------------------------

    describe('rendering modes', () => {
        it('Mode A: renders 4 fields when no currentUser prop', () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            expect(screen.getByLabelText(/name/i, { exact: false })).toBeInTheDocument();
            expect(screen.getByLabelText(/email/i, { exact: false })).toBeInTheDocument();
            expect(screen.getByLabelText(/phone/i, { exact: false })).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: /message/i })).toBeInTheDocument();
        });

        it('Mode B: renders only message field when currentUser set and no existingConversationId', () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={CURRENT_USER}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            // Name and email inputs should NOT be present
            expect(screen.queryByLabelText(/name/i, { exact: false })).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/email/i, { exact: false })).not.toBeInTheDocument();
            // But message textarea should be present
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('Mode C: renders view-existing link when existingConversationId is set', () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={CURRENT_USER}
                    existingConversationId="conv-999"
                    locale={LOCALE}
                />
            );
            const link = screen.getByRole('link');
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('href', expect.stringContaining('conv-999'));
        });

        it('does NOT render when lifecycleState is not ACTIVE', () => {
            const { container } = render(
                <ContactHost
                    accommodation={INACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            expect(container.firstChild).toBeNull();
        });

        it('does NOT render when accommodation.deletedAt is set', () => {
            const { container } = render(
                <ContactHost
                    accommodation={DELETED_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // Character counter + submit disable
    // -------------------------------------------------------------------------

    describe('character counter', () => {
        it('shows character counter on message field', () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            // The char count span has aria-live="polite"
            const counter = document.querySelector('[aria-live="polite"]');
            expect(counter).toBeInTheDocument();
        });

        it('disables submit button when message exceeds 5000 characters', () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            const textarea = screen.getByRole('textbox', { name: /message/i });
            const longMessage = 'a'.repeat(5001);
            fireEvent.change(textarea, { target: { value: longMessage } });

            const submitBtn = screen.getByRole('button');
            expect(submitBtn).toBeDisabled();
        });

        it('enables submit button when all required fields filled and under limit', () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            const submitBtn = screen.getByRole('button');
            expect(submitBtn).not.toBeDisabled();
        });
    });

    // -------------------------------------------------------------------------
    // Error paths
    // -------------------------------------------------------------------------

    describe('422 content blocked path', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 422,
                    headers: { get: () => null },
                    json: async () => ({ error: { reason: 'MESSAGE_CONTENT_BLOCKED' } })
                })
            );
        });

        it('shows inline error under message field and does NOT clear form', async () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            const nameInput = screen.getByLabelText(/name/i, { exact: false });
            const emailInput = screen.getByLabelText(/email/i, { exact: false });
            const messageInput = screen.getByRole('textbox', { name: /message/i });

            fireEvent.change(nameInput, { target: { value: 'Ana' } });
            fireEvent.change(emailInput, { target: { value: 'ana@test.com' } });
            fireEvent.change(messageInput, { target: { value: 'bad content' } });

            const form = document.querySelector('form')!;
            await act(async () => {
                fireEvent.submit(form);
            });

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            // Form should NOT be cleared
            expect(messageInput).toHaveValue('bad content');
            expect(nameInput).toHaveValue('Ana');
        });
    });

    describe('429 rate limit path', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 429,
                    headers: { get: (key: string) => (key === 'Retry-After' ? '30' : null) },
                    json: async () => ({ error: { reason: 'RATE_LIMIT_EXCEEDED' } })
                })
            );
        });

        it('shows retry-after countdown on 429 response', async () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'test message' }
            });

            const form = document.querySelector('form')!;
            await act(async () => {
                fireEvent.submit(form);
            });

            await waitFor(() => {
                // Should show rate limit message with countdown
                const alert = screen.getByRole('alert');
                expect(alert).toBeInTheDocument();
                expect(alert.textContent).toMatch(/30s/);
            });
        });
    });

    describe('409 duplicate conversation path', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 409,
                    headers: { get: () => null },
                    json: async () => ({ error: { reason: 'CONVERSATION_DUPLICATE' } })
                })
            );
        });

        it('shows duplicate notice with request-access button', async () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'test message' }
            });

            const form = document.querySelector('form')!;
            await act(async () => {
                fireEvent.submit(form);
            });

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toBeInTheDocument();
                // Should show a secondary "request access" button (second button after submit)
                const buttons = screen.getAllByRole('button');
                expect(buttons.length).toBeGreaterThan(0);
            });
        });
    });

    // -------------------------------------------------------------------------
    // HOS-190 slice 3: mislabeled-error bug fix. Three catch-alls used to
    // show "conversation not found" for ANY failure (uncategorized 4xx/5xx,
    // and even a network failure with no response at all). Now they resolve
    // a status/reason-appropriate message via resolveInitiateFailureMessage,
    // falling back to a generic "message send failed" — never the specific
    // "not found" text unless the response was actually a 404.
    // -------------------------------------------------------------------------

    describe('generic failure message (HOS-190 bug fix — was mislabeled "conversation not found")', () => {
        it('Mode A: shows the generic messageSendFailed text (NOT conversationNotFound) for an uncategorized 400', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 400,
                    headers: { get: () => null },
                    json: async () => ({ error: { code: 'VALIDATION_ERROR', message: 'bad' } })
                })
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert.textContent).toBe('conversations.errors.messageSendFailed');
                expect(alert.textContent).not.toBe('conversations.errors.conversationNotFound');
            });
        });

        it('Mode B: shows the generic messageSendFailed text (NOT conversationNotFound) for a 500 response', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 500,
                    headers: { get: () => null },
                    json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'boom' } })
                })
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={CURRENT_USER}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Hola, me interesa' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert.textContent).toBe('conversations.errors.messageSendFailed');
                expect(alert.textContent).not.toBe('conversations.errors.conversationNotFound');
            });
        });

        it('still shows conversationNotFound for an actual 404 (accommodation truly gone)', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 404,
                    headers: { get: () => null },
                    json: async () => ({ error: { code: 'NOT_FOUND' } })
                })
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                expect(screen.getByRole('alert').textContent).toBe(
                    'conversations.errors.conversationNotFound'
                );
            });
        });

        it('Mode A: shows the generic messageSendFailed text (NOT conversationNotFound) on a network failure', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert.textContent).toBe('conversations.errors.messageSendFailed');
                expect(alert.textContent).not.toBe('conversations.errors.conversationNotFound');
            });
        });
    });

    // -------------------------------------------------------------------------
    // HOS-190 slice 3: client-side validation for the anonymous (Mode A) form,
    // against CreateConversationAnonSchema. Previously guestEmail only checked
    // non-empty, so a syntactically invalid email reached the network.
    // -------------------------------------------------------------------------

    describe('client-side validation (HOS-190)', () => {
        it('blocks submit and shows a field error for an invalid guestEmail format, without calling fetch', async () => {
            const fetchSpy = vi.fn();
            vi.stubGlobal('fetch', fetchSpy);

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'not-an-email' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                expect(document.getElementById('guestEmail-error')).toBeInTheDocument();
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('clears the guestEmail field error once the user fixes the format', async () => {
            vi.stubGlobal('fetch', vi.fn());

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            const emailInput = screen.getByLabelText(/email/i, { exact: false });
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });
            await waitFor(() => {
                expect(document.getElementById('guestEmail-error')).toBeInTheDocument();
            });

            fireEvent.change(emailInput, { target: { value: 'ana@test.com' } });
            expect(document.getElementById('guestEmail-error')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // initialMessage prop (search context handoff from listing)
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // T-011 (SPEC-228): aria-busy, Spinner on submit, requestAccess guard
    // -------------------------------------------------------------------------

    describe('T-011 — submit loading state (SPEC-228)', () => {
        it('T-011: submit button has aria-busy=true while submitting', async () => {
            // Arrange: never-resolving fetch so we stay in the submitting phase
            vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, me interesa' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            const submitBtn = screen.getByRole('button');
            expect(submitBtn).toHaveAttribute('aria-busy', 'true');
        });

        it('T-011: submit button shows Spinner (not "...") while submitting', async () => {
            vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, me interesa' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            // Must not show literal '...' text
            expect(document.body.textContent).not.toContain('...');
            // Spinner (decorative, no label) renders with aria-hidden="true" and class "spinner"
            const spinnerEl = document.querySelector('[aria-hidden="true"].spinner');
            expect(spinnerEl).toBeInTheDocument();
        });

        it('T-011: submit button shows label text "Enviando…" while submitting', async () => {
            vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, me interesa' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            expect(screen.getByText('Enviando…')).toBeInTheDocument();
        });
    });

    describe('T-011 — requestAccess double-submit guard (SPEC-228)', () => {
        it('T-011: requestAccess button shows loading state while in-flight', async () => {
            // First set up duplicate state
            vi.stubGlobal(
                'fetch',
                vi
                    .fn()
                    // First call: submit form → 409 duplicate
                    .mockResolvedValueOnce({
                        ok: false,
                        status: 409,
                        headers: { get: () => null },
                        json: async () => ({ error: { reason: 'CONVERSATION_DUPLICATE' } })
                    })
                    // Second call: requestAccess → deferred (never resolves, so we stay in loading)
                    .mockReturnValueOnce(new Promise(() => {}))
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            // Fill and submit form to get to duplicate state
            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            // Wait for duplicate notice to appear
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            // Click requestAccess button (second button in DOM)
            const buttons = screen.getAllByRole('button');
            const requestAccessBtn = buttons.find((b) =>
                b.textContent?.includes('conversations.actions.requestAccess')
            );
            expect(requestAccessBtn).toBeTruthy();

            await act(async () => {
                fireEvent.click(requestAccessBtn!);
            });

            // Assert: button now shows loading state
            await waitFor(() => {
                expect(screen.getByText('Solicitando…')).toBeInTheDocument();
            });
            const loadingBtn = screen.getByRole('button', { name: /Solicitando/i });
            expect(loadingBtn).toBeDisabled();
            expect(loadingBtn).toHaveAttribute('aria-busy', 'true');
        });
    });

    describe('initialMessage prop', () => {
        it('Mode A: pre-fills the message textarea when initialMessage is provided', () => {
            const prefilled =
                'Hola, me interesa este alojamiento. Estoy mirando del 1 al 7 de junio.';
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                    initialMessage={prefilled}
                />
            );
            const textarea = screen.getByRole('textbox', {
                name: /message/i
            }) as HTMLTextAreaElement;
            expect(textarea.value).toBe(prefilled);
        });

        it('Mode B: pre-fills the message textarea when initialMessage is provided and user is authenticated', () => {
            const prefilled = 'Hola, me interesa. Somos 2 adultos.';
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={CURRENT_USER}
                    existingConversationId={null}
                    locale={LOCALE}
                    initialMessage={prefilled}
                />
            );
            const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
            expect(textarea.value).toBe(prefilled);
        });

        it('leaves the textarea empty when initialMessage is undefined', () => {
            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );
            const textarea = screen.getByRole('textbox', {
                name: /message/i
            }) as HTMLTextAreaElement;
            expect(textarea.value).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // PostHog analytics — booking_request_sent (fires only on success)
    // -------------------------------------------------------------------------

    describe('booking_request_sent analytics event', () => {
        let captureSpy: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            captureSpy = vi.fn();
            (window as unknown as { posthog: { capture: typeof captureSpy } }).posthog = {
                capture: captureSpy
            };
            // JSDOM blocks direct assignment to window.location.href — stub it
            // so Mode B's redirect on success doesn't throw.
            Object.defineProperty(window, 'location', {
                value: { href: '' },
                writable: true,
                configurable: true
            });
        });

        afterEach(() => {
            (window as unknown as { posthog?: unknown }).posthog = undefined;
        });

        it('Mode A: fires booking_request_sent on successful anonymous send', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    json: async () => ({ data: { status: 'PENDING_VERIFICATION' } })
                })
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                expect(
                    captureSpy.mock.calls.some((call) => call[0] === 'booking_request_sent')
                ).toBe(true);
            });
            const bookingRequestCall = captureSpy.mock.calls.find(
                (call) => call[0] === 'booking_request_sent'
            );
            expect(bookingRequestCall?.[1]).toEqual({
                accommodation_id: ACTIVE_ACCOMMODATION.id,
                accommodation_type: 'CABIN',
                destination_id: 'dest-colon',
                destination_name: 'Colón',
                price: 12000,
                currency: 'ARS',
                owner_id: 'owner-9',
                is_authenticated: false,
                locale: LOCALE
            });
        });

        it('Mode B: fires booking_request_sent when an authenticated conversation is created', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    json: async () => ({ data: { conversationId: 'conv-123' } })
                })
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={CURRENT_USER}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            fireEvent.change(screen.getByRole('textbox'), {
                target: { value: 'Hola, me interesa' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                expect(
                    captureSpy.mock.calls.some((call) => call[0] === 'booking_request_sent')
                ).toBe(true);
            });
            const bookingRequestCall = captureSpy.mock.calls.find(
                (call) => call[0] === 'booking_request_sent'
            );
            expect(bookingRequestCall?.[1]).toEqual({
                accommodation_id: ACTIVE_ACCOMMODATION.id,
                accommodation_type: 'CABIN',
                destination_id: 'dest-colon',
                destination_name: 'Colón',
                price: 12000,
                currency: 'ARS',
                owner_id: 'owner-9',
                is_authenticated: true,
                locale: LOCALE
            });
        });

        it('does NOT fire booking_request_sent on a 409 duplicate response', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 409,
                    headers: { get: () => null },
                    json: async () => ({ error: { reason: 'CONVERSATION_DUPLICATE' } })
                })
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });

            expect(captureSpy.mock.calls.some((call) => call[0] === 'booking_request_sent')).toBe(
                false
            );

            // Instead it fires conversation_duplicate with the enriched props.
            const duplicateCall = captureSpy.mock.calls.find(
                (call) => call[0] === 'conversation_duplicate'
            );
            expect(duplicateCall?.[1]).toEqual({
                accommodation_id: ACTIVE_ACCOMMODATION.id,
                accommodation_type: 'CABIN',
                destination_id: 'dest-colon',
                destination_name: 'Colón',
                price: 12000,
                currency: 'ARS',
                owner_id: 'owner-9',
                is_authenticated: false,
                locale: LOCALE
            });
        });

        it('fires conversation_rate_limited on a 429 response with retry_after', async () => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: false,
                    status: 429,
                    headers: { get: (name: string) => (name === 'Retry-After' ? '90' : null) },
                    json: async () => ({})
                })
            );

            render(
                <ContactHost
                    accommodation={ACTIVE_ACCOMMODATION}
                    currentUser={null}
                    existingConversationId={null}
                    locale={LOCALE}
                />
            );

            fireEvent.change(screen.getByLabelText(/name/i, { exact: false }), {
                target: { value: 'Ana' }
            });
            fireEvent.change(screen.getByLabelText(/email/i, { exact: false }), {
                target: { value: 'ana@test.com' }
            });
            fireEvent.change(screen.getByRole('textbox', { name: /message/i }), {
                target: { value: 'Hola, quiero reservar' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form')!);
            });

            await waitFor(() => {
                expect(
                    captureSpy.mock.calls.some((call) => call[0] === 'conversation_rate_limited')
                ).toBe(true);
            });
            const rateLimitedCall = captureSpy.mock.calls.find(
                (call) => call[0] === 'conversation_rate_limited'
            );
            expect(rateLimitedCall?.[1]).toEqual({
                accommodation_id: ACTIVE_ACCOMMODATION.id,
                accommodation_type: 'CABIN',
                destination_id: 'dest-colon',
                destination_name: 'Colón',
                price: 12000,
                currency: 'ARS',
                owner_id: 'owner-9',
                is_authenticated: false,
                retry_after: 90,
                locale: LOCALE
            });
            expect(captureSpy.mock.calls.some((call) => call[0] === 'booking_request_sent')).toBe(
                false
            );
        });
    });
});
