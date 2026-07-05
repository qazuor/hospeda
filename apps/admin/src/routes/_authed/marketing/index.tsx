/**
 * @file _authed/marketing/index.tsx
 * @description Marketing hub landing page (HOS-66 T-025 / G-11).
 *
 * Simple navigation hub for the "Marketing" IA section: links to the two
 * marketing sub-sections (Social, Newsletter). Pure navigation, no data
 * fetching — mirrors the `/sponsor` landing page pattern, which also has
 * no `RoutePermissionGuard` since access to the section itself is already
 * gated by the sidebar's own permission checks and each sub-section guards
 * its own routes independently.
 */

import { NewsletterIcon, PostIcon } from '@repo/icons';
import { createFileRoute, Link } from '@tanstack/react-router';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';

export const Route = createFileRoute('/_authed/marketing/')({
    component: MarketingHubPage
});

/** Marketing hub landing page — links to Social and Newsletter sub-sections. */
function MarketingHubPage() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout titleKey="admin-pages.marketing.title">
            <div className="space-y-6">
                {/* Page subtitle (h1 is rendered by SidebarPageLayout) */}
                <p className="text-muted-foreground">{t('admin-pages.marketing.subtitle')}</p>

                <div className="grid gap-4 md:grid-cols-2">
                    <Link to="/social">
                        <Card className="h-full transition-colors hover:bg-accent/50">
                            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                                <PostIcon className="size-8 text-muted-foreground" />
                                <div>
                                    <CardTitle>{t('admin-pages.marketing.social.title')}</CardTitle>
                                    <CardDescription>
                                        {t('admin-pages.marketing.social.description')}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>

                    <Link to="/newsletter/campaigns">
                        <Card className="h-full transition-colors hover:bg-accent/50">
                            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                                <NewsletterIcon className="size-8 text-muted-foreground" />
                                <div>
                                    <CardTitle>
                                        {t('admin-pages.marketing.newsletter.title')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('admin-pages.marketing.newsletter.description')}
                                    </CardDescription>
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
