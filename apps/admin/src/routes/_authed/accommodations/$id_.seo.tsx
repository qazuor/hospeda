import { SeoEditor } from '@/components/seo/SeoEditor';
import { buildSeoPreviewUrl } from '@/components/seo/seo-editor.utils';
import { env } from '@/env';
import { AccommodationSubTabLayout } from '@/features/accommodations/components/AccommodationSubTabLayout';
import {
    useAccommodationQuery,
    useUpdateAccommodationMutation
} from '@/features/accommodations/hooks/useAccommodationQuery';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/accommodations/$id_/seo')({
    component: AccommodationSeoPage
});

function AccommodationSeoPage() {
    const { id } = Route.useParams();
    const { data: accommodation, isLoading } = useAccommodationQuery(id);
    const updateAccommodation = useUpdateAccommodationMutation(id);

    const previewUrl = buildSeoPreviewUrl({
        siteUrl: env.VITE_SITE_URL,
        locale: 'es',
        pathSegment: 'alojamientos',
        slug: accommodation?.slug as string | undefined
    });

    return (
        <AccommodationSubTabLayout
            accommodationId={id}
            entityName={accommodation?.name}
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
                    seo={accommodation?.seo}
                    fallbackTitle={accommodation?.name ?? ''}
                    fallbackDescription={accommodation?.summary ?? ''}
                    previewUrl={previewUrl}
                    isSaving={updateAccommodation.isPending}
                    saveError={
                        updateAccommodation.error instanceof Error
                            ? updateAccommodation.error.message
                            : undefined
                    }
                    onSave={(seo) =>
                        updateAccommodation.mutateAsync({
                            seo
                        })
                    }
                />
            )}
        </AccommodationSubTabLayout>
    );
}
