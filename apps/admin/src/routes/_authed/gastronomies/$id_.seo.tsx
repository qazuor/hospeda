import { PageTabs, gastronomyTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SeoEditor } from '@/components/seo/SeoEditor';
import { SEO_DEFAULT_LOCALE, buildSeoPreviewUrl } from '@/components/seo/seo-editor.utils';
import { env } from '@/env';
import { useGastronomyQuery, useUpdateGastronomyMutation } from '@/features/gastronomy';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/gastronomies/$id_/seo')({
    component: GastronomySeoPage
});

function GastronomySeoPage() {
    const { id } = Route.useParams();
    const { data: gastronomy, isLoading } = useGastronomyQuery(id);
    const updateGastronomy = useUpdateGastronomyMutation();

    const previewUrl = buildSeoPreviewUrl({
        siteUrl: env.VITE_SITE_URL,
        locale: SEO_DEFAULT_LOCALE,
        pathSegment: 'gastronomias',
        slug: gastronomy?.slug
    });

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.gastronomiesView">
            <div className="space-y-4">
                <PageTabs
                    tabs={gastronomyTabs}
                    basePath={`/gastronomies/${id}`}
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
                        seo={gastronomy?.seo}
                        fallbackTitle={gastronomy?.name ?? ''}
                        fallbackDescription={gastronomy?.summary ?? ''}
                        previewUrl={previewUrl}
                        isSaving={updateGastronomy.isPending}
                        saveError={
                            updateGastronomy.error instanceof Error
                                ? updateGastronomy.error.message
                                : undefined
                        }
                        onSave={(seo) => updateGastronomy.mutateAsync({ id, data: { seo } })}
                    />
                )}
            </div>
        </SidebarPageLayout>
    );
}
