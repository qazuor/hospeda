/**
 * @file AuthTabs.active-session.test.tsx
 * @description BETA-216: the sign-in island shows an "already signed in"
 * interstitial when the page hands it an open session, instead of the forms.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthTabs } from '../../../src/components/auth/AuthTabs.client';

vi.mock('../../../src/components/auth/AuthTabs.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/auth/AuthOAuthButtons.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/auth/SignIn.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/auth/SignUp.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));
vi.mock('../../../src/components/auth/ActiveSessionNotice.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string, params?: Record<string, string>): string =>
        (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_m, name: string) => params?.[name] ?? '');
    return { createTranslations: () => ({ t }) };
});

vi.mock('../../../src/lib/auth-client', () => ({
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() }
}));

const signOutHelperMock = vi.fn();
vi.mock('../../../src/lib/sign-out', () => ({
    signOutAndClearClientState: () => signOutHelperMock()
}));

const CONTINUE_URL = 'https://admin.hospeda.com.ar/es/dashboard/';

function renderIsland(withSession: boolean) {
    return render(
        <AuthTabs
            locale="es"
            initialTab="signin"
            signInPath="/es/auth/signin/"
            signUpPath="/es/auth/signup/"
            signInConfig={{ redirectTo: CONTINUE_URL, externalRedirect: true }}
            signUpConfig={{
                redirectTo: '/es/auth/verify-email-sent/',
                verificationCallbackUrl: 'https://hospeda.com.ar/es/mi-cuenta/',
                oauthRedirectTo: CONTINUE_URL
            }}
            activeSession={
                withSession ? { email: 'admin@hospeda.test', continueUrl: CONTINUE_URL } : undefined
            }
        />
    );
}

describe('AuthTabs with an open session (BETA-216)', () => {
    beforeEach(() => {
        signOutHelperMock.mockReset();
        signOutHelperMock.mockResolvedValue({ ok: true });
    });

    it('shows the normal forms when there is no session', () => {
        renderIsland(false);

        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.queryByText(/Ya iniciaste sesión como/)).toBeNull();
    });

    it('names the account and offers Continue to the validated destination', () => {
        renderIsland(true);

        expect(screen.getByText('Ya iniciaste sesión como admin@hospeda.test')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Continuar' })).toHaveAttribute(
            'href',
            CONTINUE_URL
        );
        expect(screen.queryByRole('tablist')).toBeNull();
    });

    it('signs out on "Usar otra cuenta" and then shows the sign-in form', async () => {
        renderIsland(true);

        fireEvent.click(screen.getByRole('button', { name: 'Usar otra cuenta' }));

        await waitFor(() => expect(screen.getByRole('tablist')).toBeInTheDocument());
        expect(signOutHelperMock).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Ya iniciaste sesión como/)).toBeNull();
    });

    it('keeps the interstitial and reports an error when the sign-out fails', async () => {
        signOutHelperMock.mockResolvedValue({ ok: false });
        renderIsland(true);

        fireEvent.click(screen.getByRole('button', { name: 'Usar otra cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión');
        expect(screen.queryByRole('tablist')).toBeNull();
    });
});
