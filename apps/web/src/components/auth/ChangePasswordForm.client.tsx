/**
 * @file ChangePasswordForm.client.tsx
 * @description Change-password form React island (SPEC-239 T-055).
 *
 * Shown to commerce owners who were provisioned with a server-generated
 * password and must choose a personal one before using the platform.
 * Also accessible as a voluntary password change from the account section.
 *
 * Fields: currentPassword, newPassword, confirmNewPassword.
 * Validates that newPassword === confirmNewPassword client-side.
 * Submits to POST /api/v1/protected/auth/change-password with credentials.
 * On success shows a brief confirmation banner, then redirects to
 * /{locale}/mi-cuenta/ after 1.5 s.
 *
 * Extras: password-strength meter (weak / medium / strong heuristic),
 * show/hide toggle on all three inputs.
 *
 * Hydration: caller MUST use `client:load`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ChangePasswordInputSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import styles from './ChangePasswordForm.module.css';

// API base URL — must be absolute because the web app and API live on different
// origins in both dev and prod.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the ChangePasswordForm island. */
export interface ChangePasswordFormProps {
    /** Active locale for i18n and redirect URL. */
    readonly locale: SupportedLocale;
}

interface FormFields {
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly confirmNewPassword: string;
}

type FieldErrors = Partial<Record<keyof FormFields, string>>;

