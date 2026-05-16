/**
 * PasswordField component for consistent password input with optional
 * show/hide toggle and strength meter.
 *
 * Used across signup, set-password (web), and reset-password flows.
 * Matches the Tailwind-based styling of the surrounding auth-ui components.
 *
 * @module password-field
 */

import { useState } from 'react';

// ─── Strength Helpers ─────────────────────────────────────────────────────────

/**
 * Strong-password regex mirroring `StrongPasswordRegex` from
 * `@repo/schemas/src/common/password.schema.ts`.
 *
 * Kept in-sync manually; do NOT relax validation here without also
 * updating the canonical schema.
 *
 * Rules:
 *  - min 8 chars
 *  - at least one uppercase letter
 *  - at least one lowercase letter
 *  - at least one digit
 *  - at least one special char from @$!%*?&
 */
const STRONG_PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

type PasswordRule = {
    readonly key: string;
    readonly test: (value: string) => boolean;
};

const PASSWORD_RULES: readonly PasswordRule[] = [
    { key: 'length', test: (v) => v.length >= 8 },
    { key: 'upper', test: (v) => /[A-Z]/.test(v) },
    { key: 'lower', test: (v) => /[a-z]/.test(v) },
    { key: 'digit', test: (v) => /\d/.test(v) },
    { key: 'special', test: (v) => /[@$!%*?&]/.test(v) }
] as const;

/**
 * Compute password strength level (0–3).
 *
 * 0 = empty / not started
 * 1 = weak (fails length OR more than 1 rule)
 * 2 = medium (meets length + 3 of 4 character rules)
 * 3 = strong (all rules pass)
 */
function computeStrengthLevel(value: string): 0 | 1 | 2 | 3 {
    if (!value) return 0;
    if (STRONG_PASSWORD_REGEX.test(value)) return 3;

    const passedRules = PASSWORD_RULES.filter((r) => r.test(value)).length;

    if (value.length < 8 || passedRules < 3) return 1;
    return 2;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** i18n strings required by PasswordField. */
export interface PasswordFieldI18n {
    /** Label for the eye button when password is hidden. */
    readonly showPassword: string;
    /** Label for the eye button when password is visible. */
    readonly hidePassword: string;
    /** Strength meter labels keyed by level name. */
    readonly strength: {
        readonly weak: string;
        readonly medium: string;
        readonly strong: string;
    };
    /** Rule hint labels (optional — shown when `showRuleChecklist` is true). */
    readonly rules?: {
        readonly length: string;
        readonly upper: string;
        readonly lower: string;
        readonly digit: string;
        readonly special: string;
    };
}

/** Props for the PasswordField component. */
export interface PasswordFieldProps {
    /** `id` attribute — used to wire `<label htmlFor>` and ARIA references. */
    readonly id: string;
    /** Visible label text rendered above the input. */
    readonly label: string;
    /** Current value (controlled). */
    readonly value: string;
    /** Change handler — receives the raw string value. */
    readonly onChange: (value: string) => void;
    /** Input placeholder text. */
    readonly placeholder?: string;
    /** autocomplete hint (default: 'new-password'). */
    readonly autoComplete?: 'new-password' | 'current-password';
    /** Whether the field is required (default: false). */
    readonly required?: boolean;
    /** Whether the field is disabled (default: false). */
    readonly disabled?: boolean;
    /**
     * When true, renders a color-coded strength bar and optional rule checklist
     * below the input.  Enable for "new password" contexts.  Default: false.
     */
    readonly showStrength?: boolean;
    /** When true, renders the rule-by-rule checklist below the strength bar. */
    readonly showRuleChecklist?: boolean;
    /** Inline validation error string — renders a red error message. */
    readonly error?: string;
    /** i18n strings bundle. */
    readonly i18n: PasswordFieldI18n;
}

// ─── Eye icons (inline SVG — no @repo/icons dependency from auth-ui) ──────────

/** Eye open SVG — visible when password is hidden. */
function EyeOpenIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle
                cx="12"
                cy="12"
                r="3"
            />
        </svg>
    );
}

