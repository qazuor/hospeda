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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    PROFILE_COMPLETION_MIN_PASSWORD_LENGTH: 8,
    StrongPasswordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
}));

vi.mock('../../../src/components/ui/PasswordField.client', () => ({
    PasswordField: ({ id, label }: { id: string; label: string }) => (
        <label htmlFor={id}>
            {label}
            <input
                id={id}
                type="password"
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
