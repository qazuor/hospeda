import type { JSX } from 'react';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { getApiUrl } from '../../lib/env';
import type { SupportedLocale } from '../../lib/i18n';
import { addToast } from '../../store/toast-store';

/**
 * Contact form state
 */
interface ContactFormState {
    readonly name: string;
    readonly email: string;
    readonly subject: string;
    readonly message: string;
}

/**
 * Validation errors for form fields
 */
interface ContactFormErrors {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
}

/**
 * Props for the ContactForm component
 */
export interface ContactFormProps {
    /**
     * Locale for UI text
     * @default 'es'
     */
    readonly locale?: string;

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;
}

/**
 * Validates an email address using a simple regex pattern
 *
 * @param email - Email address to validate
 * @returns True if email is valid, false otherwise
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * ContactForm component
 *
 * A contact form with name, email, subject, and message fields.
 * Includes client-side validation, API submission, and toast notifications.
 *
 * @param props - Component props
 * @returns React component
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
     * Validates form data
     *
     * @param data - Form data to validate
     * @returns Validation errors or empty object if valid
     */
    const validateForm = (data: ContactFormState): ContactFormErrors => {
        const validationErrors: ContactFormErrors = {};

        // Name validation
        if (!data.name.trim()) {
            validationErrors.name = t('form.validation.nameRequired');
        } else if (data.name.trim().length < 2) {
            validationErrors.name = t('form.validation.nameMinLength');
        }

        // Email validation
        if (!data.email.trim()) {
            validationErrors.email = t('form.validation.emailRequired');
        } else if (!isValidEmail(data.email.trim())) {
            validationErrors.email = t('form.validation.emailInvalid');
        }

        // Subject validation
        if (!data.subject.trim()) {
            validationErrors.subject = t('form.validation.subjectRequired');
        } else if (data.subject.trim().length < 3) {
            validationErrors.subject = t('form.validation.subjectMinLength');
        }

        // Message validation
        if (!data.message.trim()) {
            validationErrors.message = t('form.validation.messageRequired');
        } else if (data.message.trim().length < 20) {
            validationErrors.message = t('form.validation.messageMinLength');
        }

        return validationErrors;
    };

    /**
     * Handles form submission
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Validate form
        const validationErrors = validateForm(formState);
        setErrors(validationErrors);

        // Stop if validation failed
        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        // Submit to API (async operation)
        submitForm();
    };

    /**
     * Submits form data to API
     */
    const submitForm = async () => {
        setIsSubmitting(true);

        try {
            const apiBaseUrl = getApiUrl();
            const response = await fetch(`${apiBaseUrl}/api/v1/public/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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

            // Success: show toast and reset form
            addToast({
                type: 'success',
                message: t('form.successMessage')
            });

            setFormState({
                name: '',
                email: '',
                subject: '',
                message: ''
            });
            setErrors({});
        } catch (_error) {
            // Error: show toast
            addToast({
                type: 'error',
                message: t('form.errorMessage')
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handles field change and clears corresponding error
     */
    const handleFieldChange = (field: keyof ContactFormState, value: string) => {
        setFormState((prev) => ({ ...prev, [field]: value }));
        // Clear error for this field if it exists
        if (errors[field]) {
            const newErrors = { ...errors };
            delete newErrors[field];
            setErrors(newErrors);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className={`space-y-4 ${className}`.trim()}
        >
            {/* Name Field */}
            <div>
                <label
                    htmlFor="contact-name"
                    className="mb-1 block font-medium text-gray-700 text-sm"
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
                    className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                        errors.name
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.name && (
                    <p
                        id="name-error"
                        className="mt-1 text-red-600 text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.name}
                    </p>
                )}
            </div>

            {/* Email Field */}
            <div>
                <label
                    htmlFor="contact-email"
                    className="mb-1 block font-medium text-gray-700 text-sm"
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
                    className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                        errors.email
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.email && (
                    <p
                        id="email-error"
                        className="mt-1 text-red-600 text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.email}
                    </p>
                )}
            </div>

            {/* Subject Field */}
            <div>
                <label
                    htmlFor="contact-subject"
                    className="mb-1 block font-medium text-gray-700 text-sm"
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
                    className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                        errors.subject
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.subject && (
                    <p
                        id="subject-error"
                        className="mt-1 text-red-600 text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.subject}
                    </p>
                )}
            </div>

            {/* Message Field */}
            <div>
                <label
                    htmlFor="contact-message"
                    className="mb-1 block font-medium text-gray-700 text-sm"
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
                    className={`resize-vertical w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                        errors.message
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-primary focus:ring-primary'
                    }`}
                />
                {errors.message && (
                    <p
                        id="message-error"
                        className="mt-1 text-red-600 text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.message}
                    </p>
                )}
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-gray-300"
            >
                {isSubmitting ? t('form.submitting') : t('form.submit')}
            </button>
        </form>
    );
}