/** Eye slash SVG — visible when password is shown. */
function EyeSlashIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line
                x1="1"
                y1="1"
                x2="23"
                y2="23"
            />
        </svg>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PasswordField renders a password input with:
 * - show/hide toggle (eye icon button)
 * - optional color-coded strength bar (0 = hidden, 1 = red, 2 = orange, 3 = green)
 * - optional per-rule checklist (✅ / ⬜) shown when `showRuleChecklist` is true
 * - accessible ARIA wiring (`aria-describedby`, `aria-invalid`)
 *
 * @example
 * ```tsx
 * <PasswordField
 *   id="signup-password"
 *   label="Contraseña"
 *   value={password}
 *   onChange={setPassword}
 *   showStrength
 *   i18n={passwordI18n}
 * />
 * ```
 */
export const PasswordField = ({
    id,
    label,
    value,
    onChange,
    placeholder,
    autoComplete = 'new-password',
    required = false,
    disabled = false,
    showStrength = false,
    showRuleChecklist = false,
    error,
    i18n
}: PasswordFieldProps) => {
    const [visible, setVisible] = useState(false);

    const strengthLevel = showStrength ? computeStrengthLevel(value) : 0;

    const strengthColorClass =
        strengthLevel === 0
            ? 'bg-gray-200'
            : strengthLevel === 1
              ? 'bg-red-500'
              : strengthLevel === 2
                ? 'bg-orange-400'
                : 'bg-green-500';

    const strengthLabel =
        strengthLevel === 1
            ? i18n.strength.weak
            : strengthLevel === 2
              ? i18n.strength.medium
              : strengthLevel === 3
                ? i18n.strength.strong
                : '';

    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const strengthId = `${id}-strength`;

    const describedBy =
        [
            error ? errorId : null,
            showStrength && value ? strengthId : null,
            !error && !showStrength ? hintId : null
        ]
            .filter(Boolean)
            .join(' ') || undefined;

    return (
        <div className="space-y-1">
            <label
                htmlFor={id}
                className="block font-medium text-gray-700 text-sm"
            >
                {label}
                {required && (
                    <span
                        aria-hidden="true"
                        className="ml-1 text-red-500"
                    >
                        *
                    </span>
                )}
            </label>

            {/* Input + toggle button wrapper */}
            <div className="relative">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    required={required}
                    disabled={disabled}
                    aria-required={required || undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={describedBy}
                    className="w-full rounded-lg border border-gray-300 py-4 pr-12 pl-4 text-sm transition-colors placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    disabled={disabled}
                    aria-label={visible ? i18n.hidePassword : i18n.showPassword}
                    className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 transition-colors hover:text-gray-600 disabled:pointer-events-none"
                    tabIndex={-1}
                >
                    {visible ? <EyeSlashIcon /> : <EyeOpenIcon />}
                </button>
            </div>

            {/* Error message */}
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-red-600 text-sm"
                >
                    {error}
                </p>
            )}

            {/* Strength bar */}
            {showStrength && value && (
                <div
                    id={strengthId}
                    aria-live="polite"
                    aria-label={strengthLabel}
                    className="space-y-1"
                >
                    <div className="flex gap-1">
                        {([1, 2, 3] as const).map((lvl) => (
                            <div
                                key={lvl}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${
                                    strengthLevel >= lvl ? strengthColorClass : 'bg-gray-200'
                                }`}
                            />
                        ))}
                    </div>
                    {strengthLabel && <p className="text-gray-500 text-xs">{strengthLabel}</p>}
                </div>
            )}

            {/* Rule checklist */}
            {showStrength && showRuleChecklist && i18n.rules && (
                <ul className="mt-1 space-y-0.5">
                    {PASSWORD_RULES.map((rule) => {
                        const passed = rule.test(value);
                        const ruleLabel = i18n.rules?.[rule.key as keyof typeof i18n.rules];
                        return (
                            <li
                                key={rule.key}
                                className={`flex items-center gap-1.5 text-xs ${
                                    passed ? 'text-green-600' : 'text-gray-500'
                                }`}
                            >
                                <span aria-hidden="true">{passed ? '✅' : '⬜'}</span>
                                {ruleLabel}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
