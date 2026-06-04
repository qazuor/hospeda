/**
 * @file PasswordField.test.tsx
 * @description Unit tests for the web-native PasswordField component.
 *
 * Covers: show/hide toggle, strength levels at boundary values, error display,
 * hint display, required + disabled states, rule checklist rendering, and
 * mobile touch-target size regression (BETA-84).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordField } from '../../../src/components/ui/PasswordField.client';
import type { PasswordFieldI18n } from '../../../src/components/ui/PasswordField.client';

// ── Mock @repo/schemas ───────────────────────────────────────────────────────
// @repo/schemas internally imports @repo/feedback/schemas which is not
// resolvable in the jsdom test environment. We mock only the export we need.
vi.mock('@repo/schemas', () => ({
    StrongPasswordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    PROFILE_COMPLETION_MIN_PASSWORD_LENGTH: 8
}));

// ── Mock @repo/icons ─────────────────────────────────────────────────────────
// The icon components are simple SVG wrappers. We stub them so jsdom doesn't
// need to resolve the actual icon SVG paths.
vi.mock('@repo/icons', () => ({
    EyeIcon: ({ 'aria-hidden': _hidden, ...rest }: Record<string, unknown>) => (
        <svg
            data-testid="eye-icon"
            {...rest}
        />
    ),
    EyeOffIcon: ({ 'aria-hidden': _hidden, ...rest }: Record<string, unknown>) => (
        <svg
            data-testid="eye-off-icon"
            {...rest}
        />
    )
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const i18n: PasswordFieldI18n = {
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    strength: {
        weak: 'Weak',
        medium: 'Medium',
        strong: 'Strong'
    },
    rules: {
        length: 'At least 8 characters',
        upper: 'At least 1 uppercase',
        lower: 'At least 1 lowercase',
        digit: 'At least 1 number',
        special: 'At least 1 special character'
    }
};

const baseProps = {
    id: 'test-password',
    label: 'Password',
    value: '',
    onChange: vi.fn(),
    i18n
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PasswordField', () => {
    // Label rendering
    it('renders the label text', () => {
        render(<PasswordField {...baseProps} />);
        expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('associates label with input via htmlFor/id', () => {
        render(<PasswordField {...baseProps} />);
        const input = screen.getByLabelText('Password');
        expect(input).toBeInTheDocument();
    });

    // Required asterisk
    it('shows required asterisk when required=true', () => {
        render(
            <PasswordField
                {...baseProps}
                required
            />
        );
        // The asterisk lives in a <span aria-hidden> so use querySelector.
        const requiredSpan = document.querySelector('[aria-hidden="true"]');
        expect(requiredSpan).toBeTruthy();
        expect(requiredSpan?.textContent?.trim()).toBe('*');
    });

    it('does not show required asterisk when required=false', () => {
        render(<PasswordField {...baseProps} />);
        expect(screen.queryByText(' *')).not.toBeInTheDocument();
    });

    // Input type toggling
    it('renders as password type by default', () => {
        render(<PasswordField {...baseProps} />);
        const input = screen.getByLabelText('Password');
        expect(input).toHaveAttribute('type', 'password');
    });

    it('shows EyeIcon (reveal button) when password is hidden', () => {
        render(<PasswordField {...baseProps} />);
        expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });

    it('toggles to text type when eye button is clicked', () => {
        render(<PasswordField {...baseProps} />);
        const eyeBtn = screen.getByRole('button', { name: 'Show password' });
        fireEvent.click(eyeBtn);
        const input = screen.getByLabelText('Password');
        expect(input).toHaveAttribute('type', 'text');
    });

    it('shows EyeOffIcon after toggling to visible', () => {
        render(<PasswordField {...baseProps} />);
        const eyeBtn = screen.getByRole('button', { name: 'Show password' });
        fireEvent.click(eyeBtn);
        expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();
    });

    it('shows aria-label "Hide password" after toggling to visible', () => {
        render(<PasswordField {...baseProps} />);
        const eyeBtn = screen.getByRole('button', { name: 'Show password' });
        fireEvent.click(eyeBtn);
        expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
    });

    it('toggles back to password type on second click', () => {
        render(<PasswordField {...baseProps} />);
        const eyeBtn = screen.getByRole('button', { name: 'Show password' });
        fireEvent.click(eyeBtn);
        fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
        const input = screen.getByLabelText('Password');
        expect(input).toHaveAttribute('type', 'password');
    });

    // onChange
    it('calls onChange with the new value when input changes', () => {
        const onChange = vi.fn();
        render(
            <PasswordField
                {...baseProps}
                onChange={onChange}
            />
        );
        const input = screen.getByLabelText('Password');
        fireEvent.change(input, { target: { value: 'abc' } });
        expect(onChange).toHaveBeenCalledWith('abc');
    });

    // Strength bar — not shown when showStrength=false (default)
    it('does not render strength bar when showStrength is false', () => {
        render(
            <PasswordField
                {...baseProps}
                value="somepassword"
                showStrength={false}
            />
        );
        expect(screen.queryByText('Weak')).not.toBeInTheDocument();
        expect(screen.queryByText('Medium')).not.toBeInTheDocument();
        expect(screen.queryByText('Strong')).not.toBeInTheDocument();
    });

    it('does not render strength bar when value is empty even if showStrength=true', () => {
        render(
            <PasswordField
                {...baseProps}
                value=""
                showStrength
            />
        );
        expect(screen.queryByText('Weak')).not.toBeInTheDocument();
    });

    // Strength levels
    it('shows "Weak" label for a short/simple password', () => {
        render(
            <PasswordField
                {...baseProps}
                value="abc"
                showStrength
            />
        );
        expect(screen.getByText('Weak')).toBeInTheDocument();
    });

    it('shows "Medium" label for a moderately strong password', () => {
        // 8+ chars, 3 of 4 rule types but not strong regex
        render(
            <PasswordField
                {...baseProps}
                value="Abcdef1g"
                showStrength
            />
        );
        expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('shows "Strong" label for a fully compliant password', () => {
        // Matches StrongPasswordRegex: upper + lower + digit + special + 8+ chars
        render(
            <PasswordField
                {...baseProps}
                value="Abcdef1!"
                showStrength
            />
        );
        expect(screen.getByText('Strong')).toBeInTheDocument();
    });

    // Error display
    it('renders error message with role="alert" when error is provided', () => {
        render(
            <PasswordField
                {...baseProps}
                error="Password is too short."
            />
        );
        const errorEl = screen.getByRole('alert');
        expect(errorEl).toHaveTextContent('Password is too short.');
    });

    it('sets aria-invalid on input when error is provided', () => {
        render(
            <PasswordField
                {...baseProps}
                error="Some error"
            />
        );
        const input = screen.getByLabelText('Password');
        expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not set aria-invalid when no error', () => {
        render(<PasswordField {...baseProps} />);
        const input = screen.getByLabelText('Password');
        expect(input).not.toHaveAttribute('aria-invalid');
    });

    // Hint display
    it('renders hint text when no error is present', () => {
        render(
            <PasswordField
                {...baseProps}
                hint="At least 8 characters."
            />
        );
        expect(screen.getByText('At least 8 characters.')).toBeInTheDocument();
    });

    it('does not render hint when error is present', () => {
        render(
            <PasswordField
                {...baseProps}
                hint="At least 8 characters."
                error="Too short."
            />
        );
        expect(screen.queryByText('At least 8 characters.')).not.toBeInTheDocument();
    });

    // Disabled
    it('disables the input when disabled=true', () => {
        render(
            <PasswordField
                {...baseProps}
                disabled
            />
        );
        expect(screen.getByLabelText('Password')).toBeDisabled();
    });

    it('disables the eye button when disabled=true', () => {
        render(
            <PasswordField
                {...baseProps}
                disabled
            />
        );
        expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
    });

    // Rule checklist
    it('does not render rule checklist when showRuleChecklist=false', () => {
        render(
            <PasswordField
                {...baseProps}
                value="Abcdef1!"
                showRuleChecklist={false}
            />
        );
        expect(screen.queryByText('At least 8 characters')).not.toBeInTheDocument();
    });

    it('does not render rule checklist when value is empty', () => {
        render(
            <PasswordField
                {...baseProps}
                value=""
                showRuleChecklist
            />
        );
        expect(screen.queryByText('At least 8 characters')).not.toBeInTheDocument();
    });

    it('renders rule checklist when showRuleChecklist=true and value is non-empty', () => {
        render(
            <PasswordField
                {...baseProps}
                value="abc"
                showRuleChecklist
            />
        );
        expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument();
        expect(screen.getByText(/At least 1 uppercase/)).toBeInTheDocument();
        expect(screen.getByText(/At least 1 lowercase/)).toBeInTheDocument();
        expect(screen.getByText(/At least 1 number/)).toBeInTheDocument();
        expect(screen.getByText(/At least 1 special character/)).toBeInTheDocument();
    });

    it('marks length rule as passed when value has 8+ chars', () => {
        render(
            <PasswordField
                {...baseProps}
                value="abcdefgh"
                showRuleChecklist
            />
        );
        const ruleItems = screen.getAllByRole('listitem');
        const lengthRule = ruleItems.find((el) =>
            el.textContent?.includes('At least 8 characters')
        );
        expect(lengthRule?.textContent).toMatch(/✅/);
    });

    it('marks uppercase rule as not passed when no uppercase is present', () => {
        render(
            <PasswordField
                {...baseProps}
                value="abcdefgh"
                showRuleChecklist
            />
        );
        const ruleItems = screen.getAllByRole('listitem');
        const upperRule = ruleItems.find((el) => el.textContent?.includes('At least 1 uppercase'));
        expect(upperRule?.textContent).toMatch(/⬜/);
    });

    // autoComplete passthrough
    it('passes autoComplete attribute to the input', () => {
        render(
            <PasswordField
                {...baseProps}
                autoComplete="current-password"
            />
        );
        expect(screen.getByLabelText('Password')).toHaveAttribute(
            'autocomplete',
            'current-password'
        );
    });

    // ── BETA-84 regression: mobile touch target ───────────────────────────────
    // Root cause: .eyeBtn had padding:0 and relied on the 18px icon for its
    // click area, giving an ~18×18px touch target — well below the 44×44px
    // minimum required for reliable mobile taps.

    describe('BETA-84: eye button functional toggle (non-regression)', () => {
        it('toggles input from password to text when the eye button is clicked', () => {
            // Arrange
            render(<PasswordField {...baseProps} />);
            const input = screen.getByLabelText('Password') as HTMLInputElement;
            const eyeBtn = screen.getByRole('button', { name: 'Show password' });

            // Assert initial state
            expect(input.type).toBe('password');

            // Act
            fireEvent.click(eyeBtn);

            // Assert toggled state
            expect(input.type).toBe('text');
        });
    });

    describe('BETA-84: eye button CSS touch target (regression guard)', () => {
        // Read the raw CSS Module source so we can assert on the property values
        // without needing a browser renderer (CSS Modules classes are identity-
        // mapped in Vitest via css.modules.classNameStrategy: 'non-scoped').
        const cssSrc = readFileSync(
            resolve(__dirname, '../../../src/components/ui/PasswordField.module.css'),
            'utf8'
        );

        it('.eyeBtn declares min-height of 44px for WCAG touch target', () => {
            // Arrange: locate the .eyeBtn rule block in the raw CSS
            const eyeBtnBlock = cssSrc.match(/\.eyeBtn\s*\{([^}]+)\}/s)?.[1] ?? '';

            // Assert: min-height must be 44px
            expect(eyeBtnBlock).toMatch(/min-height\s*:\s*44px/);
        });

        it('.eyeBtn declares min-width of 44px for WCAG touch target', () => {
            // Arrange: locate the .eyeBtn rule block in the raw CSS
            const eyeBtnBlock = cssSrc.match(/\.eyeBtn\s*\{([^}]+)\}/s)?.[1] ?? '';

            // Assert: min-width must be 44px
            expect(eyeBtnBlock).toMatch(/min-width\s*:\s*44px/);
        });
    });
});
