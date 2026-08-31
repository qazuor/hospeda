/**
 * @file SignIn.client.test.tsx
 * @description Regression tests for the SignIn island's HOS-190 slice 3 email
 * guard. `noValidate` on the form disables the browser's native
 * `required`/`type="email"` enforcement, so before this change any string
 * (empty or malformed) reached `signIn.email()` and came back as a generic
 * Better Auth credentials error instead of a clear client-side message.
 *
 * HOS-959: `email` is now a controlled prop owned by the parent (`AuthTabs`
 * in production) instead of local state, so every render here goes through
 * a tiny `Harness` wrapper that supplies `email`/`onEmailChange` the same
 * way `AuthTabs` does. The OAuth block moved out entirely — see
 * `AuthTabs.client.test.tsx` for that coverage.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignIn, type SignInProps } from '../../../src/components/auth/SignIn.client';

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

type HarnessProps = Omit<SignInProps, 'email' | 'onEmailChange'> & {
    readonly initialEmail?: string;
};

/** Owns the controlled `email` value the way `AuthTabs` does in production. */
function Harness({ initialEmail = '', ...props }: HarnessProps) {
    const [email, setEmail] = useState(initialEmail);
    return (
        <SignIn
            {...props}
            email={email}
            onEmailChange={setEmail}
        />
    );
}

function renderIsland() {
    return render(
        <Harness
            locale="es"
            redirectTo="/es/mi-cuenta/"
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

        fireEvent.change(screen.getByLabelText(/^Contraseña/), {
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
        fireEvent.change(screen.getByLabelText(/^Contraseña/), {
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
        fireEvent.change(screen.getByLabelText(/^Contraseña/), {
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
                email=""
                onEmailChange={() => {}}
            />
        );

        expect(screen.getByRole('form', { name: 'Iniciar sesión' })).toBeInTheDocument();
        expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
        expect(screen.getByLabelText(/^Contraseña/)).toBeInTheDocument();
    });
});

describe('SignIn controlled email (HOS-959)', () => {
    beforeEach(() => {
        // The SSR test in the previous describe block writes straight into
        // document.body, which RTL's auto-cleanup does not own and
        // therefore leaves behind — reset it or getByLabelText below can
        // pick up the stale SSR markup instead of this test's own render.
        document.body.innerHTML = '';
        signInEmailMock.mockReset();
        signInEmailMock.mockResolvedValue({ error: null });
    });

    it('renders the value handed in via the email prop', async () => {
        render(
            <Harness
                locale="es"
                redirectTo="/es/mi-cuenta/"
                initialEmail="preset@example.com"
            />
        );
        await readyForm();

        expect(screen.getByLabelText('Correo electrónico')).toHaveValue('preset@example.com');
    });

    it('calls onEmailChange on every keystroke instead of managing its own state', async () => {
        const onEmailChange = vi.fn();
        render(
            <SignIn
                locale="es"
                redirectTo="/es/mi-cuenta/"
                email=""
                onEmailChange={onEmailChange}
            />
        );
        await readyForm();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'typed@example.com' }
        });

        expect(onEmailChange).toHaveBeenCalledWith('typed@example.com');
    });
});

describe('SignIn password reveal (HOS-796)', () => {
    beforeEach(() => {
        // The SSR test above writes straight into document.body, which RTL's
        // auto-cleanup does not own and therefore leaves behind. Without this
        // reset, every query here finds two of each control.
        document.body.innerHTML = '';
        signInEmailMock.mockReset();
        signInEmailMock.mockResolvedValue({ error: null });
    });

    it('offers a reveal control next to the password field', () => {
        renderIsland();

        expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
    });

    it('unmasks the password when the control is activated, and masks it again', () => {
        renderIsland();

        const input = screen.getByLabelText(/^Contraseña/);
        expect(input).toHaveAttribute('type', 'password');

        fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
        expect(input).toHaveAttribute('type', 'text');

        fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
        expect(input).toHaveAttribute('type', 'password');
    });

    it('keeps the typed value intact across a reveal round-trip', () => {
        renderIsland();

        const input = screen.getByLabelText(/^Contraseña/);
        fireEvent.change(input, { target: { value: 'Secreta1!' } });

        fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
        expect(input).toHaveValue('Secreta1!');
    });

    it('reaches the reveal control with the keyboard (AC-2 — it used to be tabIndex={-1})', () => {
        renderIsland();

        const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
        expect(toggle).not.toHaveAttribute('tabindex');

        toggle.focus();
        expect(toggle).toHaveFocus();
    });

    it('still submits the real password after it was revealed', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'user@example.com' }
        });
        fireEvent.change(screen.getByLabelText(/^Contraseña/), {
            target: { value: 'Secreta1!' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
        fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

        await waitFor(() => {
            expect(signInEmailMock).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: 'Secreta1!'
            });
        });
    });
});
