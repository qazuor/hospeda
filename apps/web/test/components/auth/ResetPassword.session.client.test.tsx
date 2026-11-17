/**
 * @file ResetPassword.session.client.test.tsx
 * @description BETA-216 regression: after a reset-password success, a browser
 * that already holds ANOTHER account's session must be told so and offered a
 * sign-out, instead of a bare sign-in link that `/auth/signin` would silently
 * bounce to the old account's dashboard.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPassword } from '../../../src/components/auth/ResetPassword.client';

vi.mock('../../../src/components/auth/ResetPassword.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string, params?: Record<string, string>): string =>
        (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_m, name: string) => params?.[name] ?? '');
    return { createTranslations: () => ({ t }) };
});

const resetPasswordMock = vi.fn();
const useSessionMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
    useSession: () => useSessionMock()
}));

const signOutHelperMock = vi.fn();
vi.mock('../../../src/lib/sign-out', () => ({
    signOutAndClearClientState: () => signOutHelperMock()
}));

const SIGN_IN_URL = '/es/auth/signin/';
const TYPED_VALUE = 'Aa1!aaaa';

async function completeReset(): Promise<void> {
    render(
        <ResetPassword
            locale="es"
            token="reset-token-123"
            signInUrl={SIGN_IN_URL}
        />
    );
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), {
        target: { value: TYPED_VALUE }
    });
    fireEvent.change(screen.getByLabelText(/^Confirmar contraseña/), {
        target: { value: TYPED_VALUE }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    await screen.findByText('Contraseña actualizada');
}

describe('ResetPassword success state with an open session (BETA-216)', () => {
    beforeEach(() => {
        resetPasswordMock.mockReset();
        resetPasswordMock.mockResolvedValue({ data: {} });
        useSessionMock.mockReset();
        signOutHelperMock.mockReset();
        signOutHelperMock.mockResolvedValue({ ok: true });
    });

    it('keeps the plain sign-in link when there is no session', async () => {
        useSessionMock.mockReturnValue({ data: null });

        await completeReset();

        expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
            'href',
            SIGN_IN_URL
        );
        expect(screen.queryByText(/Iniciaste sesión como/)).toBeNull();
    });

    it('names the signed-in account and offers a sign-out instead of the plain link', async () => {
        useSessionMock.mockReturnValue({ data: { user: { email: 'admin@hospeda.test' } } });

        await completeReset();

        expect(
            screen.getByText(
                'Iniciaste sesión como admin@hospeda.test. Para entrar con la contraseña nueva, cerrá esta sesión.'
            )
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).toBeNull();
    });

    it('signs out and then navigates to the sign-in page', async () => {
        useSessionMock.mockReturnValue({ data: { user: { email: 'admin@hospeda.test' } } });
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { href: '' }
        });

        try {
            await completeReset();
            fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

            await waitFor(() => expect(window.location.href).toBe(SIGN_IN_URL));
            expect(signOutHelperMock).toHaveBeenCalledTimes(1);
        } finally {
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: originalLocation
            });
        }
    });

    it('does not navigate and shows an error when the sign-out fails', async () => {
        useSessionMock.mockReturnValue({ data: { user: { email: 'admin@hospeda.test' } } });
        signOutHelperMock.mockResolvedValue({ ok: false });
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { href: '' }
        });

        try {
            await completeReset();
            fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

            expect(await screen.findByRole('alert')).toHaveTextContent(
                'No se pudo cerrar la sesión. Probá de nuevo.'
            );
            expect(window.location.href).toBe('');
            expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
                'href',
                SIGN_IN_URL
            );
            expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled();
        } finally {
            Object.defineProperty(window, 'location', {
                configurable: true,
                value: originalLocation
            });
        }
    });
});
