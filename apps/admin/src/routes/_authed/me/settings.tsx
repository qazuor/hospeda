/**
 * My Settings Page Route
 *
 * Two theme/language sections (Web and Admin) plus shared notifications.
 * Submits to the admin user PATCH endpoint via `useUpdateUserSettings`,
 * which now accepts `themeWeb`, `themeAdmin`, `languageWeb`, `languageAdmin`,
 * `notifications`, and `newsletter` (SPEC-096 / REQ-096-32, T-056).
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Badge } from '@/components/ui/badge';
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
import type { TranslationKey } from '@repo/i18n';
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
import type { LanguageEnum, ThemeEnum, UserSettings } from '@repo/schemas';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

type TranslateFn = (key: TranslationKey, params?: Record<string, unknown>) => string;

export const Route = createFileRoute('/_authed/me/settings')({
    component: MySettingsPage
});

const DEFAULT_NOTIFICATIONS = {
    enabled: true,
    allowEmails: true,
    allowSms: false,
    allowPush: false
} as const satisfies UserSettings['notifications'];

function MySettingsPage() {
    const { t } = useTranslations();
    const { user: authUser } = useAuthContext();
    const userId = authUser?.id;
    const { data: profile, isLoading, isError, refetch } = useUserProfile({ userId });
    const mutation = useUpdateUserSettings({ userId });
    const { success: toastSuccess, error: toastError } = useFlashyToast();

    const settings = profile?.settings as UserSettings | undefined;

    // Resolve current values, falling back to legacy fields when the new
    // per-surface fields haven't been backfilled yet.
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
            // Always send the full per-surface shape so the server has a
            // complete object — none of the four surface fields are required
            // individually, but we forward the current values for the keys we
            // are not changing this round.
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

    const handleThemeWeb = useCallback(
        (value: ThemeEnum) => saveSettings({ themeWeb: value }),
        [saveSettings]
    );
    const handleThemeAdmin = useCallback(
        (value: ThemeEnum) => saveSettings({ themeAdmin: value }),
        [saveSettings]
    );
    const handleLanguageWeb = useCallback(
        (value: LanguageEnum) => saveSettings({ languageWeb: value }),
        [saveSettings]
    );
    const handleLanguageAdmin = useCallback(
        (value: LanguageEnum) => saveSettings({ languageAdmin: value }),
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
                {/* Web preferences */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 dark:bg-purple-400/10">
                                <PaletteIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.settings.web.title')}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.settings.web.subtitle')}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <ThemePicker
                                label={t('admin-pages.settings.appearance.themePreference')}
                                value={currentThemeWeb}
                                onChange={handleThemeWeb}
                                disabled={isSaving}
                                idPrefix="web-theme"
                                t={t}
                            />
                            <LanguagePicker
                                label={t('admin-pages.settings.language.interfaceLanguage')}
                                value={currentLanguageWeb}
                                onChange={handleLanguageWeb}
                                disabled={isSaving}
                                idPrefix="web-lang"
                                t={t}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Admin preferences */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                                <GlobeIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.settings.admin.title')}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.settings.admin.subtitle')}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <ThemePicker
                                label={t('admin-pages.settings.appearance.themePreference')}
                                value={currentThemeAdmin}
                                onChange={handleThemeAdmin}
                                disabled={isSaving}
                                idPrefix="admin-theme"
                                t={t}
                            />
                            <LanguagePicker
                                label={t('admin-pages.settings.language.interfaceLanguage')}
                                value={currentLanguageAdmin}
                                onChange={handleLanguageAdmin}
                                disabled={isSaving}
                                idPrefix="admin-lang"
                                t={t}
                            />

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

                {/* Notifications (shared) */}
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

                {/* Account & security info */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Pickers
// ─────────────────────────────────────────────────────────────────────────────

interface ThemePickerProps {
    readonly label: string;
    readonly value: ThemeEnum;
    readonly onChange: (value: ThemeEnum) => void;
    readonly disabled: boolean;
    readonly idPrefix: string;
    readonly t: TranslateFn;
}

function ThemePicker({ label, value, onChange, disabled, idPrefix, t }: ThemePickerProps) {
    return (
        <div>
            <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                {label}
            </span>
            <div
                className="flex flex-wrap gap-3"
                aria-labelledby={`${idPrefix}-label`}
            >
                <ThemeButton
                    icon={<MonitorIcon className="h-5 w-5" />}
                    label={t('admin-pages.settings.appearance.system')}
                    active={value === 'system'}
                    disabled={disabled}
                    onClick={() => onChange('system')}
                />
                <ThemeButton
                    icon={<SunIcon className="h-5 w-5" />}
                    label={t('admin-pages.settings.appearance.light')}
                    active={value === 'light'}
                    disabled={disabled}
                    onClick={() => onChange('light')}
                />
                <ThemeButton
                    icon={<MoonIcon className="h-5 w-5" />}
                    label={t('admin-pages.settings.appearance.dark')}
                    active={value === 'dark'}
                    disabled={disabled}
                    onClick={() => onChange('dark')}
                />
            </div>
        </div>
    );
}

interface LanguagePickerProps {
    readonly label: string;
    readonly value: LanguageEnum;
    readonly onChange: (value: LanguageEnum) => void;
    readonly disabled: boolean;
    readonly idPrefix: string;
    readonly t: TranslateFn;
}

function LanguagePicker({ label, value, onChange, disabled, idPrefix, t }: LanguagePickerProps) {
    return (
        <div>
            <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                {label}
            </span>
            <div
                className="flex flex-wrap gap-3"
                aria-labelledby={`${idPrefix}-label`}
            >
                <LanguageButton
                    label={t('admin-pages.settings.language.es')}
                    code="es"
                    active={value === 'es'}
                    disabled={disabled}
                    onClick={() => onChange('es')}
                />
                <LanguageButton
                    label={t('admin-pages.settings.language.en')}
                    code="en"
                    active={value === 'en'}
                    disabled={disabled}
                    onClick={() => onChange('en')}
                />
                <LanguageButton
                    label={t('admin-pages.settings.language.pt')}
                    code="pt"
                    active={value === 'pt'}
                    disabled={disabled}
                    onClick={() => onChange('pt')}
                />
            </div>
        </div>
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
                    : 'bg-card text-muted-foreground hover:text-foreground'
            } disabled:cursor-not-allowed disabled:opacity-50`}
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
                    : 'bg-card text-muted-foreground hover:text-foreground'
            } disabled:cursor-not-allowed disabled:opacity-50`}
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
                aria-label={label}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
            />
        </div>
    );
}
