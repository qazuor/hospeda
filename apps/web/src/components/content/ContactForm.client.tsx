import * as Sentry from '@sentry/astro';
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { contactApi } from '../../lib/api/endpoints';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { validateField } from '../../lib/validation/validate-field';
import { addToast } from '../../store/toast-store';
import { FormError } from '../ui/FormError';

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
 * ContactForm component.
 *
 * Renders a contact form with name, email, subject, and message fields.
 * Performs client-side validation via `validateField` before submitting
 * through the typed `contactApi.sendContactMessage()` wrapper. On success
 * or failure it shows a toast notification and resets or keeps the form
 * state accordingly.
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

    // Base translation function (no namespace) used to resolve generic
    // validationError.field.* keys returned by validateField.
    const { t: tBase } = useMemo(() => createTranslations(locale as SupportedLocale), [locale]);

    /**
     * Translates a `validationError.field.*` key returned by `validateField`
     * into a human-readable string using the standard validation namespace.
     *
     * @param key - i18n key like `validationError.field.required`
     * @returns Translated string or the raw key as fallback
     */
    const resolveValidationKey = (key: string): string =>
        tBase(key.replace('validationError.', 'validation.'));

    /**
     * Validates the current form state and returns any validation errors.
     *
     * Uses `validateField` for consistent validation logic and email-regex
     * parity with the rest of the application (GAP-011).
     *
     * @param data - Snapshot of the form fields to validate.
     * @returns An object with field-level error messages, or `{}` when valid.
     */
    const validateForm = (data: ContactFormState): ContactFormErrors => {
        const validationErrors: ContactFormErrors = {};

        const nameKey = validateField(data.name, { required: true, minLength: 2 });
        if (nameKey) validationErrors.name = resolveValidationKey(nameKey);

        const emailKey = validateField(data.email, { required: true, email: true });
        if (emailKey) validationErrors.email = resolveValidationKey(emailKey);

        const subjectKey = validateField(data.subject, { required: true, minLength: 3 });
        if (subjectKey) validationErrors.subject = resolveValidationKey(subjectKey);

        const messageKey = validateField(data.message, { required: true, minLength: 20 });
        if (messageKey) validationErrors.message = resolveValidationKey(messageKey);

        return validationErrors;
    };

    /**
     * Sends the validated form payload via the typed contactApi wrapper.
     * Shows a success or error toast and resets the form on success.
     */
    const submitForm = async (): Promise<void> => {
        setIsSubmitting(true);

        try {
            const result = await contactApi.sendContactMessage({
                name: formState.name.trim(),
                email: formState.email.trim(),
                subject: formState.subject.trim(),
                message: formState.message.trim()
            });

            if (!result.ok) {
                throw new Error(result.error.message);
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
                <FormError
                    fieldName="name"
                    error={errors.name}
                />
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
                <FormError
                    fieldName="email"
                    error={errors.email}
                />
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
                <FormError
                    fieldName="subject"
                    error={errors.subject}
                />
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
                <FormError
                    fieldName="message"
                    error={errors.message}
                />
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
