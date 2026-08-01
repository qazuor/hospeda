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

    // ── Signed-in prefill ────────────────────────────────────────────────────

    // Regression: the four landing pages did not pre-fill a signed-in visitor's
    // name and email. The island had no `currentUser` prop, and the pages could
    // not have supplied one anyway — `sumate`/`colaborar` were missing from
    // `SESSION_OPTIONAL_SEGMENTS`, so their frontmatter had no `Astro.locals.user`.
    describe('Signed-in prefill', () => {
        const signedInUser = { name: 'Ana Gómez', email: 'ana@example.com' } as const;

        function renderSignedIn(currentUser: { name: string | null; email: string | null }) {
            return render(
                <AllianceLead
                    locale="es"
                    kind="partner"
                    currentUser={currentUser}
                />
            );
        }

        it('seeds the contact fields from the session', () => {
            renderSignedIn(signedInUser);

            expect(screen.getByLabelText(/tu nombre/i)).toHaveValue('Ana Gómez');
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('ana@example.com');
        });

        it('leaves the seeded fields editable', () => {
            renderSignedIn(signedInUser);

            const email = screen.getByLabelText(/correo electrónico/i);
            fireEvent.change(email, { target: { value: 'otro@example.com' } });

            expect(email).toHaveValue('otro@example.com');
            expect(email).not.toHaveAttribute('readonly');
        });

        it('starts empty and silent for an anonymous visitor', () => {
            renderForm('partner');

            expect(screen.getByLabelText(/tu nombre/i)).toHaveValue('');
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('');
            expect(document.getElementById('al-prefill-notice')).toBeNull();
        });

        it('explains the prefill when the session seeded something', () => {
            renderSignedIn(signedInUser);

            expect(document.getElementById('al-prefill-notice')).not.toBeNull();
        });

        it('stays silent when the session had nothing to seed', () => {
            // Better Auth stores '' rather than null for an account that never
            // set a name; with no email either, nothing was pre-filled and the
            // notice must not claim otherwise.
            renderSignedIn({ name: '', email: null });

            expect(document.getElementById('al-prefill-notice')).toBeNull();
        });

        it('points the seeded fields at the notice through aria-describedby', () => {
            renderSignedIn(signedInUser);

            expect(screen.getByLabelText(/tu nombre/i)).toHaveAttribute(
                'aria-describedby',
                'al-prefill-notice'
            );
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
                'aria-describedby',
                'al-prefill-notice'
            );
        });

        it('keeps the error id alongside the notice when a seeded field is invalid', async () => {
            renderSignedIn(signedInUser);

            fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
                target: { value: 'not-an-email' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
                    'aria-describedby',
                    'al-prefill-notice al-email-error'
                );
            });
        });
    });

    // ── Confirmation reveal ──────────────────────────────────────────────────

    // Regression: submitting left the visitor scrolled where the (tall) form
    // used to be — staring at the footer — because the short confirmation that
    // replaces it renders above the current scroll offset.
    describe('Confirmation reveal', () => {
        // jsdom implements neither `scrollIntoView` nor `matchMedia`; the hook
        // feature-detects both, so `scrollIntoView` has to be installed here to
        // be observable at all.
        let scrollIntoView: ReturnType<typeof vi.fn>;

        beforeEach(() => {
            scrollIntoView = vi.fn();
            Element.prototype.scrollIntoView = scrollIntoView;
        });

        async function submitPartnerForm() {
            renderForm('partner');
            await fillGenericRequiredFields();
            fireEvent.change(screen.getByLabelText(/^businessName/i), {
                target: { value: 'Acme Turismo' }
            });
            fireEvent.change(screen.getByLabelText(/^partnershipType/i), {
                target: { value: 'Agencia' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
        }

        it('scrolls the confirmation into view and focuses it on success', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                status: 201,
                json: async () => ({})
            } as Response);

            await submitPartnerForm();

            const confirmation = await screen.findByRole('alert');

            expect(scrollIntoView).toHaveBeenCalledTimes(1);
            expect(scrollIntoView.mock.calls[0]?.[0]).toMatchObject({ block: 'start' });
            expect(document.activeElement).toBe(confirmation);
        });

        it('does not scroll while the form is still on screen', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: 'Server error' } })
            } as Response);

            await submitPartnerForm();

            await waitFor(() => {
                expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
            });
            expect(scrollIntoView).not.toHaveBeenCalled();
        });
    });
});
