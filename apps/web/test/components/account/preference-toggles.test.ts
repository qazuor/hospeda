/**
 * Tests for PreferenceToggles.client.tsx
 *
 * Verifies component structure, exports, props interface, localization,
 * accessibility attributes, API integration, and notification/language preference patterns.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/account/PreferenceToggles.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('PreferenceToggles.client.tsx', () => {
    describe('Module exports', () => {
        it('should export PreferenceToggles as named export', () => {
            expect(content).toContain('export function PreferenceToggles(');
        });

        it('should export PreferenceTogglesProps interface', () => {
            expect(content).toContain('export interface PreferenceTogglesProps');
        });

        it('should not use default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Props interface', () => {
        it('should define userId prop as readonly string', () => {
            expect(content).toContain('readonly userId: string');
        });

        it('should define initialSettings prop', () => {
            expect(content).toContain('readonly initialSettings: UserSettings');
        });

        it('should define optional locale prop with supported locales', () => {
            expect(content).toContain("readonly locale?: 'es' | 'en' | 'pt'");
        });

        it('should default locale to es', () => {
            expect(content).toContain("locale = 'es'");
        });
    });

    describe('Imports', () => {
        it('should import JSX type from react', () => {
            expect(content).toContain("import type { JSX } from 'react'");
        });

        it('should import useState from react', () => {
            expect(content).toContain('import { useState }');
        });

        it('should import userApi from endpoints', () => {
            expect(content).toContain("import { userApi } from '../../lib/api/endpoints'");
        });

        it('should import addToast from toast store', () => {
            expect(content).toContain("import { addToast } from '../../store/toast-store'");
        });
    });

    describe('Internal interfaces', () => {
        it('should define NotificationSettings interface', () => {
            expect(content).toContain('interface NotificationSettings');
        });

        it('should define enabled field in NotificationSettings', () => {
            expect(content).toContain('readonly enabled: boolean');
        });

        it('should define allowEmails field in NotificationSettings', () => {
            expect(content).toContain('readonly allowEmails: boolean');
        });

        it('should define allowSms field in NotificationSettings', () => {
            expect(content).toContain('readonly allowSms: boolean');
        });

        it('should define allowPush field in NotificationSettings', () => {
            expect(content).toContain('readonly allowPush: boolean');
        });

        it('should define UserSettings interface', () => {
            expect(content).toContain('interface UserSettings');
        });

        it('should define optional darkMode in UserSettings', () => {
            expect(content).toContain('readonly darkMode?: boolean');
        });

        it('should define optional language in UserSettings', () => {
            expect(content).toContain('readonly language?: string');
        });

        it('should define notifications in UserSettings', () => {
            expect(content).toContain('readonly notifications: NotificationSettings');
        });
    });

    describe('Localization - Spanish (es)', () => {
        it('should have Spanish notifications title', () => {
            expect(content).toContain('Notificaciones');
        });

        it('should have Spanish email label', () => {
            expect(content).toContain('Notificaciones por email');
        });

        it('should have Spanish SMS label', () => {
            expect(content).toContain('Notificaciones por SMS');
        });

        it('should have Spanish push label', () => {
            expect(content).toContain('Notificaciones push');
        });

        it('should have Spanish language title', () => {
            expect(content).toContain("languageTitle: 'Idioma'");
        });

        it('should have Spanish save button text', () => {
            expect(content).toContain("saveButton: 'Guardar cambios'");
        });

        it('should have Spanish saving indicator', () => {
            expect(content).toContain("saving: 'Guardando...'");
        });

        it('should have Spanish notifications saved message', () => {
            expect(content).toContain('Preferencias de notificaciones guardadas');
        });

        it('should have Spanish language saved message', () => {
            expect(content).toContain('Idioma actualizado correctamente');
        });

        it('should have Spanish error message', () => {
            expect(content).toContain('No se pudieron guardar los cambios. Intentá nuevamente.');
        });
    });

    describe('Localization - English (en)', () => {
        it('should have English notifications title', () => {
            expect(content).toContain("notificationsTitle: 'Notifications'");
        });

        it('should have English email label', () => {
            expect(content).toContain("emailLabel: 'Email notifications'");
        });

        it('should have English SMS label', () => {
            expect(content).toContain("smsLabel: 'SMS notifications'");
        });

        it('should have English push label', () => {
            expect(content).toContain("pushLabel: 'Push notifications'");
        });

        it('should have English save button text', () => {
            expect(content).toContain("saveButton: 'Save changes'");
        });

        it('should have English saving indicator', () => {
            expect(content).toContain("saving: 'Saving...'");
        });

        it('should have English notifications saved message', () => {
            expect(content).toContain('Notification preferences saved');
        });

        it('should have English language saved message', () => {
            expect(content).toContain('Language updated successfully');
        });

        it('should have English error message', () => {
            expect(content).toContain('Could not save changes. Please try again.');
        });
    });

    describe('Localization - Portuguese (pt)', () => {
        it('should have Portuguese notifications title', () => {
            expect(content).toContain("notificationsTitle: 'Notificações'");
        });

        it('should have Portuguese email label', () => {
            expect(content).toContain("emailLabel: 'Notificações por e-mail'");
        });

        it('should have Portuguese save button text', () => {
            expect(content).toContain("saveButton: 'Salvar alterações'");
        });

        it('should have Portuguese saving indicator', () => {
            expect(content).toContain("saving: 'Salvando...'");
        });

        it('should have Portuguese notifications saved message', () => {
            expect(content).toContain('Preferências de notificação salvas');
        });

        it('should have Portuguese language saved message', () => {
            expect(content).toContain('Idioma atualizado com sucesso');
        });

        it('should have Portuguese error message', () => {
            expect(content).toContain('Não foi possível salvar as alterações. Tente novamente.');
        });
    });

    describe('Language options', () => {
        it('should include Español option for all locales', () => {
            expect(content).toContain("languageEs: 'Español'");
        });

        it('should include English option for all locales', () => {
            expect(content).toContain("languageEn: 'English'");
        });

        it('should include Português option for all locales', () => {
            expect(content).toContain("languagePt: 'Português'");
        });

        it('should have language select element', () => {
            expect(content).toContain('id="language-select"');
        });

        it('should have es option value', () => {
            expect(content).toContain('value="es"');
        });

        it('should have en option value', () => {
            expect(content).toContain('value="en"');
        });

        it('should have pt option value', () => {
            expect(content).toContain('value="pt"');
        });
    });

    describe('Notification checkboxes', () => {
        it('should have email notification checkbox', () => {
            expect(content).toContain('id="notification-email"');
        });

        it('should have SMS notification checkbox', () => {
            expect(content).toContain('id="notification-sms"');
        });

        it('should have push notification checkbox', () => {
            expect(content).toContain('id="notification-push"');
        });

        it('should bind email checkbox to allowEmails state', () => {
            expect(content).toContain('checked={notifications.allowEmails}');
        });

        it('should bind SMS checkbox to allowSms state', () => {
            expect(content).toContain('checked={notifications.allowSms}');
        });

        it('should bind push checkbox to allowPush state', () => {
            expect(content).toContain('checked={notifications.allowPush}');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-describedby on email checkbox', () => {
            expect(content).toContain('aria-describedby="notification-email-description"');
        });

        it('should have aria-describedby on SMS checkbox', () => {
            expect(content).toContain('aria-describedby="notification-sms-description"');
        });

        it('should have aria-describedby on push checkbox', () => {
            expect(content).toContain('aria-describedby="notification-push-description"');
        });

        it('should have labels with htmlFor for each checkbox', () => {
            expect(content).toContain('htmlFor="notification-email"');
            expect(content).toContain('htmlFor="notification-sms"');
            expect(content).toContain('htmlFor="notification-push"');
        });

        it('should have label with htmlFor for language select', () => {
            expect(content).toContain('htmlFor="language-select"');
        });

        it('should disable notifications save button when saving', () => {
            expect(content).toContain('disabled={isSavingNotifications}');
        });

        it('should disable language save button when saving', () => {
            expect(content).toContain('disabled={isSavingLanguage}');
        });
    });

    describe('State management', () => {
        it('should use useState for notifications', () => {
            expect(content).toContain(
                'const [notifications, setNotifications] = useState<NotificationSettings>'
            );
        });

        it('should use useState for language', () => {
            expect(content).toContain('const [language, setLanguage] = useState<string>');
        });

        it('should use useState for isSavingNotifications', () => {
            expect(content).toContain(
                'const [isSavingNotifications, setIsSavingNotifications] = useState<boolean>'
            );
        });

        it('should use useState for isSavingLanguage', () => {
            expect(content).toContain(
                'const [isSavingLanguage, setIsSavingLanguage] = useState<boolean>'
            );
        });
    });

    describe('API integration', () => {
        it('should call userApi.patchProfile for notifications save', () => {
            expect(content).toContain('userApi.patchProfile(');
        });

        it('should pass settings.notifications to patchProfile', () => {
            expect(content).toContain('notifications');
        });

        it('should pass settings.language to patchProfile', () => {
            expect(content).toContain('language');
        });

        it('should check result.ok after API call', () => {
            expect(content).toContain('if (!result.ok)');
        });

        it('should define handleSaveNotifications function', () => {
            expect(content).toContain('const handleSaveNotifications = async');
        });

        it('should define handleSaveLanguage function', () => {
            expect(content).toContain('const handleSaveLanguage = async');
        });
    });

    describe('Toast notifications', () => {
        it('should show success toast when notifications saved', () => {
            expect(content).toContain('t.notificationsSaved');
        });

        it('should show success toast when language saved', () => {
            expect(content).toContain('t.languageSaved');
        });

        it('should show error toast on failure', () => {
            expect(content).toContain('t.errorMessage');
        });

        it('should use type success for success toasts', () => {
            expect(content).toContain("type: 'success'");
        });

        it('should use type error for error toasts', () => {
            expect(content).toContain("type: 'error'");
        });
    });

    describe('Language redirect behavior', () => {
        it('should redirect to new locale URL after language change', () => {
            expect(content).toContain("typeof window !== 'undefined'");
            expect(content).toContain('window.location.href = newPath');
        });

        it('should only redirect when language differs from current locale', () => {
            expect(content).toContain('language !== locale');
        });

        it('should replace locale in URL path', () => {
            expect(content).toContain('pathSegments[0] = language');
        });
    });

    describe('Loading state', () => {
        it('should show saving text when saving notifications', () => {
            expect(content).toContain('{isSavingNotifications ? t.saving : t.saveButton}');
        });

        it('should show saving text when saving language', () => {
            expect(content).toContain('{isSavingLanguage ? t.saving : t.saveButton}');
        });
    });

    describe('UI structure', () => {
        it('should have a notifications section', () => {
            expect(content).toContain('t.notificationsTitle');
        });

        it('should have a language section', () => {
            expect(content).toContain('t.languageTitle');
        });

        it('should have handleNotificationToggle function', () => {
            expect(content).toContain('const handleNotificationToggle = ');
        });

        it('should toggle notification field by field name', () => {
            expect(content).toContain('[field]: !prev[field]');
        });
    });
});
