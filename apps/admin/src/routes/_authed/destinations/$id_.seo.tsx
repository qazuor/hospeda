import { SeoEditor } from '@/components/seo/SeoEditor';
import { buildSeoPreviewUrl } from '@/components/seo/seo-editor.utils';
import { env } from '@/env';
import { DestinationSubTabLayout } from '@/features/destinations/components/DestinationSubTabLayout';
import {
    useDestinationQuery,
    useUpdateDestinationMutation
} from '@/features/destinations/hooks/useDestinationQuery';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/destinations/$id_/seo')({
    component: DestinationSeoPage
});

function DestinationSeoPage() {
    const { id } = Route.useParams();
    const { data: destination, isLoading } = useDestinationQuery(id);
    const updateDestination = useUpdateDestinationMutation(id);

    const previewUrl = buildSeoPreviewUrl({
        siteUrl: env.VITE_SITE_URL,
        locale: 'es',
        pathSegment: 'destinos',
        slug: destination?.slug
    });

    return (
        <DestinationSubTabLayout
            destinationId={id}
            entityName={destination?.name}
        >
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
                    seo={destination?.seo}
                    fallbackTitle={destination?.name ?? ''}
                    fallbackDescription={destination?.summary ?? ''}
                    previewUrl={previewUrl}
                    isSaving={updateDestination.isPending}
                    saveError={
                        updateDestination.error instanceof Error
                            ? updateDestination.error.message
                            : undefined
                    }
                    onSave={(seo) => updateDestination.mutateAsync({ seo })}
                />
            )}
        </DestinationSubTabLayout>
    );
}
