/**
 * My Notifications Page Route
 *
 * Shared notification preferences extracted from the legacy /me/settings
 * route. The master toggle and the email channel are fully wired through
 * `useUpdateUserSettings`. The SMS and push channels are visually disabled
 * with an "(no disponible)" disclosure since the dispatch backends are not
 * implemented yet — see `99-future-enhancements.md` §3.2.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { useTranslations } from '@/hooks/use-translations';
import {
    type AdminUserSettingsPatch,
    useUpdateUserSettings,
    useUserProfile
} from '@/hooks/use-user-profile';
import { BellIcon } from '@repo/icons';
import type { LanguageEnum, ThemeEnum, UserNotifications, UserSettings } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';

export const Route = createFileRoute('/_authed/account/notifications')({
    component: MyNotificationsPage
});

const DEFAULT_NOTIFICATIONS = {
    enabled: true,
    allowEmails: true,
    allowSms: false,
    allowPush: false
} as const satisfies UserSettings['notifications'];

function MyNotificationsPage() {
    const { t } = useTranslations();
    const { user: authUser } = useAuthContext();
    const userId = authUser?.id;
    const { data: profile, isLoading, isError, refetch } = useUserProfile({ userId });
    const mutation = useUpdateUserSettings({ userId });
    const { success: toastSuccess, error: toastError } = useFlashyToast();

    const settings = profile?.settings as UserSettings | undefined;

    const currentThemeWeb: ThemeEnum =
        settings?.themeWeb ??
        (settings?.darkMode === true ? 'dark' : settings?.darkMode === false ? 'light' : 'system');
    const currentThemeAdmin: ThemeEnum =
        settings?.themeAdmin ??
        (settings?.darkMode === true ? 'dark' : settings?.darkMode === false ? 'light' : 'system');
    const currentLanguageWeb: LanguageEnum =
        settings?.languageWeb ?? (settings?.language as LanguageEnum | undefined) ?? 'es';
    const currentLanguageAdmin: LanguageEnum =
        settings?.languageAdmin ?? (settings?.language as LanguageEnum | undefined) ?? 'es';

    const notifications = settings?.notifications ?? { ...DEFAULT_NOTIFICATIONS };

    const saveSettings = useCallback(
        (partial: Partial<AdminUserSettingsPatch>) => {
            const merged: AdminUserSettingsPatch = {
                themeWeb: currentThemeWeb,
                themeAdmin: currentThemeAdmin,
                languageWeb: currentLanguageWeb,
                languageAdmin: currentLanguageAdmin,
                notifications,
                newsletter: settings?.newsletter ?? false,
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
        [
            mutation,
            toastSuccess,
            toastError,
            currentThemeWeb,
            currentThemeAdmin,
            currentLanguageWeb,
            currentLanguageAdmin,
            notifications,
            settings?.newsletter,
            t
        ]
    );

    const handleNotificationChange = useCallback(
        (field: keyof UserNotifications, value: boolean) => {
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

    if (isLoading) {
        return (
            <MainPageLayout title={t('ui.pages.mySettings')}>
                <div className="mx-auto max-w-4xl space-y-6">
                    {Array.from({ length: 2 }).map((_, i) => (
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
                                disabled
                                unavailableLabel="(no disponible)"
                                onChange={(v) => handleNotificationChange('allowSms', v)}
                            />
                            <NotificationToggle
                                label={t('admin-pages.settings.notifications.pushNotifications')}
                                description={t(
                                    'admin-pages.settings.notifications.pushNotificationsDesc'
                                )}
                                checked={notifications.allowPush}
                                disabled
                                unavailableLabel="(no disponible)"
                                onChange={(v) => handleNotificationChange('allowPush', v)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainPageLayout>
    );
}

/**
 * Notification toggle row with label, description, and Switch control.
 *
 * When `unavailableLabel` is set, an inline "(no disponible)" badge is
 * rendered next to the label so users know the channel exists but the
 * dispatch backend is not implemented yet.
 */
function NotificationToggle({
    label,
    description,
    checked,
    disabled,
    onChange,
    unavailableLabel
}: {
    readonly label: string;
    readonly description: string;
    readonly checked: boolean;
    readonly disabled: boolean;
    readonly onChange: (value: boolean) => void;
    readonly unavailableLabel?: string;
}) {
    return (
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div className="flex-1">
                <p className="mb-1 flex items-center gap-2 font-medium text-sm">
                    <span>{label}</span>
                    {unavailableLabel && (
                        <span className="text-muted-foreground text-xs italic">
                            {unavailableLabel}
                        </span>
                    )}
                </p>
                <p className="text-muted-foreground text-xs">{description}</p>
            </div>
            <Switch
                aria-label={label}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
            />
        </div>
    );
}
