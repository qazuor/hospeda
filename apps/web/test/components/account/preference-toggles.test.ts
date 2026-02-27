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

        it('should define optional locale prop as string', () => {
            expect(content).toContain('readonly locale?: string');
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
            expect(content).toContain(
                "import { userApi } from '../../lib/api/endpoints-protected'"
            );
        });

        it('should import addToast from toast store', () => {
            expect(content).toContain("import { addToast } from '../../store/toast-store'");
        });

        it('should import useTranslation hook', () => {
            expect(content).toContain(
                "import { useTranslation } from '../../hooks/useTranslation'"
            );
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

    describe('Localization - useTranslation hook', () => {
        it('should use useTranslation with account namespace', () => {
            expect(content).toContain("namespace: 'account'");
        });

        it('should destructure t from useTranslation', () => {
            expect(content).toContain('const { t } = useTranslation(');
        });

        it('should use t function for notifications title', () => {
            expect(content).toContain("t('preferences.notificationsTitle')");
        });

        it('should use t function for email label', () => {
            expect(content).toContain("t('preferences.emailLabel')");
        });

        it('should use t function for SMS label', () => {
            expect(content).toContain("t('preferences.smsLabel')");
        });

        it('should use t function for push label', () => {
            expect(content).toContain("t('preferences.pushLabel')");
        });

        it('should use t function for language title', () => {
            expect(content).toContain("t('preferences.languageTitle')");
        });

        it('should use t function for save button', () => {
            expect(content).toContain("t('preferences.saveButton')");
        });

        it('should use t function for saving indicator', () => {
            expect(content).toContain("t('preferences.saving')");
        });

        it('should use t function for notifications saved message', () => {
            expect(content).toContain("t('preferences.notificationsSaved')");
        });

        it('should use t function for language saved message', () => {
            expect(content).toContain("t('preferences.languageSaved')");
        });

        it('should use t function for error message', () => {
            expect(content).toContain("t('preferences.errorMessage')");
        });

        it('should use t function for language Es option', () => {
            expect(content).toContain("t('preferences.languageEs')");
        });

        it('should use t function for language En option', () => {
            expect(content).toContain("t('preferences.languageEn')");
        });

        it('should use t function for language Pt option', () => {
            expect(content).toContain("t('preferences.languagePt')");
        });
    });

    describe('Language options', () => {
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
            expect(content).toContain("t('preferences.notificationsSaved')");
        });

        it('should show success toast when language saved', () => {
            expect(content).toContain("t('preferences.languageSaved')");
        });

        it('should show error toast on failure', () => {
            expect(content).toContain("t('preferences.errorMessage')");
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
            expect(content).toContain('{isSavingNotifications');
            expect(content).toContain("t('preferences.saving')");
            expect(content).toContain("t('preferences.saveButton')");
        });

        it('should show saving text when saving language', () => {
            expect(content).toContain(
                "isSavingLanguage ? t('preferences.saving') : t('preferences.saveButton')"
            );
        });
    });

    describe('UI structure', () => {
        it('should have a notifications section', () => {
            expect(content).toContain("t('preferences.notificationsTitle')");
        });

        it('should have a language section', () => {
            expect(content).toContain("t('preferences.languageTitle')");
        });

        it('should have handleNotificationToggle function', () => {
            expect(content).toContain('const handleNotificationToggle = ');
        });

        it('should toggle notification field by field name', () => {
            expect(content).toContain('[field]: !prev[field]');
        });
    });
});
