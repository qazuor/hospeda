import { PageTabs, postTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SeoEditor } from '@/components/seo/SeoEditor';
import { SEO_DEFAULT_LOCALE, buildSeoPreviewUrl } from '@/components/seo/seo-editor.utils';
import { env } from '@/env';
import { usePostQuery, useUpdatePostMutation } from '@/features/posts/hooks/usePostQuery';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/posts/$id_/seo')({
    component: PostSeoPage
});

function PostSeoPage() {
    const { id } = Route.useParams();
    const { data: post, isLoading } = usePostQuery(id);
    const updatePost = useUpdatePostMutation(id);

    const previewUrl = buildSeoPreviewUrl({
        siteUrl: env.VITE_SITE_URL,
        locale: SEO_DEFAULT_LOCALE,
        pathSegment: 'publicaciones',
        slug: post?.slug
    });

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.postsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={postTabs}
                    basePath={`/posts/${id}`}
                />

                {isLoading ? (
                    <div className="rounded-lg border bg-card p-6">
                        <div className="space-y-4">
                            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
                            <div className="h-32 animate-pulse rounded bg-muted" />
                            <div className="h-24 animate-pulse rounded bg-muted" />
                        </div>
                    </div>
                ) : (
                    <SeoEditor
                        seo={post?.seo}
                        fallbackTitle={post?.title ?? ''}
                        fallbackDescription={post?.summary ?? ''}
                        previewUrl={previewUrl}
                        isSaving={updatePost.isPending}
                        saveError={
                            updatePost.error instanceof Error ? updatePost.error.message : undefined
                        }
                        onSave={(seo) => updatePost.mutateAsync({ seo })}
                    />
                )}
            </div>
        </SidebarPageLayout>
    );
}
