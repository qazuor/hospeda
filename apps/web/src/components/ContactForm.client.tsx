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

import { CheckCircleIcon, ChevronDownIcon } from '@repo/icons';
import type { ContactSubmitInput } from '@repo/schemas';
import { ContactSubmitSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { visibleApiMessage } from '@/lib/api-errors';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ContactForm.module.css';
import { FieldError } from './ui/FieldError';
import { RequiredMarker } from './ui/RequiredMarker';
import { TextField } from './ui/TextField';

// API base URL — must be absolute because the web app (host A) and the API
// (host B) live on different origins both in dev (4321 vs 3001) and prod
// (hospeda.com.ar vs api.hospeda.com.ar). A relative path resolves against
// the web origin and 404s.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the ContactForm island. */
interface ContactFormProps {
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
}

type FormFields = Omit<ContactSubmitInput, 'website'> & { readonly website: string };

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
 * Ordered list of contact-type options surfaced to the public form.
 * Order is roughly by expected volume so high-frequency cases sit at the top.
 * `accommodation` is intentionally excluded — host inquiries go through the
 * dedicated ContactHost flow on the accommodation detail page instead.
 */
const CONTACT_TYPE_OPTIONS = [
    { value: 'general', i18nKey: 'contact.form.typeGeneral', fallback: 'Consulta general' },
    { value: 'support', i18nKey: 'contact.form.typeSupport', fallback: 'Soporte técnico' },
    {
        value: 'publish_accommodation',
        i18nKey: 'contact.form.typePublishAccommodation',
        fallback: 'Quiero publicar mi alojamiento'
    },
    {
        value: 'subscriptions',
        i18nKey: 'contact.form.typeSubscriptions',
        fallback: 'Suscripciones y pagos'
    },
    {
        value: 'suggestions',
        i18nKey: 'contact.form.typeSuggestions',
        fallback: 'Sugerencias y mejoras'
    },
    { value: 'report', i18nKey: 'contact.form.typeReport', fallback: 'Reportar un problema' },
    { value: 'press', i18nKey: 'contact.form.typePress', fallback: 'Prensa y medios' },
    {
        value: 'partnerships',
        i18nKey: 'contact.form.typePartnerships',
        fallback: 'Alianzas comerciales'
    },
    {
        value: 'event_submission',
        i18nKey: 'contact.form.typeEventSubmission',
        fallback: 'Sumar mi evento'
    },
    {
        value: 'revocation',
        i18nKey: 'contact.form.typeRevocation',
        fallback: 'Arrepentimiento de compra (revocación)'
    }
] as const;

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
    const {
        fieldErrors: errors,
        clearError,
        formError,
        setFormError,
        validate
    } = useZodForm({
        schema: ContactSubmitSchema,
        t,
        fieldIdPrefix: 'cf',
        validationToast: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Prefill from URL params so other pages can deep-link into the contact
    // form with a topic + message already filled in (e.g. the
    // CityDestinationPicker's "No encuentro mi ciudad" link). Only the
    // `type` value is honored if it matches a known option; `message` is
    // length-capped to match the schema bound and prevent UI blow-out.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const rawType = params.get('type');
        const rawMessage = params.get('message');
        const allowedTypes = new Set<string>(CONTACT_TYPE_OPTIONS.map((opt) => opt.value));
        const nextType =
            rawType && allowedTypes.has(rawType) ? (rawType as FormFields['type']) : null;
        const nextMessage = rawMessage ? rawMessage.slice(0, 2000) : null;
        if (!nextType && !nextMessage) return;
        setFields((prev) => ({
            ...prev,
            ...(nextType ? { type: nextType } : {}),
            ...(nextMessage ? { message: nextMessage } : {})
        }));
    }, []);

    function handleChange(
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ): void {
        const { name, value } = e.currentTarget;
        setFields((prev) => ({ ...prev, [name]: value }));
        // Clear field error on change
        clearError(name);
        setFormError(null);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        // Validate with Zod. accommodationId is no longer surfaced by the form,
        // so it is always omitted from the submission payload.
        const parsed = validate({
            ...fields,
            accommodationId: undefined
        });

        if (!parsed.success) return;

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_BASE}/api/v1/public/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed.data)
            });

            if (!res.ok) {
                // Surface rate-limit (429) as a dedicated, friendlier message so
                // the user understands why the request was rejected rather than
                // seeing a generic error.
                if (res.status === 429) {
                    throw new Error(
                        t(
                            'contact.form.errorRateLimit',
                            'Demasiados intentos. Esperá un minuto y volvé a intentar.'
                        )
                    );
                }

                const body = (await res.json().catch(() => ({}))) as {
                    error?: { message?: string };
                };
                throw new Error(
                    visibleApiMessage({ error: body.error, status: res.status }) ??
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

    const commonField = {
        prefix: 'cf',
        labelClassName: styles.label,
        required: true,
        onChange: handleChange
    };
    const requiredLabel = (label: string) => (
        <>
            {label}
            <RequiredMarker />
        </>
    );

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

            <FieldError
                id="cf-summary"
                message={Object.keys(errors).length > 0 ? t('validation.formHasErrors') : undefined}
            />
            <div className={styles.row}>
                <div className={styles.field}>
                    <TextField
                        {...commonField}
                        name="firstName"
                        controlName="firstName"
                        label={requiredLabel(t('contact.form.firstName'))}
                        className={styles.input}
                        value={fields.firstName}
                        error={errors.firstName}
                        autoComplete="given-name"
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        {...commonField}
                        name="lastName"
                        controlName="lastName"
                        label={requiredLabel(t('contact.form.lastName'))}
                        className={styles.input}
                        value={fields.lastName}
                        error={
                            errors.lastName &&
                            (fields.lastName.trim().length < 2
                                ? t('contact.form.lastNameError')
                                : errors.lastName)
                        }
                        autoComplete="family-name"
                    />
                </div>
            </div>

            {/* Email */}
            <div className={styles.field}>
                <TextField
                    {...commonField}
                    name="email"
                    controlName="email"
                    type="email"
                    label={requiredLabel(t('contact.form.email'))}
                    className={styles.input}
                    value={fields.email}
                    error={errors.email}
                    autoComplete="email"
                />
            </div>

            {/* Type select */}
            <div className={`${styles.field} ${styles.selectField}`}>
                <TextField
                    {...commonField}
                    as="select"
                    name="type"
                    controlName="type"
                    label={requiredLabel(t('contact.form.type'))}
                    className={styles.select}
                    value={fields.type}
                    error={errors.type}
                >
                    {CONTACT_TYPE_OPTIONS.map((opt) => (
                        <option
                            key={opt.value}
                            value={opt.value}
                        >
                            {t(opt.i18nKey, opt.fallback)}
                        </option>
                    ))}
                </TextField>
                <ChevronDownIcon
                    className={styles.selectIcon}
                    size={18}
                    aria-hidden="true"
                />
            </div>

            {/* Message */}
            <div className={styles.field}>
                <TextField
                    {...commonField}
                    as="textarea"
                    name="message"
                    controlName="message"
                    label={requiredLabel(t('contact.form.message'))}
                    className={styles.textarea}
                    value={fields.message}
                    error={errors.message}
                    placeholder={t('contact.form.messagePlaceholder')}
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
                    ? t('contact.form.sending', 'Enviando...')
                    : t('contact.form.submit', 'Enviar mensaje')}
            </button>
        </form>
    );
}
