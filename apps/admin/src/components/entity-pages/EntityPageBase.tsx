import { EntityFormProvider, FormModeEnum } from '@/components/entity-form';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import {
    prepareFormValues,
    unflattenValues
} from '@/components/entity-form/utils/unflatten-values.utils';
import {
    EntityPageHeader,
    type EntityPageHeaderMedia
} from '@/components/entity-header/EntityPageHeader';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import { LoaderIcon } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import React, { Suspense, type ReactNode } from 'react';
import type { ZodSchema } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a (possibly dot-notation) field value from the live form state.
 * Mirrors `EntityFormSection.readValue` so the save path picks up the same
 * "nested-first" value the inputs render against. Returns `undefined` when
 * neither the nested path nor the flat literal key carry a value.
 */
function readFieldValueForSave(source: Record<string, unknown>, id: string): unknown {
    if (!id.includes('.')) return source[id];
    const parts = id.split('.');
    let current: unknown = source;
    for (const part of parts) {
        if (current === null || current === undefined) {
            current = undefined;
            break;
        }
        current = (current as Record<string, unknown>)[part];
    }
    if (current !== undefined) return current;
    return source[id];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
    /** Optional Zod schema for form validation */
    zodSchema?: ZodSchema;
    /**
     * Optional media (thumbnail/avatar) for the EntityPageHeader.
     * When omitted, the header renders without a media slot.
     */
    headerMedia?: EntityPageHeaderMedia;
    /**
     * Optional subtitle for the EntityPageHeader (e.g. "Hotel · Gualeguaychú").
     * When omitted, no subtitle is shown.
     */
    headerSubtitle?: string;
    /**
     * Optional status badges for the EntityPageHeader.
     * Pass pre-rendered React nodes (Badge components).
     */
    headerBadges?: ReactNode;
    /**
     * Slot for the quality score widget.
     * Pass `null` for entities without a score (users, catalogs).
     *
     * Accepts either a static `ReactNode` or a render function that receives
     * the current header reduced state so the widget can swap to its compact
     * variant when the header shrinks on scroll. The flag is provided by the
     * EntityPageHeader's scroll-shrink hook downstream.
     */
    qualityScore?: ReactNode | ((options: { readonly isReduced: boolean }) => ReactNode);
    /**
     * Extra header actions (e.g. impersonate, delete). Rendered to the left of
     * the mode-specific action set, with a divider between them.
     *
     * Forwarded as-is to `EntityPageHeader.extraActions`.
     */
    headerExtraActions?: ReactNode;
    /**
     * Tab navigation rendered as a sticky strip below the main header row.
     * Stays visible while the header is in reduced (scrolled) state.
     *
     * Forwarded as-is to `EntityPageHeader.tabs`. Pass a `<PageTabs>` element.
     */
    headerTabs?: ReactNode;
    /**
     * Optional extra data to merge into the save payload before the mutation call.
     * Use for write-only fields that live outside the form schema
     * (e.g. client-side audit metadata like `aiAssistedFields`).
     *
     * Accepts either a static object or a lazy-evaluated function.
     * Use a function when the values come from a mutable ref that changes
     * between render and save time.
     */
    extraSavePayload?: Record<string, unknown> | (() => Record<string, unknown>);
    /**
     * Optional callback invoked after a successful save (before navigating away).
     * Use for cleanup such as clearing client-side refs.
     */
    onSaveSuccess?: () => void;
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

// ---------------------------------------------------------------------------
// EntityPageBase
// ---------------------------------------------------------------------------

/**
 * Base component for entity pages (view and edit).
 *
 * Handles common logic: permissions, configuration, state, errors and form
 * provider. Renders an EntityPageHeader (sticky, with mode-specific actions)
 * and wraps children in an EntityFormProvider.
 *
 * The old Card/CardHeader layout is replaced by EntityPageHeader.
 * SmartNavigation / PageTabs / SmartBreadcrumbs are no longer rendered here —
 * EntityViewContent and EntityEditContent use a SectionAccordion instead.
 */
export const EntityPageBase = <T = Record<string, unknown>>({
    entityType,
    entityId,
    initialMode = 'view',
    children,
    className,
    zodSchema,
    headerMedia,
    headerSubtitle,
    headerBadges,
    qualityScore = null,
    headerExtraActions,
    headerTabs,
    extraSavePayload,
    onSaveSuccess,
    entityData
}: EntityPageBaseProps<T>) => {
    const { t } = useTranslations();

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
        goToView,
        goToEdit,
        updateMutation
    } = entityData;

    // Set initial mode once
    React.useEffect(() => {
        setMode(initialMode);
    }, [initialMode, setMode]);

    // ------------------------------------------------------------------
    // Save handler
    // ------------------------------------------------------------------
    const handleSave = React.useCallback(
        async (values: Record<string, unknown>) => {
            adminLogger.debug('[EntityPageBase] All form values', values);

            const fieldsToSave: Record<string, unknown> = {};
            const allFields = entityConfig.editSections.flatMap((section) => {
                const sectionConfig = typeof section === 'function' ? section() : section;
                return sectionConfig.fields;
            });

            for (const field of allFields) {
                // Mirror EntityFormSection.readValue: for dot-notation ids the
                // nested copy is the authoritative one (TanStack Form writes
                // there). Falling back to the flat literal key avoids losing
                // values that were never touched after initial seeding.
                const fresh = readFieldValueForSave(values, field.id);
                if (fresh !== undefined) {
                    fieldsToSave[field.id] = fresh;
                }
            }

            const payload = unflattenValues(fieldsToSave);

            // Merge optional extra save payload (e.g. aiAssistedFields audit metadata).
            // Supports both static objects and lazy-evaluated functions for ref-based data.
            const extraData =
                typeof extraSavePayload === 'function' ? extraSavePayload() : extraSavePayload;
            if (extraData) {
                Object.assign(payload, extraData);
            }

            adminLogger.debug('[EntityPageBase] Filtered values for API', payload);

            await updateMutation.mutateAsync(payload);
            onSaveSuccess?.();
            goToView();
        },
        [updateMutation, goToView, entityConfig.editSections, extraSavePayload, onSaveSuccess]
    );

    // ------------------------------------------------------------------
    // Prepare initial form values
    // ------------------------------------------------------------------
    const preparedValues = React.useMemo(() => {
        if (!entity) return {};
        const entityRecord = entity as Record<string, unknown>;

        const editSections = entityConfig.editSections.map((section) =>
            typeof section === 'function' ? section() : section
        );
        const allFieldIds = editSections
            .flatMap((section) => section.fields || [])
            .map((field) => field.id);

        return prepareFormValues(entityRecord, allFieldIds);
    }, [entity, entityConfig.editSections]);

    // ------------------------------------------------------------------
    // Loading / error / not-found states
    // ------------------------------------------------------------------
    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <h1 className="sr-only">{t('admin-common.states.loading')}</h1>
                <div className="text-center">
                    <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground text-sm">
                        {t('admin-common.states.loading')}
                    </p>
                </div>
            </div>
        );
    }

    if (error) throw error;
    if (!entity) throw new Error(`${entityType} not found`);
    if (!canView) throw new Error('You do not have permission to view this resource');

    // ------------------------------------------------------------------
    // Derive entity name for display
    // ------------------------------------------------------------------
    const entityRecord = entity as Record<string, unknown>;
    const entityName =
        (entityRecord?.name as string) ||
        (entityRecord?.placeName as string) ||
        (entityRecord?.title as string) ||
        (entityRecord?.displayName as string) ||
        (entityConfig.metadata?.entityName as string) ||
        entityType;

    // ------------------------------------------------------------------
    // Build complete entity config
    // ------------------------------------------------------------------
    const currentSections =
        mode === 'view'
            ? entityConfig.viewSections.map((s) => (typeof s === 'function' ? s() : s))
            : entityConfig.editSections.map((s) => (typeof s === 'function' ? s() : s));

    const completeEntityConfig = {
        id: `${entityType}-${entityId}`,
        entityType,
        title: (entityConfig.metadata?.title as string) || entityName,
        description:
            (entityConfig.metadata?.description as string) ||
            t('admin-common.entityPage.viewDescription').replace('{entity}', entityType),
        entityName: (entityConfig.metadata?.entityName as string) || entityType,
        entityNamePlural: (entityConfig.metadata?.entityNamePlural as string) || `${entityType}s`,
        sections: currentSections,
        viewSections: entityConfig.viewSections.map((s) => (typeof s === 'function' ? s() : s)),
        editSections: entityConfig.editSections.map((s) => (typeof s === 'function' ? s() : s)),
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

    // ------------------------------------------------------------------
    // Header title text (for EntityPageHeader and sr-only h1)
    // ------------------------------------------------------------------
    const pageTitleText =
        mode === 'view'
            ? entityName
            : t('admin-common.entityPage.editTitle').replace('{entity}', entityName);

    return (
        <div className={`space-y-4 p-6 ${className ?? ''}`}>
            {/* Accessible sr-only h1 — always present, even during loading */}
            <h1 className="sr-only">{pageTitleText}</h1>

            {/* ---- Form provider wraps header + children so widgets inside the
                  header (notably QualityScore) can subscribe to live form state
                  via useEntityFormContext. ---- */}
            <EntityErrorBoundary>
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center p-8">
                            <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    }
                >
                    <EntityFormProvider
                        config={completeEntityConfig}
                        mode={mode === 'view' ? FormModeEnum.VIEW : FormModeEnum.EDIT}
                        initialValues={preparedValues}
                        userPermissions={userPermissions}
                        onSave={handleSave}
                        zodSchema={zodSchema}
                    >
                        {/* ---- Sticky hybrid header ---- */}
                        <EntityPageHeader
                            mode={mode}
                            title={pageTitleText}
                            subtitle={headerSubtitle}
                            badges={headerBadges}
                            media={headerMedia}
                            qualityScore={qualityScore}
                            extraActions={headerExtraActions}
                            tabs={headerTabs}
                            viewActions={
                                mode === 'view'
                                    ? {
                                          onBack: () => window.history.back(),
                                          onEdit: canEdit ? goToEdit : () => undefined
                                      }
                                    : undefined
                            }
                            editActions={
                                mode === 'edit'
                                    ? {
                                          onCancel: goToView,
                                          // Actual save is triggered by form submit;
                                          // the button calls handleSave indirectly via the
                                          // EntityFormProvider's save() which is wired in
                                          // EntityEditContent. Dirty state is unknown here
                                          // (it lives in the form context); left as `false`
                                          // until a lifting mechanism is added.
                                          isDirty: false,
                                          isSaving: updateMutation.isLoading
                                      }
                                    : undefined
                            }
                        />

                        {children}
                    </EntityFormProvider>
                </Suspense>
            </EntityErrorBoundary>
        </div>
    );
};
