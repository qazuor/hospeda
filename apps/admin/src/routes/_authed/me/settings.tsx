/**
 * My Settings Page Route
 *
 * Displays and manages user settings and preferences.
 * Includes theme, language, notifications, and account settings.
 * All changes auto-save via PATCH to the user API endpoint.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useUpdateUserSettings, useUserProfile } from '@/hooks/use-user-profile';
import {
    BellIcon,
    GlobeIcon,
    InfoIcon,
    MonitorIcon,
    MoonIcon,
    PaletteIcon,
    ShieldIcon,
    SunIcon
} from '@repo/icons';
import type { UserSettings } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/me/settings')({
    component: MySettingsPage
});

/**
 * Resolves the current theme label from the darkMode setting.
 *
 * @param darkMode - The darkMode setting value
 * @returns 'system' | 'light' | 'dark'
 */
function resolveTheme(darkMode: boolean | undefined): 'system' | 'light' | 'dark' {
    if (darkMode === undefined) return 'system';
    return darkMode ? 'dark' : 'light';
}

function MySettingsPage() {
    const { t } = useTranslations();
    const { user: authUser } = useAuthContext();
    const userId = authUser?.id;
    const { data: profile, isLoading, isError, refetch } = useUserProfile({ userId });
    const mutation = useUpdateUserSettings({ userId });
    const { success: toastSuccess, error: toastError } = useFlashyToast();

    const settings = profile?.settings as UserSettings | undefined;
    const currentTheme = resolveTheme(settings?.darkMode);
    const currentLanguage = settings?.language ?? 'es';
    const notifications = settings?.notifications ?? {
        enabled: true,
        allowEmails: true,
        allowSms: false,
        allowPush: false
    };

    const saveSettings = useCallback(
        (partial: Partial<UserSettings>) => {
            // Merge with current settings to send a complete object
            // (the API schema requires notifications to be present)
            const merged: UserSettings = {
                darkMode: settings?.darkMode,
                language: currentLanguage,
                notifications,
                ...partial
            };
            mutation.mutate(merged, {
                onSuccess: () => {
                    toastSuccess(t('admin-pages.settings.settingsSaved'));
                },
                onError: () => {
                    toastError(t('admin-pages.settings.settingsSaveError'));
                }
            });
        },
        [mutation, toastSuccess, toastError, settings?.darkMode, currentLanguage, notifications, t]
    );

    const handleThemeChange = useCallback(
        (theme: 'system' | 'light' | 'dark') => {
            const darkMode = theme === 'system' ? undefined : theme === 'dark';
            saveSettings({ darkMode });
        },
        [saveSettings]
    );

    const handleLanguageChange = useCallback(
        (language: string) => {
            saveSettings({ language });
        },
        [saveSettings]
    );

    const handleNotificationChange = useCallback(
        (field: keyof UserSettings['notifications'], value: boolean) => {
            const updated = { ...notifications, [field]: value };
            if (field === 'enabled' && !value) {
                updated.allowEmails = false;
                updated.allowSms = false;
                updated.allowPush = false;
            }
            saveSettings({ notifications: updated });
        },
        [notifications, saveSettings]
    );

    const isSaving = mutation.isPending;

    const [browserTimezone, setBrowserTimezone] = useState<string>('');
    useEffect(() => {
        setBrowserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }, []);

    if (isLoading) {
        return (
            <MainPageLayout title={t('ui.pages.mySettings')}>
                <div className="mx-auto max-w-4xl space-y-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={`skeleton-${String(i)}`}
                            className="h-48 animate-pulse rounded-lg bg-muted"
                        />
                    ))}
                </div>
            </MainPageLayout>
        );
    }

    if (isError) {
        return (
            <MainPageLayout title={t('ui.pages.mySettings')}>
                <div className="mx-auto max-w-4xl">
                    <Card>
                        <CardContent className="flex flex-col items-center gap-4 py-12">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.settings.loadError')}
                            </p>
                            <button
                                type="button"
                                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
                                onClick={() => refetch()}
                            >
                                {t('admin-pages.settings.retry')}
                            </button>
                        </CardContent>
                    </Card>
                </div>
            </MainPageLayout>
        );
    }

    return (
        <MainPageLayout title={t('ui.pages.mySettings')}>
            <div className="mx-auto max-w-4xl space-y-6">
                {/* Appearance settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 dark:bg-purple-400/10">
                                <PaletteIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.settings.appearance.title')}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.settings.appearance.subtitle')}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                                    {t('admin-pages.settings.appearance.themePreference')}
                                </span>
                                <div className="flex flex-wrap gap-3">
                                    <ThemeButton
                                        icon={<MonitorIcon className="h-5 w-5" />}
                                        label={t('admin-pages.settings.appearance.system')}
                                        active={currentTheme === 'system'}
                                        disabled={isSaving}
                                        onClick={() => handleThemeChange('system')}
                                    />
                                    <ThemeButton
                                        icon={<SunIcon className="h-5 w-5" />}
                                        label={t('admin-pages.settings.appearance.light')}
                                        active={currentTheme === 'light'}
                                        disabled={isSaving}
                                        onClick={() => handleThemeChange('light')}
                                    />
                                    <ThemeButton
                                        icon={<MoonIcon className="h-5 w-5" />}
                                        label={t('admin-pages.settings.appearance.dark')}
                                        active={currentTheme === 'dark'}
                                        disabled={isSaving}
                                        onClick={() => handleThemeChange('dark')}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Language settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                                <GlobeIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.settings.language.title')}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.settings.language.subtitle')}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                                    {t('admin-pages.settings.language.interfaceLanguage')}
                                </span>
                                <div className="flex flex-wrap gap-3">
                                    <LanguageButton
                                        label={t('admin-pages.settings.language.es')}
                                        code="es"
                                        active={currentLanguage === 'es'}
                                        disabled={isSaving}
                                        onClick={() => handleLanguageChange('es')}
                                    />
                                    <LanguageButton
                                        label={t('admin-pages.settings.language.en')}
                                        code="en"
                                        active={currentLanguage === 'en'}
                                        disabled={isSaving}
                                        onClick={() => handleLanguageChange('en')}
                                    />
                                    <LanguageButton
                                        label={t('admin-pages.settings.language.pt')}
                                        code="pt"
                                        active={currentLanguage === 'pt'}
                                        disabled={isSaving}
                                        onClick={() => handleLanguageChange('pt')}
                                    />
                                </div>
                            </div>

                            <div>
                                <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                                    {t('admin-pages.settings.language.timezone')}
                                </span>
                                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                                    <span className="font-medium">{browserTimezone || '...'}</span>
                                    <Badge
                                        variant="secondary"
                                        className="ml-auto"
                                    >
                                        {t('admin-pages.settings.language.timezoneAuto')}
                                    </Badge>
                                </div>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-pages.settings.language.timezoneDetected')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notification settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-400/10">
                                <BellIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.settings.notifications.title')}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.settings.notifications.subtitle')}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <NotificationToggle
                                label={t('admin-pages.settings.notifications.enableNotifications')}
                                description={t(
                                    'admin-pages.settings.notifications.enableNotificationsDesc'
                                )}
                                checked={notifications.enabled}
                                disabled={isSaving}
                                onChange={(v) => handleNotificationChange('enabled', v)}
                            />
                            <NotificationToggle
                                label={t('admin-pages.settings.notifications.emailNotifications')}
                                description={t(
                                    'admin-pages.settings.notifications.emailNotificationsDesc'
                                )}
                                checked={notifications.allowEmails}
                                disabled={isSaving || !notifications.enabled}
                                onChange={(v) => handleNotificationChange('allowEmails', v)}
                            />
                            <NotificationToggle
                                label={t('admin-pages.settings.notifications.smsNotifications')}
                                description={t(
                                    'admin-pages.settings.notifications.smsNotificationsDesc'
                                )}
                                checked={notifications.allowSms}
                                disabled={isSaving || !notifications.enabled}
                                onChange={(v) => handleNotificationChange('allowSms', v)}
                            />
                            <NotificationToggle
                                label={t('admin-pages.settings.notifications.pushNotifications')}
                                description={t(
                                    'admin-pages.settings.notifications.pushNotificationsDesc'
                                )}
                                checked={notifications.allowPush}
                                disabled={isSaving || !notifications.enabled}
                                onChange={(v) => handleNotificationChange('allowPush', v)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Account & security settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 dark:bg-red-400/10">
                                <ShieldIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.settings.security.title')}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.settings.security.subtitle')}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div className="rounded-lg border bg-card p-4">
                                <div className="mb-3 flex items-start gap-3">
                                    <InfoIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                                    <div className="flex-1">
                                        <p className="mb-1 font-medium text-sm">
                                            {t('admin-pages.settings.security.authProviderTitle')}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {t('admin-pages.settings.security.authProviderDesc')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                                <p className="text-amber-900 text-sm dark:text-amber-100">
                                    <strong>
                                        {t('admin-pages.settings.security.securityTip')}:
                                    </strong>{' '}
                                    {t('admin-pages.settings.security.securityTipDesc')}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainPageLayout>
    );
}

/**
 * Clickable theme option button.
 */
function ThemeButton({
    icon,
    label,
    active,
    disabled,
    onClick
}: {
    readonly icon: React.ReactNode;
    readonly label: string;
    readonly active: boolean;
    readonly disabled: boolean;
    readonly onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex items-center gap-2 rounded-lg border p-3 transition-colors ${
                active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'bg-card text-muted-foreground opacity-60 hover:opacity-100'
            } disabled:cursor-not-allowed disabled:opacity-40`}
        >
            {icon}
            <span className={active ? 'font-medium text-sm' : 'text-sm'}>{label}</span>
        </button>
    );
}

/**
 * Clickable language option button.
 */
function LanguageButton({
    label,
    code,
    active,
    disabled,
    onClick
}: {
    readonly label: string;
    readonly code: string;
    readonly active: boolean;
    readonly disabled: boolean;
    readonly onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex items-center gap-2 rounded-lg border p-3 transition-colors ${
                active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'bg-card text-muted-foreground opacity-60 hover:opacity-100'
            } disabled:cursor-not-allowed disabled:opacity-40`}
        >
            <GlobeIcon className="h-5 w-5" />
            <span className={active ? 'font-medium text-sm' : 'text-sm'}>{label}</span>
            {active && (
                <Badge
                    variant="secondary"
                    className="ml-1"
                >
                    {code.toUpperCase()}
                </Badge>
            )}
        </button>
    );
}

/**
 * Notification toggle row with label, description, and Switch control.
 */
function NotificationToggle({
    label,
    description,
    checked,
    disabled,
    onChange
}: {
    readonly label: string;
    readonly description: string;
    readonly checked: boolean;
    readonly disabled: boolean;
    readonly onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div className="flex-1">
                <p className="mb-1 font-medium text-sm">{label}</p>
                <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            <Switch
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
            />
        </div>
    );
}
