/**
 * @file CommerceLead.client.tsx
 * @description Pre-onboarding commerce lead form island for gastronomy listings.
 *
 * Collects the minimum data needed to evaluate a new commerce applicant.
 * Submits to POST /api/v1/public/commerce/leads with `domain: 'gastronomy'`
 * hardcoded. Includes a honeypot `_hp` field for spam rejection.
 *
 * Rate-limit (429) and generic API errors surface friendly i18n messages.
 *
 * Hydration: caller MUST use `client:load`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CheckCircleIcon } from '@repo/icons';
import type { CommerceLeadCreateInput } from '@repo/schemas';
import { CommerceLeadCreateInputSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import styles from './CommerceLead.module.css';

// API base URL — must be absolute because the web app (host A) and the API
// (host B) live on different origins both in dev (4321 vs 3001) and prod.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

/** A destination option for the optional destination select. */
export interface DestinationOption {
    readonly id: string;
    readonly name: string;
}

/** Props for the CommerceLead island. */
export interface CommerceLeadProps {
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    /** Optional list of destination options for the city/destination select. */
    readonly destinations?: ReadonlyArray<DestinationOption>;
}

type LeadFields = Omit<CommerceLeadCreateInput, 'domain'> & {
    readonly _hp: string;
};

type FieldErrors = Partial<Record<keyof LeadFields, string>>;

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_FIELDS: LeadFields = {
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    destinationId: undefined,
    message: '',
    _hp: ''
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts Zod field-level errors from a ZodError and maps them to a flat
 * FieldErrors record using the first issue's message per field.
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
 * CommerceLead — public gastronomy pre-onboarding lead form island.
 *
 * Validation: CommerceLeadCreateInputSchema (Zod), domain hardcoded to 'gastronomy'.
 * Submission: POST /api/v1/public/commerce/leads.
 * Success: replaces form with a confirmation message.
 * 429: shows rateLimited i18n message.
 *
 * @param props - Component props (see {@link CommerceLeadProps})
 */
export function CommerceLead({ locale, destinations = [] }: CommerceLeadProps) {
    const { t } = createTranslations(locale);

    const [fields, setFields] = useState<LeadFields>(INITIAL_FIELDS);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    function handleChange(
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ): void {
        const { name, value } = e.currentTarget;
        setFields((prev) => ({ ...prev, [name]: value || undefined }));
        if (errors[name as keyof FieldErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
        setFormError(null);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        // Build the payload — domain is always 'gastronomy'.
        const payload: CommerceLeadCreateInput & { _hp: string } = {
            domain: 'gastronomy',
            businessName: fields.businessName,
            contactName: fields.contactName,
            email: fields.email,
            phone: fields.phone || undefined,
            destinationId: fields.destinationId || undefined,
            message: fields.message || undefined,
            _hp: fields._hp
        };

        // Validate the non-honeypot fields through the schema.
        const { _hp, ...schemaPayload } = payload;
        const parsed = CommerceLeadCreateInputSchema.safeParse(schemaPayload);

        if (!parsed.success) {
            setErrors(extractFieldErrors(parsed.error));
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_BASE}/api/v1/public/commerce/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...parsed.data, _hp })
            });

            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error(
                        t(
                            'commerce.lead.rateLimited',
                            'Demasiados intentos. Por favor, esperá unos minutos antes de volver a intentarlo.'
                        )
                    );
                }

                const body = (await res.json().catch(() => ({}))) as {
                    error?: { message?: string };
                };
                throw new Error(
                    body.error?.message ??
                        t(
                            'commerce.lead.error',
                            'Ocurrió un error al enviar la solicitud. Por favor, intentá de nuevo.'
                        )
                );
            }

            setIsSuccess(true);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'commerce.lead.error',
                          'Ocurrió un error al enviar la solicitud. Por favor, intentá de nuevo.'
                      );
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
                    {t(
                        'commerce.lead.success',
                        '¡Gracias! Recibimos tu solicitud y nos contactaremos a la brevedad.'
                    )}
                </h2>
            </div>
        );
    }

    return (
        <form
            className={styles.form}
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            aria-label={t('commerce.lead.title', 'Sumá tu negocio')}
        >
            {/* Honeypot — hidden from users, visible to bots */}
            <div
                className={styles.honeypot}
                aria-hidden="true"
            >
                <label htmlFor="cl-hp">Website</label>
                <input
                    id="cl-hp"
                    type="text"
                    name="_hp"
                    value={fields._hp}
                    onChange={handleChange}
                    tabIndex={-1}
                    autoComplete="off"
                />
            </div>

            {/* Business name */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cl-businessName"
                >
                    {t('commerce.lead.fields.businessName', 'Nombre del negocio')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <input
                    id="cl-businessName"
                    type="text"
                    name="businessName"
                    value={fields.businessName}
                    onChange={handleChange}
                    className={`${styles.input}${errors.businessName ? ` ${styles.inputError}` : ''}`}
                    autoComplete="organization"
                    aria-describedby={errors.businessName ? 'cl-businessName-error' : undefined}
                    aria-invalid={!!errors.businessName}
                    required
                />
                {errors.businessName && (
                    <p
                        id="cl-businessName-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t('commerce.lead.validation.required', 'Este campo es obligatorio.')}
                    </p>
                )}
            </div>

            {/* Contact name */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cl-contactName"
                >
                    {t('commerce.lead.fields.contactName', 'Tu nombre')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <input
                    id="cl-contactName"
                    type="text"
                    name="contactName"
                    value={fields.contactName}
                    onChange={handleChange}
                    className={`${styles.input}${errors.contactName ? ` ${styles.inputError}` : ''}`}
                    autoComplete="name"
                    aria-describedby={errors.contactName ? 'cl-contactName-error' : undefined}
                    aria-invalid={!!errors.contactName}
                    required
                />
                {errors.contactName && (
                    <p
                        id="cl-contactName-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t('commerce.lead.validation.required', 'Este campo es obligatorio.')}
                    </p>
                )}
            </div>

            {/* Email */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cl-email"
                >
                    {t('commerce.lead.fields.email', 'Correo electrónico')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <input
                    id="cl-email"
                    type="email"
                    name="email"
                    value={fields.email}
                    onChange={handleChange}
                    className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ''}`}
                    autoComplete="email"
                    aria-describedby={errors.email ? 'cl-email-error' : undefined}
                    aria-invalid={!!errors.email}
                    required
                />
                {errors.email && (
                    <p
                        id="cl-email-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t(
                            'commerce.lead.validation.email',
                            'Ingresá un correo electrónico válido.'
                        )}
                    </p>
                )}
            </div>

            {/* Phone (optional) */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cl-phone"
                >
                    {t('commerce.lead.fields.phone', 'Teléfono (opcional)')}
                </label>
                <input
                    id="cl-phone"
                    type="tel"
                    name="phone"
                    value={fields.phone ?? ''}
                    onChange={handleChange}
                    className={styles.input}
                    autoComplete="tel"
                />
            </div>

            {/* Destination (optional) */}
            {destinations.length > 0 && (
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="cl-destinationId"
                    >
                        {t('commerce.lead.fields.destination', 'Ciudad / Destino (opcional)')}
                    </label>
                    <select
                        id="cl-destinationId"
                        name="destinationId"
                        value={fields.destinationId ?? ''}
                        onChange={handleChange}
                        className={styles.select}
                    >
                        <option value="">—</option>
                        {destinations.map((d) => (
                            <option
                                key={d.id}
                                value={d.id}
                            >
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Message (optional) */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="cl-message"
                >
                    {t('commerce.lead.fields.message', 'Contanos sobre tu negocio (opcional)')}
                </label>
                <textarea
                    id="cl-message"
                    name="message"
                    value={fields.message ?? ''}
                    onChange={handleChange}
                    className={styles.textarea}
                    rows={4}
                />
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
                    ? t('commerce.lead.submitting', 'Enviando...')
                    : t('commerce.lead.submit', 'Enviar solicitud')}
            </button>
        </form>
    );
}
