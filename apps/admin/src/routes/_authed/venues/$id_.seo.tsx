import { createFileRoute } from '@tanstack/react-router';
import { PageTabs, venueTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SeoEditor } from '@/components/seo/SeoEditor';
import { buildSeoPreviewUrl, SEO_DEFAULT_LOCALE } from '@/components/seo/seo-editor.utils';
import { env } from '@/env';
import { useUpdateVenueMutation, useVenueQuery } from '@/features/venue';

export const Route = createFileRoute('/_authed/gastronomies/$id_/seo')({
    component: VenueSeoPage
});

function VenueSeoPage() {
    const { id } = Route.useParams();
    const { data: venue, isLoading } = useVenueQuery(id);
    const updateVenue = useUpdateVenueMutation();

    const previewUrl = buildSeoPreviewUrl({
        siteUrl: env.VITE_SITE_URL,
        locale: SEO_DEFAULT_LOCALE,
        pathSegment: 'gastronomia',
        slug: venue?.slug
    });

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.gastronomiesView">
            <div className="space-y-4">
                <PageTabs
                    tabs={venueTabs}
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
                        seo={venue?.seo}
                        fallbackTitle={venue?.name ?? ''}
                        fallbackDescription={venue?.summary ?? ''}
                        previewUrl={previewUrl}
                        isSaving={updateVenue.isPending}
                        saveError={
                            updateVenue.error instanceof Error
                                ? updateVenue.error.message
                                : undefined
                        }
                        onSave={(seo) => updateVenue.mutateAsync({ id, data: { seo } })}
                    />
                )}
            </div>
        </SidebarPageLayout>
    );
}
