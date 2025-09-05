import { EntityPageBase } from '@/components/entity-pages/EntityPageBase';
import { EntityViewContent } from '@/components/entity-pages/EntityViewContent';
import { Button } from '@/components/ui-wrapped';
import { useAccommodationPage } from '@/features/accommodations/hooks/useAccommodationPage';
import { PreviousIcon } from '@repo/icons';
import { createFileRoute, useParams } from '@tanstack/react-router';

/**
 * Accommodation View Page Component
 */
function AccommodationViewPage() {
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
    const { id } = useParams({ from: '/_authed/accommodations/$id' as any });

    // Use the hook at the top level
    const entityData = useAccommodationPage(id);

    return (
        <EntityPageBase
            entityType="accommodation"
            entityId={id}
            initialMode="view"
            entityData={entityData}
        >
            <EntityViewContent
                entityType="accommodation"
                entityId={id}
                sections={entityData.sections}
                entity={entityData.entity || {}}
                userPermissions={entityData.userPermissions}
            />
        </EntityPageBase>
    );
}

/**
 * Accommodation View Route Configuration
 */
// biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
export const Route = createFileRoute('/_authed/accommodations/$id' as any)({
    component: AccommodationViewPage,
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
            <Button
                variant="outline"
                onClick={() => window.history.back()}
            >
                <PreviousIcon className="mr-2 h-4 w-4" />
                Go Back
            </Button>
        </div>
    ),
    pendingComponent: () => (
        <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
        </div>
    )
});
