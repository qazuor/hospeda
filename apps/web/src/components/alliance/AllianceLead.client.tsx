/**
 * @file AllianceLead.client.tsx
 * @description "Aliados" lead form island (HOS-277) shared by the four
 * alliance landing pages: `partner`, `sponsor`, `service_provider`, `editor`.
 *
 * Collects generic applicant info (`contactName`, `email`, `phone`,
 * free-text `message`) plus a small set of kind-specific fields (business
 * name, website, portfolio links, etc. — see
 * `@/lib/forms/alliance-lead-message.ts`). The kind-specific fields are
 * front-only: on submit they are serialized with human-readable labels into
 * the single `message` string the backend persists (HOS-277 §7.3), so the
 * payload sent to `POST /api/v1/public/alliance/leads` only ever carries
 * `{ kind, contactName, email, phone?, message, _hp? }`.
 *
 * Includes a honeypot `_hp` field for spam rejection, mirroring
 * `CommerceLead.client.tsx`. Rate-limit (429) and generic API errors surface
 * friendly i18n messages.
 *
 * Hydration: caller MUST use `client:load` (the `kind` prop is fixed per
 * landing page, so there is no reason to defer hydration).
 */

import { CheckCircleIcon } from '@repo/icons';
import type { AllianceLeadCreateInput, AllianceLeadKind } from '@repo/schemas';
import { AllianceLeadCreateInputSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import {
    ALLIANCE_LEAD_SPECIFIC_FIELDS,
    type AllianceLeadSpecificValues,
    serializeAllianceLeadMessage,
    validateAllianceLeadSpecificFields
} from '@/lib/forms/alliance-lead-message';
import { zodIssuesToFieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AllianceLead.module.css';

// API base URL — must be absolute because the web app (host A) and the API
// (host B) live on different origins both in dev (4321 vs 3001) and prod.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the AllianceLead island. */
export interface AllianceLeadProps {
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    /** Which "aliados" program this form submits for. Fixed per landing page. */
    readonly kind: AllianceLeadKind;
}

interface GenericFields {
    contactName: string;
    email: string;
    phone: string;
    freeText: string;
}

type FieldErrors = Record<string, string>;

const INITIAL_GENERIC_FIELDS: GenericFields = {
    contactName: '',
    email: '',
    phone: '',
    freeText: ''
};

/** Maps each kind to the i18n namespace segment carrying its landing copy. */
const KIND_NAMESPACE: Record<AllianceLeadKind, string> = {
    partner: 'partner',
    sponsor: 'sponsor',
    service_provider: 'serviceProvider',
    editor: 'editor'
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AllianceLead — public "aliados" pre-onboarding lead form island (HOS-277).
 *
 * Validation: generic fields through `AllianceLeadCreateInputSchema` (Zod);
 * kind-specific fields through `validateAllianceLeadSpecificFields` (front-only).
 * Submission: POST /api/v1/public/alliance/leads.
 * Success: replaces form with a confirmation message.
 * 429: shows rateLimited i18n message.
 *
 * @param props - Component props (see {@link AllianceLeadProps})
 */
export function AllianceLead({ locale, kind }: AllianceLeadProps) {
    const { t } = createTranslations(locale);

    const namespaceKey = KIND_NAMESPACE[kind];
    const formTitleKey = `alliance-leads.${namespaceKey}.form.heading`;
    const specificFields = ALLIANCE_LEAD_SPECIFIC_FIELDS[kind];

    const [fields, setFields] = useState<GenericFields>(INITIAL_GENERIC_FIELDS);
    const [specificValues, setSpecificValues] = useState<AllianceLeadSpecificValues>({});
    const [hp, setHp] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
        const { name, value } = e.currentTarget;
        setFields((prev) => ({ ...prev, [name]: value }));
        if (errors[name === 'freeText' ? 'message' : name]) {
            setErrors((prev) => ({ ...prev, [name === 'freeText' ? 'message' : name]: '' }));
        }
        setFormError(null);
    }

    function handleSpecificChange(e: ChangeEvent<HTMLInputElement>): void {
        const { name, value } = e.currentTarget;
        setSpecificValues((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
        setFormError(null);
    }

    function handleHoneypotChange(e: ChangeEvent<HTMLInputElement>): void {
        setHp(e.currentTarget.value);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        const specificErrors = validateAllianceLeadSpecificFields({ kind, specificValues, t });

        const message = serializeAllianceLeadMessage({
            kind,
            specificValues,
            freeText: fields.freeText,
            t
        });

        const payload: AllianceLeadCreateInput = {
            kind,
            contactName: fields.contactName,
            email: fields.email,
            phone: fields.phone || undefined,
            message
        };

        const parsed = AllianceLeadCreateInputSchema.safeParse(payload);

        const schemaErrors = parsed.success ? {} : zodIssuesToFieldErrors(parsed.error.issues, t);
        const combinedErrors = { ...specificErrors, ...schemaErrors };

        if (Object.keys(combinedErrors).length > 0) {
            setErrors(combinedErrors);
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_BASE}/api/v1/public/alliance/leads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...(parsed.success ? parsed.data : payload), _hp: hp })
            });

            if (!res.ok) {
                if (res.status === 429) {
                    throw new Error(
                        t(
                            'alliance-leads.form.rateLimited',
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
                            'alliance-leads.form.error',
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
                          'alliance-leads.form.error',
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
                        'alliance-leads.form.success',
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
            aria-label={t(formTitleKey, 'Enviá tu solicitud')}
        >
            {/* Honeypot — hidden from users, visible to bots */}
            <div
                className={styles.honeypot}
                aria-hidden="true"
            >
                <label htmlFor="al-hp">Leave this field empty</label>
                <input
                    id="al-hp"
                    type="text"
                    name="_hp"
                    value={hp}
                    onChange={handleHoneypotChange}
                    tabIndex={-1}
                    autoComplete="off"
                />
            </div>

            {/* Contact name */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="al-contactName"
                >
                    {t('alliance-leads.form.fields.contactName', 'Tu nombre')}
                    <span
                        className={styles.required}
                        aria-hidden="true"
                    >
                        *
                    </span>
                </label>
                <input
                    id="al-contactName"
                    type="text"
                    name="contactName"
                    value={fields.contactName}
                    onChange={handleChange}
                    className={`${styles.input}${errors.contactName ? ` ${styles.inputError}` : ''}`}
                    autoComplete="name"
                    aria-describedby={errors.contactName ? 'al-contactName-error' : undefined}
                    aria-invalid={!!errors.contactName}
                    required
                />
                {errors.contactName && (
                    <p
                        id="al-contactName-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t('alliance-leads.form.validation.required', 'Este campo es obligatorio.')}
                    </p>
                )}
            </div>

            {/* Email */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="al-email"
                >
                    {t('alliance-leads.form.fields.email', 'Correo electrónico')}
                    <span
                        className={styles.required}
                        aria-hidden="true"
                    >
                        *
                    </span>
                </label>
                <input
                    id="al-email"
                    type="email"
                    name="email"
                    value={fields.email}
                    onChange={handleChange}
                    className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ''}`}
                    autoComplete="email"
                    aria-describedby={errors.email ? 'al-email-error' : undefined}
                    aria-invalid={!!errors.email}
                    required
                />
                {errors.email && (
                    <p
                        id="al-email-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t(
                            'alliance-leads.form.validation.email',
                            'Ingresá un correo electrónico válido.'
                        )}
                    </p>
                )}
            </div>

            {/* Phone (optional) */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="al-phone"
                >
                    {t('alliance-leads.form.fields.phone', 'Teléfono (opcional)')}
                </label>
                <input
                    id="al-phone"
                    type="tel"
                    name="phone"
                    value={fields.phone}
                    onChange={handleChange}
                    className={`${styles.input}${errors.phone ? ` ${styles.inputError}` : ''}`}
                    autoComplete="tel"
                    aria-describedby={errors.phone ? 'al-phone-error' : undefined}
                    aria-invalid={!!errors.phone}
                />
                {errors.phone && (
                    <p
                        id="al-phone-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {errors.phone}
                    </p>
                )}
            </div>

            {/* Kind-specific fields */}
            <h3 className={styles.sectionTitle}>{t(formTitleKey, 'Contanos más')}</h3>
            {specificFields.map((field) => (
                <div
                    key={field.name}
                    className={styles.field}
                >
                    <label
                        className={styles.label}
                        htmlFor={`al-${field.name}`}
                    >
                        {t(`alliance-leads.form.fields.${field.name}`, field.name)}
                        {field.required && (
                            <span
                                className={styles.required}
                                aria-hidden="true"
                            >
                                *
                            </span>
                        )}
                    </label>
                    <input
                        id={`al-${field.name}`}
                        type={field.type === 'url' ? 'url' : 'text'}
                        name={field.name}
                        value={specificValues[field.name] ?? ''}
                        onChange={handleSpecificChange}
                        className={`${styles.input}${errors[field.name] ? ` ${styles.inputError}` : ''}`}
                        aria-describedby={errors[field.name] ? `al-${field.name}-error` : undefined}
                        aria-invalid={!!errors[field.name]}
                        required={field.required}
                    />
                    {errors[field.name] && (
                        <p
                            id={`al-${field.name}-error`}
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {errors[field.name]}
                        </p>
                    )}
                </div>
            ))}

            {/* Free-text message (optional) */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="al-message"
                >
                    {t('alliance-leads.form.fields.message', 'Contanos más (opcional)')}
                </label>
                <textarea
                    id="al-message"
                    name="freeText"
                    value={fields.freeText}
                    onChange={handleChange}
                    className={`${styles.textarea}${errors.message ? ` ${styles.inputError}` : ''}`}
                    rows={4}
                    aria-describedby={errors.message ? 'al-message-error' : undefined}
                    aria-invalid={!!errors.message}
                />
                {errors.message && (
                    <p
                        id="al-message-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {errors.message}
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
                    ? t('alliance-leads.form.submitting', 'Enviando...')
                    : t('alliance-leads.form.submit', 'Enviar solicitud')}
            </button>
        </form>
    );
}
