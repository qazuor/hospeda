import * as Sentry from '@sentry/astro';
import type { JSX } from 'react';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { getApiUrl } from '../../lib/env';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { addToast } from '../../store/toast-store';

/**
 * Internal form state shape.
 */
interface ContactFormState {
    readonly name: string;
    readonly email: string;
    readonly subject: string;
    readonly message: string;
}

/**
 * Per-field validation error messages.
 */
interface ContactFormErrors {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
}

/**
 * Props for the ContactForm component.
 */
export interface ContactFormProps {
    /**
     * Locale used for UI text translations.
     * @default 'es'
     */
    readonly locale?: string;

    /**
     * Additional CSS classes applied to the `<form>` element.
     */
    readonly className?: string;
}

/**
 * Validates an email address with a simple regex pattern.
 *
 * @param email - The email string to test.
 * @returns `true` when the email is syntactically valid.
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * ContactForm component.
 *
 * Renders a contact form with name, email, subject, and message fields.
 * Performs client-side validation before submitting to the public contact API
 * endpoint. On success or failure it shows a toast notification and resets
 * or keeps the form state accordingly.
 *
 * Intentionally uses manual validation (no react-hook-form) because the form
 * is simple (4 fields, basic rules) and adding a heavy form library is not
 * justified (YAGNI).
 *
 * @param props - Component props.
 * @returns The rendered contact form.
 *
 * @example
 * ```tsx
 * <ContactForm locale="es" className="max-w-2xl mx-auto" />
 * ```
 */
export function ContactForm({ locale = 'es', className = '' }: ContactFormProps): JSX.Element {
    const [formState, setFormState] = useState<ContactFormState>({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [errors, setErrors] = useState<ContactFormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'contact' });

    /**
     * Validates the current form state and returns any validation errors.
     *
     * @param data - Snapshot of the form fields to validate.
     * @returns An object with field-level error messages, or `{}` when valid.
     */
    const validateForm = (data: ContactFormState): ContactFormErrors => {
        const validationErrors: ContactFormErrors = {};

        if (!data.name.trim()) {
            validationErrors.name = t('form.validation.nameRequired');
        } else if (data.name.trim().length < 2) {
            validationErrors.name = t('form.validation.nameMinLength');
        }

        if (!data.email.trim()) {
            validationErrors.email = t('form.validation.emailRequired');
        } else if (!isValidEmail(data.email.trim())) {
            validationErrors.email = t('form.validation.emailInvalid');
        }

        if (!data.subject.trim()) {
            validationErrors.subject = t('form.validation.subjectRequired');
        } else if (data.subject.trim().length < 3) {
            validationErrors.subject = t('form.validation.subjectMinLength');
        }

        if (!data.message.trim()) {
            validationErrors.message = t('form.validation.messageRequired');
        } else if (data.message.trim().length < 20) {
            validationErrors.message = t('form.validation.messageMinLength');
        }

        return validationErrors;
    };

    /**
     * Sends the validated form payload to the contact API endpoint.
     * Shows a success or error toast and resets the form on success.
     */
    const submitForm = async (): Promise<void> => {
        setIsSubmitting(true);

        try {
            const apiBaseUrl = getApiUrl();
            const response = await fetch(`${apiBaseUrl}/api/v1/public/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formState.name.trim(),
                    email: formState.email.trim(),
                    subject: formState.subject.trim(),
                    message: formState.message.trim()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            addToast({ type: 'success', message: t('form.successMessage') });

            setFormState({ name: '', email: '', subject: '', message: '' });
            setErrors({});
        } catch (error) {
            webLogger.error('ContactForm: submit failed', error);
            Sentry.captureException(error);
            addToast({ type: 'error', message: t('form.errorMessage') });
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handles the form submit event: validates, then fires the async submit.
     *
     * @param e - The React form submit event.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();

        const validationErrors = validateForm(formState);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        void submitForm();
    };

    /**
     * Updates a single field in the form state and clears its error if present.
     *
     * @param field - The form field key to update.
     * @param value - The new value for that field.
     */
    const handleFieldChange = (field: keyof ContactFormState, value: string): void => {
        setFormState((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            const updated = { ...errors };
            delete updated[field];
            setErrors(updated);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className={`space-y-4 ${className}`.trim()}
        >
            {/* Name */}
            <div>
                <label
                    htmlFor="contact-name"
                    className="mb-1 block font-medium text-sm text-text"
                >
                    {t('form.name')}
                </label>
                <input
                    type="text"
                    id="contact-name"
                    value={formState.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder={t('form.placeholders.name')}
                    disabled={isSubmitting}
                    aria-required="true"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                    className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                        errors.name
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.name && (
                    <p
                        id="name-error"
                        className="mt-1 text-destructive text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.name}
                    </p>
                )}
            </div>

            {/* Email */}
            <div>
                <label
                    htmlFor="contact-email"
                    className="mb-1 block font-medium text-sm text-text"
                >
                    {t('form.email')}
                </label>
                <input
                    type="email"
                    id="contact-email"
                    value={formState.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder={t('form.placeholders.email')}
                    disabled={isSubmitting}
                    aria-required="true"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                        errors.email
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.email && (
                    <p
                        id="email-error"
                        className="mt-1 text-destructive text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.email}
                    </p>
                )}
            </div>

            {/* Subject */}
            <div>
                <label
                    htmlFor="contact-subject"
                    className="mb-1 block font-medium text-sm text-text"
                >
                    {t('form.subject')}
                </label>
                <input
                    type="text"
                    id="contact-subject"
                    value={formState.subject}
                    onChange={(e) => handleFieldChange('subject', e.target.value)}
                    placeholder={t('form.placeholders.subject')}
                    disabled={isSubmitting}
                    aria-required="true"
                    aria-invalid={!!errors.subject}
                    aria-describedby={errors.subject ? 'subject-error' : undefined}
                    className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                        errors.subject
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.subject && (
                    <p
                        id="subject-error"
                        className="mt-1 text-destructive text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.subject}
                    </p>
                )}
            </div>

            {/* Message */}
            <div>
                <label
                    htmlFor="contact-message"
                    className="mb-1 block font-medium text-sm text-text"
                >
                    {t('form.message')}
                </label>
                <textarea
                    id="contact-message"
                    value={formState.message}
                    onChange={(e) => handleFieldChange('message', e.target.value)}
                    placeholder={t('form.placeholders.message')}
                    rows={5}
                    disabled={isSubmitting}
                    aria-required="true"
                    aria-invalid={!!errors.message}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                    className={`resize-vertical w-full rounded-md border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                        errors.message
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.message && (
                    <p
                        id="message-error"
                        className="mt-1 text-destructive text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.message}
                    </p>
                )}
            </div>

            {/* Submit */}
            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isSubmitting ? t('form.submitting') : t('form.submit')}
            </button>
        </form>
    );
}
