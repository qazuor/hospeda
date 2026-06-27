/**
 * @file ChangePasswordForm.test.tsx
 * @description RTL tests for the ChangePasswordForm React island (SPEC-239 T-055).
 *
 * Covers: rendering of all three fields, passwords-do-not-match validation,
 * empty-field validation, API call on valid submit, API error display,
 * success banner + redirect, password strength indicator, and submit-button
 * loading state.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from '../../src/components/auth/ChangePasswordForm.client';
import { refreshBetterAuthSession } from '../../src/lib/auth-client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../src/components/auth/ChangePasswordForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Mock the Better Auth session refresh so we can assert it runs on success
// (the must-change-password gate fix) without performing a real network call.
vi.mock('../../src/lib/auth-client', () => ({
    refreshBetterAuthSession: vi.fn().mockResolvedValue(undefined)
}));

// Keep real @repo/schemas validation so we can verify field-level enforcement.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A password that satisfies StrongPasswordSchema (8+, upper, lower, digit, special @$!%*?&). */
const VALID_PWD = 'SecureP@ss1';

function renderForm() {
    return render(<ChangePasswordForm locale="es" />);
}

/**
 * Returns the three password inputs by their stable DOM ids.
 * Using ids avoids ambiguity between "Nueva contraseña" and "Confirmá la nueva contraseña".
 */
function getInputs() {
    return {
        current: document.getElementById('cpf-currentPassword') as HTMLInputElement,
        newPwd: document.getElementById('cpf-newPassword') as HTMLInputElement,
        confirm: document.getElementById('cpf-confirmNewPassword') as HTMLInputElement
    };
}

/**
 * Fills all three password fields.
 * Defaults produce a valid, matching pair that passes StrongPasswordSchema.
 */
