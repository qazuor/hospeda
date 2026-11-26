/**
 * @file PartnerClaim.client.test.tsx
 * @description Covers one-time Partner claim links, confirmation and outcomes.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_ME_CACHE_KEY } from '../../../src/lib/auth-cache';
import { PENDING_ACTION_STORAGE_KEY, savePendingAction } from '../../../src/lib/pending-action';
import {
    CLAIMED,
    mocks,
    PARTNER_ID,
    PATH,
    renderClaim,
    restoreLocation,
    SECRET,
    setAuthenticated,
    setFragment,
    useClaimFixture
} from './partner-claim-fixture';

it('keeps the PartnerClaim flow suite within the 500-line limit', () => {
    const source = readFileSync(resolve(__dirname, 'PartnerClaim.client.test.tsx'), 'utf8');

    expect(source.trimEnd().split('\n').length).toBeLessThanOrEqual(500);
});

describe('PartnerClaim', () => {
    useClaimFixture();

    it('looks up the token and offers a fixed-email signup that signs in after claiming', async () => {
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        renderClaim();

        expect(
            await screen.findByText('Creá tu cuenta para reclamar el Partner')
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue('claim@example.test')).toHaveAttribute('readonly');
        expect(document.querySelector('input[type="email"]:not([readonly])')).toBeNull();
        await userEvent.type(screen.getByLabelText(/Contraseña/), 'StrongPass123!');
        await userEvent.type(screen.getByLabelText(/Confirmar contraseña/), 'StrongPass123!');
        await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta y reclamar' }));

        expect(mocks.lookup).toHaveBeenCalledWith({ partnerId: PARTNER_ID, secret: SECRET });
        expect(mocks.signUp).toHaveBeenCalledWith({
            partnerId: PARTNER_ID,
            secret: SECRET,
            password: 'StrongPass123!'
        });
        expect(mocks.signUp.mock.calls[0]?.[0]).not.toHaveProperty('email');
        expect(mocks.signInEmail).toHaveBeenCalledWith({
            email: 'claim@example.test',
            password: 'StrongPass123!'
        });
        expect(
            await screen.findByText('Listo: el Partner quedó vinculado a tu cuenta.')
        ).toBeInTheDocument();
        expect(mocks.resend).not.toHaveBeenCalled();
    });

    it('shows the fixed-email password sign-in for an existing mailbox account', async () => {
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.lookup.mockResolvedValue({
            ok: true,
            data: { email: 'claim@example.test', accountExists: true }
        });
        renderClaim();

        expect(
            await screen.findByText('Iniciá sesión para reclamar el Partner.')
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue('claim@example.test')).toHaveAttribute('readonly');
        expect(document.querySelector('input[type="email"]:not([readonly])')).toBeNull();
        await userEvent.type(screen.getByLabelText(/Contraseña/), 'ExistingPass123!');
        await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        expect(mocks.signInEmail).toHaveBeenCalledWith({
            email: 'claim@example.test',
            password: 'ExistingPass123!'
        });
        expect(
            await screen.findByText(
                'Vas a vincular este Partner a la cuenta con la que iniciaste sesión.'
            )
        ).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Reclamar el Partner' }));
        expect(
            await screen.findByText('Listo: el Partner quedó vinculado a tu cuenta.')
        ).toBeInTheDocument();
    });

    it('clears the fragment and saves the secret only as a pending action before sign-in', async () => {
        mocks.lookup.mockResolvedValue({
            ok: true,
            data: { email: 'claim@example.test', accountExists: true }
        });
        setFragment(`partner=${PARTNER_ID}&secret=${encodeURIComponent(SECRET)}`);
        const replaceState = vi.spyOn(window.history, 'replaceState');
        renderClaim();

        expect(
            await screen.findByText('Iniciá sesión para reclamar el Partner.')
        ).toBeInTheDocument();
        await waitFor(() => expect(window.location.hash).toBe(''));
        expect(replaceState).toHaveBeenCalledWith(null, '', PATH);

        const assign = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: { pathname: PATH, hash: '', assign }
        });
        await userEvent.click(screen.getByRole('button', { name: 'Entrar de otra forma' }));

        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
        const stored = JSON.parse(
            window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY) as string
        ) as { action: unknown; path: string };
        const savedAction = stored.action as {
            readonly kind: string;
            readonly partnerId: string;
            readonly secret: string;
        };
        expect(savedAction.kind).toBe('partner-claim');
        expect(savedAction.partnerId).toBe(PARTNER_ID);
        expect(savedAction.secret === SECRET).toBe(true);
        expect(stored.path).toBe(PATH);
        expect(assign).toHaveBeenCalledWith(
            '/es/auth/signin/?returnUrl=%2Fes%2Fpartners%2Freclamar%2F'
        );
        const signInUrl = String(assign.mock.calls[0]?.[0]);
        expect(signInUrl).toContain('returnUrl');
        expect(signInUrl.includes(SECRET)).toBe(false);
        expect(signInUrl).not.toContain(PARTNER_ID);
    });

    it('takes a pending action once and requires explicit confirmation', async () => {
        setAuthenticated(true);
        savePendingAction({
            action: { kind: 'partner-claim', partnerId: PARTNER_ID, secret: SECRET },
            path: PATH
        });
        renderClaim();

        expect(
            await screen.findByText(
                'Vas a vincular este Partner a la cuenta con la que iniciaste sesión.'
            )
        ).toBeInTheDocument();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY) === null).toBe(true);
        expect(mocks.claim).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', { name: 'Reclamar el Partner' }));
        expect(
            await screen.findByText('Listo: el Partner quedó vinculado a tu cuenta.')
        ).toBeInTheDocument();
        const claimCalls = mocks.claim.mock.calls;
        expect(claimCalls).toHaveLength(1);
        const submitted = claimCalls[0]?.[0] as Record<string, unknown>;
        expect(Object.keys(submitted).sort()).toEqual(['partnerId', 'secret']);
        expect(submitted.partnerId === PARTNER_ID).toBe(true);
        expect(submitted.secret === SECRET).toBe(true);
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it.each([
        {
            name: 'invalid request',
            status: 400,
            reason: undefined,
            text: 'El enlace no es válido'
        },
        {
            name: 'missing Partner',
            status: 404,
            reason: undefined,
            text: 'El enlace no es válido'
        },
        {
            name: 'already claimed',
            status: 409,
            reason: 'PARTNER_ALREADY_CLAIMED',
            text: 'Este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte'
        },
        {
            name: 'account already owns one',
            status: 409,
            reason: 'PARTNER_CLAIM_ACCOUNT_ALREADY_OWNS',
            text: 'Tu cuenta ya es dueña de un Partner. Cada cuenta administra un solo Partner: el segundo negocio se reclama con otra cuenta. Si necesitás ayuda, escribinos a soporte.'
        },
        {
            name: 'unverified account',
            status: 403,
            reason: 'EMAIL_NOT_VERIFIED',
            text: 'No pudimos completar el reclamo. Probá de nuevo en unos minutos.'
        },
        {
            name: 'server error',
            status: 500,
            reason: undefined,
            text: 'No pudimos completar el reclamo. Probá de nuevo en unos minutos.'
        }
    ])('shows the Spanish copy for $name', async ({ status, reason, text }) => {
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.claim.mockResolvedValue({
            ok: false,
            error: { status, reason, message: 'technical message' }
        });
        renderClaim();

        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));
        expect(await screen.findByText(text)).toBeInTheDocument();
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('tells an account that slipped past the check to use the claim-mailbox account (403 safety net) (HOS-2222)', async () => {
        // Arrange
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.claim.mockResolvedValue({
            ok: false,
            error: {
                status: 403,
                reason: 'PARTNER_CLAIM_EMAIL_MISMATCH',
                message: 'technical message'
            }
        });
        renderClaim();

        // Act
        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));

        // Assert
        expect(
            await screen.findByText(
                'Este Partner solo se puede reclamar con la cuenta del correo al que se envió el link de reclamo. Cerrá sesión e iniciá sesión con esa cuenta. Si el Partner es tuyo pero querés administrarlo con otro correo, escribinos a Hospeda.'
            )
        ).toBeInTheDocument();
        expect(screen.getByText('Iniciaste sesión como test@example.test.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Escribir a soporte' })).toHaveAttribute(
            'href',
            expect.stringContaining('contacto')
        );
        expect(
            screen.getByRole('button', { name: 'Cerrar sesión y continuar' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reclamar el Partner' })).toBeNull();
        expect(mocks.refresh).not.toHaveBeenCalled();
        const reload = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: { pathname: PATH, hash: '', reload }
        });
        mocks.signOut.mockImplementation(async () => {
            expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
            return undefined;
        });
        await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión y continuar' }));
        expect(mocks.signOut).toHaveBeenCalledOnce();
        expect(reload).toHaveBeenCalledOnce();
    });

    it('drops the cached signed-in /auth/me snapshot on sign out, so the reload does not resume as the old account (HOS-2338)', async () => {
        // Arrange
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.claim.mockResolvedValue({
            ok: false,
            error: { status: 403, reason: 'PARTNER_CLAIM_EMAIL_MISMATCH', message: 'x' }
        });
        renderClaim();
        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));
        const button = await screen.findByRole('button', { name: 'Cerrar sesión y continuar' });
        window.sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: mocks.user,
                permissions: [],
                roles: ['USER'],
                cachedAt: Date.now()
            })
        );
        const reload = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: { pathname: PATH, hash: '', reload }
        });

        // Act
        await userEvent.click(button);

        // Assert
        expect(window.sessionStorage.getItem(AUTH_ME_CACHE_KEY)).toBeNull();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
        expect(reload).toHaveBeenCalledOnce();
    });

    it('does not reload into the old session when the sign out fails, and erases the saved secret (HOS-2338)', async () => {
        // Arrange
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.claim.mockResolvedValue({
            ok: false,
            error: { status: 403, reason: 'PARTNER_CLAIM_EMAIL_MISMATCH', message: 'x' }
        });
        renderClaim();
        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));
        const button = await screen.findByRole('button', { name: 'Cerrar sesión y continuar' });
        const reload = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: { pathname: PATH, hash: '', reload }
        });
        mocks.signOut.mockResolvedValue({ error: { message: 'boom' } });

        // Act
        await userEvent.click(button);

        // Assert
        expect(reload).not.toHaveBeenCalled();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).toBeNull();
        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('renders the email mismatch copy in English and Portuguese', async () => {
        for (const [locale, copy, signedInAs] of [
            [
                'en',
                'This Partner can only be claimed with the account for the email address the claim link was sent to. Sign out and sign in with that account. If the Partner is yours but you want to manage it with a different email address, contact Hospeda.',
                'You are signed in as test@example.test.'
            ],
            [
                'pt',
                'Este Partner só pode ser reivindicado com a conta do e-mail para o qual o link de reivindicação foi enviado. Saia e entre com essa conta. Se o Partner é seu, mas você quer administrá-lo com outro e-mail, fale com a Hospeda.',
                'Você entrou como test@example.test.'
            ]
        ] as const) {
            // Arrange
            setAuthenticated(true);
            setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
            mocks.claim.mockResolvedValue({
                ok: false,
                error: { status: 403, reason: 'PARTNER_CLAIM_EMAIL_MISMATCH', message: 'x' }
            });
            const view = renderClaim({ locale });
            const confirmName = locale === 'en' ? 'Claim the Partner' : 'Reivindicar o Partner';

            // Act
            await userEvent.click(await screen.findByRole('button', { name: confirmName }));

            // Assert
            expect(await screen.findByText(copy)).toBeInTheDocument();
            expect(screen.getByText(signedInAs)).toBeInTheDocument();
            view.unmount();
        }
    });

    it('sends only one claim when confirmation is double-clicked', async () => {
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        let finishClaim: ((result: unknown) => void) | undefined;
        mocks.claim.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishClaim = resolve;
                })
        );
        renderClaim();

        await userEvent.dblClick(
            await screen.findByRole('button', { name: 'Reclamar el Partner' })
        );
        await waitFor(() => expect(mocks.claim).toHaveBeenCalledOnce());
        finishClaim?.({ ok: true, data: CLAIMED });
        expect(
            await screen.findByText('Listo: el Partner quedó vinculado a tu cuenta.')
        ).toBeInTheDocument();
    });

    describe('wrong account detected before the claim (HOS-2353)', () => {
        const WARNING =
            'Este Partner solo se puede reclamar con la cuenta del correo al que llegó el link. Ahora estás con otra cuenta.';

        beforeEach(() => {
            setAuthenticated(true);
            setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
            mocks.checkClaim.mockResolvedValue({ ok: true, data: { emailMatches: false } });
        });

        it('warns before any click, offers sign-out, and never offers or calls the claim', async () => {
            renderClaim();

            expect(await screen.findByText(WARNING)).toBeInTheDocument();
            expect(mocks.checkClaim).toHaveBeenCalledExactlyOnceWith({
                partnerId: PARTNER_ID,
                secret: SECRET
            });
            expect(
                screen.getByText('Iniciaste sesión como test@example.test.')
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Cerrar sesión y continuar' })
            ).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Reclamar el Partner' })).toBeNull();
            expect(mocks.claim).not.toHaveBeenCalled();
            expect(document.body.textContent).not.toContain('claim@example.test');
        });

        it('still reaches the sign-in flow after signing out, dropping the cached account (HOS-2338)', async () => {
            renderClaim();
            const button = await screen.findByRole('button', { name: 'Cerrar sesión y continuar' });
            window.sessionStorage.setItem(
                AUTH_ME_CACHE_KEY,
                JSON.stringify({
                    isAuthenticated: true,
                    user: mocks.user,
                    permissions: [],
                    roles: ['USER'],
                    cachedAt: Date.now()
                })
            );
            const reload = vi.fn();
            Object.defineProperty(window, 'location', {
                configurable: true,
                writable: true,
                value: { pathname: PATH, hash: '', reload }
            });

            await userEvent.click(button);

            expect(mocks.signOut).toHaveBeenCalledOnce();
            expect(window.sessionStorage.getItem(AUTH_ME_CACHE_KEY)).toBeNull();
            expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
            expect(reload).toHaveBeenCalledOnce();

            // After the reload the guest resumes through the pending action and lookup.
            setAuthenticated(false);
            mocks.lookup.mockResolvedValue({
                ok: true,
                data: { email: 'claim@example.test', accountExists: true }
            });
            restoreLocation();
            window.history.replaceState(null, '', PATH);
            renderClaim();
            expect(
                await screen.findByText('Iniciá sesión para reclamar el Partner.')
            ).toBeInTheDocument();
        });

        it('goes to confirm when the account matches', async () => {
            mocks.checkClaim.mockResolvedValue({ ok: true, data: { emailMatches: true } });
            renderClaim();

            expect(
                await screen.findByRole('button', { name: 'Reclamar el Partner' })
            ).toBeInTheDocument();
            expect(screen.queryByText(WARNING)).toBeNull();
        });

        it('renders the warning in English and Portuguese', async () => {
            for (const [locale, copy] of [
                [
                    'en',
                    'This Partner can only be claimed with the account for the email address the link was sent to. You are currently signed in with a different account.'
                ],
                [
                    'pt',
                    'Este Partner só pode ser reivindicado com a conta do e-mail para o qual o link foi enviado. Agora você está com outra conta.'
                ]
            ] as const) {
                setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
                const view = renderClaim({ locale });
                expect(await screen.findByText(copy)).toBeInTheDocument();
                view.unmount();
            }
        });
    });
});
