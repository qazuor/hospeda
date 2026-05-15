/**
 * @file ProfileCompletion.client.tsx
 * @description React island for the post-signup profile completion form (SPEC-113 T-113-04).
 *
 * Collects baseline profile data (full name, optional casual name, optional phone,
 * optional locale preference, optional newsletter opt-in, required terms acceptance)
 * and posts to POST /api/v1/protected/profile/complete.
 *
 * On success, redirects to the set-password screen if `requiresSetPassword === true`,
 * otherwise to `/[lang]/mi-cuenta/`.
 *
 * Hydration: caller MUST use `client:load` (the form must be interactive on first paint).
 */

import { refreshBetterAuthSession } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useState } from 'react';
import {
    COUNTRY_CODES,
    type ProfileCompletionFieldErrors,
    validateProfileCompletionFields
} from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the ProfileCompletion island. */
export interface ProfileCompletionProps {
    /** Active locale for i18n and locale pre-fill. */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /** Pre-filled display name from the session (OAuth provider or email signup). */
    readonly initialDisplayName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Profile completion form island.
 *
 * Renders a form that collects baseline profile data for first-time users.
 * Posts to the profile completion endpoint and redirects based on the response.
 *
 * @param props - Component props
 */
export function ProfileCompletion({
    locale,
    apiUrl,
    initialDisplayName = ''
}: ProfileCompletionProps) {
    const { t } = createTranslations(locale);

    // ── Form state ────────────────────────────────────────────────────────────

    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [firstName, setFirstName] = useState('');
    const [phoneCode, setPhoneCode] = useState('+54');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedLocale, setSelectedLocale] = useState<SupportedLocale>(locale);
    const [newsletter, setNewsletter] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const [errors, setErrors] = useState<ProfileCompletionFieldErrors>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Build E.164-compatible phone string. Empty if no phone number entered. */
    function buildPhone(): string | undefined {
        const trimmed = phoneNumber.trim();
        if (!trimmed) return undefined;
        const digits = trimmed.replace(/[\s\-().]/g, '');
        return `${phoneCode}${digits}`;
    }

    /** Map Zod error key to the translated message. */
    function errorMessage(field: keyof ProfileCompletionFieldErrors, variant: string): string {
        const keyMap: Record<string, string> = {
            displayName_required: t(
                'account.profileCompletion.errors.displayNameRequired',
                'El nombre completo es obligatorio.'
            ),
            displayName_min: t(
                'account.profileCompletion.errors.displayNameMin',
                'El nombre debe tener al menos 2 caracteres.'
            ),
            displayName_max: t(
                'account.profileCompletion.errors.displayNameMax',
                'El nombre no puede superar los 50 caracteres.'
            ),
            phone_format: t(
                'account.profileCompletion.errors.phoneFormat',
                'Ingresá un número de teléfono válido con código de país.'
            ),
            terms_required: t(
                'account.profileCompletion.errors.termsRequired',
                'Tenés que aceptar los términos para continuar.'
            )
        };
        return keyMap[`${field}_${variant}`] ?? `${field}: ${variant}`;
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setGlobalError(null);

        // Client-side validation
        const validationErrors = validateProfileCompletionFields({
            displayName,
            phone: buildPhone() ?? '',
            acceptedTerms
        });

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);

