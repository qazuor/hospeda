/**
 * @file SignIn.client.test.tsx
 * @description Regression tests for the SignIn island's HOS-190 slice 3 email
 * guard. `noValidate` on the form disables the browser's native
 * `required`/`type="email"` enforcement, so before this change any string
 * (empty or malformed) reached `signIn.email()` and came back as a generic
 * Better Auth credentials error instead of a clear client-side message.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignIn } from '../../../src/components/auth/SignIn.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/auth/SignIn.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

const signInEmailMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    signIn: { email: (...args: unknown[]) => signInEmailMock(...args), social: vi.fn() }
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderIsland() {
    return render(
        <SignIn
            locale="es"
            redirectTo="/es/mi-cuenta/"
            showOAuth={false}
        />
    );
}

async function readyForm(): Promise<void> {
    // Wait for the hydrated tree before interacting with submit behavior.
    await screen.findByLabelText('Correo electrónico');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SignIn email guard (HOS-190 slice 3)', () => {
    beforeEach(() => {
        signInEmailMock.mockReset();
        signInEmailMock.mockResolvedValue({ error: null });
    });

    it('blocks submit and does not call signIn.email when email is empty', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: 'Whatever1!' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Ingresá tu correo electrónico.'
        );
        expect(signInEmailMock).not.toHaveBeenCalled();
    });

    it('blocks submit and does not call signIn.email when email is malformed', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'not-an-email' }
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: 'Whatever1!' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Ingresá un correo electrónico válido.'
        );
        expect(signInEmailMock).not.toHaveBeenCalled();
    });

    it('trims the email and calls signIn.email for a well-formed address', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: '  user@example.com  ' }
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: 'Whatever1!' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        await waitFor(() => {
            expect(signInEmailMock).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: 'Whatever1!'
            });
        });
    });

    it('server-renders the real sign-in form fields on first paint', () => {
        document.body.innerHTML = renderToStaticMarkup(
            <SignIn
                locale="es"
                redirectTo="/es/mi-cuenta/"
                showOAuth={false}
            />
        );

        expect(screen.getByRole('form', { name: 'Iniciar sesión' })).toBeInTheDocument();
        expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    });
});
