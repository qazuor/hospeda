/**
 * My Settings Page Route
 *
 * Displays user settings and preferences.
 * Includes theme, language, notifications, and account settings.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';
import { Bell, ExternalLink, Globe, Info, Monitor, Moon, Palette, Shield, Sun } from 'lucide-react';

export const Route = createFileRoute('/_authed/me/settings')({
    component: MySettingsPage
});

function MySettingsPage() {
    const { t } = useTranslations();

    return (
        <MainPageLayout title={t('ui.pages.mySettings')}>
            <div className="mx-auto max-w-4xl space-y-6">
                {/* Page description */}
                <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-muted-foreground text-sm">
                        Customize your experience with Hospeda Admin. Settings are saved to your
                        browser's local storage and will persist across sessions.
                    </p>
                </div>

                {/* Appearance settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                                <Palette className="h-5 w-5 text-purple-500" />
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
                                    <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                                        <Monitor className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-medium text-sm">System</span>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-lg border bg-card p-3 opacity-60">
                                        <Sun className="h-5 w-5 text-muted-foreground" />
                                        <span className="text-muted-foreground text-sm">Light</span>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-lg border bg-card p-3 opacity-60">
                                        <Moon className="h-5 w-5 text-muted-foreground" />
                                        <span className="text-muted-foreground text-sm">Dark</span>
                                    </div>
                                </div>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Currently using system preference (display only)
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Language settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                                <Globe className="h-5 w-5 text-blue-500" />
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
                                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                                    <Globe className="h-5 w-5 text-muted-foreground" />
                                    <span className="font-medium">Español (Argentina)</span>
                                    <Badge
                                        variant="secondary"
                                        className="ml-auto"
                                    >
                                        Default
                                    </Badge>
                                </div>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Language selection will be available soon
                                </p>
                            </div>

                            <div>
                                <span className="mb-2 block font-medium text-muted-foreground text-xs uppercase">
                                    Timezone
                                </span>
                                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                                    <span className="font-medium">
                                        America/Argentina/Buenos_Aires
                                    </span>
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
                                <Bell className="h-5 w-5 text-green-500" />
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
                            {/* Email notifications */}
                            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                                <div className="flex-1">
                                    <p className="mb-1 font-medium text-sm">Email Notifications</p>
                                    <p className="text-muted-foreground text-xs">
                                        Receive updates via email
                                    </p>
                                </div>
                                <Badge variant="outline">Enabled</Badge>
                            </div>

                            {/* Browser notifications */}
                            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                                <div className="flex-1">
                                    <p className="mb-1 font-medium text-sm">
                                        Browser Notifications
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Show desktop notifications
                                    </p>
                                </div>
                                <Badge variant="outline">Disabled</Badge>
                            </div>

                            {/* Important updates */}
                            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                                <div className="flex-1">
                                    <p className="mb-1 font-medium text-sm">
                                        Important Updates Only
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Only critical notifications
                                    </p>
                                </div>
                                <Badge variant="outline">Disabled</Badge>
                            </div>

                            <p className="text-muted-foreground text-xs">
                                Notification preferences are display-only. Full notification
                                management will be available in a future update.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Account & security settings */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                                <Shield className="h-5 w-5 text-red-500" />
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
                                    <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
                                    <div className="flex-1">
                                        <p className="mb-1 font-medium text-sm">
                                            Authentication Provider
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            Your account security is managed by Clerk. Use the Clerk
                                            dashboard to update your password, enable two-factor
                                            authentication, or manage connected accounts.
                                        </p>
                                    </div>
                                </div>
                                <a
                                    href="https://dashboard.clerk.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary text-sm underline hover:text-primary/80"
                                >
                                    Manage Security Settings
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                                <p className="text-amber-900 text-sm dark:text-amber-100">
                                    <strong>Security Tip:</strong> Enable two-factor authentication
                                    (2FA) in your Clerk account for enhanced security. This adds an
                                    extra layer of protection to your admin account.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Info cards */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Local storage info */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                        <p className="mb-2 font-medium text-blue-900 text-sm dark:text-blue-100">
                            Settings Persistence
                        </p>
                        <p className="text-blue-900 text-sm dark:text-blue-100">
                            Your preferences are saved to your browser's local storage. They will
                            persist across sessions but are specific to this device and browser.
                            Settings sync across devices will be available in a future update.
                        </p>
                    </div>

                    {/* Future features */}
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
                        <p className="mb-2 font-medium text-purple-900 text-sm dark:text-purple-100">
                            Coming Soon
                        </p>
                        <p className="text-purple-900 text-sm dark:text-purple-100">
                            Interactive settings management, including theme switching, language
                            selection, notification preferences, and keyboard shortcuts
                            customization will be available soon.
                        </p>
                    </div>
                </div>
            </div>
        </MainPageLayout>
    );
}
