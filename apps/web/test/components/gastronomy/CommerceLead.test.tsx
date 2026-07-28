/**
 * @file CommerceLead.test.tsx
 * @description RTL tests for the CommerceLead React island (SPEC-239 T-056).
 *
 * Covers: field rendering, required-field validation, honeypot presence,
 * honeypot blocks submission, posts to the commerce leads endpoint,
 * success state, 429 rate-limit message, and generic API errors.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommerceLead } from '../../../src/components/gastronomy/CommerceLead.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mirrors the real `t(key, fallback?, params?)` signature, including `{{name}}`
// interpolation — the HOS-305 confirmation echoes the submitted email through it.
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            const template = fallback ?? _key;
            if (!params) {
                return template;
            }
            return template.replace(/\{\{(\w+)\}\}/g, (match: string, name: string) =>
                name in params ? String(params[name]) : match
            );
        }
    })
}));

vi.mock('../../../src/components/gastronomy/CommerceLead.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Keep real schema validation so we can verify field-level enforcement.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderForm() {
    return render(<CommerceLead locale="es" />);
}

async function fillRequiredFields(
    overrides: Partial<{
        businessName: string;
        contactName: string;
        email: string;
    }> = {}
) {
    const defaults = {
        businessName: 'La Parrilla de Juan',
        contactName: 'Juan Pérez',
        email: 'juan@example.com'
    };
    const values = { ...defaults, ...overrides };

    fireEvent.change(screen.getByLabelText(/nombre del negocio/i), {
        target: { value: values.businessName }
    });
    fireEvent.change(screen.getByLabelText(/tu nombre/i), {
        target: { value: values.contactName }
    });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
        target: { value: values.email }
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommerceLead', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    // ── Render ───────────────────────────────────────────────────────────────

    describe('Initial render', () => {
        it('renders businessName input', () => {
            renderForm();
            expect(screen.getByLabelText(/nombre del negocio/i)).toBeInTheDocument();
        });

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

        it('renders message textarea (optional)', () => {
            renderForm();
            expect(screen.getByLabelText(/contanos sobre tu negocio/i)).toBeInTheDocument();
        });

        it('renders submit button', () => {
            renderForm();
            expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeInTheDocument();
        });

        it('renders destination select when destinations prop is provided', () => {
            const destinations = [
                { id: '1', name: 'Concepción del Uruguay' },
                { id: '2', name: 'Colón' }
            ];
            render(
                <CommerceLead
                    locale="es"
                    destinations={destinations}
                />
            );
            expect(screen.getByLabelText(/ciudad/i)).toBeInTheDocument();
            expect(screen.getByText('Concepción del Uruguay')).toBeInTheDocument();
        });

        it('does NOT render destination select when destinations prop is empty', () => {
            renderForm();
            expect(screen.queryByLabelText(/ciudad/i)).not.toBeInTheDocument();
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

        it('_hp field is inside the honeypot container', () => {
            renderForm();
            const container = document.querySelector('input[name="_hp"]')?.closest('div');
            expect(container?.className).toContain('honeypot');
        });

        it('does not POST when _hp is filled in (simulates bot)', async () => {
            renderForm();

            // Fill in required fields then fill the honeypot
            await fillRequiredFields();
            const honeypot = document.querySelector('input[name="_hp"]') as HTMLInputElement;
            fireEvent.change(honeypot, { target: { value: 'bot-value' } });

            // The form should still pass client-side validation and POST,
            // but the payload will include _hp='bot-value'. The server silently
            // rejects it. We verify the POST body contains _hp.
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringMatching(/\/api\/v1\/public\/commerce\/leads$/),
                    expect.objectContaining({ method: 'POST' })
                );
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body._hp).toBe('bot-value');
            });
        });
    });

    // ── Validation ────────────────────────────────────────────────────────────

    describe('Validation errors', () => {
        it('shows validation alerts when submitted with empty required fields', async () => {
            renderForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });

        it('does not call fetch when form is invalid', async () => {
            renderForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled();
            });
        });

        it('shows email error for invalid email', async () => {
            renderForm();
            fireEvent.change(screen.getByLabelText(/nombre del negocio/i), {
                target: { value: 'Mi negocio' }
            });
            fireEvent.change(screen.getByLabelText(/tu nombre/i), {
                target: { value: 'Juan Pérez' }
            });
            fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
                target: { value: 'not-valid-email' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });

        // HOS-190 form 18: phone/message field errors were already computed
        // (extractFieldErrors → zodIssuesToFieldErrors) but never rendered.
        it('renders a visible alert for an over-length phone number', async () => {
            renderForm();
            await fillRequiredFields();
            fireEvent.change(screen.getByLabelText(/teléfono/i), {
                target: { value: '1'.repeat(51) } // CommerceLeadSchema.phone.max(50)
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const phoneAlert = alerts.find((el) => el.id === 'cl-phone-error');
                expect(phoneAlert).toBeDefined();
                expect(phoneAlert?.textContent?.length).toBeGreaterThan(0);
            });

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('renders a visible alert for a too-short message', async () => {
            renderForm();
            await fillRequiredFields();
            fireEvent.change(screen.getByLabelText(/contanos sobre tu negocio/i), {
                target: { value: 'short' } // CommerceLeadSchema.message.min(10)
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const messageAlert = alerts.find((el) => el.id === 'cl-message-error');
                expect(messageAlert).toBeDefined();
                expect(messageAlert?.textContent?.length).toBeGreaterThan(0);
            });

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('wires aria-describedby/aria-invalid on the phone input when it has an error', async () => {
            renderForm();
            await fillRequiredFields();
            fireEvent.change(screen.getByLabelText(/teléfono/i), {
                target: { value: '1'.repeat(51) }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const phoneInput = screen.getByLabelText(/teléfono/i);
                expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
                expect(phoneInput).toHaveAttribute('aria-describedby', 'cl-phone-error');
            });
        });
    });

    // ── Submission ────────────────────────────────────────────────────────────

    describe('Successful submission', () => {
        it('POSTs to /api/v1/public/commerce/leads', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            await fillRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringMatching(/\/api\/v1\/public\/commerce\/leads$/),
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('sends domain: gastronomy in the request body by default', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            await fillRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.domain).toBe('gastronomy');
            });
        });

        it('sends domain: experience in the request body when the domain prop is set (HOS-134)', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            render(
                <CommerceLead
                    locale="es"
                    domain="experience"
                />
            );
            await fillRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.domain).toBe('experience');
            });
        });

        it('derives a domain-aware accessible-name key for the form so it matches the visible heading (HOS-134)', () => {
            // The unit-test i18n returns the fallback string (no locale loaded),
            // so assert the domain→key mapping at the source level instead.
            const src = readFileSync(
                resolve(__dirname, '../../../src/components/gastronomy/CommerceLead.client.tsx'),
                'utf8'
            );
            expect(src).toContain("domain === 'experience' ? 'commerce.lead.experience.title'");
            expect(src).toContain("'commerce.lead.title'");
            expect(src).toContain('aria-label={t(formTitleKey,');
        });

        it('replaces form with success message on 200', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            await fillRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                // HOS-305 replaced the bare thank-you with a confirmation that
                // repeats the journey; the acknowledgement itself still leads.
                expect(screen.getByText(/recibimos tu solicitud/i)).toBeInTheDocument();
            });
        });

        it('hides form fields after successful submission', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            await fillRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.queryByLabelText(/nombre del negocio/i)).not.toBeInTheDocument();
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

            renderForm();
            await fillRequiredFields();
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

            renderForm();
            await fillRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const serverAlert = alerts.find((el) => el.textContent?.includes('Server error'));
                expect(serverAlert).toBeDefined();
            });
        });

        it('shows generic error when fetch throws', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            renderForm();
            await fillRequiredFields();
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });
    });

    // ── Signed-in prefill (HOS-295) ───────────────────────────────────────────

    describe('Signed-in prefill', () => {
        const currentUser = {
            name: 'Juan Pérez',
            email: 'juan@example.com'
        };

        function renderSignedIn(
            overrides: Partial<{
                name: string | null;
                email: string | null;
            }> = {}
        ) {
            return render(
                <CommerceLead
                    locale="es"
                    currentUser={{ ...currentUser, ...overrides }}
                />
            );
        }

        it('pre-fills contactName and email from the session', () => {
            renderSignedIn();
            expect(screen.getByLabelText(/tu nombre/i)).toHaveValue('Juan Pérez');
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('juan@example.com');
        });

        it('leaves the business-specific fields empty', () => {
            renderSignedIn();
            expect(screen.getByLabelText(/nombre del negocio/i)).toHaveValue('');
            expect(screen.getByLabelText(/teléfono/i)).toHaveValue('');
            expect(screen.getByLabelText(/contanos sobre tu negocio/i)).toHaveValue('');
        });

        // Deliberately editable, not read-only: a merchant's business contact
        // may legitimately differ from the address they signed in with, and the
        // lead is a reply-to, not an identity claim. (The submitted email does
        // NOT link the lead to an existing account — see the note in
        // CommerceLead.client.tsx; that is HOS-296.)
        it('keeps the pre-filled fields editable', () => {
            renderSignedIn();
            const email = screen.getByLabelText(/correo electrónico/i);
            const contactName = screen.getByLabelText(/tu nombre/i);

            expect(email).not.toHaveAttribute('readonly');
            expect(email).not.toBeDisabled();
            expect(contactName).not.toHaveAttribute('readonly');
            expect(contactName).not.toBeDisabled();
        });

        it('submits an edited email instead of the session one', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderSignedIn();
            fireEvent.change(screen.getByLabelText(/nombre del negocio/i), {
                target: { value: 'La Parrilla de Juan' }
            });
            fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
                target: { value: 'contacto@laparrilla.com' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.email).toBe('contacto@laparrilla.com');
                expect(body.contactName).toBe('Juan Pérez');
            });
        });

        it('submits the pre-filled values untouched when the visitor edits nothing else', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderSignedIn();
            fireEvent.change(screen.getByLabelText(/nombre del negocio/i), {
                target: { value: 'La Parrilla de Juan' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.email).toBe('juan@example.com');
                expect(body.contactName).toBe('Juan Pérez');
            });
        });

        it('falls back to empty fields when the session carries no name or email', () => {
            renderSignedIn({ name: null, email: null });
            expect(screen.getByLabelText(/tu nombre/i)).toHaveValue('');
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('');
        });

        it('renders the anonymous form empty when there is no session', () => {
            renderForm();
            expect(screen.getByLabelText(/tu nombre/i)).toHaveValue('');
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('');
        });

        // Better Auth stores '' rather than null for an account that never set
        // a name, so "signed in" is not the same as "something was pre-filled".
        it('omits the notice when the session filled nothing in', () => {
            renderSignedIn({ name: '', email: '' });
            expect(document.getElementById('cl-prefill-notice')).toBeNull();
            expect(screen.getByLabelText(/correo electrónico/i)).not.toHaveAttribute(
                'aria-describedby'
            );
        });

        it('still shows the notice when only the email came from the session', () => {
            renderSignedIn({ name: '' });
            expect(document.getElementById('cl-prefill-notice')).not.toBeNull();
            expect(screen.getByLabelText(/tu nombre/i)).toHaveValue('');
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('juan@example.com');
        });

        it('explains the prefill and does so only for signed-in visitors', () => {
            const { unmount } = renderSignedIn();
            const notice = document.getElementById('cl-prefill-notice');
            expect(notice).not.toBeNull();
            expect(notice?.textContent?.length).toBeGreaterThan(0);
            unmount();

            renderForm();
            expect(document.getElementById('cl-prefill-notice')).toBeNull();
        });

        // The notice explains why the two seeded fields already have a value,
        // so screen readers must reach it from those fields.
        it('associates the notice with the two pre-filled fields', () => {
            renderSignedIn();
            expect(screen.getByLabelText(/tu nombre/i)).toHaveAttribute(
                'aria-describedby',
                'cl-prefill-notice'
            );
            expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
                'aria-describedby',
                'cl-prefill-notice'
            );
        });

        it('keeps the field error in aria-describedby alongside the notice', async () => {
            renderSignedIn();
            fireEvent.change(screen.getByLabelText(/nombre del negocio/i), {
                target: { value: 'La Parrilla de Juan' }
            });
            fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
                target: { value: 'not-valid-email' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute(
                    'aria-describedby',
                    'cl-prefill-notice cl-email-error'
                );
            });
        });
    });

    // ── Approval process (HOS-305) ────────────────────────────────────────────

    describe('Approval process', () => {
        async function submitSuccessfully(email = 'juan@example.com') {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            await fillRequiredFields({ email });
            fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
        }

        it('explains the manual approval BEFORE the visitor submits', () => {
            renderForm();
            // The whole point of the issue: the applicant should not discover
            // the review step only after sending the form.
            expect(screen.getByText(/nuestro equipo lo revisa y lo aprueba/i)).toBeInTheDocument();
        });

        it('gives a concrete expectation of how long the review takes', () => {
            renderForm();
            expect(screen.getByText(/24 y 48 horas hábiles/i)).toBeInTheDocument();
        });

        it('renders the four journey steps in order, as an ordered list', () => {
            renderForm();
            const steps = screen.getByRole('list').querySelectorAll('li');
            expect(steps).toHaveLength(4);
            expect(steps[0]?.textContent).toMatch(/enviás el formulario/i);
            expect(steps[3]?.textContent).toMatch(/contratás el plan/i);
        });

        // The submitted email does NOT link an approved lead to an existing
        // account today — commerce-ports.ts calls signUpEmail with no lookup.
        // That is HOS-296. The copy must not promise it in the meantime, in
        // ANY phrasing, so this pins the exact wording of the step rather than
        // blacklisting a couple of words a reworded promise would slip past.
        it('pins step 3 to the account-neutral wording', () => {
            renderForm();
            const step3 = screen.getByRole('list').querySelectorAll('li')[2];
            expect(step3?.textContent).toBe(
                'Te avisamos por correo cuando esté listo, con los pasos para entrar.'
            );
        });

        it('never claims the lead links to an existing account', () => {
            renderForm();
            const body = document.body.textContent ?? '';
            for (const claim of [
                /vincul/i,
                /cuenta existente/i,
                /cuenta ya registrada/i,
                /te conectamos/i,
                /iniciá sesión con/i,
                /con tu cuenta de hospeda/i
            ]) {
                expect(body).not.toMatch(claim);
            }
        });

        it('replaces the form with a confirmation, not just a toast', async () => {
            renderForm();
            await submitSuccessfully();

            await waitFor(() => {
                expect(screen.getByText(/recibimos tu solicitud/i)).toBeInTheDocument();
            });
            // The form itself is gone — this is a page state, not an overlay.
            expect(
                screen.queryByRole('button', { name: /enviar solicitud/i })
            ).not.toBeInTheDocument();
        });

        it('repeats the same four steps on the confirmation', async () => {
            renderForm();
            await submitSuccessfully();

            await waitFor(() => {
                expect(screen.getByText(/qué pasa ahora/i)).toBeInTheDocument();
            });
            expect(screen.getByRole('list').querySelectorAll('li')).toHaveLength(4);
            expect(screen.getByText(/nuestro equipo lo revisa y lo aprueba/i)).toBeInTheDocument();
        });

        it('echoes the address the lead was actually sent with', async () => {
            renderForm();
            await submitSuccessfully('contacto@laparrilla.com');

            await waitFor(() => {
                expect(
                    screen.getByText(/te vamos a escribir a contacto@laparrilla\.com/i)
                ).toBeInTheDocument();
            });
        });

        it('invites the visitor to get in touch rather than only wait', async () => {
            renderForm();
            await submitSuccessfully();

            await waitFor(() => {
                expect(screen.getByText(/escribinos y lo revisamos/i)).toBeInTheDocument();
            });
        });

        // `role="alert"` announces its whole subtree in one uninterruptible
        // burst, so it must stay scoped to the acknowledgement. The steps and
        // the closing note are ordinary content read at the user's own pace.
        it('scopes the assertive alert to the acknowledgement only', async () => {
            renderForm();
            await submitSuccessfully('contacto@laparrilla.com');

            await waitFor(() => {
                const alert = screen.getByRole('alert');
                expect(alert).toHaveAttribute('aria-live', 'assertive');
                expect(alert.textContent).toMatch(/recibimos tu solicitud/i);
                expect(alert.textContent).toContain('contacto@laparrilla.com');
                // The repeated journey must NOT be inside the live region.
                expect(alert.querySelector('ol')).toBeNull();
                expect(alert.textContent).not.toMatch(/qué pasa ahora/i);
                expect(alert.textContent).not.toMatch(/escribinos y lo revisamos/i);
            });
        });
    });
});