        try {
            const body: Record<string, unknown> = {
                displayName: displayName.trim(),
                acceptedTerms: true
            };

            const trimmedFirstName = firstName.trim();
            if (trimmedFirstName) body.firstName = trimmedFirstName;

            const phone = buildPhone();
            if (phone) body.phone = phone;

            body.locale = selectedLocale;
            body.newsletterOptIn = newsletter;

            const response = await fetch(`${apiUrl}/api/v1/protected/profile/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = (await response.json()) as {
                    error?: { message?: string };
                };
                setGlobalError(
                    errorData?.error?.message ??
                        t(
                            'account.profileCompletion.errors.submitFailed',
                            'No se pudo completar el perfil. Intentá nuevamente.'
                        )
                );
                return;
            }

            const result = (await response.json()) as {
                data?: { profileCompleted?: boolean; requiresSetPassword?: boolean };
            };

            // Force Better Auth to refresh the session cookie cache so the
            // navbar on the next page reflects the new display_name (otherwise
            // it stays empty until the cookie cache TTL expires).
            await refreshBetterAuthSession();

            if (result.data?.requiresSetPassword) {
                window.location.href = `/${locale}/mi-cuenta/agregar-contrasena/`;
            } else {
                window.location.href = `/${locale}/mi-cuenta/`;
            }
        } catch {
            setGlobalError(
                t(
                    'account.profileCompletion.errors.submitFailed',
                    'No se pudo completar el perfil. Intentá nuevamente.'
                )
            );
        } finally {
            setSubmitting(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h1 className={styles.heading}>
                    {t('account.profileCompletion.heading', '¡Bienvenido a Hospeda!')}
                </h1>
                <p className={styles.subheading}>
                    {t(
                        'account.profileCompletion.subheading',
                        'Antes de continuar, completá tu perfil.'
                    )}
                </p>
            </div>

            <div className={styles.card}>
                <form
                    className={styles.form}
                    onSubmit={handleSubmit}
                    noValidate
                >
                    {/* Full name */}
                    <div className={styles.field}>
                        <label
                            htmlFor="pc-displayName"
                            className={styles.label}
                        >
                            {t('account.profileCompletion.fields.displayName', 'Nombre completo')}
                            <span
                                className={styles.required}
                                aria-hidden="true"
                            >
                                {' *'}
                            </span>
                        </label>
                        <input
                            id="pc-displayName"
                            type="text"
                            className={
                                errors.displayName
                                    ? `${styles.input} ${styles.inputError}`
                                    : styles.input
                            }
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={t(
                                'account.profileCompletion.fields.displayNamePlaceholder',
                                'Tu nombre y apellido'
                            )}
                            aria-required="true"
                            aria-describedby={
                                errors.displayName ? 'pc-displayName-error' : undefined
                            }
                            autoComplete="name"
                            disabled={submitting}
                        />
                        {errors.displayName ? (
                            <p
                                id="pc-displayName-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errorMessage('displayName', errors.displayName)}
                            </p>
                        ) : (
                            <p className={styles.hint}>
                                {t(
                                    'account.profileCompletion.fields.displayNameHint',
                                    'Mínimo 2 caracteres.'
                                )}
                            </p>
                        )}
                    </div>

                    {/* Casual name */}
                    <div className={styles.field}>
                        <label
                            htmlFor="pc-firstName"
                            className={styles.label}
                        >
                            {t(
                                'account.profileCompletion.fields.firstName',
                                '¿Cómo querés que te llamemos?'
                            )}
                        </label>
                        <input
                            id="pc-firstName"
                            type="text"
                            className={styles.input}
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder={t(
                                'account.profileCompletion.fields.firstNamePlaceholder',
                                'Tu apodo o nombre de pila'
                            )}
                            autoComplete="given-name"
                            disabled={submitting}
                        />
                        <p className={styles.hint}>
                            {t(
                                'account.profileCompletion.fields.firstNameHint',
                                'Opcional. Por defecto usamos tu primer nombre.'
                            )}
                        </p>
                    </div>

                    {/* Phone */}
                    <div className={styles.field}>
                        <label
                            htmlFor="pc-phone"
                            className={styles.label}
                        >
                            {t('account.profileCompletion.fields.phone', 'Teléfono')}
                        </label>
                        <div className={styles.phoneRow}>
                            <select
                                id="pc-phoneCode"
                                className={`${styles.select} ${styles.phoneCode}`}
                                value={phoneCode}
                                onChange={(e) => setPhoneCode(e.target.value)}
                                disabled={submitting}
                                aria-label="Código de país"
                            >
                                {COUNTRY_CODES.map((cc) => (
                                    <option
                                        key={cc.code}
                                        value={cc.code}
                                    >
                                        {cc.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                id="pc-phone"
                                type="tel"
                                className={
                                    errors.phone
                                        ? `${styles.input} ${styles.inputError} ${styles.phoneNumber}`
                                        : `${styles.input} ${styles.phoneNumber}`
                                }
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder={t(
                                    'account.profileCompletion.fields.phonePlaceholder',
                                    '9 11 1234-5678'
                                )}
                                aria-describedby={errors.phone ? 'pc-phone-error' : 'pc-phone-hint'}
                                autoComplete="tel-national"
                                disabled={submitting}
                            />
                        </div>
                        {errors.phone ? (
                            <p
                                id="pc-phone-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errorMessage('phone', errors.phone)}
                            </p>
                        ) : (
                            <p
                                id="pc-phone-hint"
                                className={styles.hint}
                            >
                                {t(
                                    'account.profileCompletion.fields.phoneHint',
                                    'Opcional. Incluí el código de país.'
                                )}
                            </p>
                        )}
                    </div>

                    {/* Preferred locale */}
                    <div className={styles.field}>
                        <label
                            htmlFor="pc-locale"
                            className={styles.label}
                        >
                            {t('account.profileCompletion.fields.locale', 'Idioma preferido')}
                        </label>
                        <select
                            id="pc-locale"
                            className={styles.select}
                            value={selectedLocale}
                            onChange={(e) => setSelectedLocale(e.target.value as SupportedLocale)}
                            disabled={submitting}
                        >
                            <option value="es">
                                {t('account.profileCompletion.fields.localeEs', 'Español')}
                            </option>
                            <option value="en">
                                {t('account.profileCompletion.fields.localeEn', 'English')}
                            </option>
                            <option value="pt">
                                {t('account.profileCompletion.fields.localePt', 'Português')}
                            </option>
                        </select>
                    </div>

                    {/* Newsletter opt-in */}
                    <label className={styles.checkboxRow}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={newsletter}
                            onChange={(e) => setNewsletter(e.target.checked)}
                            disabled={submitting}
                        />
                        <span className={styles.checkboxLabel}>
                            {t(
                                'account.profileCompletion.fields.newsletter',
                                'Quiero recibir novedades y promociones por email'
                            )}
                        </span>
                    </label>

                    {/* Terms acceptance */}
                    <div className={styles.field}>
                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                                aria-required="true"
                                aria-describedby={errors.terms ? 'pc-terms-error' : undefined}
                                disabled={submitting}
                            />
                            <span className={styles.checkboxLabel}>
                                {t('account.profileCompletion.fields.terms', 'Acepto los')}{' '}
                                <a
                                    href={`/${locale}/legal/terminos/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.checkboxLink}
                                >
                                    {t(
                                        'account.profileCompletion.fields.termsLink',
                                        'términos y condiciones'
                                    )}
                                </a>
                            </span>
                        </label>
                        {errors.terms && (
                            <p
                                id="pc-terms-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errorMessage('terms', errors.terms)}
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

                    {/* Submit */}
                    <div className={styles.submitRow}>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <>
                                    <span
                                        className={styles.spinner}
                                        aria-hidden="true"
                                    />
                                    {t('account.profileCompletion.submitting', 'Guardando...')}
                                </>
                            ) : (
                                t('account.profileCompletion.submit', 'Completar perfil')
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
