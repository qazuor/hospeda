// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerificationDelivery } from '../../src/components/auth/VerificationDelivery.client';
import { AccessDeniedActions } from '../../src/components/shared/AccessDeniedActions.client';
import { saveVerificationDelivery } from '../../src/lib/verification-delivery';

const { resend, session } = vi.hoisted(() => ({ resend: vi.fn(), session: vi.fn() }));
vi.mock('../../src/lib/auth-client', () => ({ resendVerificationEmail: resend }));
vi.mock('../../src/hooks/use-account-permissions', () => ({ useAccountPermissions: session }));

afterEach(() => {
    sessionStorage.clear();
    resend.mockReset();
    vi.useRealTimers();
});

describe('verification delivery', () => {
    it('has no recipient or resend on a direct visit', () => {
        render(
            <VerificationDelivery
                locale="en"
                signInHref="/en/auth/signin/"
            />
        );

        expect(screen.getByRole('link')).toHaveAttribute('href', '/en/auth/signin/');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows the recipient, waits 60 seconds and sends the original callback once', async () => {
        vi.useFakeTimers();
        const delivery = {
            email: 'traveler@example.test',
            callbackURL: 'https://example.test/es/mi-cuenta/'
        };
        resend.mockResolvedValue({ error: null });
        saveVerificationDelivery(delivery);
        render(
            <VerificationDelivery
                locale="es"
                signInHref="/es/auth/signin/"
            />
        );
        expect(screen.getByText(/traveler@example\.test/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reenviar en 60 s' })).toBeDisabled();

        act(() => vi.advanceTimersByTime(60_000));
        await act(async () =>
            fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo' }))
        );

        expect(resend).toHaveBeenCalledExactlyOnceWith(delivery);
        expect(screen.getByRole('button', { name: 'Reenviar en 60 s' })).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent(/recibirás otro correo/);
    });
});

describe('access denial recovery', () => {
    it('offers only the home action while the session is unresolved', () => {
        session.mockReturnValue({ user: null, isResolved: false });

        render(<AccessDeniedActions locale="es" />);

        const home = screen.getByRole('link');
        expect(home).toHaveAttribute('href', '/es/');
        expect(home).toHaveClass('btn-gradient--primary');
    });

    it.each([
        [null, 'Iniciar sesión', '/es/auth/signin/', /cuenta autorizada/],
        [{ id: 'test-user' }, 'Ir a mi cuenta', '/es/mi-cuenta/', /no tiene permisos/]
    ])('gives the right primary action for session %j', (user, label, href, copy) => {
        session.mockReturnValue({ user, isResolved: true });

        render(<AccessDeniedActions locale="es" />);

        expect(screen.getByText(copy)).toBeInTheDocument();
        const [primary, secondary] = screen.getAllByRole('link');
        expect(primary).toHaveAccessibleName(label);
        expect(primary).toHaveAttribute('href', href);
        expect(primary).toHaveClass('btn-gradient--primary');
        expect(secondary).toHaveAttribute('href', '/es/');
    });
});
