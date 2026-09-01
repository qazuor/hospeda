/**
 * @file AuthTabs.client.test.tsx
 * @description RTL tests for the unified sign-in/sign-up island (HOS-959).
 * Covers what moved INTO this component from `SignIn.client.tsx` /
 * `SignUp.client.tsx`: the shared OAuth block, the ARIA tab pattern, the
 * `email` value surviving a tab switch, and the `history.replaceState`
 * tab-switch URL rewrite that preserves the query string.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthTabs } from '../../../src/components/auth/AuthTabs.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

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

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

const signInSocialMock = vi.fn();
const signInEmailMock = vi.fn();
const signUpEmailMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    signIn: {
        email: (...args: unknown[]) => signInEmailMock(...args),
        social: (...args: unknown[]) => signInSocialMock(...args)
    },
    signUp: { email: (...args: unknown[]) => signUpEmailMock(...args) }
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SIGN_IN_PATH = '/es/auth/signin/';
const SIGN_UP_PATH = '/es/auth/signup/';

function renderAuthTabs(overrides: Partial<Parameters<typeof AuthTabs>[0]> = {}) {
    return render(
        <AuthTabs
            locale="es"
            initialTab="signin"
            signInPath={SIGN_IN_PATH}
            signUpPath={SIGN_UP_PATH}
            signInConfig={{
                redirectTo: 'https://hospeda.com.ar/es/mi-cuenta/',
                externalRedirect: false
            }}
            signUpConfig={{
                redirectTo: 'https://hospeda.com.ar/es/auth/verify-email-sent/',
                oauthRedirectTo: 'https://hospeda.com.ar/es/mi-cuenta/',
                oauthExternalRedirect: false
            }}
            {...overrides}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthTabs — tab structure and ARIA', () => {
    beforeEach(() => {
        signInSocialMock.mockReset();
        signInEmailMock.mockReset();
        signUpEmailMock.mockReset();
        signInSocialMock.mockResolvedValue(undefined);
        window.history.pushState({}, '', 'http://localhost:3000/es/auth/signin/');
    });

    it('renders both tabs on arrival', () => {
        renderAuthTabs();

        expect(screen.getByRole('tab', { name: 'Ingresar' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Registrarse' })).toBeInTheDocument();
    });

    it('honors initialTab="signin" — sign-in form mounted, aria-selected on the right tab', () => {
        renderAuthTabs({ initialTab: 'signin' });

        expect(screen.getByRole('tab', { name: 'Ingresar' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByRole('tab', { name: 'Registrarse' })).toHaveAttribute(
            'aria-selected',
            'false'
        );
        expect(screen.getByLabelText(/Correo electrónico/)).toBeInTheDocument();
        // Sign-up-only field must NOT be mounted.
        expect(screen.queryByLabelText(/Confirmar contraseña/)).not.toBeInTheDocument();
    });

    it('honors initialTab="signup" — sign-up form mounted, aria-selected on the right tab', () => {
        renderAuthTabs({ initialTab: 'signup' });

        expect(screen.getByRole('tab', { name: 'Registrarse' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByRole('tab', { name: 'Ingresar' })).toHaveAttribute(
            'aria-selected',
            'false'
        );
        expect(screen.getByLabelText(/Confirmar contraseña/)).toBeInTheDocument();
    });

    it('exposes the ARIA tab pattern: tablist, tabs, tabpanel', () => {
        renderAuthTabs();

        const tablist = screen.getByRole('tablist');
        expect(tablist).toHaveAccessibleName();
        expect(within(tablist).getAllByRole('tab')).toHaveLength(2);

        const panel = screen.getByRole('tabpanel');
        expect(panel).toBeInTheDocument();
        const signInTab = screen.getByRole('tab', { name: 'Ingresar' });
        expect(panel).toHaveAttribute('aria-labelledby', signInTab.id);
    });

    it('switching tabs swaps the mounted form (conditional render, not CSS hiding)', () => {
        renderAuthTabs({ initialTab: 'signin' });

        fireEvent.click(screen.getByRole('tab', { name: 'Registrarse' }));

        expect(screen.getByRole('tab', { name: 'Registrarse' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByLabelText(/Confirmar contraseña/)).toBeInTheDocument();
        // Only one email input exists at a time.
        expect(screen.getAllByLabelText(/Correo electrónico/)).toHaveLength(1);
    });

    it('keyboard navigation (ArrowRight/ArrowLeft) moves focus and activates the other tab', () => {
        renderAuthTabs({ initialTab: 'signin' });

        const signInTab = screen.getByRole('tab', { name: 'Ingresar' });
        const signUpTab = screen.getByRole('tab', { name: 'Registrarse' });
        signInTab.focus();

        fireEvent.keyDown(signInTab, { key: 'ArrowRight' });
        expect(signUpTab).toHaveFocus();
        expect(signUpTab).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(signUpTab, { key: 'ArrowLeft' });
        expect(signInTab).toHaveFocus();
        expect(signInTab).toHaveAttribute('aria-selected', 'true');
    });

    it('keyboard Home/End jump directly to sign-in/sign-up', () => {
        renderAuthTabs({ initialTab: 'signin' });

        const signInTab = screen.getByRole('tab', { name: 'Ingresar' });
        signInTab.focus();

        fireEvent.keyDown(signInTab, { key: 'End' });
        expect(screen.getByRole('tab', { name: 'Registrarse' })).toHaveAttribute(
            'aria-selected',
            'true'
        );

        fireEvent.keyDown(screen.getByRole('tab', { name: 'Registrarse' }), { key: 'Home' });
        expect(screen.getByRole('tab', { name: 'Ingresar' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
    });
});

describe('AuthTabs — email survives a tab switch (HOS-959 core requirement)', () => {
    beforeEach(() => {
        window.history.pushState({}, '', 'http://localhost:3000/es/auth/signin/');
    });

    it('keeps the typed email when switching from sign-in to sign-up', () => {
        renderAuthTabs({ initialTab: 'signin' });

        fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
            target: { value: 'visitor@example.com' }
        });

        fireEvent.click(screen.getByRole('tab', { name: 'Registrarse' }));

        expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue('visitor@example.com');
    });

    it('keeps the typed email when switching from sign-up back to sign-in', () => {
        renderAuthTabs({ initialTab: 'signup' });

        fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
            target: { value: 'newcomer@example.com' }
        });

        fireEvent.click(screen.getByRole('tab', { name: 'Ingresar' }));

        expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue('newcomer@example.com');
    });
});

describe('AuthTabs — shared OAuth block', () => {
    beforeEach(() => {
        signInSocialMock.mockReset();
        signInSocialMock.mockResolvedValue(undefined);
        window.history.pushState({}, '', 'http://localhost:3000/es/auth/signin/');
    });

    it('renders exactly one Google and one Facebook button, outside either form', () => {
        renderAuthTabs();

        const googleButton = screen.getByRole('button', { name: /Continuar con Google/ });
        const facebookButton = screen.getByRole('button', { name: /Continuar con Facebook/ });
        expect(googleButton).toBeInTheDocument();
        expect(facebookButton).toBeInTheDocument();
        expect(googleButton.closest('form')).toBeNull();
        expect(facebookButton.closest('form')).toBeNull();
    });

    it('stays the single instance when switching tabs (not duplicated per form)', () => {
        renderAuthTabs({ initialTab: 'signin' });
        fireEvent.click(screen.getByRole('tab', { name: 'Registrarse' }));

        expect(screen.getAllByRole('button', { name: /Continuar con Google/ })).toHaveLength(1);
    });

    // NOTE: when externalRedirect is false, `resolvePostAuthRedirectUrl`
    // deliberately strips whatever host `target` carries and reattaches
    // `window.location.origin` (the reverse-proxy `https://localhost` fix —
    // see `post-auth-redirect.ts`). The test window's origin under jsdom is
    // `http://localhost:3000`, so that — not the configured redirectTo's
    // own host — is what the resulting callbackURL carries. Only the PATH
    // survives verbatim.
    it('uses signInConfig.redirectTo (path only, reattached to the current origin) while the sign-in tab is active', async () => {
        renderAuthTabs({
            initialTab: 'signin',
            signInConfig: {
                redirectTo: 'https://hospeda.com.ar/es/mi-cuenta/reservas/',
                externalRedirect: false
            }
        });

        fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }));

        await waitFor(() => expect(signInSocialMock).toHaveBeenCalledTimes(1));
        const call = signInSocialMock.mock.calls[0][0];
        expect(call.provider).toBe('google');
        expect(call.callbackURL).toBe('http://localhost:3000/es/mi-cuenta/reservas/');
    });

    it('uses signUpConfig.oauthRedirectTo (path only, reattached to the current origin) while the sign-up tab is active', async () => {
        // signInConfig.redirectTo is DELIBERATELY a different path here — if
        // the handler ever used the wrong tab's config (e.g. always
        // signInConfig, regardless of activeTab) this assertion must catch
        // it. Sharing the same path between the two configs would make this
        // test pass either way, which defeats the point.
        renderAuthTabs({
            initialTab: 'signup',
            signInConfig: {
                redirectTo: 'https://hospeda.com.ar/es/WRONG-TAB-CONFIG/',
                externalRedirect: false
            },
            signUpConfig: {
                redirectTo: 'https://hospeda.com.ar/es/auth/verify-email-sent/',
                oauthRedirectTo: 'https://hospeda.com.ar/es/mi-cuenta/',
                oauthExternalRedirect: false
            }
        });

        fireEvent.click(screen.getByRole('button', { name: /Continuar con Facebook/ }));

        await waitFor(() => expect(signInSocialMock).toHaveBeenCalledTimes(1));
        const call = signInSocialMock.mock.calls[0][0];
        expect(call.provider).toBe('facebook');
        expect(call.callbackURL).toBe('http://localhost:3000/es/mi-cuenta/');
    });

    it('uses the target verbatim when externalRedirect is set (SPEC-182 callbackUrl)', async () => {
        renderAuthTabs({
            initialTab: 'signin',
            signInConfig: {
                redirectTo: 'https://admin.hospeda.com.ar/dashboard',
                externalRedirect: true
            }
        });

        fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ }));

        await waitFor(() => expect(signInSocialMock).toHaveBeenCalledTimes(1));
        expect(signInSocialMock.mock.calls[0][0].callbackURL).toBe(
            'https://admin.hospeda.com.ar/dashboard'
        );
    });

    it('shows the OAuth failure banner from initialOAuthError', () => {
        renderAuthTabs({ initialOAuthError: { code: 'access_denied', provider: 'google' } });

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});

describe('AuthTabs — tab-switch URL rewrite (history.replaceState)', () => {
    beforeEach(() => {
        window.history.pushState(
            {},
            '',
            'http://localhost:3000/es/auth/signin/?returnUrl=/es/mi-cuenta/&foo=bar'
        );
    });

    it('rewrites the pathname to signUpPath while preserving the entire query string', () => {
        renderAuthTabs({ initialTab: 'signin' });

        fireEvent.click(screen.getByRole('tab', { name: 'Registrarse' }));

        expect(window.location.pathname).toBe(SIGN_UP_PATH);
        expect(window.location.search).toBe('?returnUrl=/es/mi-cuenta/&foo=bar');
    });

    it('rewrites back to signInPath, still preserving the query string', () => {
        renderAuthTabs({ initialTab: 'signup' });

        fireEvent.click(screen.getByRole('tab', { name: 'Ingresar' }));

        expect(window.location.pathname).toBe(SIGN_IN_PATH);
        expect(window.location.search).toBe('?returnUrl=/es/mi-cuenta/&foo=bar');
    });

    it('does not throw when history.replaceState is unavailable (defensive try/catch)', () => {
        const original = window.history.replaceState;
        // @ts-expect-error — deliberately breaking the API to prove the
        // component tolerates a throwing replaceState rather than crashing.
        window.history.replaceState = () => {
            throw new Error('replaceState blocked');
        };

        renderAuthTabs({ initialTab: 'signin' });

        expect(() =>
            fireEvent.click(screen.getByRole('tab', { name: 'Registrarse' }))
        ).not.toThrow();
        // The tab still switches even though the URL cosmetic failed.
        expect(screen.getByRole('tab', { name: 'Registrarse' })).toHaveAttribute(
            'aria-selected',
            'true'
        );

        window.history.replaceState = original;
    });
});
