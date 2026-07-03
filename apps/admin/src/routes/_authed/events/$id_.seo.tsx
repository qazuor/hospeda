import { PageTabs, eventTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { SeoEditor } from '@/components/seo/SeoEditor';
import { SEO_DEFAULT_LOCALE, buildSeoPreviewUrl } from '@/components/seo/seo-editor.utils';
import { env } from '@/env';
import { useEventQuery, useUpdateEventMutation } from '@/features/events/hooks/useEventQuery';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/events/$id_/seo')({
    component: EventSeoPage
});

function EventSeoPage() {
    const { id } = Route.useParams();
    const { data: event, isLoading } = useEventQuery(id);
    const updateEvent = useUpdateEventMutation(id);

    const previewUrl = buildSeoPreviewUrl({
        siteUrl: env.VITE_SITE_URL,
        locale: SEO_DEFAULT_LOCALE,
        pathSegment: 'eventos',
        slug: event?.slug
    });

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.eventsView">
            <div className="space-y-4">
                <PageTabs
                    tabs={eventTabs}
                    basePath={`/events/${id}`}
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
                        seo={event?.seo}
                        fallbackTitle={event?.name ?? ''}
                        fallbackDescription={event?.summary ?? ''}
                        previewUrl={previewUrl}
                        isSaving={updateEvent.isPending}
                        saveError={
                            updateEvent.error instanceof Error
                                ? updateEvent.error.message
                                : undefined
                        }
                        onSave={(seo) => updateEvent.mutateAsync({ seo })}
                    />
                )}
            </div>
        </SidebarPageLayout>
    );
}