/** Password strength level (based on local heuristic — no npm deps). */
type PasswordStrength = 'weak' | 'medium' | 'strong';

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_FIELDS: FormFields = {
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Evaluates password strength using a pure heuristic (no npm deps).
 *
 * - weak:   fewer than 8 characters
 * - medium: 8+ chars with both letters AND digits
 * - strong: 8+ chars with letters, digits AND at least one special character
 *
 * @param password - Raw password string to evaluate.
 * @returns PasswordStrength level.
 */
function evaluateStrength(password: string): PasswordStrength {
    if (password.length < 8) return 'weak';
    const hasLetters = /[a-zA-Z]/.test(password);
    const hasDigits = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z\d]/.test(password);
    if (hasLetters && hasDigits && hasSpecial) return 'strong';
    if (hasLetters && hasDigits) return 'medium';
    return 'weak';
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ChangePasswordForm — forced or voluntary password-change island.
 *
 * Validation: client-side mismatch check + ChangePasswordInputSchema (Zod).
 * Submission: POST /api/v1/protected/auth/change-password (credentials: 'include').
 * Success: shows success banner, then redirects to /{locale}/mi-cuenta/ after 1.5 s.
 * 400 current-password-incorrect: shows commerce.changePassword.currentIncorrect message.
 *
 * @param props - Component props (see {@link ChangePasswordFormProps})
 */
export function ChangePasswordForm({ locale }: ChangePasswordFormProps) {
    const { t } = createTranslations(locale);

    const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Show/hide toggles — one per input field.
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Derived: real-time strength of the new-password field.
    const strength: PasswordStrength =
        fields.newPassword.length > 0 ? evaluateStrength(fields.newPassword) : 'weak';

    function handleChange(e: ChangeEvent<HTMLInputElement>): void {
        const { name, value } = e.currentTarget;
        setFields((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FieldErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
        setGlobalError(null);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setGlobalError(null);
        setErrors({});

        // Client-side mismatch check before hitting the API.
        if (fields.newPassword !== fields.confirmNewPassword) {
            setErrors((prev) => ({
                ...prev,
                confirmNewPassword: t(
                    'commerce.changePassword.mismatch',
                    'Las contraseñas no coinciden.'
                )
            }));
            return;
        }

        // Validate via schema (enforces strong-password rules on newPassword,
        // requires currentPassword to be non-empty).
        const parsed = ChangePasswordInputSchema.safeParse({
            currentPassword: fields.currentPassword,
            newPassword: fields.newPassword
        });

        if (!parsed.success) {
            const fieldErrors: FieldErrors = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0] as keyof FieldErrors | undefined;
                if (field && !fieldErrors[field]) {
                    fieldErrors[field] = issue.message;
                }
            }
            setErrors(fieldErrors);
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_BASE}/api/v1/protected/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(parsed.data)
            });

            if (!res.ok) {
                // 400 with PASSWORD_INCORRECT code → current password is wrong.
                const body = (await res.json().catch(() => ({}))) as {
                    error?: { code?: string; message?: string };
                };
                const code = body.error?.code ?? '';
                if (res.status === 400 && code === 'PASSWORD_INCORRECT') {
                    setErrors((prev) => ({
                        ...prev,
                        currentPassword: t(
                            'commerce.changePassword.currentIncorrect',
                            'La contraseña actual es incorrecta.'
                        )
                    }));
                    return;
                }
                throw new Error(
                    body.error?.message ??
                        t(
                            'commerce.changePassword.error',
                            'Ocurrió un error al actualizar la contraseña. Por favor, intentá de nuevo.'
                        )
                );
            }

            // Show success banner first, then redirect to account page after 1.5 s.
            setIsSuccess(true);
            setTimeout(() => {
                window.location.href = `/${locale}/mi-cuenta/`;
            }, 1500);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'commerce.changePassword.error',
                          'Ocurrió un error al actualizar la contraseña. Por favor, intentá de nuevo.'
                      );
            setGlobalError(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    // ── Strength meter label ──────────────────────────────────────────────────

    const strengthLabel =
        strength === 'strong'
            ? t('commerce.changePassword.strength.strong', 'Segura')
            : strength === 'medium'
              ? t('commerce.changePassword.strength.medium', 'Media')
              : t('commerce.changePassword.strength.weak', 'Débil');

    // ── Success state ─────────────────────────────────────────────────────────

    if (isSuccess) {
        return (
            <div
                className={`${styles.feedbackBanner} ${styles.feedbackBannerSuccess}`}
                role="alert"
                aria-live="assertive"
            >
                {t(
                    'commerce.changePassword.success',
                    'Contraseña actualizada correctamente. Redirigiendo...'
                )}
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h1 className={styles.heading}>
                    {t('commerce.changePassword.title', 'Cambiar contraseña')}
                </h1>
                <p className={styles.subtitle}>
                    {t(
                        'commerce.changePassword.subtitle',
                        'Por seguridad, necesitás actualizar tu contraseña antes de continuar.'
                    )}
                </p>
            </div>

            <div className={styles.card}>
                <form
                    className={styles.form}
                    onSubmit={(e) => void handleSubmit(e)}
                    noValidate
                >
                    {/* Current password */}
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="cpf-currentPassword"
                        >
                            {t(
                                'commerce.changePassword.fields.currentPassword',
                                'Contraseña actual'
                            )}
                            <span
                                className={styles.required}
                                aria-label={t('ui.required', 'requerido')}
                            >
                                *
                            </span>
                        </label>
                        <div className={styles.inputWrapper}>
                            <input
                                id="cpf-currentPassword"
                                type={showCurrent ? 'text' : 'password'}
                                name="currentPassword"
                                value={fields.currentPassword}
                                onChange={handleChange}
                                className={`${styles.input}${errors.currentPassword ? ` ${styles.inputError}` : ''}`}
                                autoComplete="current-password"
                                aria-describedby={
                                    errors.currentPassword ? 'cpf-currentPassword-error' : undefined
                                }
                                aria-invalid={!!errors.currentPassword}
                                required
                                disabled={isSubmitting}
                            />
                            <button
                                type="button"
                                className={styles.toggleBtn}
                                onClick={() => setShowCurrent((v) => !v)}
                                aria-label={
                                    showCurrent
                                        ? t(
                                              'commerce.changePassword.hidePassword',
                                              'Ocultar contraseña'
                                          )
                                        : t(
                                              'commerce.changePassword.showPassword',
                                              'Mostrar contraseña'
                                          )
                                }
                                tabIndex={0}
                            >
                                {showCurrent ? '🙈' : '👁'}
                            </button>
                        </div>
                        {errors.currentPassword && (
                            <p
                                id="cpf-currentPassword-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errors.currentPassword}
                            </p>
                        )}
                    </div>

                    {/* New password */}
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="cpf-newPassword"
                        >
                            {t('commerce.changePassword.fields.newPassword', 'Nueva contraseña')}
                            <span
                                className={styles.required}
                                aria-label={t('ui.required', 'requerido')}
                            >
                                *
                            </span>
                        </label>
                        <div className={styles.inputWrapper}>
                            <input
                                id="cpf-newPassword"
                                type={showNew ? 'text' : 'password'}
                                name="newPassword"
                                value={fields.newPassword}
                                onChange={handleChange}
                                className={`${styles.input}${errors.newPassword ? ` ${styles.inputError}` : ''}`}
                                autoComplete="new-password"
                                aria-describedby={
                                    errors.newPassword ? 'cpf-newPassword-error' : undefined
                                }
                                aria-invalid={!!errors.newPassword}
                                required
                                disabled={isSubmitting}
                            />
                            <button
                                type="button"
                                className={styles.toggleBtn}
                                onClick={() => setShowNew((v) => !v)}
                                aria-label={
                                    showNew
                                        ? t(
                                              'commerce.changePassword.hidePassword',
                                              'Ocultar contraseña'
                                          )
                                        : t(
                                              'commerce.changePassword.showPassword',
                                              'Mostrar contraseña'
                                          )
                                }
                                tabIndex={0}
                            >
                                {showNew ? '🙈' : '👁'}
                            </button>
                        </div>

                        {/* Password strength meter — only shown while the field has content */}
                        {fields.newPassword.length > 0 && (
                            <div
                                className={styles.strengthMeter}
                                aria-label={t(
                                    'commerce.changePassword.strengthLabel',
                                    'Seguridad de la contraseña'
                                )}
                            >
                                <div className={styles.strengthBars}>
                                    <span
                                        className={`${styles.strengthBar} ${styles.strengthBarActive} ${
                                            strength === 'weak'
                                                ? styles.strengthBarWeak
                                                : strength === 'medium'
                                                  ? styles.strengthBarMedium
                                                  : styles.strengthBarStrong
                                        }`}
                                    />
                                    <span
                                        className={`${styles.strengthBar} ${
                                            strength !== 'weak'
                                                ? `${styles.strengthBarActive} ${strength === 'medium' ? styles.strengthBarMedium : styles.strengthBarStrong}`
                                                : ''
                                        }`}
                                    />
                                    <span
                                        className={`${styles.strengthBar} ${
                                            strength === 'strong'
                                                ? `${styles.strengthBarActive} ${styles.strengthBarStrong}`
                                                : ''
                                        }`}
                                    />
                                </div>
                                <span className={styles.strengthLabel}>{strengthLabel}</span>
                            </div>
                        )}

                        {errors.newPassword && (
                            <p
                                id="cpf-newPassword-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errors.newPassword}
                            </p>
                        )}
                    </div>

                    {/* Confirm new password */}
                    <div className={styles.field}>
                        <label
                            className={styles.label}
                            htmlFor="cpf-confirmNewPassword"
                        >
                            {t(
                                'commerce.changePassword.fields.confirmNewPassword',
                                'Confirmá la nueva contraseña'
                            )}
                            <span
                                className={styles.required}
                                aria-label={t('ui.required', 'requerido')}
                            >
                                *
                            </span>
                        </label>
                        <div className={styles.inputWrapper}>
                            <input
                                id="cpf-confirmNewPassword"
                                type={showConfirm ? 'text' : 'password'}
                                name="confirmNewPassword"
                                value={fields.confirmNewPassword}
                                onChange={handleChange}
                                className={`${styles.input}${errors.confirmNewPassword ? ` ${styles.inputError}` : ''}`}
                                autoComplete="new-password"
                                aria-describedby={
                                    errors.confirmNewPassword
                                        ? 'cpf-confirmNewPassword-error'
                                        : undefined
                                }
                                aria-invalid={!!errors.confirmNewPassword}
                                required
                                disabled={isSubmitting}
                            />
                            <button
                                type="button"
                                className={styles.toggleBtn}
                                onClick={() => setShowConfirm((v) => !v)}
                                aria-label={
                                    showConfirm
                                        ? t(
                                              'commerce.changePassword.hidePassword',
                                              'Ocultar contraseña'
                                          )
                                        : t(
                                              'commerce.changePassword.showPassword',
                                              'Mostrar contraseña'
                                          )
                                }
                                tabIndex={0}
                            >
                                {showConfirm ? '🙈' : '👁'}
                            </button>
                        </div>
                        {errors.confirmNewPassword && (
                            <p
                                id="cpf-confirmNewPassword-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errors.confirmNewPassword}
                            </p>
                        )}
                    </div>

                    {/* Global error banner */}
                    {globalError && (
                        <div
                            className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                            role="alert"
                        >
                            {globalError}
                        </div>
                    )}

                    <div className={styles.actionRow}>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isSubmitting}
                            aria-busy={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span
                                        className={styles.spinner}
                                        aria-hidden="true"
                                    />
                                    {t('commerce.changePassword.submitting', 'Guardando...')}
                                </>
                            ) : (
                                t('commerce.changePassword.submit', 'Cambiar contraseña')
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
