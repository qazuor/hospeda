/**
 * Security Area Landing Page
 *
 * Entry point for the "Mi cuenta > Seguridad" section. Lists the actions
 * available today (password change) and disclosed stubs for features
 * deferred to future SPECs — 2FA, active sessions, login history, email
 * change. See spec OUT-of-scope §3 and 99-future-enhancements.md §3.1.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { ChevronRightIcon, LockIcon, ShieldIcon } from '@repo/icons';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/account/security/')({
    component: SecurityLandingPage
});

const STUB_FEATURES = [
    {
        id: 'twoFactorAuth',
        titleKey: 'admin-pages.security.stubs.twoFactorAuth.title',
        subtitleKey: 'admin-pages.security.stubs.twoFactorAuth.subtitle'
    },
    {
        id: 'activeSessions',
        titleKey: 'admin-pages.security.stubs.activeSessions.title',
        subtitleKey: 'admin-pages.security.stubs.activeSessions.subtitle'
    },
    {
        id: 'loginHistory',
        titleKey: 'admin-pages.security.stubs.loginHistory.title',
        subtitleKey: 'admin-pages.security.stubs.loginHistory.subtitle'
    },
    {
        id: 'changeEmail',
        titleKey: 'admin-pages.security.stubs.changeEmail.title',
        subtitleKey: 'admin-pages.security.stubs.changeEmail.subtitle'
    }
] as const;

function SecurityLandingPage() {
    const { t } = useTranslations();

    return (
        <MainPageLayout title={t('admin-pages.security.title')}>
            <div className="mx-auto max-w-3xl space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                                <ShieldIcon className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    {t('admin-pages.security.available.title')}
                                </CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.security.available.subtitle')}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Link
                            to="/account/security/change-password"
                            className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                        >
                            <div className="flex items-center gap-3">
                                <LockIcon className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium text-sm">
                                        {t('admin-pages.security.changePassword.title')}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        {t('admin-pages.security.changePassword.subtitle')}
                                    </p>
                                </div>
                            </div>
                            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {t('admin-common.comingSoon.title')}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-common.comingSoon.description')}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {STUB_FEATURES.map((feature) => (
                                <li
                                    key={feature.id}
                                    aria-disabled
                                    className="flex items-center justify-between rounded-lg border bg-muted/30 p-4 opacity-60"
                                >
                                    <div>
                                        <p className="font-medium text-sm">{t(feature.titleKey)}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {t(feature.subtitleKey)}
                                        </p>
                                    </div>
                                    <span className="text-muted-foreground text-xs italic">
                                        ({t('admin-common.comingSoon.title').toLowerCase()})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </MainPageLayout>
    );
}
