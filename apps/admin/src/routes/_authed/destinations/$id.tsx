import { PageTabs, destinationTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

/**
 * Destination View Route
 *
 * Displays a single destination's details.
 * TODO: Implement full entity page with useDestinationPage hook
 */
export const Route = createFileRoute('/_authed/destinations/$id')({
    component: DestinationViewPage
});

function DestinationViewPage() {
    const { id } = Route.useParams();
    const { t } = useTranslations();

    const entityName = t('admin-entities.entities.destination.singular');

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.destinationsView">
            <div className="space-y-4">
                {/* Level 3 Navigation: Page Tabs */}
                <PageTabs
                    tabs={destinationTabs}
                    basePath={`/destinations/${id}`}
                />

                <div className="rounded-lg border bg-card p-6">
                    <h2 className="mb-4 font-semibold text-lg">
                        {t('admin-entities.detail.title', { entity: entityName })}
                    </h2>
                    <p className="text-muted-foreground">
                        ID: <code className="rounded bg-muted px-2 py-1">{id}</code>
                    </p>
                    <p className="mt-4 text-muted-foreground text-sm">
                        {t('ui.pages.todoAddContent')}
                    </p>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
