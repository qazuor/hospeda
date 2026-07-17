/**
 * @file SetPassword.test.tsx
 * @description Regression tests for the OAuth set-password island skip modal (BETA-61).
 *
 * BETA-61: the "skip for now" confirmation modal rendered incorrectly because it
 * used a raw `<dialog open>` element styled as a full-screen overlay. A native
 * `<dialog>` inherits user-agent `width: fit-content`, `margin: auto` and
 * `border: solid`, so `inset: 0` never stretched it: the backdrop did not cover
 * the viewport and a stray border box appeared. The fix migrates the modal to
 * the shared `Dialog` primitive (portal + backdrop + focus trap).
 *
 * These tests lock in that the modal is rendered through the primitive
 * (`role="dialog"`) and NOT through a native `<dialog>` element, so a regression
 * back to the broken pattern fails the suite.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { SetPassword } from '../../../src/components/account/SetPassword.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/SetPassword.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

vi.mock('../../../src/lib/auth-client', () => ({
    refreshBetterAuthSession: vi.fn()
}));

vi.mock('../../../src/store/toast-store', () => ({
    queueToastForNextPage: vi.fn()
}));

vi.mock('@repo/schemas', () => ({
    // Mirrors StrongPasswordSchema's bounds (HOS-190 slice 3: min 8, max 128,
    // upper/lower/digit) without pulling in the full `@repo/schemas` package.
    StrongPasswordSchema: z
        .string()
        .min(8)
        .max(128)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
}));

vi.mock('../../../src/components/ui/PasswordField.client', () => ({
    // NOTE: must wire `onChange` through to a real DOM input, otherwise
    // `fireEvent.change` never reaches the parent's `setPassword`/
    // `setConfirmPassword` state and every submit test would silently
    // validate an empty string instead of the value the test intends.
    PasswordField: ({
        id,
        label,
        value,
        onChange
    }: {
        id: string;
        label: string;
        value: string;
        onChange: (value: string) => void;
    }) => (
        <label htmlFor={id}>
            {label}
            <input
                id={id}
                type="password"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </label>
    )
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

const renderIsland = () =>
    render(
        <SetPassword
            locale="es"
            apiUrl="http://api.test"
        />
    );

const openSkipModal = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Saltar por ahora' }));
};

describe('SetPassword skip modal (BETA-61)', () => {
    it('does not render the skip modal until the skip button is clicked', () => {
        renderIsland();

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders the skip modal through the shared Dialog primitive, not a native <dialog>', () => {
        renderIsland();

        openSkipModal();

        // The shared primitive renders a <div role="dialog"> via portal.
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog.getAttribute('aria-modal')).toBe('true');

        // Regression guard: a raw <dialog> element inherits broken user-agent
        // styling and is exactly what BETA-61 fixed. It must NOT come back.
        expect(document.querySelector('dialog')).toBeNull();
    });

    it('shows the confirmation title and body copy inside the modal', () => {
        renderIsland();

        openSkipModal();

        expect(screen.getByText('¿Saltar por ahora?')).toBeInTheDocument();
        expect(
            screen.getByText('Vas a poder establecerla más tarde desde tu perfil. ¿Continuar?')
        ).toBeInTheDocument();
    });

    it('closes the modal when the cancel button is clicked', () => {
        renderIsland();

        openSkipModal();
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('closes the modal when Escape is pressed', () => {
        renderIsland();

        openSkipModal();
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

// ─── Password validation (HOS-190 slice 3: StrongPasswordSchema) ──────────────

describe('SetPassword password validation (HOS-190 slice 3)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('rejects a password longer than 128 characters and does not submit', () => {
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        renderIsland();

        // 129 chars total — still satisfies the strength regex (has lower/
        // upper/digit), so only the new 128-char cap should reject it.
        const tooLong = `Aa1!${'a'.repeat(125)}`;
        fireEvent.change(document.getElementById('sp-password') as HTMLInputElement, {
            target: { value: tooLong }
        });
        fireEvent.change(document.getElementById('sp-confirm-password') as HTMLInputElement, {
            target: { value: tooLong }
        });

        fireEvent.click(screen.getByRole('button', { name: 'Establecer contraseña' }));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('accepts a valid strong password within bounds and submits', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: {} })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderIsland();

        const valid = 'Aa1!aaaa';
        fireEvent.change(document.getElementById('sp-password') as HTMLInputElement, {
            target: { value: valid }
        });
        fireEvent.change(document.getElementById('sp-confirm-password') as HTMLInputElement, {
            target: { value: valid }
        });

        fireEvent.click(screen.getByRole('button', { name: 'Establecer contraseña' }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });
});
