import * as Sentry from '@sentry/astro';
import type { JSX } from 'react';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { userApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';
import { addToast } from '../../store/toast-store';

/**
 * User notification settings
 */
interface NotificationSettings {
    readonly enabled: boolean;
    readonly allowEmails: boolean;
    readonly allowSms: boolean;
    readonly allowPush: boolean;
}

/**
 * User settings structure
 */
interface UserSettings {
    readonly darkMode?: boolean;
    readonly language?: string;
    readonly notifications: NotificationSettings;
}

/**
 * Props for the PreferenceToggles component
 */
export interface PreferenceTogglesProps {
    /**
     * Current user ID
     */
    readonly userId: string;

    /**
     * Initial user settings
     */
    readonly initialSettings: UserSettings;

    /**
     * Current locale for localized text
     * @default 'es'
     */
    readonly locale?: string;
}

/**
 * PreferenceToggles component
 *
 * Manages user preferences for notifications and language settings.
 * Provides separate save buttons for each section with optimistic updates.
 * Handles API calls via `userApi.patchProfile` and shows toast notifications
 * on success or error. On language change, redirects to the new locale URL.
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * ```tsx
 * <PreferenceToggles
 *   userId="user-123"
 *   initialSettings={{
 *     language: 'es',
 *     notifications: {
 *       enabled: true,
 *       allowEmails: true,
 *       allowSms: false,
 *       allowPush: true
 *     }
 *   }}
 *   locale="es"
 * />
 * ```
 */
export function PreferenceToggles({
    userId,
    initialSettings,
    locale = 'es'
}: PreferenceTogglesProps): JSX.Element {
    const [notifications, setNotifications] = useState<NotificationSettings>(
        initialSettings.notifications
    );
    const [language, setLanguage] = useState<string>(initialSettings.language ?? locale);
    const [isSavingNotifications, setIsSavingNotifications] = useState<boolean>(false);
    const [isSavingLanguage, setIsSavingLanguage] = useState<boolean>(false);

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'account' });

    /**
     * Handles notification checkbox toggle for a given field.
     *
     * @param field - Notification field to toggle
     */
    const handleNotificationToggle = (field: keyof NotificationSettings): void => {
        setNotifications((prev) => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    /**
     * Persists notification preferences via PATCH and shows a toast on completion.
     */
    const handleSaveNotifications = async (): Promise<void> => {
        setIsSavingNotifications(true);

        try {
            const result = await userApi.patchProfile({
                id: userId,
                data: {
                    settings: {
                        ...initialSettings,
                        notifications
                    }
                }
            });

            if (!result.ok) {
                throw new Error('Failed to save notifications');
            }

            addToast({
                type: 'success',
                message: t('preferences.notificationsSaved'),
                duration: 3000
            });
        } catch (error) {
            webLogger.error('PreferenceToggles: save notifications failed', error);
            Sentry.captureException(error);
            addToast({
                type: 'error',
                message: t('preferences.errorMessage'),
                duration: 5000
            });
        } finally {
            setIsSavingNotifications(false);
        }
    };

    /**
     * Persists language preference via PATCH and redirects to the new locale URL
     * when the selected language differs from the current locale.
     */
    const handleSaveLanguage = async (): Promise<void> => {
        setIsSavingLanguage(true);

        try {
            const result = await userApi.patchProfile({
                id: userId,
                data: {
                    settings: {
                        ...initialSettings,
                        language
                    }
                }
            });

            if (!result.ok) {
                throw new Error('Failed to save language');
            }

            addToast({
                type: 'success',
                message: t('preferences.languageSaved'),
                duration: 3000
            });

            // Redirect to the new locale URL when language changes.
            if (typeof window !== 'undefined' && language !== locale) {
                const currentPath = window.location.pathname;
                const pathSegments = currentPath.split('/').filter(Boolean);

                if (pathSegments.length > 0) {
                    pathSegments[0] = language;
                    const newPath = `/${pathSegments.join('/')}`;
                    window.location.href = newPath;
                }
            }
        } catch (error) {
            webLogger.error('PreferenceToggles: save language failed', error);
            Sentry.captureException(error);
            addToast({
                type: 'error',
                message: t('preferences.errorMessage'),
                duration: 5000
            });
            setIsSavingLanguage(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Notifications Section */}
            <section className="rounded-lg border border-border bg-bg p-6">
                <div className="mb-4">
                    <h2 className="font-semibold text-lg text-text">
                        {t('preferences.notificationsTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">
                        {t('preferences.notificationsDescription')}
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Email Notifications */}
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            id="notification-email"
                            checked={notifications.allowEmails}
                            onChange={() => handleNotificationToggle('allowEmails')}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            aria-describedby="notification-email-description"
                        />
                        <div className="flex-1">
                            <label
                                htmlFor="notification-email"
                                className="cursor-pointer font-medium text-sm text-text"
                            >
                                {t('preferences.emailLabel')}
                            </label>
                            <p
                                id="notification-email-description"
                                className="mt-0.5 text-text-secondary text-xs"
                            >
                                {t('preferences.emailDescription')}
                            </p>
                        </div>
                    </div>

                    {/* SMS Notifications */}
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            id="notification-sms"
                            checked={notifications.allowSms}
                            onChange={() => handleNotificationToggle('allowSms')}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            aria-describedby="notification-sms-description"
                        />
                        <div className="flex-1">
                            <label
                                htmlFor="notification-sms"
                                className="cursor-pointer font-medium text-sm text-text"
                            >
                                {t('preferences.smsLabel')}
                            </label>
                            <p
                                id="notification-sms-description"
                                className="mt-0.5 text-text-secondary text-xs"
                            >
                                {t('preferences.smsDescription')}
                            </p>
                        </div>
                    </div>

                    {/* Push Notifications */}
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            id="notification-push"
                            checked={notifications.allowPush}
                            onChange={() => handleNotificationToggle('allowPush')}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            aria-describedby="notification-push-description"
                        />
                        <div className="flex-1">
                            <label
                                htmlFor="notification-push"
                                className="cursor-pointer font-medium text-sm text-text"
                            >
                                {t('preferences.pushLabel')}
                            </label>
                            <p
                                id="notification-push-description"
                                className="mt-0.5 text-text-secondary text-xs"
                            >
                                {t('preferences.pushDescription')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Notifications Button */}
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={handleSaveNotifications}
                        disabled={isSavingNotifications}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-text-tertiary"
                    >
                        {isSavingNotifications
                            ? t('preferences.saving')
                            : t('preferences.saveButton')}
                    </button>
                </div>
            </section>

            {/* Language Section */}
            <section className="rounded-lg border border-border bg-bg p-6">
                <div className="mb-4">
                    <h2 className="font-semibold text-lg text-text">
                        {t('preferences.languageTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">
                        {t('preferences.languageDescription')}
                    </p>
                </div>

                <div>
                    <label
                        htmlFor="language-select"
                        className="mb-2 block font-medium text-sm text-text"
                    >
                        {t('preferences.languageLabel')}
                    </label>
                    <select
                        id="language-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="es">{t('preferences.languageEs')}</option>
                        <option value="en">{t('preferences.languageEn')}</option>
                        <option value="pt">{t('preferences.languagePt')}</option>
                    </select>
                </div>

                {/* Save Language Button */}
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={handleSaveLanguage}
                        disabled={isSavingLanguage}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-text-tertiary"
                    >
                        {isSavingLanguage ? t('preferences.saving') : t('preferences.saveButton')}
                    </button>
                </div>
            </section>
        </div>
    );
}
