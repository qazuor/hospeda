/**
 * @file ContributionForm.client.tsx
 * @description Locked-type contribution form island (SPEC-191 D-3).
 *
 * Thin variant of ContactForm for the /colaborar pages: same Zod validation
 * (ContactSubmitSchema), same POST /api/v1/public/contact, same honeypot and
 * 429 handling — but the contact `type` is locked via the `presetType` prop
 * (no type select rendered) and the success path fires the matching typed
 * `contribution_*_submitted` PostHog event.
 *
 * Destination context (FR-3): when `presetType` is `report_destination_info`,
 * the island reads `?destino=<slug>` from the URL client-side (the /colaborar
 * pages are SSG — the server cannot read query params), seeds the message
 * with the destination context and keeps the slug in state so the submit
 * analytics event carries it structurally.
 *
 * Styling reuses ContactForm.module.css on purpose: the form anatomy is
 * identical (minus the type select), so a single stylesheet keeps both forms
 * visually in sync (Single Source of Truth).
 *
 * Hydration: client:visible (below-the-fold interactive form).
 */

import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CheckCircleIcon } from '@repo/icons';
import type { ContactSubmitInput } from '@repo/schemas';
import { ContactSubmitSchema } from '@repo/schemas';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from 'react';
import styles from '../ContactForm.module.css';

// API base URL — must be absolute because the web app and the API live on
// different origins both in dev (4321 vs 3001) and prod (hospeda.com.ar vs
// api.hospeda.com.ar). A relative path resolves against the web origin and 404s.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Max length accepted for the ?destino= slug before seeding/forwarding. */
const DESTINO_MAX_LENGTH = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Contact types reachable through the contribution forms (SPEC-191 FR-1). */
export type ContributionType =
    | 'report_destination_info'
    | 'photo_submission'
    | 'editor_application';

/** Props for the ContributionForm island. */
interface ContributionFormProps {
    /** Locked contact type — the visitor cannot change it (D-3). */
    readonly presetType: ContributionType;
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
    /**
     * Optional static content rendered directly above the submit button —
     * used by /colaborar/fotos for the "by submitting you accept the photo
     * usage terms" note (FR-4). Astro passes this as serialized children.
     */
    readonly children?: ReactNode;
}

type FormFields = Omit<ContactSubmitInput, 'website' | 'type' | 'accommodationId'> & {
    readonly website: string;
};
type FieldErrors = Partial<Record<keyof FormFields, string>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_FIELDS: FormFields = {
    firstName: '',
    lastName: '',
    email: '',
    message: '',
    website: ''
};

