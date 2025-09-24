import { EntityFormProvider, FormModeEnum } from '@/components/entity-form';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import type { PermissionEnum } from '@repo/schemas';

import React, { Suspense, type ReactNode } from 'react';

/**
 * Props for EntityPageBase component
 */
export interface EntityPageBaseProps<T = Record<string, unknown>> {
    /** Entity type (e.g., 'accommodation') */
    entityType: string;
    /** Entity ID */
    entityId: string;
    /** Initial mode */
    initialMode?: 'view' | 'edit';
    /** Children to render */
    children: ReactNode;
    /** Additional CSS classes */
    className?: string;
    /** Entity data and configuration from the hook */
    entityData: {
        mode: 'view' | 'edit';
        setMode: (mode: 'view' | 'edit') => void;
        switchToView: () => void;
        switchToEdit: () => void;
        entity: T | undefined;
        isLoading: boolean;
        error: Error | null;
        entityConfig: {
            viewSections: Array<(() => SectionConfig) | SectionConfig>;
            editSections: Array<(() => SectionConfig) | SectionConfig>;
            metadata?: Record<string, unknown>;
        };
        userPermissions: PermissionEnum[];
        canView: boolean;
        canEdit: boolean;
        goToList: () => void;
        goToView: () => void;
        goToEdit: () => void;
        updateMutation: {
            mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
            isLoading: boolean;
        };
    };
}

/**
 * Base component for entity pages (view and edit)
 * Handles common logic: permissions, configuration, state, errors
 * Renders mode-specific content
 */
export const EntityPageBase = <T = Record<string, unknown>>({
    entityType,
    entityId,
    initialMode = 'view',
    children,
    className,
    entityData
}: EntityPageBaseProps<T>) => {
    // Extract data from props
    const {
        mode,
        setMode,
        entity,
        isLoading,
        error,
        entityConfig,
        userPermissions,
        canView,
        canEdit,
        goToList,
        goToView,
        goToEdit,
        updateMutation
    } = entityData;

    // Set initial mode
    React.useEffect(() => {
        setMode(initialMode);
    }, [initialMode, setMode]);

    // Handle save function
    const handleSave = React.useCallback(
        async (values: Record<string, unknown>) => {
            // DEBUG [3ac2cd4f-636f-4197-8086-e79219df2bac]: Log all form values
            // biome-ignore lint/suspicious/noConsoleLog: Temporary debugging
            console.log('[EntityPageBase] All form values:', values);

            // Extract only the fields that are defined in the configuration
            const fieldsToSave: Record<string, unknown> = {};
            const allFields = entityConfig.editSections.flatMap((section) => {
                const sectionConfig = typeof section === 'function' ? section() : section;
                return sectionConfig.fields;
            });

            for (const field of allFields) {
                if (field.id in values) {
                    fieldsToSave[field.id] = values[field.id];
                }
            }

            // DEBUG [cd101b08-1036-4f48-b34d-20dc52afb9b3]: Log filtered values being sent to API
            // biome-ignore lint/suspicious/noConsoleLog: Temporary debugging
            console.log('[EntityPageBase] Filtered values for API:', fieldsToSave);

            await updateMutation.mutateAsync(fieldsToSave);
            // After successful save, navigate to view mode
            goToView();
        },
        [updateMutation, goToView, entityConfig.editSections]
    );

    // Loading state
    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
                    <p className="mt-2 text-gray-600 text-sm">Loading {entityType}...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        throw error;
    }

    // Not found state
    if (!entity) {
        throw new Error(`${entityType} not found`);
    }

    // Permission check
    if (!canView) {
        throw new Error('You do not have permission to view this resource');
    }

    // Get entity name for display
    const entityName = (entity as { name?: string })?.name || entityType;

    // Debug logging (temporarily disabled)
    // console.log('[EntityPageBase] Debug info:', {
    //     mode,
    //     entityId,
    //     entityType,
    //     hasEntity: !!entity,
    //     entity: entity ? Object.keys(entity) : 'undefined'
    // });

    // Create a complete EntityConfig from our entityConfig
    // Use sections filtered by current mode
    const currentSections =
        mode === 'view'
            ? entityConfig.viewSections.map((section) =>
                  typeof section === 'function' ? section() : section
              )
            : entityConfig.editSections.map((section) =>
                  typeof section === 'function' ? section() : section
              );

    const completeEntityConfig = {
        id: `${entityType}-${entityId}`,
        entityType,
        title: (entityConfig.metadata?.title as string) || entityName,
        description: (entityConfig.metadata?.description as string) || `View ${entityType} details`,
        entityName: (entityConfig.metadata?.entityName as string) || entityType,
        entityNamePlural: (entityConfig.metadata?.entityNamePlural as string) || `${entityType}s`,
        sections: currentSections, // ✅ Usar secciones filtradas por modo actual
        viewSections: entityConfig.viewSections.map((section) =>
            typeof section === 'function' ? section() : section
        ),
        editSections: entityConfig.editSections.map((section) =>
            typeof section === 'function' ? section() : section
        ),
        routes: {
            base: `/${entityType}s`,
            view: `/${entityType}s/$id`,
            edit: `/${entityType}s/$id/edit`,
            sections: {},
            editSections: {}
        },
        permissions: {
            view: ['view'],
            edit: ['edit'],
            create: ['create'],
            delete: ['delete']
        }
    };

    return (
        <div className={`space-y-6 ${className || ''}`}>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">
                                {mode === 'view' ? entityName : `Edit ${entityName}`}
                            </CardTitle>
                            <p className="text-gray-600">
                                {mode === 'view'
                                    ? `View ${entityType} details`
                                    : `Modify ${entityType} details`}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Navigation buttons */}
                            {mode === 'view' ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.history.back()}
                                    >
                                        <Icon
                                            name="arrow-left"
                                            className="mr-2 h-4 w-4"
                                        />
                                        Back
                                    </Button>
                                    {canEdit && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={goToEdit}
                                        >
                                            <Icon
                                                name="edit"
                                                className="mr-2 h-4 w-4"
                                            />
                                            Edit
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={goToView}
                                    >
                                        <Icon
                                            name="eye"
                                            className="mr-2 h-4 w-4"
                                        />
                                        View
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={goToList}
                                    >
                                        <Icon
                                            name="close"
                                            className="mr-2 h-4 w-4"
                                        />
                                        Cancel
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <EntityErrorBoundary>
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center p-8">
                                    <div className="h-6 w-6 animate-spin rounded-full border-blue-600 border-b-2" />
                                </div>
                            }
                        >
                            <EntityFormProvider
                                config={completeEntityConfig}
                                mode={mode === 'view' ? FormModeEnum.VIEW : FormModeEnum.EDIT}
                                initialValues={entity}
                                userPermissions={userPermissions}
                                onSave={handleSave}
                            >
                                {children}
                            </EntityFormProvider>
                        </Suspense>
                    </EntityErrorBoundary>
                </CardContent>
            </Card>
        </div>
    );
};
