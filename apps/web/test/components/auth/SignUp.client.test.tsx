/**
 * @file SignUp.client.test.tsx
 * @description Regression tests for the SignUp island's HOS-190 slice 3
 * changes: a real email presence/format guard (the form is `noValidate`,
 * so the browser's native check never ran), unifying the password check onto
 * `StrongPasswordSchema.safeParse` (adds the 128-char cap the old
 * `StrongPasswordRegex.test()` never enforced), and HOS-779's SSR-first
 * guarantee that the real sign-up form exists on the first paint.
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
import { z } from 'zod';
import { SignUp, type SignUpProps } from '../../../src/components/auth/SignUp.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/auth/SignUp.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: () => ({ t }) };
});

vi.mock('@repo/schemas', () => ({
    // Mirrors StrongPasswordSchema's bounds (HOS-190 slice 3: min 8, max 128,
    // upper/lower/digit/special) without pulling in the full package.
    StrongPasswordSchema: z
        .string()
        .min(8)
        .max(128)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/)
}));

const signUpEmailMock = vi.fn();
vi.mock('../../../src/lib/auth-client', () => ({
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: (...args: unknown[]) => signUpEmailMock(...args) }
}));

vi.mock('../../../src/components/ui/PasswordField.client', () => ({
    // Wire onChange + error through — otherwise fireEvent.change never
    // reaches the parent's `setPassword`/`setConfirmPassword` state, and the
    // field error message (rendered internally by the real component) would
    // be invisible to the test.
    PasswordField: ({
        id,
        label,
        value,
        onChange,
        error
    }: {
        id: string;
        label: string;
        value: string;
        onChange: (value: string) => void;
        error?: string;
    }) => (
        <label htmlFor={id}>
            {label}
            <input
                id={id}
                type="password"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {error && <p role="alert">{error}</p>}
        </label>
    )
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

type HarnessProps = Omit<SignUpProps, 'email' | 'onEmailChange'> & {
    readonly initialEmail?: string;
};

/** Owns the controlled `email` value the way `AuthTabs` does in production. */
function Harness({ initialEmail = '', ...props }: HarnessProps) {
    const [email, setEmail] = useState(initialEmail);
    return (
        <SignUp
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
            redirectTo="/es/auth/verify-email-sent/"
            verificationCallbackUrl="https://hospeda.com.ar/es/mi-cuenta/"
        />
    );
}

async function readyForm(): Promise<void> {
    await screen.findByLabelText(/Correo electrónico/);
}

const VALID_PASSWORD = 'Aa1!aaaa';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SignUp email + password guards (HOS-190 slice 3)', () => {
    beforeEach(() => {
        signUpEmailMock.mockReset();
        signUpEmailMock.mockResolvedValue({ error: null });
    });

    it('blocks submit when email is empty', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Ingresá tu correo electrónico.'
        );
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it('blocks submit when email is malformed', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
            target: { value: 'not-an-email' }
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Ingresá un correo electrónico válido.'
        );
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it('rejects a password longer than 128 characters', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
            target: { value: 'user@example.com' }
        });
        const tooLong = `Aa1!${'a'.repeat(125)}`;
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: tooLong }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: tooLong }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        expect(
            await screen.findByText('La contraseña no puede superar los 128 caracteres.')
        ).toBeInTheDocument();
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it('trims the email and calls signUp.email for valid data', async () => {
        renderIsland();
        await readyForm();

        fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
            target: { value: '  user@example.com  ' }
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(signUpEmailMock).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: VALID_PASSWORD,
                name: '',
                callbackURL: 'https://hospeda.com.ar/es/mi-cuenta/'
            });
        });
    });

    // ─── HOS-821: the required marker ────────────────────────────────────────

    it('marks the email label as required, like the two password labels', () => {
        // Arrange / Act
        renderIsland();

        // Assert — the label's own text, not the input's attributes: `required`
        // and `aria-required` were ALREADY on this input, so an attribute check
        // passed happily while the field was the only mandatory one on the form
        // that did not look mandatory.
        const label = screen.getByText('Correo electrónico').closest('label');
        expect(label).not.toBeNull();
        expect(label?.textContent).toBe('Correo electrónico *');
    });

    it('hides the marker from the accessibility tree', () => {
        // The input already announces itself via `aria-required`; a second,
        // literal "asterisk" in the accessible name is noise, which is why
        // `PasswordField` marks its own span `aria-hidden` too.
        renderIsland();

        const marker = screen
            .getByText('Correo electrónico')
            .closest('label')
            ?.querySelector('span');
        expect(marker?.getAttribute('aria-hidden')).toBe('true');
    });

    it('server-renders the marker too, so it is present before hydration', () => {
        // NOTE: `PasswordField` is mocked in this file (see the module mocks
        // above) and its mock renders no marker, so the two password labels are
        // deliberately NOT asserted here — doing so would test the stub. Their
        // asterisk is `PasswordField`'s own behaviour, covered where that
        // component is exercised for real.
        const html = renderToStaticMarkup(
            <SignUp
                locale="es"
                redirectTo="/es/auth/verify-email-sent/"
                verificationCallbackUrl="https://hospeda.com.ar/es/mi-cuenta/"
                email=""
                onEmailChange={() => {}}
            />
        );

        expect(html).toContain('Correo electr');
        expect(html).toMatch(/aria-hidden="true"[^>]*>\s*\*|\*<\/span>/);
    });

    it('server-renders the real sign-up form fields on first paint', () => {
        document.body.innerHTML = renderToStaticMarkup(
            <SignUp
                locale="es"
                redirectTo="/es/auth/verify-email-sent/"
                verificationCallbackUrl="https://hospeda.com.ar/es/mi-cuenta/"
                email=""
                onEmailChange={() => {}}
            />
        );

        expect(screen.getByRole('form', { name: 'Crear cuenta' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Correo electrónico/)).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    });
});