/** Maps each contribution type to its typed submit-success event (FR-9). */
const SUBMIT_EVENT_BY_TYPE: Record<ContributionType, string> = {
    report_destination_info: WebEvents.ContributionReportSubmitted,
    photo_submission: WebEvents.ContributionPhotoSubmitted,
    editor_application: WebEvents.ContributionEditorSubmitted
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
 * ContributionForm — locked-type contribution form island.
 *
 * Validation: ContactSubmitSchema (Zod) — client-side before submission.
 * Submission: POST /api/v1/public/contact with the locked presetType.
 * Success: contribution-specific confirmation + typed analytics event.
 */
export function ContributionForm({ presetType, locale, children }: ContributionFormProps) {
    const { t } = createTranslations(locale);

    const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
    const [destino, setDestino] = useState<string | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Destination context (FR-3): /colaborar/reportar is SSG, so the
    // ?destino= slug is read client-side (same pattern as ContactForm's
    // ?type=/?message= prefill). Only the report preset honors it.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (presetType !== 'report_destination_info') return;
        const raw = new URLSearchParams(window.location.search).get('destino');
        if (!raw) return;
        const slug = raw.slice(0, DESTINO_MAX_LENGTH);
        const { t: tEffect } = createTranslations(locale);
        const seedPrefix = tEffect(
            'contributions.form.reportSeedPrefix',
            'Reporte sobre el destino:'
        );
        setDestino(slug);
        setFields((prev) =>
            prev.message ? prev : { ...prev, message: `${seedPrefix} ${slug}. ` }
        );
    }, [presetType, locale]);

    function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
        const { name, value } = e.currentTarget;
        setFields((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FieldErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
        setFormError(null);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setFormError(null);

        // Validate with Zod — the locked type joins the payload here, and
        // accommodationId is never surfaced by contribution forms.
        const parsed = ContactSubmitSchema.safeParse({
            ...fields,
            type: presetType,
            accommodationId: undefined
        });

        if (!parsed.success) {
            const fieldErrors = extractFieldErrors(parsed.error);
            setErrors(fieldErrors);
            // Safety net (SPEC-191 smoke finding): if every issue maps to a
            // field this form does not render (e.g. the locked `type` rejected
            // by a stale schema bundle), surface the general error instead of
            // failing silently.
            const renderableFields: ReadonlyArray<keyof FieldErrors> = [
                'firstName',
                'lastName',
                'email',
                'message'
            ];
            if (!renderableFields.some((field) => fieldErrors[field])) {
                setFormError(
                    t('contributions.form.errorGeneral', 'Ha ocurrido un error. Intentá de nuevo.')
                );
            }
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_BASE}/api/v1/public/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed.data)
            });

            if (!res.ok) {
                // Surface rate-limit (429) as a dedicated, friendlier message
                // (same UX as ContactForm).
                if (res.status === 429) {
                    throw new Error(
                        t(
                            'contributions.form.errorRateLimit',
                            'Demasiados intentos. Esperá un minuto y volvé a intentar.'
                        )
                    );
                }

                const body = (await res.json().catch(() => ({}))) as {
                    error?: { message?: string };
                };
                throw new Error(
                    body.error?.message ??
                        t(
                            'contributions.form.errorGeneral',
                            'Ha ocurrido un error. Intentá de nuevo.'
                        )
                );
            }

            // Typed submit-success analytics (FR-9). The report event carries
            // the structured destino slug when present.
            trackEvent(SUBMIT_EVENT_BY_TYPE[presetType], {
                ...(presetType === 'report_destination_info' && destino ? { destino } : {}),
                locale
            });

            setIsSuccess(true);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'contributions.form.errorGeneral',
                          'Ha ocurrido un error. Intentá de nuevo.'
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
                    {t('contributions.form.successTitle', '¡Gracias por tu aporte!')}
                </h2>
                <p className={styles.successMsg}>
                    {t(
                        'contributions.form.successMsg',
                        'Lo vamos a revisar y te contactamos por email si necesitamos más detalles.'
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
            aria-label={t('contributions.form.ariaLabel', 'Formulario de colaboración')}
        >
            {/* Honeypot — hidden from users, visible to bots */}
            <div
                className={styles.honeypot}
                aria-hidden="true"
            >
                <label htmlFor="contrib-website-hp">Website</label>
                <input
                    id="contrib-website-hp"
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
                        htmlFor="contrib-firstName"
                    >
                        {t('contributions.form.firstName', 'Nombre')}
                        <span
                            className={styles.required}
                            aria-label={t('ui.required', 'requerido')}
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="contrib-firstName"
                        type="text"
                        name="firstName"
                        value={fields.firstName}
                        onChange={handleChange}
                        className={`${styles.input}${errors.firstName ? ` ${styles.inputError}` : ''}`}
                        autoComplete="given-name"
                        aria-describedby={errors.firstName ? 'contrib-firstName-error' : undefined}
                        aria-invalid={!!errors.firstName}
                        required
                    />
                    {errors.firstName && (
                        <p
                            id="contrib-firstName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {t('contributions.form.firstNameError', 'El nombre es requerido')}
                        </p>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="contrib-lastName"
                    >
                        {t('contributions.form.lastName', 'Apellido')}
                        <span
                            className={styles.required}
                            aria-label={t('ui.required', 'requerido')}
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="contrib-lastName"
                        type="text"
                        name="lastName"
                        value={fields.lastName}
                        onChange={handleChange}
                        className={`${styles.input}${errors.lastName ? ` ${styles.inputError}` : ''}`}
                        autoComplete="family-name"
                        aria-describedby={errors.lastName ? 'contrib-lastName-error' : undefined}
                        aria-invalid={!!errors.lastName}
                        required
                    />
                    {errors.lastName && (
                        <p
                            id="contrib-lastName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {t('contributions.form.lastNameError', 'El apellido es requerido')}
                        </p>
                    )}
                </div>
            </div>

            {/* Email */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="contrib-email"
                >
                    {t('contributions.form.email', 'Email')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <input
                    id="contrib-email"
                    type="email"
                    name="email"
                    value={fields.email}
                    onChange={handleChange}
                    className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ''}`}
                    autoComplete="email"
                    aria-describedby={errors.email ? 'contrib-email-error' : undefined}
                    aria-invalid={!!errors.email}
                    required
                />
                {errors.email && (
                    <p
                        id="contrib-email-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t('contributions.form.emailError', 'Ingresá un email válido')}
                    </p>
                )}
            </div>

            {/* Message */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="contrib-message"
                >
                    {t('contributions.form.message', 'Mensaje')}
                    <span
                        className={styles.required}
                        aria-label={t('ui.required', 'requerido')}
                    >
                        *
                    </span>
                </label>
                <textarea
                    id="contrib-message"
                    name="message"
                    value={fields.message}
                    onChange={handleChange}
                    className={`${styles.textarea}${errors.message ? ` ${styles.inputError}` : ''}`}
                    placeholder={t(
                        'contributions.form.messagePlaceholder',
                        'Contanos los detalles de tu aporte aquí...'
                    )}
                    aria-describedby={errors.message ? 'contrib-message-error' : undefined}
                    aria-invalid={!!errors.message}
                    required
                />
                {errors.message && (
                    <p
                        id="contrib-message-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {t(
                            'contributions.form.messageError',
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

            {/* Optional pre-submit note (e.g. photo usage-terms acceptance, FR-4) */}
            {children}

            <button
                type="submit"
                className={styles.submit}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
            >
                {isSubmitting
                    ? t('contributions.form.sending', 'Enviando...')
                    : t('contributions.form.submit', 'Enviar')}
            </button>
        </form>
    );
}
