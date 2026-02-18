import type { JSX } from 'react';
import { useState } from 'react';
import { userApi } from '../../lib/api/endpoints';
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
    readonly locale?: 'es' | 'en' | 'pt';
}

/**
 * Localized text strings
 */
const texts = {
    es: {
        notificationsTitle: 'Notificaciones',
        notificationsDescription: 'Configurá cómo querés recibir notificaciones',
        emailLabel: 'Notificaciones por email',
        emailDescription: 'Recibí alertas y actualizaciones por correo electrónico',
        smsLabel: 'Notificaciones por SMS',
        smsDescription: 'Recibí alertas por mensaje de texto',
        pushLabel: 'Notificaciones push',
        pushDescription: 'Recibí notificaciones en tu navegador o aplicación',
        languageTitle: 'Idioma',
        languageDescription: 'Seleccioná tu idioma preferido',
        languageLabel: 'Idioma del sitio',
        languageEs: 'Español',
        languageEn: 'English',
        languagePt: 'Português',
        saveButton: 'Guardar cambios',
        saving: 'Guardando...',
        notificationsSaved: 'Preferencias de notificaciones guardadas',
        languageSaved: 'Idioma actualizado correctamente',
        errorMessage: 'No se pudieron guardar los cambios. Intentá nuevamente.'
    },
    en: {
        notificationsTitle: 'Notifications',
        notificationsDescription: 'Configure how you want to receive notifications',
        emailLabel: 'Email notifications',
        emailDescription: 'Receive alerts and updates via email',
        smsLabel: 'SMS notifications',
        smsDescription: 'Receive alerts via text message',
        pushLabel: 'Push notifications',
        pushDescription: 'Receive notifications in your browser or app',
        languageTitle: 'Language',
        languageDescription: 'Select your preferred language',
        languageLabel: 'Site language',
        languageEs: 'Español',
        languageEn: 'English',
        languagePt: 'Português',
        saveButton: 'Save changes',
        saving: 'Saving...',
        notificationsSaved: 'Notification preferences saved',
        languageSaved: 'Language updated successfully',
        errorMessage: 'Could not save changes. Please try again.'
    },
    pt: {
        notificationsTitle: 'Notificações',
        notificationsDescription: 'Configure como você deseja receber notificações',
        emailLabel: 'Notificações por e-mail',
        emailDescription: 'Receba alertas e atualizações por e-mail',
        smsLabel: 'Notificações por SMS',
        smsDescription: 'Receba alertas por mensagem de texto',
        pushLabel: 'Notificações push',
        pushDescription: 'Receba notificações no seu navegador ou aplicativo',
        languageTitle: 'Idioma',
        languageDescription: 'Selecione seu idioma preferido',
        languageLabel: 'Idioma do site',
        languageEs: 'Español',
        languageEn: 'English',
        languagePt: 'Português',
        saveButton: 'Salvar alterações',
        saving: 'Salvando...',
        notificationsSaved: 'Preferências de notificação salvas',
        languageSaved: 'Idioma atualizado com sucesso',
        errorMessage: 'Não foi possível salvar as alterações. Tente novamente.'
    }
};

/**
 * PreferenceToggles component
 *
 * Manages user preferences for notifications and language settings.
 * Provides separate save buttons for each section with optimistic updates.
 * Handles API calls via userApi.patchProfile and shows toast notifications.
 *
 * @param props - Component props
 * @returns React component
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
    const [language, setLanguage] = useState<string>(initialSettings.language || locale);
    const [isSavingNotifications, setIsSavingNotifications] = useState<boolean>(false);
    const [isSavingLanguage, setIsSavingLanguage] = useState<boolean>(false);

    const t = texts[locale];

    /**
     * Handles notification checkbox toggle
     *
     * @param field - Notification field to toggle
     */
    const handleNotificationToggle = (field: keyof NotificationSettings) => {
        setNotifications((prev) => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    /**
     * Saves notification preferences
     */
    const handleSaveNotifications = async () => {
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
                message: t.notificationsSaved,
                duration: 3000
            });
        } catch (_error) {
            addToast({
                type: 'error',
                message: t.errorMessage,
                duration: 5000
            });
        } finally {
            setIsSavingNotifications(false);
        }
    };

    /**
     * Saves language preference and redirects to new locale
     */
    const handleSaveLanguage = async () => {
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
                message: t.languageSaved,
                duration: 3000
            });

            // Redirect to the new locale URL
            if (typeof window !== 'undefined' && language !== locale) {
                const currentPath = window.location.pathname;
                const pathSegments = currentPath.split('/').filter(Boolean);

                // Replace locale segment (first segment)
                if (pathSegments.length > 0) {
                    pathSegments[0] = language;
                    const newPath = `/${pathSegments.join('/')}`;
                    window.location.href = newPath;
                }
            }
        } catch (_error) {
            addToast({
                type: 'error',
                message: t.errorMessage,
                duration: 5000
            });
            setIsSavingLanguage(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Notifications Section */}
            <section className="rounded-lg border bg-bg p-6">
                <div className="mb-4">
                    <h2 className="font-semibold text-lg text-text">{t.notificationsTitle}</h2>
                    <p className="mt-1 text-sm text-text-secondary">{t.notificationsDescription}</p>
                </div>

                <div className="space-y-4">
                    {/* Email Notifications */}
                    <div className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            id="notification-email"
                            checked={notifications.allowEmails}
                            onChange={() => handleNotificationToggle('allowEmails')}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            aria-describedby="notification-email-description"
                        />
                        <div className="flex-1">
                            <label
                                htmlFor="notification-email"
                                className="cursor-pointer font-medium text-sm text-text"
                            >
                                {t.emailLabel}
                            </label>
                            <p
                                id="notification-email-description"
                                className="mt-0.5 text-text-secondary text-xs"
                            >
                                {t.emailDescription}
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
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            aria-describedby="notification-sms-description"
                        />
                        <div className="flex-1">
                            <label
                                htmlFor="notification-sms"
                                className="cursor-pointer font-medium text-sm text-text"
                            >
                                {t.smsLabel}
                            </label>
                            <p
                                id="notification-sms-description"
                                className="mt-0.5 text-text-secondary text-xs"
                            >
                                {t.smsDescription}
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
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            aria-describedby="notification-push-description"
                        />
                        <div className="flex-1">
                            <label
                                htmlFor="notification-push"
                                className="cursor-pointer font-medium text-sm text-text"
                            >
                                {t.pushLabel}
                            </label>
                            <p
                                id="notification-push-description"
                                className="mt-0.5 text-text-secondary text-xs"
                            >
                                {t.pushDescription}
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
                        className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isSavingNotifications ? t.saving : t.saveButton}
                    </button>
                </div>
            </section>

            {/* Language Section */}
            <section className="rounded-lg border bg-bg p-6">
                <div className="mb-4">
                    <h2 className="font-semibold text-lg text-text">{t.languageTitle}</h2>
                    <p className="mt-1 text-sm text-text-secondary">{t.languageDescription}</p>
                </div>

                <div>
                    <label
                        htmlFor="language-select"
                        className="mb-2 block font-medium text-sm text-text"
                    >
                        {t.languageLabel}
                    </label>
                    <select
                        id="language-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="es">{t.languageEs}</option>
                        <option value="en">{t.languageEn}</option>
                        <option value="pt">{t.languagePt}</option>
                    </select>
                </div>

                {/* Save Language Button */}
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={handleSaveLanguage}
                        disabled={isSavingLanguage}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                        {isSavingLanguage ? t.saving : t.saveButton}
                    </button>
                </div>
            </section>
        </div>
    );
}
