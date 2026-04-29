/**
 * @file ContactForm.test.tsx
 * @description RTL tests for the ContactForm React island.
 * Covers: field rendering, validation errors, accommodation field visibility,
 * honeypot presence, successful submission, and API error handling.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '../../src/components/ContactForm.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../src/components/ContactForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ContactSubmitSchema is used for real validation — don't mock it
// so we can verify that validation is triggered correctly.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderContactForm() {
    return render(<ContactForm locale="es" />);
}

async function fillForm(
    overrides: Partial<{
        firstName: string;
        lastName: string;
        email: string;
        message: string;
    }> = {}
) {
    const defaults = {
        firstName: 'Ana',
        lastName: 'López',
        email: 'ana@example.com',
        message: 'Quería consultar sobre disponibilidad general para el fin de semana.'
    };
    const values = { ...defaults, ...overrides };

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: values.firstName } });
    fireEvent.change(screen.getByLabelText(/apellido/i), { target: { value: values.lastName } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: values.email } });
    fireEvent.change(screen.getByLabelText(/mensaje/i), { target: { value: values.message } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ContactForm', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    describe('Initial render', () => {
        it('renders firstName input', () => {
            renderContactForm();
            expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
        });

        it('renders lastName input', () => {
            renderContactForm();
            expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument();
        });

        it('renders email input', () => {
            renderContactForm();
            expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        });

        it('renders message textarea', () => {
            renderContactForm();
            expect(screen.getByLabelText(/mensaje/i)).toBeInTheDocument();
        });

        it('renders type select', () => {
            renderContactForm();
            expect(screen.getByLabelText(/tipo de consulta/i)).toBeInTheDocument();
        });

        it('renders submit button', () => {
            renderContactForm();
            expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument();
        });
    });

    describe('Honeypot field', () => {
        it('renders a hidden website field', () => {
            renderContactForm();
            const honeypot = document.querySelector('input[name="website"]');
            expect(honeypot).not.toBeNull();
        });

        it('website field is not visible to users (off-screen container)', () => {
            renderContactForm();
            const container = document.querySelector('input[name="website"]')?.closest('div');
            expect(container?.className).toContain('honeypot');
        });

        it('website field has tabIndex=-1', () => {
            renderContactForm();
            const honeypot = document.querySelector('input[name="website"]');
            expect(honeypot).toHaveAttribute('tabindex', '-1');
        });
    });

    describe('Accommodation ID field visibility', () => {
        it('does NOT show accommodationId field when type=general (default)', () => {
            renderContactForm();
            expect(screen.queryByLabelText(/id del alojamiento/i)).not.toBeInTheDocument();
        });

        it('shows accommodationId field when type=accommodation is selected', () => {
            renderContactForm();
            const typeSelect = screen.getByLabelText(/tipo de consulta/i);
            fireEvent.change(typeSelect, { target: { value: 'accommodation' } });

            expect(screen.getByLabelText(/id del alojamiento/i)).toBeInTheDocument();
        });

        it('hides accommodationId field when switching back to general', () => {
            renderContactForm();
            const typeSelect = screen.getByLabelText(/tipo de consulta/i);
            fireEvent.change(typeSelect, { target: { value: 'accommodation' } });
            fireEvent.change(typeSelect, { target: { value: 'general' } });

            expect(screen.queryByLabelText(/id del alojamiento/i)).not.toBeInTheDocument();
        });
    });

    describe('Validation errors', () => {
        it('shows firstName error when submitted empty', async () => {
            renderContactForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });

        it('shows email error for invalid email', async () => {
            renderContactForm();
            fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Ana' } });
            fireEvent.change(screen.getByLabelText(/apellido/i), { target: { value: 'López' } });
            fireEvent.change(screen.getByLabelText(/email/i), {
                target: { value: 'not-an-email' }
            });
            fireEvent.change(screen.getByLabelText(/mensaje/i), {
                target: { value: 'Mensaje con suficiente longitud para pasar validacion' }
            });
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });

        it('does not submit when form is invalid (fetch not called)', async () => {
            renderContactForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled();
            });
        });
    });

    describe('Successful submission', () => {
        it('calls /api/v1/public/contact with correct method', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, message: 'Sent' })
            } as Response);

            renderContactForm();
            await fillForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/v1/public/contact',
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('replaces form with success message on 200', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, message: 'Sent' })
            } as Response);

            renderContactForm();
            await fillForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                expect(screen.getByText(/mensaje enviado/i)).toBeInTheDocument();
            });
        });

        it('success state does not show the form fields', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, message: 'Sent' })
            } as Response);

            renderContactForm();
            await fillForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                expect(screen.queryByLabelText(/nombre/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('API error handling', () => {
        it('shows form-level error when API returns non-ok', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: { message: 'Server error' } })
            } as Response);

            renderContactForm();
            await fillForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const formAlert = alerts.find((el) => el.textContent?.includes('Server error'));
                expect(formAlert).toBeDefined();
            });
        });

        it('shows generic error when fetch throws', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            renderContactForm();
            await fillForm();
            fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });
    });
});
