/**
 * @file Entity Routes Factory
 *
 * Factory functions for creating standardized entity route components.
 * Provides reusable error and pending components, plus type definitions
 * for consistent entity page hook implementations.
 *
 * @example
 * ```tsx
 * // In routes/_authed/accommodations/$id.tsx
 * import { createErrorComponent, createPendingComponent } from '@/lib/factories';
 *
 * export const Route = createFileRoute('/_authed/accommodations/$id')({
 *     component: AccommodationViewPage,
 *     errorComponent: createErrorComponent('Accommodation'),
 *     pendingComponent: createPendingComponent(),
 * });
 * ```
 */

import { Button } from '@/components/ui-wrapped';
import { LoaderIcon, PreviousIcon } from '@repo/icons';
import type { ReactNode } from 'react';

/**
 * Default error component styles
 */
const ERROR_STYLES = {
    container: 'flex min-h-[400px] flex-col items-center justify-center space-y-4',
    content: 'text-center',
    title: 'font-semibold text-2xl text-gray-900',
    message: 'mt-2 text-gray-600',
    icon: 'mr-2 h-4 w-4'
} as const;

/**
 * Default pending component styles
 */
const PENDING_STYLES = {
    container: 'flex min-h-[400px] items-center justify-center',
    spinner: 'h-8 w-8 animate-spin text-blue-600'
} as const;

/**
 * Creates a standard error component for entity routes
 *
 * @param displayName - Display name for the entity (e.g., 'Accommodation', 'Destination')
 * @returns Error component for use in route definitions
 *
 * @example
 * ```tsx
 * export const Route = createFileRoute('/_authed/accommodations/$id')({
 *     errorComponent: createErrorComponent('Accommodation'),
 *     // ...
 * });
 * ```
 */
export function createErrorComponent(displayName: string): (props: { error: Error }) => ReactNode {
    return function EntityErrorComponent({ error }: { error: Error }) {
        return (
            <div className={ERROR_STYLES.container}>
                <div className={ERROR_STYLES.content}>
                    <h2 className={ERROR_STYLES.title}>Error Loading {displayName}</h2>
                    <p className={ERROR_STYLES.message}>
                        {error.message || 'An unexpected error occurred'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => window.history.back()}
                >
                    <PreviousIcon className={ERROR_STYLES.icon} />
                    Go Back
                </Button>
            </div>
        );
    };
}

/**
 * Creates a standard pending/loading component for entity routes
 *
 * @returns Pending component for use in route definitions
 *
 * @example
 * ```tsx
 * export const Route = createFileRoute('/_authed/accommodations/$id')({
 *     pendingComponent: createPendingComponent(),
 *     // ...
 * });
 * ```
 */
export function createPendingComponent(): () => ReactNode {
    return function EntityPendingComponent() {
        return (
            <div className={PENDING_STYLES.container}>
                <LoaderIcon className={PENDING_STYLES.spinner} />
            </div>
        );
    };
}

/**
 * Pre-built error and pending components
 * Use these directly when a simple, unnamed component is sufficient
 */
export const RouteComponents = {
    /** Generic error component */
    Error: ({ error }: { error: Error }) => (
        <div className={ERROR_STYLES.container}>
            <div className={ERROR_STYLES.content}>
                <h2 className={ERROR_STYLES.title}>Error Loading Page</h2>
                <p className={ERROR_STYLES.message}>
                    {error.message || 'An unexpected error occurred'}
                </p>
            </div>
            <Button
                variant="outline"
                onClick={() => window.history.back()}
            >
                <PreviousIcon className={ERROR_STYLES.icon} />
                Go Back
            </Button>
        </div>
    ),

    /** Generic pending/loading component */
    Pending: () => (
        <div className={PENDING_STYLES.container}>
            <LoaderIcon className={PENDING_STYLES.spinner} />
        </div>
    )
} as const;

/**
 * Standard loader function for entity routes
 * Extracts entity ID from params and returns it
 *
 * @example
 * ```tsx
 * export const Route = createFileRoute('/_authed/accommodations/$id')({
 *     loader: createEntityLoader(),
 *     // ...
 * });
 *
 * // Access in component
 * const { entityId } = Route.useLoaderData();
 * ```
 */
export function createEntityLoader(): (args: {
    params: { id: string };
}) => Promise<{ entityId: string }> {
    return async ({ params }) => ({
        entityId: params.id
    });
}

/**
 * Creates both error and pending components for an entity
 * Convenience function for typical route setup
 *
 * @param displayName - Display name for the entity
 * @returns Object with error and pending components
 *
 * @example
 * ```tsx
 * const { errorComponent, pendingComponent } = createRouteComponents('Accommodation');
 *
 * export const Route = createFileRoute('/_authed/accommodations/$id')({
 *     component: AccommodationViewPage,
 *     errorComponent,
 *     pendingComponent,
 * });
 * ```
 */
export function createRouteComponents(displayName: string) {
    return {
        errorComponent: createErrorComponent(displayName),
        pendingComponent: createPendingComponent()
    };
}

/**
 * Configuration type for entity page hooks
 * Ensures consistent return types across all entity page hooks
 */
export interface EntityPageHookConfig<TEntity = Record<string, unknown>> {
    /** Current mode (view or edit) */
    mode: 'view' | 'edit';
    /** Function to set mode */
    setMode: (mode: 'view' | 'edit') => void;
    /** Switch to view mode */
    switchToView: () => void;
    /** Switch to edit mode */
    switchToEdit: () => void;
    /** Entity data */
    entity: TEntity | undefined;
    /** Loading state */
    isLoading: boolean;
    /** Error state */
    error: Error | null;
    /** Sections configuration */
    sections: readonly unknown[];
    /** Entity config for view/edit sections */
    entityConfig: {
        viewSections: readonly unknown[];
        editSections: readonly unknown[];
        metadata?: Record<string, unknown>;
    };
    /** User permissions */
    userPermissions: readonly string[];
    /** Permission checks */
    canView: boolean;
    canEdit: boolean;
    /** Navigation helpers */
    goToList: () => void;
    goToView: () => void;
    goToEdit: () => void;
    /** Update mutation */
    updateMutation: {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isLoading: boolean;
    };
}

/**
 * Type helper for creating entity page hooks with consistent interfaces
 *
 * @example
 * ```tsx
 * // In features/destinations/hooks/useDestinationPage.ts
 * import type { EntityPageHookConfig } from '@/lib/factories';
 *
 * export function useDestinationPage(id: string): EntityPageHookConfig<Destination> {
 *     // ... implementation
 * }
 * ```
 */
export type CreateEntityPageHook<TEntity = Record<string, unknown>> = (
    id: string
) => EntityPageHookConfig<TEntity>;
