/**
 * @file ContactForm.client.tsx
 * @description Contact form React island. Validates with ContactSubmitSchema
 * (from @repo/schemas), sends POST /api/v1/public/contact, shows inline field
 * errors and a success message on 200.
 *
 * Includes a honeypot `website` field (visually hidden, aria-hidden) to reject
 * bot submissions at the API layer.
 *
 * Hydration: client:visible (below-the-fold interactive form).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CheckCircleIcon } from '@repo/icons';
import type { ContactSubmitInput } from '@repo/schemas';
import { ContactSubmitSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import styles from './ContactForm.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the ContactForm island. */
interface ContactFormProps {
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
}

type FormFields = Omit<ContactSubmitInput, 'website'> & { readonly website: string };
type FieldErrors = Partial<Record<keyof FormFields, string>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_FIELDS: FormFields = {
    firstName: '',
    lastName: '',
    email: '',
    message: '',
    type: 'general',
    accommodationId: undefined,
    website: ''
};

/**
 * Extracts Zod field-level errors from a ZodError and maps them to
 * a flat FieldErrors record using the first issue's message per field.
 */
function extractFieldErrors(error: import('zod').ZodError): FieldErrors {
    const result: FieldErrors = {};
    for (const issue of error.issues) {
        const field = issue.path[0] as keyof FieldErrors | undefined;
        if (field && !result[field]) {
            result[field] = issue.message;
        }
    }
    return result;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ContactForm — standalone contact form island.
 *
 * Validation: ContactSubmitSchema (Zod) — client-side before submission.
 * Submission: POST /api/v1/public/contact.
 * Success: replaces form with a confirmation message.
 */
export function ContactForm({ locale }: ContactFormProps) {
    const { t } = createTranslations(locale);

    const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    function handleChange(
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ): void {
        const { name, value } = e.currentTarget;
        setFields((prev) => ({ ...prev, [name]: value }));
        // Clear field error on change
        if (errors[name as keyof FieldErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
        setFormError(null);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        // Validate with Zod
        const parsed = ContactSubmitSchema.safeParse({
            ...fields,
            // Omit undefined accommodationId if not accommodation type
            accommodationId: fields.type === 'accommodation' ? fields.accommodationId : undefined
        });

        if (!parsed.success) {
            setErrors(extractFieldErrors(parsed.error));
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch('/api/v1/public/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed.data)
            });

            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: { message?: string };
                };
                throw new Error(
                    body.error?.message ??
                        t('contact.form.errorGeneral', 'Ha ocurrido un error. Intentá de nuevo.')
                );
            }

            setIsSuccess(true);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t('contact.form.errorGeneral', 'Ha ocurrido un error. Intentá de nuevo.');
            setFormError(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isSuccess) {
        return (
            <div
                className={styles.success}
                role="alert"
                aria-live="assertive"
            >
                <span
                    className={styles.successIcon}
                    aria-hidden="true"
                >
                    <CheckCircleIcon
                        size={64}
                        weight="duotone"
                    />
                </span>
                <h2 className={styles.successTitle}>
                    {t('contact.form.successTitle', '¡Mensaje enviado!')}
                </h2>
                <p className={styles.successMsg}>
                    {t(
                        'contact.form.successMsg',
                        'Gracias por escribirnos. Te responderemos a la brevedad.'
                    )}
                </p>
            </div>
        );
    }

    return (
        <form
            className={styles.form}
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            aria-label={t('contact.form.ariaLabel', 'Formulario de contacto')}
        >
            {/* Honeypot — hidden from users, visible to bots */}
            <div
                className={styles.honeypot}
                aria-hidden="true"
            >
                <label htmlFor="website-hp">Website</label>
                <input
                    id="website-hp"
                    type="text"
                    name="website"
                    value={fields.website}
                    onChange={handleChange}
                    tabIndex={-1}
                    autoComplete="off"
                />
            </div>

            {/* Name row */}
            <div className={styles.row}>
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="cf-firstName"
                    >
                        {t('contact.form.firstName', 'Nombre')}
                        <span
                            className={styles.required}
                            aria-label={t('ui.required', 'requerido')}
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="cf-firstName"
                        type="text"
                        name="firstName"
                        value={fields.firstName}
                        onChange={handleChange}
                        className={`${styles.input}${errors.firstName ? ` ${styles.inputError}` : ''}`}
                        autoComplete="given-name"
                        aria-describedby={errors.firstName ? 'cf-firstName-error' : undefined}
                        aria-invalid={!!errors.firstName}
                        required
                    />
                    {errors.firstName && (
                        <p
                            id="cf-firstName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {t('zodError.contact.firstName.min', errors.firstName) !==
                            errors.firstName
                                ? t('zodError.contact.firstName.min', 'El nombre es requerido')
                                : errors.firstName}
                        </p>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="cf-lastName"
                    >
                        {t('contact.form.lastName', 'Apellido')}
                        <span
                            className={styles.required}
                            aria-label={t('ui.required', 'requerido')}
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="cf-lastName"
                        type="text"
                        name="lastName"
                        value={fields.lastName}
                        onChange={handleChange}
                        className={`${styles.input}${errors.lastName ? ` ${styles.inputError}` : ''}`}
                        autoComplete="family-name"
                        aria-describedby={errors.lastName ? 'cf-lastName-error' : undefined}
                        aria-invalid={!!errors.lastName}
                        required
                    />
                    {errors.lastName && (
                        <p
                            id="cf-lastName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {t('contact.form.lastNameError', 'El apellido es requerido')}
                        </p>
                    )}
                </div>
            </div>

            {/* Email */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cf-email"
                >
                    {t('contact.form.email', 'Email')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <input
                    id="cf-email"
                    type="email"
                    name="email"
                    value={fields.email}
                    onChange={handleChange}
                    className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ''}`}
                    autoComplete="email"
                    aria-describedby={errors.email ? 'cf-email-error' : undefined}
                    aria-invalid={!!errors.email}
                    required
                />
                {errors.email && (
                    <p
                        id="cf-email-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t('contact.form.emailError', 'Ingresá un email válido')}
                    </p>
                )}
            </div>

            {/* Type select */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cf-type"
                >
                    {t('contact.form.type', 'Tipo de consulta')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <select
                    id="cf-type"
                    name="type"
                    value={fields.type}
                    onChange={handleChange}
                    className={styles.select}
                    required
                >
                    <option value="general">
                        {t('contact.form.typeGeneral', 'Consulta general')}
                    </option>
                    <option value="accommodation">
                        {t('contact.form.typeAccommodation', 'Consulta sobre un alojamiento')}
                    </option>
                </select>
            </div>

            {/* Accommodation ID — visible only when type = accommodation */}
            {fields.type === 'accommodation' && (
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="cf-accommodationId"
                    >
                        {t('contact.form.accommodationId', 'ID del alojamiento')}
                        <span
                            className={styles.required}
                            aria-label={t('ui.required', 'requerido')}
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="cf-accommodationId"
                        type="text"
                        name="accommodationId"
                        value={fields.accommodationId ?? ''}
                        onChange={handleChange}
                        className={`${styles.input}${errors.accommodationId ? ` ${styles.inputError}` : ''}`}
                        placeholder={t(
                            'contact.form.accommodationIdPlaceholder',
                            'UUID del alojamiento (ej: 550e8400-...)'
                        )}
                        aria-describedby={
                            errors.accommodationId ? 'cf-accommodationId-error' : undefined
                        }
                        aria-invalid={!!errors.accommodationId}
                        required={fields.type === 'accommodation'}
                    />
                    {errors.accommodationId && (
                        <p
                            id="cf-accommodationId-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {t(
                                'contact.form.accommodationIdError',
                                'El ID del alojamiento es requerido y debe ser un UUID válido'
                            )}
                        </p>
                    )}
                </div>
            )}

            {/* Message */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cf-message"
                >
                    {t('contact.form.message', 'Mensaje')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <textarea
                    id="cf-message"
                    name="message"
                    value={fields.message}
                    onChange={handleChange}
                    className={`${styles.textarea}${errors.message ? ` ${styles.inputError}` : ''}`}
                    placeholder={t(
                        'contact.form.messagePlaceholder',
                        'Escribí tu consulta o sugerencia aquí...'
                    )}
                    aria-describedby={errors.message ? 'cf-message-error' : undefined}
                    aria-invalid={!!errors.message}
                    required
                />
                {errors.message && (
                    <p
                        id="cf-message-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t(
                            'contact.form.messageError',
                            'El mensaje debe tener al menos 10 caracteres'
                        )}
                    </p>
                )}
            </div>

            {/* Form-level error */}
            {formError && (
                <p
                    className={styles.formError}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            <button
                type="submit"
                className={styles.submit}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
            >
                {isSubmitting
                    ? t('contact.form.sending', 'Enviando...')
                    : t('contact.form.submit', 'Enviar mensaje')}
            </button>
        </form>
    );
}
