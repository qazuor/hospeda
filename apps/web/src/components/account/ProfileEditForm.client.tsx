import * as Sentry from '@sentry/astro';
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { userApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { validateField } from '../../lib/validation/validate-field';
import { addToast } from '../../store/toast-store';
import { FormError } from '../ui/FormError';

/**
 * Props for the ProfileEditForm component
 */
export interface ProfileEditFormProps {
    /** User ID to update */
    readonly userId: string;
    /** Initial name value */
    readonly initialName: string;
    /** Initial bio value */
    readonly initialBio: string;
    /** User email (read-only display) */
    readonly email: string;
    /** Locale for localized labels and messages */
    readonly locale: string;
}

/**
 * Validation errors for form fields
 */
interface ValidationErrors {
    name?: string;
    bio?: string;
}

/**
 * ProfileEditForm component
 *
 * A client-side form for editing user profile information (name and bio).
 * Email is displayed as read-only. Uses the protected API endpoint to update
 * profile data.
 *
 * Features:
 * - Client-side validation (name required, min 2 chars; bio max 500 chars)
 * - Loading state during submission
 * - Toast notifications for success/error
 * - Optimistic UI updates
 * - Accessible form with proper labels and ARIA attributes
 * - Localized for Spanish, English, and Portuguese
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <ProfileEditForm
 *   userId="user-123"
 *   initialName="Jane Doe"
 *   initialBio="Travel enthusiast"
 *   email="jane@example.com"
 *   locale="es"
 * />
 * ```
 */
export function ProfileEditForm({
    userId,
    initialName,
    initialBio,
    email,
    locale
}: ProfileEditFormProps): JSX.Element {
    const [name, setName] = useState(initialName);
    const [bio, setBio] = useState(initialBio);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'account' });

    // Base translation function (no namespace) for resolving validateField keys.
    const { t: tBase } = useMemo(() => createTranslations(locale as SupportedLocale), [locale]);

    /**
     * Translates a `validationError.field.*` key from validateField into a
     * human-readable string via the standard `validation.*` namespace.
     */
    const resolveValidationKey = (key: string): string =>
        tBase(key.replace('validationError.', 'validation.'));

    /**
     * Validate form fields using validateField helper.
     *
     * @returns Validation errors object or undefined if valid
     */
    const validateForm = (): ValidationErrors | undefined => {
        const newErrors: ValidationErrors = {};

        const nameKey = validateField(name, { required: true, minLength: 2 });
        if (nameKey) newErrors.name = resolveValidationKey(nameKey);

        const bioKey = validateField(bio, { maxLength: 500 });
        if (bioKey) newErrors.bio = resolveValidationKey(bioKey);

        return Object.keys(newErrors).length > 0 ? newErrors : undefined;
    };

    /**
     * Handle name input change
     *
     * @param event - Input change event
     */
    const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setName(event.target.value);
        if (errors.name) {
            setErrors((prev) => ({ ...prev, name: undefined }));
        }
    };

    /**
     * Handle bio textarea change
     *
     * @param event - Textarea change event
     */
    const handleBioChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
        setBio(event.target.value);
        if (errors.bio) {
            setErrors((prev) => ({ ...prev, bio: undefined }));
        }
    };

    /**
     * Handle form submission.
     * Validates fields, calls API to update profile, shows success/error toast.
     *
     * @param event - Form submit event
     */
    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        const validationErrors = validateForm();
        if (validationErrors) {
            setErrors(validationErrors);
            return;
        }

        setErrors({});
        setIsSubmitting(true);

        try {
            const result = await userApi.patchProfile({
                id: userId,
                data: {
                    name: name.trim(),
                    bio: bio.trim()
                }
            });

            if (result.ok) {
                addToast({
                    type: 'success',
                    message: t('profileEdit.successMessage'),
                    duration: 5000
                });
            } else {
                throw new Error('API returned unsuccessful result');
            }
        } catch (error) {
            webLogger.error('ProfileEditForm: save profile failed', error);
            Sentry.captureException(error);
            addToast({
                type: 'error',
                message: t('profileEdit.errorMessage'),
                duration: 5000
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Character count for bio field */
    const bioCharCount = bio.length;
    const bioCharCountColor = bioCharCount > 500 ? 'text-destructive' : 'text-muted-foreground';

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-8"
            noValidate
        >
            {/* Personal Information Section */}
            <section
                id="personal-info"
                className="space-y-6"
            >
                {/* Name Field */}
                <div>
                    <label
                        htmlFor="input-name"
                        className="mb-2 block font-medium text-foreground text-sm"
                    >
                        {t('profileEdit.name')}
                    </label>
                    <input
                        id="input-name"
                        name="name"
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        aria-required="true"
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                        className="w-full rounded-md border border-border bg-card px-4 py-2 text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <FormError
                        fieldName="name"
                        error={errors.name}
                    />
                </div>

                {/* Email Field (Read-only) */}
                <div>
                    <label
                        htmlFor="input-email"
                        className="mb-2 block font-medium text-foreground text-sm"
                    >
                        {t('profileEdit.email')}
                    </label>
                    <input
                        id="input-email"
                        name="email"
                        type="email"
                        value={email}
                        disabled
                        readOnly
                        aria-readonly="true"
                        aria-describedby="email-help"
                        className="w-full rounded-md border border-border bg-card px-4 py-2 text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p
                        id="email-help"
                        className="mt-2 text-muted-foreground text-sm"
                    >
                        {t('profileEdit.emailHelper')}
                    </p>
                </div>

                {/* Bio Field */}
                <div>
                    <label
                        htmlFor="input-bio"
                        className="mb-2 block font-medium text-foreground text-sm"
                    >
                        {t('profileEdit.bio')}
                    </label>
                    <textarea
                        id="input-bio"
                        name="bio"
                        value={bio}
                        onChange={handleBioChange}
                        rows={6}
                        aria-invalid={!!errors.bio}
                        aria-describedby={errors.bio ? 'bio-error bio-help' : 'bio-help'}
                        className="w-full rounded-md border border-border bg-card px-4 py-2 text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="mt-2 flex items-center justify-between">
                        <p
                            id="bio-help"
                            className="text-muted-foreground text-sm"
                        >
                            {t('profileEdit.bioHelper')}
                        </p>
                        <p
                            className={`text-sm ${bioCharCountColor}`}
                            aria-live="polite"
                        >
                            {bioCharCount}/500
                        </p>
                    </div>
                    <FormError
                        fieldName="bio"
                        error={errors.bio}
                    />
                </div>
            </section>

            {/* Form Actions */}
            <div className="flex flex-col gap-3 border-border border-t pt-6 sm:flex-row sm:justify-end">
                <a
                    href={`/${locale}/mi-cuenta/`}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 font-semibold text-base text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:w-auto"
                >
                    {t('profileEdit.cancel')}
                </a>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-semibold text-base text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                    {isSubmitting ? (
                        <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            {t('profileEdit.save')}
                        </>
                    ) : (
                        t('profileEdit.save')
                    )}
                </button>
            </div>
        </form>
    );
}
