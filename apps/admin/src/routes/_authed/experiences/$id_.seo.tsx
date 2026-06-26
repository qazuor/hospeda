import { PageTabs, experienceTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SeoEditor } from '@/components/seo/SeoEditor';
import { SEO_DEFAULT_LOCALE, buildSeoPreviewUrl } from '@/components/seo/seo-editor.utils';
import { env } from '@/env';
import { useExperienceQuery, useUpdateExperienceMutation } from '@/features/experience';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/experiences/$id_/seo')({
    component: ExperienceSeoPage
});

function ExperienceSeoPage() {
    const { id } = Route.useParams();
    const { data: experience, isLoading } = useExperienceQuery(id);
    const updateExperience = useUpdateExperienceMutation();

    const previewUrl = buildSeoPreviewUrl({
        siteUrl: env.VITE_SITE_URL,
        locale: SEO_DEFAULT_LOCALE,
        pathSegment: 'experiencias',
        slug: experience?.slug
    });

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.experiencesView">
            <div className="space-y-4">
                <PageTabs
                    tabs={experienceTabs}
                    basePath={`/experiences/${id}`}
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
                        seo={experience?.seo}
                        fallbackTitle={experience?.name ?? ''}
                        fallbackDescription={experience?.summary ?? ''}
                        previewUrl={previewUrl}
                        isSaving={updateExperience.isPending}
                        saveError={
                            updateExperience.error instanceof Error
                                ? updateExperience.error.message
                                : undefined
                        }
                        onSave={(seo) => updateExperience.mutateAsync({ id, data: { seo } })}
                    />
                )}
            </div>
        </SidebarPageLayout>
    );
}