describe('SignUp controlled email (HOS-959)', () => {
    beforeEach(() => {
        // The SSR tests above write straight into document.body, which
        // RTL's auto-cleanup does not own and therefore leaves behind —
        // reset it or getByLabelText below can pick up stale SSR markup
        // instead of this test's own render.
        document.body.innerHTML = '';
        signUpEmailMock.mockReset();
        signUpEmailMock.mockResolvedValue({ error: null });
    });

    it('renders the value handed in via the email prop', async () => {
        render(
            <Harness
                locale="es"
                redirectTo="/es/auth/verify-email-sent/"
                verificationCallbackUrl="https://hospeda.com.ar/es/mi-cuenta/"
                initialEmail="preset@example.com"
            />
        );
        await readyForm();

        expect(screen.getByLabelText(/Correo electrónico/)).toHaveValue('preset@example.com');
    });

    it('calls onEmailChange on every keystroke instead of managing its own state', async () => {
        const onEmailChange = vi.fn();
        render(
            <SignUp
                locale="es"
                redirectTo="/es/auth/verify-email-sent/"
                verificationCallbackUrl="https://hospeda.com.ar/es/mi-cuenta/"
                email=""
                onEmailChange={onEmailChange}
            />
        );
        await readyForm();

        fireEvent.change(screen.getByLabelText(/Correo electrónico/), {
            target: { value: 'typed@example.com' }
        });

        expect(onEmailChange).toHaveBeenCalledWith('typed@example.com');
    });
});

describe('SignUp — HOS-838: the destination reaches the verification email', () => {
    beforeEach(() => {
        signUpEmailMock.mockReset();
        signUpEmailMock.mockResolvedValue({ error: null });
    });

    it('sends the requested destination as Better Auth callbackURL', async () => {
        // The browser cannot carry the destination across the inbox hop — the
        // email may be opened on another device — so it has to travel inside
        // the verification link.
        // Arrange
        render(
            <SignUp
                locale="es"
                redirectTo="/es/auth/verify-email-sent/"
                verificationCallbackUrl="https://hospeda.com.ar/es/mi-cuenta/comercios/nuevo/"
                email="user@example.com"
                onEmailChange={() => undefined}
            />
        );
        fireEvent.change(screen.getByLabelText(/^Contraseña/), {
            target: { value: VALID_PASSWORD }
        });
        fireEvent.change(screen.getByLabelText(/Confirmar contraseña/), {
            target: { value: VALID_PASSWORD }
        });

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        // Assert
        await waitFor(() => {
            expect(signUpEmailMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    callbackURL: 'https://hospeda.com.ar/es/mi-cuenta/comercios/nuevo/'
                })
            );
        });
    });
});
