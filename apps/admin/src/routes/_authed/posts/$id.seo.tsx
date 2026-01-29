/**
 * Post SEO Tab Route
 *
 * Displays and manages SEO settings for a specific post.
 */

import { PageTabs, postTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePostQuery } from '@/features/posts/hooks/usePostQuery';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/$id/seo')({
    component: PostSeoPage
});

function PostSeoPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();
    const { data: post, isLoading } = usePostQuery(id);

    const seo = post?.seo as Record<string, unknown> | undefined;
    const metaTitle = String(seo?.metaTitle || post?.title || '');
    const metaDescription = String(seo?.metaDescription || post?.summary || '');
    const slug = String(post?.slug || '');
    const canonicalUrl = String(seo?.canonicalUrl || '');
    const ogImage = String(seo?.ogImage || post?.featuredImage || '');

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
                            <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                            <div className="h-32 animate-pulse rounded bg-gray-100" />
                            <div className="h-24 animate-pulse rounded bg-gray-100" />
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    const getCharCountColor = (current: number, target: number) => {
        const ratio = current / target;
        if (ratio < 0.8 || ratio > 1.2) return 'text-red-600';
        if (ratio < 0.9 || ratio > 1.1) return 'text-yellow-600';
        return 'text-green-600';
    };

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.postsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={postTabs}
                    basePath={`/posts/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">{t('admin-tabs.seo')}</h2>

                    {/* Google Preview */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="text-base">Search Engine Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                <p className="cursor-pointer text-blue-600 text-lg hover:underline">
                                    {metaTitle.slice(0, 60)}
                                    {metaTitle.length > 60 ? '...' : ''}
                                </p>
                                <p className="text-green-700 text-sm">
                                    hospeda.com.ar/posts/{slug}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {metaDescription.slice(0, 160)}
                                    {metaDescription.length > 160 ? '...' : ''}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SEO Fields */}
                    <div className="space-y-4">
                        {/* Meta Title */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <span className="mb-1 block font-medium text-sm">
                                            Meta Title
                                        </span>
                                        <p className="text-muted-foreground text-sm">
                                            {metaTitle || (
                                                <span className="italic">No meta title set</span>
                                            )}
                                        </p>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={getCharCountColor(metaTitle.length, 60)}
                                    >
                                        {metaTitle.length} / 60
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Meta Description */}
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <span className="mb-1 block font-medium text-sm">
                                            Meta Description
                                        </span>
                                        <p className="text-muted-foreground text-sm">
                                            {metaDescription || (
                                                <span className="italic">
                                                    No meta description set
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={getCharCountColor(metaDescription.length, 160)}
                                    >
                                        {metaDescription.length} / 160
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Slug */}
                        <Card>
                            <CardContent className="pt-6">
                                <span className="mb-1 block font-medium text-sm">Slug</span>
                                <p className="text-muted-foreground text-sm">
                                    {slug || <span className="italic">No slug set</span>}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Canonical URL */}
                        <Card>
                            <CardContent className="pt-6">
                                <span className="mb-1 block font-medium text-sm">
                                    Canonical URL
                                </span>
                                <p className="text-muted-foreground text-sm">
                                    {canonicalUrl || (
                                        <span className="italic">No canonical URL set</span>
                                    )}
                                </p>
                            </CardContent>
                        </Card>

                        {/* OG Image */}
                        <Card>
                            <CardContent className="pt-6">
                                <span className="mb-1 block font-medium text-sm">OG Image URL</span>
                                <p className="text-muted-foreground text-sm">
                                    {ogImage || <span className="italic">No OG image set</span>}
                                </p>
                                {ogImage && (
                                    <div className="mt-4">
                                        <img
                                            src={ogImage}
                                            alt="OG Preview"
                                            className="max-h-48 rounded-md border object-cover"
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
