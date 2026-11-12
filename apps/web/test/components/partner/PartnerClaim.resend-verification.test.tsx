/**
 * @file PartnerClaim.resend-verification.test.tsx
 * @description Covers resending verification from the Partner claim flow (HOS-2045).
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PartnerClaim } from '../../../src/components/partner/PartnerClaim.client';
import { PENDING_ACTION_STORAGE_KEY } from '../../../src/lib/pending-action';

const mocks = vi.hoisted(() => ({
    user: { id: 'signed-in-user', name: 'Test', email: 'test@example.test' as string },
    permissions: [] as string[],
    claim: vi.fn(),
    resend: vi.fn(),
    refresh: vi.fn()
}));

vi.mock('../../../src/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({ user: mocks.user, permissions: mocks.permissions })
}));
vi.mock('../../../src/lib/api/endpoints-protected', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../src/lib/api/endpoints-protected')>();
    return { ...actual, partnersApi: { ...actual.partnersApi, claim: mocks.claim } };
});
vi.mock('../../../src/lib/auth-client', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/auth-client')>();
    return {
        ...actual,
        refreshBetterAuthSession: mocks.refresh,
        resendVerificationEmail: mocks.resend
    };
});
vi.mock('../../../src/components/partner/PartnerClaim.module.css', () => ({
    default: new Proxy(
        {
            card: 'card',
            heading: 'heading',
            message: 'message',
            button: 'button',
            link: 'link',
            error: 'error'
        },
        {
            get: (_target, property) => String(property)
        }
    )
}));

const PATH = '/es/partners/reclamar/';
const PARTNER_ID = 'd32b0f9b-0864-49d8-bf8f-0fb52c40fd15';
const SECRET = 'fragment-secret-value';

function setFragment(): void {
    window.history.replaceState(null, '', `${PATH}#partner=${PARTNER_ID}&secret=${SECRET}`);
}

async function enterVerifyEmailFirst(): Promise<void> {
    setFragment();
    render(<PartnerClaim locale="es" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));
    await screen.findByText(
        'Para reclamar este Partner con esta cuenta, primero verificá tu correo.'
    );
}

describe('HOS-2045 the Partner claim offers to resend the verification email', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        window.history.replaceState(null, '', PATH);
        mocks.user.email = 'test@example.test';
        mocks.claim.mockReset().mockResolvedValue({
            ok: false,
            error: { status: 403, reason: 'EMAIL_NOT_VERIFIED', message: 'x' }
        });
        mocks.resend.mockReset().mockResolvedValue({ data: { status: true } });
        mocks.refresh.mockReset();
    });

    it('shows the resend button in the verify-email-first state', async () => {
        // Arrange
        setFragment();
        render(<PartnerClaim locale="es" />);

        // Act
        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));

        // Assert
        expect(mocks.claim).toHaveBeenCalledTimes(1);
        expect(
            await screen.findByRole('button', { name: 'Reenviar verificación' })
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Escribir a soporte' })).toBeInTheDocument();
    });

    it('resends to the session email with the claim page as callback and keeps the claim pending', async () => {
        // Arrange
        await enterVerifyEmailFirst();

        // Act
        await userEvent.click(screen.getByRole('button', { name: 'Reenviar verificación' }));

        // Assert
        expect(mocks.resend).toHaveBeenCalledExactlyOnceWith({
            email: 'test@example.test',
            callbackURL: new URL('/es/partners/reclamar/', window.location.origin).href
        });
        expect(
            JSON.parse(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY) ?? 'null')
        ).toMatchObject({
            action: { kind: 'partner-claim', partnerId: PARTNER_ID, secret: SECRET },
            path: PATH
        });
        expect(
            await screen.findByText(
                'Listo: te reenviamos el correo de verificación. Cuando lo verifiques, volvé a abrir el link del correo de reclamo.'
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reenviar verificación' })).toBeNull();
    });

    it('shows the error and keeps the retry button', async () => {
        // Arrange
        mocks.resend.mockResolvedValue({ error: { status: 429 } });
        await enterVerifyEmailFirst();

        // Act
        await userEvent.click(screen.getByRole('button', { name: 'Reenviar verificación' }));

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No pudimos reenviar la verificación. Probá de nuevo en unos minutos.'
        );
        expect(screen.getByRole('button', { name: 'Reenviar verificación' })).toBeEnabled();
    });

    it('a double click sends only one request', async () => {
        // Arrange
        let finishResend:
            | ((result: { readonly data: { readonly status: boolean } }) => void)
            | undefined;
        mocks.resend.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishResend = resolve;
                })
        );
        await enterVerifyEmailFirst();
        const button = screen.getByRole('button', { name: 'Reenviar verificación' });

        // Act
        act(() => {
            button.click();
            button.click();
        });

        // Assert
        expect(mocks.resend).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'Reenviando…' })).toBeDisabled();
        finishResend?.({ data: { status: true } });
    });

    it('no button when the session has no email', async () => {
        // Arrange
        mocks.user.email = '';
        await enterVerifyEmailFirst();

        // Act
        const button = screen.queryByRole('button', { name: 'Reenviar verificación' });

        // Assert
        expect(button).toBeNull();
        expect(
            screen.getByText(
                'Para reclamar este Partner con esta cuenta, primero verificá tu correo.'
            )
        ).toBeInTheDocument();
    });

    it('other refusal states do not offer the resend', async () => {
        // Arrange
        mocks.claim.mockResolvedValue({
            ok: false,
            error: { status: 409, reason: 'PARTNER_ALREADY_CLAIMED', message: 'x' }
        });
        setFragment();
        render(<PartnerClaim locale="es" />);

        // Act
        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));

        // Assert
        expect(
            await screen.findByText(
                'Este Partner ya tiene dueño; si no fuiste vos, escribinos a soporte'
            )
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reenviar verificación' })).toBeNull();
    });
});
