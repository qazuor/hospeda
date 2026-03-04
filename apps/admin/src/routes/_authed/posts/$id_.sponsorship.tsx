/**
 * Post Sponsorship Tab Route
 *
 * Displays and manages sponsorship settings for a specific post.
 */

import { PageTabs, postTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePostQuery } from '@/features/posts/hooks/usePostQuery';
import { useTranslations } from '@/hooks/use-translations';
import { formatDate } from '@repo/i18n';
import { InfoIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/$id_/sponsorship')({
    component: PostSponsorshipPage
});

function PostSponsorshipPage() {
    const { id } = Route.useParams();
    const { t, locale } = useTranslations();
    const { data: post, isLoading } = usePostQuery(id);

    // API response may include joined relations not in base Post type
    const postWithRelations = post as
        | (typeof post & {
              sponsorship?: Record<string, unknown>;
              sponsor?: Record<string, unknown>;
          })
        | undefined;
    const sponsorship = postWithRelations?.sponsorship;
    const sponsor = postWithRelations?.sponsor;
    const hasSponsor = !!sponsorship || !!sponsor;

    if (isLoading) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.postsView">
                <div className="space-y-4">
                    <PageTabs
                        tabs={postTabs}
                        basePath={`/posts/${id}`}
                    />

                    <div className="rounded-lg border bg-card p-6">
                        <div className="space-y-4">
                            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
                            <div className="h-32 animate-pulse rounded bg-muted" />
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.postsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={postTabs}
                    basePath={`/posts/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.sponsorship')}</h2>

                    {hasSponsor ? (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {t('admin-pages.posts.sponsorship.sponsorInfo')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Sponsor Name */}
                                    <div>
                                        <span className="mb-1 block font-medium text-sm">
                                            {t('admin-pages.posts.sponsorship.sponsorName')}
                                        </span>
                                        <p className="text-muted-foreground">
                                            {String(
                                                sponsorship?.sponsorName ||
                                                    sponsor?.name ||
                                                    t(
                                                        'admin-pages.posts.sponsorship.unknownSponsor'
                                                    )
                                            )}
                                        </p>
                                    </div>

                                    {/* Sponsorship Type */}
                                    {sponsorship?.type ? (
                                        <div>
                                            <span className="mb-1 block font-medium text-sm">
                                                {t('admin-pages.posts.sponsorship.type')}
                                            </span>
                                            <Badge variant="secondary">
                                                {String(sponsorship.type)}
                                            </Badge>
                                        </div>
                                    ) : null}

                                    {/* Dates */}
                                    {sponsorship?.startDate || sponsorship?.endDate ? (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {sponsorship.startDate ? (
                                                <div>
                                                    <span className="mb-1 block font-medium text-sm">
                                                        {t(
                                                            'admin-pages.posts.sponsorship.startDate'
                                                        )}
                                                    </span>
                                                    <p className="text-muted-foreground text-sm">
                                                        {formatDate({
                                                            date: String(sponsorship.startDate),
                                                            locale,
                                                            options: { dateStyle: 'short' }
                                                        })}
                                                    </p>
                                                </div>
                                            ) : null}
                                            {sponsorship.endDate ? (
                                                <div>
                                                    <span className="mb-1 block font-medium text-sm">
                                                        {t('admin-pages.posts.sponsorship.endDate')}
                                                    </span>
                                                    <p className="text-muted-foreground text-sm">
                                                        {formatDate({
                                                            date: String(sponsorship.endDate),
                                                            locale,
                                                            options: { dateStyle: 'short' }
                                                        })}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {/* Status */}
                                    {sponsorship?.status ? (
                                        <div>
                                            <span className="mb-1 block font-medium text-sm">
                                                {t('admin-pages.posts.sponsorship.status')}
                                            </span>
                                            <Badge
                                                variant={
                                                    sponsorship.status === 'active'
                                                        ? 'default'
                                                        : 'secondary'
                                                }
                                            >
                                                {String(sponsorship.status)}
                                            </Badge>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>

                            {/* Info Note */}
                            <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                                <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                                <div>
                                    <p className="font-medium text-blue-900 text-sm dark:text-blue-200">
                                        {t('admin-pages.posts.sponsorship.note')}
                                    </p>
                                    <p className="mt-1 text-blue-800 text-sm dark:text-blue-300">
                                        {t('admin-pages.posts.sponsorship.noteDesc')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="py-8 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                    <span
                                        className="text-2xl"
                                        aria-hidden="true"
                                    >
                                        🏢
                                    </span>
                                </div>
                                <h3 className="mb-2 font-semibold text-lg">
                                    {t('admin-pages.posts.sponsorship.noSponsorship')}
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.posts.sponsorship.noSponsorshipDesc')}
                                </p>
                            </div>

                            {/* Info Note */}
                            <div className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                                <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                                <div>
                                    <p className="font-medium text-blue-900 text-sm dark:text-blue-200">
                                        {t('admin-pages.posts.sponsorship.note')}
                                    </p>
                                    <p className="mt-1 text-blue-800 text-sm dark:text-blue-300">
                                        {t('admin-pages.posts.sponsorship.noteDescNoSponsor')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SidebarPageLayout>
    );
}
