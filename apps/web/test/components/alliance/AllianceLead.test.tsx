/**
 * @file AllianceLead.test.tsx
 * @description RTL tests for the AllianceLead React island (HOS-277).
 *
 * Covers: generic + kind-specific field rendering per kind, required-field
 * validation (generic and kind-specific), honeypot presence, message
 * serialization on submit, posts to the alliance leads endpoint, success
 * state, 429 rate-limit message, and generic API errors.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllianceLead } from '../../../src/components/alliance/AllianceLead.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/alliance/AllianceLead.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const { mockReadCachedAuthMe, mockFetchAuthMe, mockWriteCachedAuthMe } = vi.hoisted(() => ({
    mockReadCachedAuthMe: vi.fn(),
    mockFetchAuthMe: vi.fn(),
    mockWriteCachedAuthMe: vi.fn()
}));

// The island resolves the visitor in the browser (HOS-278 AC-1). Mocked at the
// module boundary so the suite drives auth state without a network.
vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: mockReadCachedAuthMe,
    fetchAuthMe: mockFetchAuthMe,
    writeCachedAuthMe: mockWriteCachedAuthMe
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm(kind: 'partner' | 'sponsor' | 'service_provider' | 'editor' = 'partner') {
    return render(
        <AllianceLead
            locale="es"
            kind={kind}
        />
    );
}

async function fillGenericRequiredFields(
    overrides: Partial<{ contactName: string; email: string }> = {}
) {
    const defaults = { contactName: 'Juan Pérez', email: 'juan@example.com' };
    const values = { ...defaults, ...overrides };

    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
        target: { value: values.contactName }
    });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
        target: { value: values.email }
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AllianceLead', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        // Reset call history too, not just the return value: several assertions
        // below check that /auth/me was NOT called, and a stale count from the
        // previous test would make them pass or fail for the wrong reason.
        mockReadCachedAuthMe.mockReset();
        mockFetchAuthMe.mockReset();
        // Default: anonymous visitor, the primary case for these forms.
        mockReadCachedAuthMe.mockReturnValue(null);
        mockFetchAuthMe.mockResolvedValue({
            isAuthenticated: false,
            user: null,
            permissions: [],
            roles: [],
            cachedAt: Date.now()
        });
        mockWriteCachedAuthMe.mockReset();
    });

    // ── Render — generic fields ─────────────────────────────────────────────

    describe('Generic fields (all kinds)', () => {
        it('renders contactName input', () => {
            renderForm();
            expect(screen.getByLabelText(/tu nombre/i)).toBeInTheDocument();
        });

        it('renders email input', () => {
            renderForm();
            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('renders phone input (optional)', () => {
            renderForm();
            expect(screen.getByLabelText(/teléfono/i)).toBeInTheDocument();
        });

        it('renders the free-text message textarea (optional)', () => {
            renderForm();
            expect(screen.getByLabelText(/contanos más/i)).toBeInTheDocument();
        });

        it('renders submit button', () => {
            renderForm();
            expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeInTheDocument();
        });
    });

    // ── Render — kind-specific fields ───────────────────────────────────────

    describe('Kind-specific fields', () => {
        it('renders businessName, website, partnershipType for partner', () => {
            renderForm('partner');
            expect(screen.getByLabelText(/^businessName/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^website/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^partnershipType/i)).toBeInTheDocument();
        });

        it('renders businessName, website, sponsorshipInterest for sponsor', () => {
            renderForm('sponsor');
            expect(screen.getByLabelText(/^businessName/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^sponsorshipInterest/i)).toBeInTheDocument();
        });

        it('renders businessName, serviceType, coverageArea, website for service_provider', () => {
            renderForm('service_provider');
            expect(screen.getByLabelText(/^businessName/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^serviceType/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^coverageArea/i)).toBeInTheDocument();
        });

        it('renders portfolioLinks, topics, experience for editor — no businessName (B2C)', () => {
            renderForm('editor');
            expect(screen.getByLabelText(/^portfolioLinks/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^topics/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/^experience/i)).toBeInTheDocument();
            expect(screen.queryByLabelText(/^businessName/i)).not.toBeInTheDocument();
        });

        it('marks the website field as type="url"', () => {
            renderForm('partner');
            expect(screen.getByLabelText(/^website/i)).toHaveAttribute('type', 'url');
        });
    });

    // ── Honeypot ─────────────────────────────────────────────────────────────

    describe('Honeypot field', () => {
        it('renders a hidden _hp field', () => {
            renderForm();
            const honeypot = document.querySelector('input[name="_hp"]');
            expect(honeypot).not.toBeNull();
        });

        it('_hp field has tabIndex=-1', () => {
            renderForm();
            const honeypot = document.querySelector('input[name="_hp"]');
            expect(honeypot).toHaveAttribute('tabindex', '-1');
        });
    });

    // ── Validation ────────────────────────────────────────────────────────────

    describe('Validation errors', () => {
        it('shows validation alerts and does not call fetch when submitted empty', async () => {
            renderForm('partner');
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('shows a required error on the kind-specific businessName field for partner', async () => {
            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/^businessName/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('does not require businessName for editor', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
        });

        it('shows email error for invalid email', async () => {
            renderForm('editor');
            fireEvent.change(screen.getByLabelText(/tu nombre/i), {
                target: { value: 'Juan Pérez' }
            });
            fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
                target: { value: 'not-valid-email' }
            });
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
                    'aria-invalid',
                    'true'
                );
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('rejects a malformed website URL', async () => {
            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia' }
            });
            fireEvent.change(screen.getByLabelText(/^website/i), {
                target: { value: 'not-a-url' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/^website/i)).toHaveAttribute('aria-invalid', 'true');
            });
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    // ── Submission ────────────────────────────────────────────────────────────

    // ── Signed-in applicant (HOS-278 AC-1) ──────────────────────────────────
    //
    // The visitor is resolved in the BROWSER, after hydration — these pages
    // must stay session-blind because `colaborar/editores` is edge-cached
    // (HOS-369 W2-2). So the suite drives `/auth/me`, not a prop.

    describe('Signed-in applicant', () => {
        function renderSignedIn(user: { name: string | null; email: string | null }) {
            mockReadCachedAuthMe.mockReturnValue({
                isAuthenticated: true,
                user: { id: 'u1', name: user.name ?? '', email: user.email ?? '' },
                permissions: [],
                roles: ['USER'],
                cachedAt: Date.now()
            });
            return render(
                <AllianceLead
                    locale="es"
                    kind="partner"
                />
            );
        }

        it('does NOT ask for the email when the account has one (AC-1)', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            await waitFor(() => {
                expect(screen.queryByLabelText(/correo electrónico/i)).not.toBeInTheDocument();
            });
        });

        it('states the address the application will be filed under', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            expect(await screen.findByText('juan@example.com')).toBeInTheDocument();
        });

        it('resolves the visitor without a network call when the shared cache is warm', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            await screen.findByText('juan@example.com');
            expect(mockFetchAuthMe).not.toHaveBeenCalled();
        });

        it('falls back to /auth/me when the shared cache is cold', async () => {
            mockReadCachedAuthMe.mockReturnValue(null);
            mockFetchAuthMe.mockResolvedValue({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Juan Pérez', email: 'juan@example.com' },
                permissions: [],
                roles: ['USER'],
                cachedAt: Date.now()
            });

            render(
                <AllianceLead
                    locale="es"
                    kind="partner"
                />
            );

            expect(await screen.findByText('juan@example.com')).toBeInTheDocument();
            expect(mockWriteCachedAuthMe).toHaveBeenCalled();
        });

        it('stays anonymous when /auth/me says guest', async () => {
            mockReadCachedAuthMe.mockReturnValue(null);
            mockFetchAuthMe.mockResolvedValue({
                isAuthenticated: false,
                user: null,
                permissions: [],
                roles: [],
                cachedAt: Date.now()
            });

            render(
                <AllianceLead
                    locale="es"
                    kind="partner"
                />
            );

            await waitFor(() => expect(mockFetchAuthMe).toHaveBeenCalled());
            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('pre-fills the contact name but leaves it editable', async () => {
            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });

            const nameInput = (await screen.findByLabelText(/tu nombre/i)) as HTMLInputElement;
            await waitFor(() => expect(nameInput.value).toBe('Juan Pérez'));
            expect(nameInput).not.toBeDisabled();
        });

        it('submits the account email even though no field collected it', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalled();
            });
            const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
            expect(JSON.parse(String(init.body)).email).toBe('juan@example.com');
        });

        it('sends the session cookie, or the lead would arrive unlinked (AC-1)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderSignedIn({ name: 'Juan Pérez', email: 'juan@example.com' });
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({ credentials: 'include' })
                );
            });
        });

        it('still asks for the email when the session carries none', () => {
            renderSignedIn({ name: 'Juan Pérez', email: null });

            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('still asks for the email when the session email is blank', () => {
            renderSignedIn({ name: 'Juan Pérez', email: '   ' });

            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });

        it('asks an anonymous visitor for the email as before (AC-2)', () => {
            renderForm('partner');

            expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
        });
    });

    describe('Successful submission', () => {
        it('POSTs to /api/v1/public/alliance/leads', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringMatching(/\/api\/v1\/public\/alliance\/leads$/),
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('sends kind: "partner" and serializes the specific fields into message (HOS-277 §7.3)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^website/i), {
                target: { value: 'https://acme.com' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia de turismo' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.kind).toBe('partner');
                expect(body.message).toContain('businessName: Acme SA');
                expect(body.message).toContain('website: https://acme.com');
                expect(body.message).toContain('partnershipType: Agencia de turismo');
            });
        });

        it('does not POST the specific fields as top-level payload keys (backend contract stays generic)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/teléfono/i), {
                target: { value: '+5493444123456' }
            });
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme SA' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(Object.keys(body).sort()).toEqual(
                    ['_hp', 'contactName', 'email', 'kind', 'message', 'phone'].sort()
                );
                expect(body).not.toHaveProperty('businessName');
                expect(body).not.toHaveProperty('partnershipType');
            });
        });

        it('replaces form with success message on 200', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByText(/gracias.*recibimos tu solicitud/i)).toBeInTheDocument();
            });
        });

        it('hides form fields after successful submission', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'abc' })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.queryByLabelText(/tu nombre/i)).not.toBeInTheDocument();
            });
        });
    });

    // ── Error handling ────────────────────────────────────────────────────────

    describe('API error handling', () => {
        it('shows rate-limit message on 429', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({})
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const rateLimitAlert = alerts.find((el) =>
                    el.textContent?.toLowerCase().includes('demasiados intentos')
                );
                expect(rateLimitAlert).toBeDefined();
            });
        });

        it('shows generic error on non-ok response', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: 'Server error' } })
            } as Response);

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const serverAlert = alerts.find((el) => el.textContent?.includes('Server error'));
                expect(serverAlert).toBeDefined();
            });
        });

        it('shows generic error when fetch throws', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            renderForm('editor');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^topics/i), {
                target: { value: 'Gastronomía regional' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });
    });
});
