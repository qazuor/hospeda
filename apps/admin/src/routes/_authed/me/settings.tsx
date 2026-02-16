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
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useUpdateUserSettings, useUserProfile } from '@/hooks/use-user-profile';
import { useSession } from '@/lib/auth-client';
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
    const { data: session } = useSession();
    const userId = session?.user?.id;
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
                    toastSuccess('Settings saved');
                },
                onError: () => {
                    toastError('Failed to save settings');
                }
            });
        },
        [mutation, toastSuccess, toastError, settings?.darkMode, currentLanguage, notifications]
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
                                Failed to load settings. Please try again.
                            </p>
                            <button
                                type="button"
                                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
                                onClick={() => refetch()}
                            >
                                Retry
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
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                                <PaletteIcon className="h-5 w-5 text-purple-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Appearance</CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    Customize the look and feel of the admin panel
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                                    Theme Preference
                                </span>
                                <div className="flex flex-wrap gap-3">
                                    <ThemeButton
                                        icon={<MonitorIcon className="h-5 w-5" />}
                                        label="System"
                                        active={currentTheme === 'system'}
                                        disabled={isSaving}
                                        onClick={() => handleThemeChange('system')}
                                    />
                                    <ThemeButton
                                        icon={<SunIcon className="h-5 w-5" />}
                                        label="Light"
                                        active={currentTheme === 'light'}
                                        disabled={isSaving}
                                        onClick={() => handleThemeChange('light')}
                                    />
                                    <ThemeButton
                                        icon={<MoonIcon className="h-5 w-5" />}
                                        label="Dark"
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
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                <GlobeIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Language & Region</CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    Set your preferred language and locale
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                                    Interface Language
                                </span>
                                <div className="flex flex-wrap gap-3">
                                    <LanguageButton
                                        label="Español"
                                        code="es"
                                        active={currentLanguage === 'es'}
                                        disabled={isSaving}
                                        onClick={() => handleLanguageChange('es')}
                                    />
                                    <LanguageButton
                                        label="English"
                                        code="en"
                                        active={currentLanguage === 'en'}
                                        disabled={isSaving}
                                        onClick={() => handleLanguageChange('en')}
                                    />
                                    <LanguageButton
                                        label="Português"
                                        code="pt"
                                        active={currentLanguage === 'pt'}
                                        disabled={isSaving}
                                        onClick={() => handleLanguageChange('pt')}
                                    />
                                </div>
                            </div>

                            <div>
                                <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                                    Timezone
                                </span>
                                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                                    <span className="font-medium">{browserTimezone || '...'}</span>
                                    <Badge
                                        variant="secondary"
                                        className="ml-auto"
                                    >
                                        Auto
                                    </Badge>
                                </div>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Detected from browser settings
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notification settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                                <BellIcon className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Notifications</CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    Manage how you receive notifications
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <NotificationToggle
                                label="Enable Notifications"
                                description="Master toggle for all notifications"
                                checked={notifications.enabled}
                                disabled={isSaving}
                                onChange={(v) => handleNotificationChange('enabled', v)}
                            />
                            <NotificationToggle
                                label="Email Notifications"
                                description="Receive updates via email"
                                checked={notifications.allowEmails}
                                disabled={isSaving || !notifications.enabled}
                                onChange={(v) => handleNotificationChange('allowEmails', v)}
                            />
                            <NotificationToggle
                                label="SMS Notifications"
                                description="Receive updates via SMS"
                                checked={notifications.allowSms}
                                disabled={isSaving || !notifications.enabled}
                                onChange={(v) => handleNotificationChange('allowSms', v)}
                            />
                            <NotificationToggle
                                label="Push Notifications"
                                description="Receive browser push notifications"
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
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                                <ShieldIcon className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Account & Security</CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    Manage your account security settings
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
                                            Authentication Provider
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Your account security is managed through Better Auth.
                                            Password changes and connected accounts can be managed
                                            from your account settings.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                                <p className="text-amber-900 text-sm dark:text-amber-100">
                                    <strong>Security Tip:</strong> Enable two-factor authentication
                                    (2FA) for enhanced security. This adds an extra layer of
                                    protection to your admin account.
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
