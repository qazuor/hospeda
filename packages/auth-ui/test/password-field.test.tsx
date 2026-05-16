/**
 * @file password-field.test.tsx
 * @description Unit tests for the PasswordField component (SPEC-113 polish round).
 * Covers: show/hide toggle, strength meter levels, rule checklist, error display,
 * and accessibility attributes.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PasswordField } from '../src/password-field';
import type { PasswordFieldI18n } from '../src/password-field';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const baseI18n: PasswordFieldI18n = {
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    strength: {
        weak: 'Débil',
        medium: 'Media',
        strong: 'Fuerte'
    },
    rules: {
        length: 'Al menos 8 caracteres',
        upper: 'Al menos una mayúscula',
        lower: 'Al menos una minúscula',
        digit: 'Al menos un número',
        special: 'Al menos un carácter especial'
    }
};

function renderField(
    overrides?: Partial<{
        value: string;
        error: string;
        disabled: boolean;
        showStrength: boolean;
        showRuleChecklist: boolean;
    }>
) {
    const noop = vi.fn();
    const props = {
        id: 'test-password',
        label: 'Contraseña',
        value: '',
        onChange: noop,
        i18n: baseI18n,
        showStrength: false,
        ...overrides
    };
    return { ...render(<PasswordField {...props} />), noop };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('PasswordField — basic rendering', () => {
    it('renders the label', () => {
        renderField();
        expect(screen.getByText('Contraseña')).toBeInTheDocument();
    });

    it('renders the input as type=password by default', () => {
        renderField();
        // password inputs have no ARIA role — query by type attribute
        expect(document.querySelector('input[type="password"]')).not.toBeNull();
    });

    it('renders the show-password toggle button', () => {
        renderField();
        expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
    });

    it('does not render strength bar when showStrength is false', () => {
        renderField({ value: 'Password1!', showStrength: false });
        expect(screen.queryByRole('group')).toBeNull();
        expect(screen.queryByText('Débil')).toBeNull();
    });

    it('shows required asterisk when required prop is true', () => {
        render(
            <PasswordField
                id="req"
                label="Password"
                value=""
                onChange={vi.fn()}
                required
                i18n={baseI18n}
            />
        );
        expect(screen.getByText('*')).toBeInTheDocument();
    });
});

// ─── Show / hide toggle ───────────────────────────────────────────────────────

describe('PasswordField — show/hide toggle', () => {
    it('switches input type to text when eye button is clicked', async () => {
        const user = userEvent.setup();
        renderField({ value: 'abc' });

        const toggleBtn = screen.getByRole('button', { name: 'Mostrar contraseña' });
        await user.click(toggleBtn);

        expect(document.querySelector('input[type="text"]')).not.toBeNull();
    });

    it('updates the toggle button label after clicking', async () => {
        const user = userEvent.setup();
        renderField({ value: 'abc' });

        await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
        expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toBeInTheDocument();
    });

    it('toggles back to hidden when clicked again', async () => {
        const user = userEvent.setup();
        renderField({ value: 'abc' });

        const toggleBtn = screen.getByRole('button', { name: 'Mostrar contraseña' });
        await user.click(toggleBtn);
        await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));

        expect(document.querySelector('input[type="password"]')).not.toBeNull();
    });

    it('toggle button is disabled when field is disabled', () => {
        renderField({ disabled: true });
        const btn = screen.getByRole('button', { name: 'Mostrar contraseña' });
        expect(btn).toBeDisabled();
    });
});

// ─── Strength meter ───────────────────────────────────────────────────────────

describe('PasswordField — strength meter', () => {
    it('does not render strength bar for empty value', () => {
        renderField({ value: '', showStrength: true });
        expect(screen.queryByText('Débil')).toBeNull();
        expect(screen.queryByText('Media')).toBeNull();
        expect(screen.queryByText('Fuerte')).toBeNull();
    });

    it('shows Débil (level 1) for a short/weak password', () => {
        renderField({ value: 'abc', showStrength: true });
        expect(screen.getByText('Débil')).toBeInTheDocument();
    });

    it('shows Media (level 2) for a medium password', () => {
        // Has length + upper + lower + digit but no special char
        renderField({ value: 'Password1', showStrength: true });
        expect(screen.getByText('Media')).toBeInTheDocument();
    });

    it('shows Fuerte (level 3) for a fully strong password', () => {
        // Meets all 5 rules: length, upper, lower, digit, special
        renderField({ value: 'Password1!', showStrength: true });
        expect(screen.getByText('Fuerte')).toBeInTheDocument();
    });

    it('renders 3 strength bar segments when showStrength is true and value exists', () => {
        const { container } = renderField({ value: 'abc', showStrength: true });
        // The strength bar renders exactly 3 colored divs inside a flex container
        const flexContainer = container.querySelector('[aria-live="polite"] > .flex');
        expect(flexContainer?.children).toHaveLength(3);
    });
});

// ─── Rule checklist ───────────────────────────────────────────────────────────

describe('PasswordField — rule checklist', () => {
    it('renders checklist items when showRuleChecklist is true', () => {
        renderField({ value: 'test', showStrength: true, showRuleChecklist: true });
        expect(screen.getByText('Al menos 8 caracteres')).toBeInTheDocument();
        expect(screen.getByText('Al menos una mayúscula')).toBeInTheDocument();
        expect(screen.getByText('Al menos una minúscula')).toBeInTheDocument();
        expect(screen.getByText('Al menos un número')).toBeInTheDocument();
        expect(screen.getByText('Al menos un carácter especial')).toBeInTheDocument();
    });

    it('does not render checklist when showRuleChecklist is false', () => {
        renderField({ value: 'test', showStrength: true, showRuleChecklist: false });
        expect(screen.queryByText('Al menos 8 caracteres')).toBeNull();
    });

    it('shows check emoji for passed rules', () => {
        // Password1! passes all rules — all items should show ✅
        renderField({ value: 'Password1!', showStrength: true, showRuleChecklist: true });
        const checkItems = screen.getAllByText('✅');
        expect(checkItems.length).toBe(5);
    });
});

// ─── Error display ────────────────────────────────────────────────────────────

describe('PasswordField — error display', () => {
    it('renders the error message when error prop is provided', () => {
        renderField({ error: 'La contraseña es muy débil' });
        expect(screen.getByRole('alert')).toHaveTextContent('La contraseña es muy débil');
    });

    it('sets aria-invalid on the input when error is present', () => {
        renderField({ error: 'Error message' });
        const input = document.querySelector('input');
        expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not render alert when no error', () => {
        renderField();
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

// ─── onChange ─────────────────────────────────────────────────────────────────

describe('PasswordField — onChange callback', () => {
    it('calls onChange with the typed value', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <PasswordField
                id="test"
                label="Password"
                value=""
                onChange={onChange}
                i18n={baseI18n}
            />
        );

        await user.type(document.querySelector('input')!, 'a');
        expect(onChange).toHaveBeenCalledWith('a');
    });
});