function fillFields(opts: { current?: string; newPwd?: string; confirm?: string } = {}): void {
    const { current = 'OldPass@123', newPwd = VALID_PWD, confirm = VALID_PWD } = opts;
    const inputs = getInputs();

    fireEvent.change(inputs.current, { target: { value: current } });
    fireEvent.change(inputs.newPwd, { target: { value: newPwd } });
    fireEvent.change(inputs.confirm, { target: { value: confirm } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChangePasswordForm', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
        vi.mocked(refreshBetterAuthSession).mockClear();
    });

    // ── 1. Renders all three password fields ─────────────────────────────────

    describe('Initial render', () => {
        it('renders all three password fields', () => {
            renderForm();
            expect(screen.getByLabelText(/contraseña actual/i)).toBeInTheDocument();
            // Use stable DOM ids to distinguish "Nueva contraseña" from "Confirmá la nueva contraseña"
            expect(document.getElementById('cpf-newPassword')).toBeInTheDocument();
            expect(document.getElementById('cpf-confirmNewPassword')).toBeInTheDocument();
        });

        it('renders the submit button', () => {
            renderForm();
            expect(screen.getByRole('button', { name: /cambiar contraseña/i })).toBeInTheDocument();
        });
    });

    // ── 2. Shows error when passwords do not match ────────────────────────────

    describe('Password mismatch validation', () => {
        it('shows error when new password and confirm password do not match', async () => {
            renderForm();
            fillFields({ newPwd: VALID_PWD, confirm: 'DifferentP@ss1' });
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const mismatch = alerts.find((el) =>
                    el.textContent?.toLowerCase().includes('no coinciden')
                );
                expect(mismatch).toBeDefined();
            });
        });

        it('does not call fetch when passwords do not match', async () => {
            renderForm();
            fillFields({ newPwd: VALID_PWD, confirm: 'DifferentP@ss1' });
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled();
            });
        });
    });

    // ── 3. Shows error when fields are empty ─────────────────────────────────

    describe('Empty-field validation', () => {
        it('shows validation errors when all fields are empty on submit', async () => {
            renderForm();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });

        it('does not call fetch when form is submitted empty', async () => {
            renderForm();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled();
            });
        });
    });

    // ── 4. Calls API on valid submit ──────────────────────────────────────────

    describe('Successful form submission', () => {
        it('calls POST /api/v1/protected/auth/change-password on valid submit', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringMatching(/\/api\/v1\/protected\/auth\/change-password$/),
                    expect.objectContaining({
                        method: 'POST',
                        credentials: 'include'
                    })
                );
            });
        });

        it('sends currentPassword and newPassword in the request body', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            fillFields({ current: 'OldPass@123', newPwd: VALID_PWD, confirm: VALID_PWD });
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                const callArgs = vi.mocked(global.fetch).mock.calls[0];
                const body = JSON.parse((callArgs?.[1] as RequestInit).body as string) as Record<
                    string,
                    unknown
                >;
                expect(body.currentPassword).toBe('OldPass@123');
                expect(body.newPassword).toBe(VALID_PWD);
            });
        });
    });

    // ── 5. Shows API error message on failure ─────────────────────────────────

    describe('API error handling', () => {
        it('shows API error message from response body on 500', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: 'Internal server error' } })
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const serverAlert = alerts.find((el) =>
                    el.textContent?.includes('Internal server error')
                );
                expect(serverAlert).toBeDefined();
            });
        });

        it('shows fallback error message when response body has no message', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({})
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });

        it('shows current-password-incorrect error on 400 PASSWORD_INCORRECT', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({
                    error: { code: 'PASSWORD_INCORRECT', message: 'Wrong password' }
                })
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                const incorrectAlert = alerts.find((el) =>
                    el.textContent?.toLowerCase().includes('incorrecta')
                );
                expect(incorrectAlert).toBeDefined();
            });
        });
    });

    // ── 6. Redirects on success ───────────────────────────────────────────────

    describe('Success state', () => {
        it('shows success banner after successful submission', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                expect(
                    screen.getByText(/contraseña actualizada correctamente/i)
                ).toBeInTheDocument();
            });
        });

        it('refreshes the Better Auth session on success (regression: must-change-password gate)', async () => {
            // Without refreshing the cookie cache, the middleware keeps reading the
            // stale mustChangePassword=true and bounces the user back to this gate
            // after the redirect until the 5-minute cache TTL expires.
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                expect(refreshBetterAuthSession).toHaveBeenCalledTimes(1);
            });
        });

        it('does NOT refresh the session when the change fails', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ error: { message: 'Internal server error' } })
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            await waitFor(() => {
                expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
            });
            expect(refreshBetterAuthSession).not.toHaveBeenCalled();
        });

        it('redirects to /es/mi-cuenta/ after 1.5 s on success', async () => {
            const hrefAssignSpy = vi.fn();
            const originalLocation = window.location;
            // jsdom's window.location is non-configurable for assignment; redefine
            // it with a setter so the component's `location.href = ...` is observable.
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

            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            } as Response);

            renderForm();
            fillFields();
            fireEvent.click(screen.getByRole('button', { name: /cambiar contraseña/i }));

            // Wait for success banner, then let the 1.5 s real setTimeout fire.
            await waitFor(
                () => {
                    expect(hrefAssignSpy).toHaveBeenCalledWith('/es/mi-cuenta/');
                },
                { timeout: 3000 }
            );

            // Restore.
            window.location = originalLocation;
        });
    });

    // ── 7. Shows password strength indicator ──────────────────────────────────

    describe('Password strength indicator', () => {
        it('does not render strength indicator when new password is empty', () => {
            renderForm();
            expect(screen.queryByText(/débil|media|segura/i)).not.toBeInTheDocument();
        });

        it('shows "Débil" for a password shorter than 8 characters', () => {
            renderForm();
            const newPwdInput = document.getElementById('cpf-newPassword') as HTMLInputElement;
            fireEvent.change(newPwdInput, { target: { value: 'short' } });
            expect(screen.getByText(/débil/i)).toBeInTheDocument();
        });

        it('shows "Media" for a password with letters and digits but no special character', () => {
            renderForm();
            const newPwdInput = document.getElementById('cpf-newPassword') as HTMLInputElement;
            fireEvent.change(newPwdInput, { target: { value: 'Letters1234' } });
            expect(screen.getByText(/media/i)).toBeInTheDocument();
        });

        it('shows "Segura" for a strong password with letters, digits, and special character', () => {
            renderForm();
            const newPwdInput = document.getElementById('cpf-newPassword') as HTMLInputElement;
            fireEvent.change(newPwdInput, { target: { value: VALID_PWD } });
            expect(screen.getByText(/segura/i)).toBeInTheDocument();
        });
    });

    // ── 8. Disables submit button during loading ──────────────────────────────

    describe('Loading state', () => {
        it('disables the submit button while the request is in flight', async () => {
            // Never resolves so the loading state persists throughout the assertion.
            vi.mocked(global.fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));

            renderForm();
            fillFields();

            const btn = screen.getByRole('button', { name: /cambiar contraseña/i });
            expect(btn).not.toBeDisabled();

            fireEvent.click(btn);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
            });
        });
    });
});
