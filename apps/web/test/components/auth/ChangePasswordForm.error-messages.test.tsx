/**
 * @file ChangePasswordForm.error-messages.test.tsx
 * @description Regression suite for HOS-190 BETA-190 — the newPassword field
 * used to render the RAW i18n key (`zodError.common.password.*`) from the
 * StrongPasswordSchema instead of a human Spanish message.
 *
 * Renders with the REAL translations (no `@/lib/i18n` mock) so the assertion is
 * on the actual string the user sees.
 */

import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from '../../../src/components/auth/ChangePasswordForm.client';

// Better Auth session refresh is only hit on success; mock the module so it has
// no side effects on import/render.
vi.mock('../../../src/lib/auth-client', () => ({
    refreshBetterAuthSession: vi.fn()
}));

function setValue(name: string, value: string): void {
    const el = document.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
    if (!el) throw new Error(`field [name="${name}"] not found`);
    fireEvent.change(el, { target: { value } });
}

function submit(): void {
    const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(btn);
}

describe('ChangePasswordForm — human validation messages (HOS-190 BETA-190)', () => {
    it('renders the newPassword error as human Spanish, not a raw zodError.* key', async () => {
        render(<ChangePasswordForm locale="es" />);

        setValue('currentPassword', 'OldPass1!');
        setValue('newPassword', 'weak');
        setValue('confirmNewPassword', 'weak');
        submit();

        await waitFor(() => {
            const err = document.getElementById('cpf-newPassword-error');
            expect(err).not.toBeNull();
            expect(err?.textContent ?? '').toBe('La contraseña debe tener al menos 8 caracteres');
        });

        const err = document.getElementById('cpf-newPassword-error');
        expect(err?.textContent ?? '').not.toMatch(/^zodError\./);
        expect(err?.textContent ?? '').not.toMatch(/^validation\./);
    });

    it('shows a localized (not English) message when currentPassword is empty', async () => {
        render(<ChangePasswordForm locale="es" />);

        setValue('newPassword', 'StrongP@ss1');
        setValue('confirmNewPassword', 'StrongP@ss1');
        submit();

        await waitFor(() => {
            const err = document.getElementById('cpf-currentPassword-error');
            expect(err).not.toBeNull();
            expect(err?.textContent ?? '').toBe('La contraseña actual es requerida.');
        });

        const err = document.getElementById('cpf-currentPassword-error');
        expect(err?.textContent ?? '').not.toContain('Current password is required');
    });
});
