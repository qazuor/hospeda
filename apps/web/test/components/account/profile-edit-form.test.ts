/**
 * Tests for ProfileEditForm.client.tsx
 *
 * Verifies component structure, exports, props interface, localization,
 * accessibility attributes, API integration, and form validation patterns.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/account/ProfileEditForm.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('ProfileEditForm.client.tsx', () => {
    describe('Module exports', () => {
        it('should export ProfileEditForm as named export', () => {
            expect(content).toContain('export function ProfileEditForm(');
        });

        it('should export ProfileEditFormProps interface', () => {
            expect(content).toContain('export interface ProfileEditFormProps');
        });

        it('should not use default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Props interface', () => {
        it('should define userId prop as readonly string', () => {
            expect(content).toContain('readonly userId: string');
        });

        it('should define initialName prop as readonly string', () => {
            expect(content).toContain('readonly initialName: string');
        });

        it('should define initialBio prop as readonly string', () => {
            expect(content).toContain('readonly initialBio: string');
        });

        it('should define email prop as readonly string', () => {
            expect(content).toContain('readonly email: string');
        });

        it('should define locale prop with supported locales', () => {
            expect(content).toContain("readonly locale: 'es' | 'en' | 'pt'");
        });
    });

    describe('Imports', () => {
        it('should import from react', () => {
            expect(content).toContain("from 'react'");
        });

        it('should import useState', () => {
            expect(content).toContain('useState');
        });

        it('should import JSX type from react', () => {
            expect(content).toContain("import type { JSX } from 'react'");
        });

        it('should import userApi from endpoints', () => {
            expect(content).toContain("import { userApi } from '../../lib/api/endpoints'");
        });

        it('should import addToast from toast store', () => {
            expect(content).toContain("import { addToast } from '../../store/toast-store'");
        });
    });

    describe('Localization - Spanish (es)', () => {
        it('should have Spanish name label', () => {
            expect(content).toContain('Nombre completo');
        });

        it('should have Spanish email label', () => {
            expect(content).toContain('Correo electrónico');
        });

        it('should have Spanish bio label', () => {
            expect(content).toContain("bio: 'Biografía'");
        });

        it('should have Spanish save button text', () => {
            expect(content).toContain('Guardar cambios');
        });

        it('should have Spanish cancel text', () => {
            expect(content).toContain("cancel: 'Cancelar'");
        });

        it('should have Spanish success message', () => {
            expect(content).toContain('Perfil actualizado correctamente.');
        });

        it('should have Spanish error message', () => {
            expect(content).toContain(
                'Error al actualizar el perfil. Por favor, intenta de nuevo.'
            );
        });

        it('should have Spanish validation messages', () => {
            expect(content).toContain('El nombre es obligatorio.');
            expect(content).toContain('El nombre debe tener al menos 2 caracteres.');
            expect(content).toContain('La biografía no puede superar los 500 caracteres.');
        });
    });

    describe('Localization - English (en)', () => {
        it('should have English name label', () => {
            expect(content).toContain('Full name');
        });

        it('should have English email label', () => {
            expect(content).toContain('Email address');
        });

        it('should have English save button text', () => {
            expect(content).toContain('Save changes');
        });

        it('should have English cancel text', () => {
            expect(content).toContain("cancel: 'Cancel'");
        });

        it('should have English success message', () => {
            expect(content).toContain('Profile updated successfully.');
        });

        it('should have English error message', () => {
            expect(content).toContain('Failed to update profile. Please try again.');
        });

        it('should have English validation messages', () => {
            expect(content).toContain('Name is required.');
            expect(content).toContain('Name must be at least 2 characters long.');
            expect(content).toContain('Biography cannot exceed 500 characters.');
        });
    });

    describe('Localization - Portuguese (pt)', () => {
        it('should have Portuguese name label', () => {
            expect(content).toContain('Nome completo');
        });

        it('should have Portuguese email label', () => {
            expect(content).toContain('Endereço de e-mail');
        });

        it('should have Portuguese save button text', () => {
            expect(content).toContain('Salvar alterações');
        });

        it('should have Portuguese success message', () => {
            expect(content).toContain('Perfil atualizado com sucesso.');
        });

        it('should have Portuguese error message', () => {
            expect(content).toContain('Erro ao atualizar o perfil. Por favor, tente novamente.');
        });

        it('should have Portuguese validation messages', () => {
            expect(content).toContain('O nome é obrigatório.');
            expect(content).toContain('O nome deve ter pelo menos 2 caracteres.');
            expect(content).toContain('A biografia não pode exceder 500 caracteres.');
        });
    });

    describe('Form structure', () => {
        it('should render a form element with noValidate', () => {
            expect(content).toContain('noValidate');
        });

        it('should have onSubmit handler on form', () => {
            expect(content).toContain('onSubmit={handleSubmit}');
        });

        it('should have name input with id input-name', () => {
            expect(content).toContain('id="input-name"');
        });

        it('should have email input with id input-email', () => {
            expect(content).toContain('id="input-email"');
        });

        it('should have bio textarea with id input-bio', () => {
            expect(content).toContain('id="input-bio"');
        });

        it('should have submit button with type submit', () => {
            expect(content).toContain('type="submit"');
        });

        it('should have cancel link pointing to mi-cuenta route', () => {
            expect(content).toContain('href={`/${locale}/mi-cuenta/`}');
        });

        it('should have a personal-info section', () => {
            expect(content).toContain('id="personal-info"');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-required on name input', () => {
            expect(content).toContain('aria-required="true"');
        });

        it('should have aria-invalid on name input', () => {
            expect(content).toContain('aria-invalid={!!errors.name}');
        });

        it('should have aria-invalid on bio textarea', () => {
            expect(content).toContain('aria-invalid={!!errors.bio}');
        });

        it('should have aria-describedby on name input', () => {
            expect(content).toContain('aria-describedby={errors.name ?');
        });

        it('should have aria-describedby on bio textarea', () => {
            expect(content).toContain(
                "aria-describedby={errors.bio ? 'bio-error bio-help' : 'bio-help'}"
            );
        });

        it('should have aria-readonly on email input', () => {
            expect(content).toContain('aria-readonly="true"');
        });

        it('should have aria-describedby on email input', () => {
            expect(content).toContain('aria-describedby="email-help"');
        });

        it('should have aria-busy on submit button', () => {
            expect(content).toContain('aria-busy={isSubmitting}');
        });

        it('should have role alert on name error paragraph', () => {
            expect(content).toContain('role="alert"');
        });

        it('should have aria-live on bio character count', () => {
            expect(content).toContain('aria-live="polite"');
        });

        it('should have labels with htmlFor for each input', () => {
            expect(content).toContain('htmlFor="input-name"');
            expect(content).toContain('htmlFor="input-email"');
            expect(content).toContain('htmlFor="input-bio"');
        });

        it('should have email-help paragraph for email helper text', () => {
            expect(content).toContain('id="email-help"');
        });

        it('should have bio-help paragraph for bio helper text', () => {
            expect(content).toContain('id="bio-help"');
        });

        it('should have name-error paragraph for name validation', () => {
            expect(content).toContain('id="name-error"');
        });

        it('should have bio-error paragraph for bio validation', () => {
            expect(content).toContain('id="bio-error"');
        });
    });

    describe('State management', () => {
        it('should use useState for name', () => {
            expect(content).toContain('const [name, setName] = useState(initialName)');
        });

        it('should use useState for bio', () => {
            expect(content).toContain('const [bio, setBio] = useState(initialBio)');
        });

        it('should use useState for isSubmitting', () => {
            expect(content).toContain('const [isSubmitting, setIsSubmitting] = useState(false)');
        });

        it('should use useState for errors', () => {
            expect(content).toContain('const [errors, setErrors] = useState<ValidationErrors>({})');
        });
    });

    describe('API integration', () => {
        it('should call userApi.patchProfile on submit', () => {
            expect(content).toContain('userApi.patchProfile(');
        });

        it('should pass userId as id to patchProfile', () => {
            expect(content).toContain('id: userId');
        });

        it('should pass name (trimmed) and bio (trimmed) to patchProfile', () => {
            expect(content).toContain('name: name.trim()');
            expect(content).toContain('bio: bio.trim()');
        });

        it('should check result.ok after API call', () => {
            expect(content).toContain('if (result.ok)');
        });
    });

    describe('Toast notifications', () => {
        it('should show success toast on successful save', () => {
            expect(content).toContain("type: 'success'");
            expect(content).toContain('texts.successMessage');
        });

        it('should show error toast on failed save', () => {
            expect(content).toContain("type: 'error'");
            expect(content).toContain('texts.errorMessage');
        });

        it('should pass duration 5000 to toasts', () => {
            expect(content).toContain('duration: 5000');
        });
    });

    describe('Validation', () => {
        it('should define validateForm function', () => {
            expect(content).toContain('const validateForm = ()');
        });

        it('should validate that name is not empty', () => {
            expect(content).toContain('texts.validationNameRequired');
        });

        it('should validate name minimum length of 2', () => {
            expect(content).toContain('trimmedName.length < 2');
            expect(content).toContain('texts.validationNameMinLength');
        });

        it('should validate bio maximum length of 500', () => {
            expect(content).toContain('bio.length > 500');
            expect(content).toContain('texts.validationBioMaxLength');
        });

        it('should clear errors when user changes input', () => {
            expect(content).toContain('setErrors((prev) => ({ ...prev, name: undefined }))');
            expect(content).toContain('setErrors((prev) => ({ ...prev, bio: undefined }))');
        });
    });

    describe('Loading state', () => {
        it('should disable submit button when submitting', () => {
            expect(content).toContain('disabled={isSubmitting}');
        });

        it('should show spinner animation when submitting', () => {
            expect(content).toContain('animate-spin');
        });

        it('should set isSubmitting to true before API call', () => {
            expect(content).toContain('setIsSubmitting(true)');
        });

        it('should reset isSubmitting in finally block', () => {
            expect(content).toContain('setIsSubmitting(false)');
        });
    });

    describe('Character count', () => {
        it('should track bio character count', () => {
            expect(content).toContain('const bioCharCount = bio.length');
        });

        it('should display character count with limit', () => {
            expect(content).toContain('{bioCharCount}/500');
        });

        it('should change color when over limit', () => {
            expect(content).toContain('text-red-600');
            expect(content).toContain('bioCharCount > 500');
        });
    });

    describe('Localized texts record', () => {
        it('should define localizedTexts for all 3 locales', () => {
            expect(content).toContain("Record<'es' | 'en' | 'pt', LocalizedTexts>");
        });

        it('should define LocalizedTexts interface', () => {
            expect(content).toContain('interface LocalizedTexts');
        });
    });
});
