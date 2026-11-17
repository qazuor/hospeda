/**
 * @file PartnerClaim.client.test.tsx
 * @description Covers one-time Partner claim links, confirmation and outcomes.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PartnerClaim } from '../../../src/components/partner/PartnerClaim.client';
import { PENDING_ACTION_STORAGE_KEY, savePendingAction } from '../../../src/lib/pending-action';

const mocks = vi.hoisted(() => ({
    authenticated: false,
    user: { id: 'signed-in-user', name: 'Test', email: 'test@example.test' },
    permissions: [] as string[],
    claim: vi.fn(),
    refresh: vi.fn(),
    lookup: vi.fn(),
    signUp: vi.fn(),
    signInEmail: vi.fn(),
    signOut: vi.fn(),
    resend: vi.fn()
}));

vi.mock('../../../src/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({
        user: mocks.authenticated ? mocks.user : null,
        permissions: mocks.permissions
    })
}));

vi.mock('../../../src/lib/api/endpoints-protected', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/lib/api/endpoints-protected')>();
    return {
        ...actual,
        partnersApi: { ...actual.partnersApi, claim: mocks.claim }
    };
});

vi.mock('../../../src/lib/auth-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/auth-client')>();
    return {
        ...actual,
        refreshBetterAuthSession: mocks.refresh,
        signIn: { ...actual.signIn, email: mocks.signInEmail },
        signOut: mocks.signOut,
        resendVerificationEmail: mocks.resend
    };
});

vi.mock('../../../src/lib/api/endpoints', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/api/endpoints')>();
    return { ...actual, partnerClaimsPublicApi: { lookup: mocks.lookup, signUp: mocks.signUp } };
});

vi.mock('../../../src/components/partner/PartnerClaim.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, property) => String(property)
    })
}));

const PATH = '/es/partners/reclamar/';
const PARTNER_ID = 'd32b0f9b-0864-49d8-bf8f-0fb52c40fd15';
const SECRET = 'fragment-secret-value';
const CLAIMED = { claimed: true as const, partnerId: PARTNER_ID, emailVerified: false };
let locationDescriptor: PropertyDescriptor;

function setFragment(fragment: string): void {
    window.history.replaceState(null, '', `${PATH}#${fragment}`);
}

function setAuthenticated(authenticated: boolean): void {
    mocks.authenticated = authenticated;
}

function renderClaim() {
    return render(<PartnerClaim locale="es" />);
}

describe('PartnerClaim', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        window.history.replaceState(null, '', PATH);
        locationDescriptor = Object.getOwnPropertyDescriptor(
            window,
            'location'
        ) as PropertyDescriptor;
        mocks.authenticated = false;
        mocks.claim.mockReset().mockResolvedValue({ ok: true, data: CLAIMED });
        mocks.refresh.mockReset().mockResolvedValue(undefined);
        mocks.lookup.mockReset().mockResolvedValue({
            ok: true,
            data: { email: 'claim@example.test', accountExists: false }
        });
        mocks.signUp.mockReset().mockResolvedValue({ ok: true, data: { claimed: true } });
        mocks.signInEmail.mockReset().mockResolvedValue({ data: {} });
        mocks.signOut.mockReset().mockResolvedValue(undefined);
        mocks.resend.mockReset();
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', locationDescriptor);
        vi.restoreAllMocks();
    });

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
            text: 'No encontramos este Partner. Revisá que el link esté completo.'
        },
        {
            name: 'missing Partner',
            status: 404,
            reason: undefined,
            text: 'No encontramos este Partner. Revisá que el link esté completo.'
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

    it('tells an account with a different email to use the application account or contact Hospeda (HOS-2222)', async () => {
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
                'Este Partner solo se puede reclamar con la cuenta del correo con el que se hizo la solicitud. Cerrá sesión e iniciá sesión con esa cuenta. Si el Partner es tuyo pero querés administrarlo con otro correo, escribinos a Hospeda.'
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

    it('renders the email mismatch copy in English and Portuguese', async () => {
        for (const [locale, copy, signedInAs] of [
            [
                'en',
                'This Partner can only be claimed with the account for the email address used in the application. Sign out and sign in with that account. If the Partner is yours but you want to manage it with a different email address, contact Hospeda.',
                'You are signed in as test@example.test.'
            ],
            [
                'pt',
                'Este Partner só pode ser reivindicado com a conta do e-mail usado na solicitação. Saia e entre com essa conta. Se o Partner é seu, mas você quer administrá-lo com outro e-mail, fale com a Hospeda.',
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
            const view = render(<PartnerClaim locale={locale} />);
            const confirmName = locale === 'en' ? 'Claim the Partner' : 'Reivindicar o Partner';

            // Act
            await userEvent.click(await screen.findByRole('button', { name: confirmName }));

            // Assert
            expect(await screen.findByText(copy)).toBeInTheDocument();
            expect(screen.getByText(signedInAs)).toBeInTheDocument();
            view.unmount();
        }
    });

    it('returns to sign-in and re-saves the pending action after a 401', async () => {
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.claim.mockResolvedValue({
            ok: false,
            error: { status: 401, message: 'unauthorized' }
        });
        renderClaim();
        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));

        expect(
            await screen.findByText('Iniciá sesión para reclamar el Partner.')
        ).toBeInTheDocument();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
    });

    it.each([
        { name: 'fragment without secret', fragment: `partner=${PARTNER_ID}` },
        { name: 'non-UUID partner id', fragment: `partner=not-a-uuid&secret=${SECRET}` }
    ])('does not call the API for a $name', async ({ fragment }) => {
        setAuthenticated(true);
        setFragment(fragment);
        renderClaim();

        expect(
            await screen.findByText(
                'No encontramos este Partner. Revisá que el link esté completo.'
            )
        ).toBeInTheDocument();
        expect(mocks.claim).not.toHaveBeenCalled();
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
});
