import { EntityEditContent } from '@/components/entity-pages/EntityEditContent';
import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { Button } from '@/components/ui-wrapped';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { PreviousIcon } from '@repo/icons';
import { createFileRoute, useParams } from '@tanstack/react-router';

/**
 * Accommodation Edit Page Component
 */
function AccommodationEditPage() {
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
    const { id } = useParams({ from: '/_authed/accommodations/$id_/edit' as any });
    // Use the hook at the top level
    const entityData = useAccommodationPage(id);

    return (
        <EntityPageBase
            entityType="accommodation"
            entityId={id}
            initialMode="edit"
            entityData={entityData}
        >
            <EntityEditContent entityType="accommodation" />
        </EntityPageBase>
    );
}

/**
 * Accommodation Edit Route Configuration
 */
// biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
export const Route = createFileRoute('/_authed/accommodations/$id_/edit' as any)({
    component: AccommodationEditPage,
    loader: async ({ params }: { params: { id: string } }) => {
        // Pre-load accommodation data
        // This will be handled by React Query in the component
        return { accommodationId: params.id };
    },
    errorComponent: ({ error }) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
            <div className="text-center">
                <h2 className="font-semibold text-2xl text-gray-900">
                    Error Loading Accommodation
                </h2>
                <p className="mt-2 text-gray-600">
                    {error.message || 'An unexpected error occurred'}
                </p>
            </div>
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    onClick={() => window.history.back()}
                >
                    <PreviousIcon className="mr-2 h-4 w-4" />
                    Go Back
                </Button>
            </div>
        </div>
    ),
    pendingComponent: () => (
        <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
        </div>
    )
});
