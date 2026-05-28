/**
 * My Data (GDPR) Placeholder Page
 *
 * Future home of data export, account pause, and account deletion options
 * per GDPR / Argentine PDPA. For now this page only discloses that the
 * tooling is being prepared and points users to the support inbox for
 * manual requests. Implementation tracked in 99-future-enhancements.md.
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { MailIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/mi-cuenta/datos')({
    component: MyDataPage
});

function MyDataPage() {
    const { t } = useTranslations();
    const supportEmail = t('admin-pages.datos.supportContact.email');

    return (
        <MainPageLayout title={t('admin-pages.datos.title')}>
            <div className="mx-auto max-w-3xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {t('admin-pages.datos.comingSoon.title')}
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.datos.comingSoon.description')}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                            <MailIcon className="h-5 w-5 text-muted-foreground" />
                            <p className="text-sm">
                                <span className="text-muted-foreground">
                                    {t('admin-pages.datos.supportContact.label')}
                                </span>{' '}
                                <a
                                    href={`mailto:${supportEmail}`}
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                >
                                    {supportEmail}
                                </a>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainPageLayout>
    );
}
