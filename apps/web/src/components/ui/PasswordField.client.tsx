/**
 * @file PasswordField.client.tsx
 * @description Web-native password input with show/hide toggle, optional strength
 * bar, and optional rule checklist. Uses CSS Modules (no Tailwind) and
 * `@repo/icons` for the eye toggle icons.
 *
 * Mirrors the API of `packages/auth-ui/src/password-field.tsx` so the props
 * feel familiar, but is implemented entirely with vanilla CSS custom properties
 * as required by `apps/web`.
 *
 * @example
 * <PasswordField
 *   id="sp-password"
 *   label="Contraseña"
 *   value={password}
 *   onChange={setPassword}
 *   showStrength
 *   showRuleChecklist
 *   i18n={i18n}
 * />
 */

import { EyeIcon, EyeOffIcon } from '@repo/icons';
import { StrongPasswordRegex } from '@repo/schemas';
import { useState } from 'react';
import styles from './PasswordField.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * i18n strings required by PasswordField.
 * Pass translated strings from the parent island.
 */
export interface PasswordFieldI18n {
    readonly showPassword: string;
    readonly hidePassword: string;
    readonly strength: {
        readonly weak: string;
        readonly medium: string;
        readonly strong: string;
    };
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
    /** HTML id for the input — also used to derive aria-describedby targets. */
    readonly id: string;
    /** Visible label text rendered above the input. */
    readonly label: string;
    /** Controlled value. */
    readonly value: string;
    /** Change handler — receives the new string value. */
    readonly onChange: (value: string) => void;
    /** Input placeholder text. */
    readonly placeholder?: string;
    /** autocomplete attribute value. */
    readonly autoComplete?: 'new-password' | 'current-password';
    /** Whether the field is required (renders aria-required + asterisk). */
    readonly required?: boolean;
    /** Whether the field is disabled. */
    readonly disabled?: boolean;
    /** Show the 3-segment strength bar below the input. */
    readonly showStrength?: boolean;
    /** Show the 5-rule character-class checklist below the strength bar. */
    readonly showRuleChecklist?: boolean;
    /** Inline field error — shown as role="alert" paragraph. */
    readonly error?: string;
    /** Hint text shown when no error is present. */
    readonly hint?: string;
    /** Translated strings. */
    readonly i18n: PasswordFieldI18n;
}

// ─── Strength helpers ─────────────────────────────────────────────────────────

type StrengthLevel = 0 | 1 | 2 | 3;

/**
 * Computes the password strength level.
 *
 * @param value - Raw password string.
 * @returns 0 = empty, 1 = weak, 2 = medium, 3 = strong.
 */
function computeStrength(value: string): StrengthLevel {
    if (!value) return 0;
    if (StrongPasswordRegex.test(value)) return 3;
    const rules = [/[A-Z]/, /[a-z]/, /\d/, /[@$!%*?&]/];
    const passed = rules.filter((r) => r.test(value)).length;
    if (value.length < 8 || passed < 3) return 1;
    return 2;
}

/** Per-level CSS Module class name for a strength segment. */
const STRENGTH_SEGMENT_CLASS: Record<StrengthLevel, string> = {
    0: styles.strengthEmpty,
    1: styles.strengthWeak,
    2: styles.strengthMedium,
    3: styles.strengthStrong
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Password input field with show/hide toggle, strength bar, and optional
 * rule checklist. State for show/hide is fully internal.
 *
 * @param props - Component props (see {@link PasswordFieldProps})
 */
export function PasswordField({
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
    hint,
    i18n
}: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);

    const strengthLevel = computeStrength(value);
    const strengthColorClass = STRENGTH_SEGMENT_CLASS[strengthLevel];

    const strengthLabel =
        strengthLevel === 1
            ? i18n.strength.weak
            : strengthLevel === 2
              ? i18n.strength.medium
              : strengthLevel === 3
                ? i18n.strength.strong
                : '';

    // Build aria-describedby to chain: error OR strength/hint.
    const strengthId = `${id}-strength`;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const describedBy = error
        ? errorId
        : showStrength && value && strengthLevel > 0
          ? strengthId
          : hint
            ? hintId
            : undefined;

    // Rule checks for the optional checklist.
    const rules =
        showRuleChecklist && i18n.rules
            ? [
                  { label: i18n.rules.length, passed: value.length >= 8 },
                  { label: i18n.rules.upper, passed: /[A-Z]/.test(value) },
                  { label: i18n.rules.lower, passed: /[a-z]/.test(value) },
                  { label: i18n.rules.digit, passed: /\d/.test(value) },
                  { label: i18n.rules.special, passed: /[@$!%*?&]/.test(value) }
              ]
            : [];

    return (
        <div className={styles.field}>
            {/* Label */}
            <label
                htmlFor={id}
                className={styles.label}
            >
                {label}
                {required && (
                    <span
                        className={styles.required}
                        aria-hidden="true"
                    >
                        {' *'}
                    </span>
                )}
            </label>

            {/* Input + eye toggle */}
            <div className={styles.inputWrapper}>
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    className={error ? `${styles.input} ${styles.inputError}` : styles.input}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    aria-required={required ? 'true' : undefined}
                    aria-describedby={describedBy}
                    aria-invalid={error ? 'true' : undefined}
                    disabled={disabled}
                />
                <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? i18n.hidePassword : i18n.showPassword}
                    tabIndex={-1}
                    disabled={disabled}
                >
                    {visible ? (
                        <EyeOffIcon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                    ) : (
                        <EyeIcon
                            size={18}
                            weight="regular"
                            aria-hidden="true"
                        />
                    )}
                </button>
            </div>

            {/* Strength bar */}
            {showStrength && value && (
                <div
                    id={strengthId}
                    className={styles.strengthRow}
                    aria-live="polite"
                    aria-label={strengthLabel}
                >
                    {([1, 2, 3] as const).map((lvl) => (
                        <div
                            key={lvl}
                            className={`${styles.strengthSegment} ${strengthLevel >= lvl ? strengthColorClass : styles.strengthEmpty}`}
                        />
                    ))}
                    {strengthLabel && <span className={styles.strengthLabel}>{strengthLabel}</span>}
                </div>
            )}

            {/* Rule checklist */}
            {showRuleChecklist && rules.length > 0 && value && (
                <ul
                    className={styles.ruleList}
                    aria-label="Password requirements"
                >
                    {rules.map((rule) => (
                        <li
                            key={rule.label}
                            className={
                                rule.passed
                                    ? `${styles.ruleItem} ${styles.ruleItemPassed}`
                                    : styles.ruleItem
                            }
                        >
                            {rule.passed ? '✅' : '⬜'} {rule.label}
                        </li>
                    ))}
                </ul>
            )}

            {/* Error */}
            {error && (
                <p
                    id={errorId}
                    className={styles.errorMsg}
                    role="alert"
                >
                    {error}
                </p>
            )}

            {/* Hint (shown only when no error) */}
            {!error && hint && (
                <p
                    id={hintId}
                    className={styles.hint}
                >
                    {hint}
                </p>
            )}
        </div>
    );
}
