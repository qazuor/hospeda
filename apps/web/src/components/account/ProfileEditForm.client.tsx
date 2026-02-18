import { type ChangeEvent, type FormEvent, useState } from 'react';
import type { JSX } from 'react';
import { userApi } from '../../lib/api/endpoints';
import { addToast } from '../../store/toast-store';

/**
 * Localized text translations for the form
 */
interface LocalizedTexts {
    readonly name: string;
    readonly email: string;
    readonly bio: string;
    readonly save: string;
    readonly cancel: string;
    readonly emailHelper: string;
    readonly bioHelper: string;
    readonly successMessage: string;
    readonly errorMessage: string;
    readonly validationNameRequired: string;
    readonly validationNameMinLength: string;
    readonly validationBioMaxLength: string;
}

/**
 * All localized texts for supported locales
 */
const localizedTexts: Record<'es' | 'en' | 'pt', LocalizedTexts> = {
    es: {
        name: 'Nombre completo',
        email: 'Correo electrónico',
        bio: 'Biografía',
        save: 'Guardar cambios',
        cancel: 'Cancelar',
        emailHelper:
            'El correo electrónico no puede ser modificado. Contacta soporte si necesitas cambiarlo.',
        bioHelper: 'Máximo 500 caracteres. Esta información será visible en tus reseñas públicas.',
        successMessage: 'Perfil actualizado correctamente.',
        errorMessage: 'Error al actualizar el perfil. Por favor, intenta de nuevo.',
        validationNameRequired: 'El nombre es obligatorio.',
        validationNameMinLength: 'El nombre debe tener al menos 2 caracteres.',
        validationBioMaxLength: 'La biografía no puede superar los 500 caracteres.'
    },
    en: {
        name: 'Full name',
        email: 'Email address',
        bio: 'Biography',
        save: 'Save changes',
        cancel: 'Cancel',
        emailHelper: 'Email cannot be changed. Contact support if you need to change it.',
        bioHelper:
            'Maximum 500 characters. This information will be visible on your public reviews.',
        successMessage: 'Profile updated successfully.',
        errorMessage: 'Failed to update profile. Please try again.',
        validationNameRequired: 'Name is required.',
        validationNameMinLength: 'Name must be at least 2 characters long.',
        validationBioMaxLength: 'Biography cannot exceed 500 characters.'
    },
    pt: {
        name: 'Nome completo',
        email: 'Endereço de e-mail',
        bio: 'Biografia',
        save: 'Salvar alterações',
        cancel: 'Cancelar',
        emailHelper:
            'O e-mail não pode ser alterado. Entre em contato com o suporte se precisar alterá-lo.',
        bioHelper:
            'Máximo 500 caracteres. Esta informação será visível em suas avaliações públicas.',
        successMessage: 'Perfil atualizado com sucesso.',
        errorMessage: 'Erro ao atualizar o perfil. Por favor, tente novamente.',
        validationNameRequired: 'O nome é obrigatório.',
        validationNameMinLength: 'O nome deve ter pelo menos 2 caracteres.',
        validationBioMaxLength: 'A biografia não pode exceder 500 caracteres.'
    }
};

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
    readonly locale: 'es' | 'en' | 'pt';
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
 * Email is displayed as read-only. Uses the protected API endpoint to update profile data.
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

    const texts = localizedTexts[locale];

    /**
     * Validate form fields
     *
     * @returns Validation errors object or undefined if valid
     */
    const validateForm = (): ValidationErrors | undefined => {
        const newErrors: ValidationErrors = {};

        const trimmedName = name.trim();
        if (!trimmedName) {
            newErrors.name = texts.validationNameRequired;
        } else if (trimmedName.length < 2) {
            newErrors.name = texts.validationNameMinLength;
        }

        if (bio.length > 500) {
            newErrors.bio = texts.validationBioMaxLength;
        }

        return Object.keys(newErrors).length > 0 ? newErrors : undefined;
    };

    /**
     * Handle name input change
     *
     * @param event - Input change event
     */
    const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setName(event.target.value);
        // Clear name error on change
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
        // Clear bio error on change
        if (errors.bio) {
            setErrors((prev) => ({ ...prev, bio: undefined }));
        }
    };

    /**
     * Handle form submission
     * - Validates fields
     * - Calls API to update profile
     * - Shows success/error toast
     *
     * @param event - Form submit event
     */
    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        // Client-side validation
        const validationErrors = validateForm();
        if (validationErrors) {
            setErrors(validationErrors);
            return;
        }

        // Clear any existing errors
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
                    message: texts.successMessage,
                    duration: 5000
                });
            } else {
                throw new Error('API returned unsuccessful result');
            }
        } catch (_error) {
            // On error, show error toast
            addToast({
                type: 'error',
                message: texts.errorMessage,
                duration: 5000
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Character count indicator for bio field
     */
    const bioCharCount = bio.length;
    const bioCharCountColor = bioCharCount > 500 ? 'text-red-600' : 'text-text-tertiary';

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
                        className="mb-2 block font-medium text-sm text-text-primary"
                    >
                        {texts.name}
                    </label>
                    <input
                        id="input-name"
                        name="name"
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                        required
                        aria-required="true"
                        aria-invalid={!!errors.name}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                        className="w-full rounded-md border border-border bg-surface px-4 py-2 text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {errors.name && (
                        <p
                            id="name-error"
                            className="mt-1 text-red-600 text-sm"
                            role="alert"
                        >
                            {errors.name}
                        </p>
                    )}
                </div>

                {/* Email Field (Read-only) */}
                <div>
                    <label
                        htmlFor="input-email"
                        className="mb-2 block font-medium text-sm text-text-primary"
                    >
                        {texts.email}
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
                        className="w-full rounded-md border border-border bg-surface px-4 py-2 text-text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p
                        id="email-help"
                        className="mt-2 text-sm text-text-tertiary"
                    >
                        {texts.emailHelper}
                    </p>
                </div>

                {/* Bio Field */}
                <div>
                    <label
                        htmlFor="input-bio"
                        className="mb-2 block font-medium text-sm text-text-primary"
                    >
                        {texts.bio}
                    </label>
                    <textarea
                        id="input-bio"
                        name="bio"
                        value={bio}
                        onChange={handleBioChange}
                        rows={6}
                        aria-invalid={!!errors.bio}
                        aria-describedby={errors.bio ? 'bio-error bio-help' : 'bio-help'}
                        className="w-full rounded-md border border-border bg-surface px-4 py-2 text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="mt-2 flex items-center justify-between">
                        <p
                            id="bio-help"
                            className="text-sm text-text-tertiary"
                        >
                            {texts.bioHelper}
                        </p>
                        <p
                            className={`text-sm ${bioCharCountColor}`}
                            aria-live="polite"
                        >
                            {bioCharCount}/500
                        </p>
                    </div>
                    {errors.bio && (
                        <p
                            id="bio-error"
                            className="mt-1 text-red-600 text-sm"
                            role="alert"
                        >
                            {errors.bio}
                        </p>
                    )}
                </div>
            </section>

            {/* Form Actions */}
            <div className="flex flex-col gap-3 border-border border-t pt-6 sm:flex-row sm:justify-end">
                <a
                    href={`/${locale}/mi-cuenta/`}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 font-semibold text-base text-text transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:w-auto"
                >
                    {texts.cancel}
                </a>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-semibold text-base text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto"
                >
                    {isSubmitting ? (
                        <>
                            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            {texts.save}
                        </>
                    ) : (
                        texts.save
                    )}
                </button>
            </div>
        </form>
    );
}
