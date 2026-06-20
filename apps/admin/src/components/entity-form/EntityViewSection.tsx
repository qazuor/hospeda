import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { CoordinatesValue } from '@/components/entity-form/fields/CoordinatesField';
import type { CurrencyValue } from '@/components/entity-form/fields/CurrencyField';
import type { GalleryImage } from '@/components/entity-form/fields/GalleryField';
import type { ImageValue } from '@/components/entity-form/fields/ImageField';
import type { VideoEntry } from '@/components/entity-form/fields/VideoGalleryField';
import {
    loadAccommodationsByIds,
    loadDestinationsByIds,
    loadEventLocationsByIds,
    loadEventOrganizersByIds,
    loadEventsByIds,
    loadPostSponsorshipsByIds,
    loadUsersByIds
} from '@/components/entity-form/fields/entity-selects/utils';
import type {
    EntitySelectFieldConfig,
    SelectFieldConfig,
    SelectOption
} from '@/components/entity-form/types/field-config.types';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { getFieldColSpanClass } from '@/components/entity-form/utils/field-grid.utils';
import {
    BooleanViewField,
    CurrencyViewField,
    EntitySelectViewField,
    GalleryViewField,
    I18nTextViewField,
    ImageViewField,
    RichTextViewField,
    SelectViewField,
    TextViewField,
    VideoGalleryViewField
} from '@/components/entity-form/views';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';
import { EditIcon, EyeIcon } from '@repo/icons';
import type { I18nText } from '@repo/schemas';
import * as React from 'react';

// Lazy-loaded so leaflet stays out of the components-entity-form chunk. The
// view path reuses the editable CoordinatesField (disabled), so without this it
// would drag leaflet back into the static bundle that EntityFormSection defers.
const LazyCoordinatesField = React.lazy(() =>
    import('@/components/entity-form/fields/CoordinatesField').then((m) => ({
        default: m.CoordinatesField
    }))
);

/**
 * Props for EntityViewSection component
 */
export interface EntityViewSectionProps {
    /** Section configuration */
    config: SectionConfig;
    /** Entity values */
    values: Record<string, unknown>;
    /** Additional CSS classes */
    className?: string;
    /** User permissions for permission checking */
    userPermissions?: string[];
    /** Current user for predicate evaluation */
    currentUser?: unknown;
    /** Entity data for predicate evaluation */
    entityData?: Record<string, unknown>;
    /** Whether to show edit-in-place controls */
    showEditControls?: boolean;
    /** Edit handler for edit-in-place */
    onEditField?: (fieldId: string) => void;
    /** Whether to show empty fields */
    showEmptyFields?: boolean;
    /** View mode */
    mode?: 'card' | 'list' | 'compact' | 'detailed';
}

/**
 * EntityViewSection component for rendering view sections
 * Handles section layout, permissions, and field display
 */
const EntityViewSectionComponent = React.forwardRef<HTMLDivElement, EntityViewSectionProps>(
    (
        {
            config,
            values,
            className,
            userPermissions = [],
            currentUser,
            entityData,
            showEditControls = false,
            onEditField,
            showEmptyFields = false,
            mode = 'card',
            ...props
        },
        ref
    ) => {
        const { t, tPlural } = useTranslations();

        // Use title and description directly from config (they are i18n keys)
        const title = config.title;
        const description = config.description;

        // Check section permissions
        const hasViewPermission = React.useMemo(() => {
            const result =
                !config.permissions?.view || config.permissions.view.length === 0
                    ? true
                    : config.permissions.view.some((permission) =>
                          userPermissions.includes(permission)
                      );

            return result;
        }, [config.permissions, userPermissions]);

        const hasEditPermission = React.useMemo(() => {
            if (!config.permissions?.edit || config.permissions.edit.length === 0) return false;
            return config.permissions.edit.some((permission) =>
                userPermissions.includes(permission)
            );
        }, [config.permissions, userPermissions]);

        // Check visibility conditions
        const isVisible = hasViewPermission;

        // Filter visible and accessible fields
        const visibleFields = React.useMemo(() => {
            const filtered = config.fields.filter((field) => {
                // Check field permissions
                if (field.permissions?.view && field.permissions.view.length > 0) {
                    const hasFieldPermission = field.permissions.view.some((permission) =>
                        userPermissions.includes(permission)
                    );
                    if (!hasFieldPermission) {
                        return false;
                    }
                }

                // Check if field has value or if we should show empty fields
                // Support nested field access (e.g., 'location.city' -> values.location.city)
                // biome-ignore lint/suspicious/noExplicitAny: Dynamic nested object access
                const getNestedValue = (obj: any, path: string): any => {
                    return path.split('.').reduce((current, key) => current?.[key], obj);
                };

                const fieldValue = field.id.includes('.')
                    ? getNestedValue(values, field.id)
                    : values[field.id];
                const hasValue =
                    fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

                if (!hasValue && !showEmptyFields) {
                    return false;
                }

                // TODO: Check field visibility conditions
                // For now, show all permitted fields
                return true;
            });

            return filtered;
        }, [config.fields, userPermissions, values, showEmptyFields]);

        // State for entity select options
        const [entitySelectOptions, setEntitySelectOptions] = React.useState<
            Record<string, SelectOption[]>
        >({});

        // Load options for ENTITY_SELECT fields
        React.useEffect(() => {
            const loadEntitySelectOptions = async () => {
                const entitySelectFields = visibleFields.filter(
                    (field) =>
                        field.type === FieldTypeEnum.ENTITY_SELECT ||
                        field.type === FieldTypeEnum.DESTINATION_SELECT ||
                        field.type === FieldTypeEnum.USER_SELECT ||
                        field.type === FieldTypeEnum.ACCOMMODATION_SELECT ||
                        field.type === FieldTypeEnum.EVENT_SELECT ||
                        field.type === FieldTypeEnum.EVENT_LOCATION_SELECT ||
                        field.type === FieldTypeEnum.EVENT_ORGANIZER_SELECT ||
                        field.type === FieldTypeEnum.POST_SELECT ||
                        field.type === FieldTypeEnum.POST_SPONSORSHIP_SELECT ||
                        field.type === FieldTypeEnum.FEATURE_SELECT ||
                        field.type === FieldTypeEnum.AMENITY_SELECT ||
                        field.type === FieldTypeEnum.TAG_SELECT
                );

                for (const field of entitySelectFields) {
                    const fieldValue = values[field.id];
                    if (!fieldValue) continue;

                    // Get load function based on field type
                    let loadByIdsFn: ((ids: string[]) => Promise<SelectOption[]>) | undefined;

                    if (field.type === FieldTypeEnum.ENTITY_SELECT) {
                        const entityConfig = field.typeConfig as EntitySelectFieldConfig;
                        loadByIdsFn = entityConfig?.loadByIdsFn;
                    } else if (field.type === FieldTypeEnum.DESTINATION_SELECT) {
                        loadByIdsFn = loadDestinationsByIds;
                    } else if (field.type === FieldTypeEnum.USER_SELECT) {
                        loadByIdsFn = loadUsersByIds;
                    } else if (field.type === FieldTypeEnum.ACCOMMODATION_SELECT) {
                        loadByIdsFn = loadAccommodationsByIds;
                    } else if (field.type === FieldTypeEnum.EVENT_SELECT) {
                        loadByIdsFn = loadEventsByIds;
                    } else if (field.type === FieldTypeEnum.EVENT_LOCATION_SELECT) {
                        loadByIdsFn = loadEventLocationsByIds;
                    } else if (field.type === FieldTypeEnum.EVENT_ORGANIZER_SELECT) {
                        loadByIdsFn = loadEventOrganizersByIds;
                    } else if (field.type === FieldTypeEnum.POST_SPONSORSHIP_SELECT) {
                        loadByIdsFn = loadPostSponsorshipsByIds;
                    }

                    if (!loadByIdsFn) continue;

                    const fieldValues = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
                    const stringValues = fieldValues.filter(
                        (v): v is string => typeof v === 'string'
                    );

                    if (stringValues.length === 0) continue;

                    try {
                        const options = await loadByIdsFn(stringValues);

                        setEntitySelectOptions((prev) => ({
                            ...prev,
                            [field.id]: options
                        }));
                    } catch (error) {
                        adminLogger.error(`Failed to load options for field ${field.id}`, error);
                    }
                }
            };

            loadEntitySelectOptions();
        }, [visibleFields, values]);

        // Dynamic view field component loading based on field type
        const renderViewField = (field: SectionConfig['fields'][0]) => {
            // Support nested field access (e.g., 'location.city' -> values.location.city)
            // biome-ignore lint/suspicious/noExplicitAny: Dynamic nested object access
            const getNestedValue = (obj: any, path: string): any => {
                return path.split('.').reduce((current, key) => current?.[key], obj);
            };

            const fieldValue = field.id.includes('.')
                ? getNestedValue(values, field.id)
                : values[field.id];

            // Check if field is editable for edit-in-place (computed inline — no hook needed)
            const isFieldEditable = (() => {
                if (field.readonly) return false;
                if (!hasEditPermission) return false;
                if (field.permissions?.edit && field.permissions.edit.length > 0) {
                    return field.permissions.edit.some((p) => userPermissions.includes(p));
                }
                return true;
            })();

            // Per spec §4.2 "ruido meta asimétrico":
            //   View → label + value only (no description paragraph).
            //   The description prop is intentionally NOT passed to view field components.
            const baseFieldProps = {
                config: field,
                className: field.className,
                showLabel: mode !== 'compact',
                showDescription: false // VIEW: description suppressed per redesign spec §4.2
            };

            // Derive col-span class from field type — same rule as edit mode (spec §4.2)
            const colSpan = getFieldColSpanClass(field.type);

            // Helper to wrap the rendered view component with the correct grid col-span
            const wrap = (content: React.ReactNode) => (
                <div
                    key={field.id}
                    className={colSpan}
                >
                    {content}
                </div>
            );

            // Render appropriate view component based on field type
            switch (field.type) {
                case FieldTypeEnum.TEXT:
                case FieldTypeEnum.EMAIL:
                case FieldTypeEnum.URL:
                case FieldTypeEnum.TEXTAREA:
                case FieldTypeEnum.NUMBER:
                case FieldTypeEnum.DATE:
                case FieldTypeEnum.TIME:
                case FieldTypeEnum.PHONE:
                    return wrap(
                        <TextViewField
                            {...baseFieldProps}
                            value={fieldValue as string}
                        />
                    );

                case FieldTypeEnum.SELECT:
                case FieldTypeEnum.RADIO:
                    return wrap(
                        <SelectViewField
                            {...baseFieldProps}
                            value={fieldValue as string}
                            options={
                                field.type === FieldTypeEnum.SELECT
                                    ? (field.typeConfig as SelectFieldConfig)?.options || []
                                    : []
                            }
                        />
                    );

                case FieldTypeEnum.SWITCH:
                case FieldTypeEnum.CHECKBOX:
                    return wrap(
                        <BooleanViewField
                            {...baseFieldProps}
                            value={fieldValue as boolean}
                        />
                    );

                case FieldTypeEnum.ENTITY_SELECT:
                case FieldTypeEnum.DESTINATION_SELECT:
                case FieldTypeEnum.USER_SELECT:
                case FieldTypeEnum.ACCOMMODATION_SELECT:
                case FieldTypeEnum.EVENT_SELECT:
                case FieldTypeEnum.EVENT_LOCATION_SELECT:
                case FieldTypeEnum.EVENT_ORGANIZER_SELECT:
                case FieldTypeEnum.POST_SELECT:
                case FieldTypeEnum.POST_SPONSORSHIP_SELECT:
                case FieldTypeEnum.FEATURE_SELECT:
                case FieldTypeEnum.AMENITY_SELECT:
                case FieldTypeEnum.TAG_SELECT:
                    return wrap(
                        <EntitySelectViewField
                            {...baseFieldProps}
                            value={fieldValue as string}
                            options={entitySelectOptions[field.id] || []}
                            loading={!entitySelectOptions[field.id] && !!fieldValue}
                        />
                    );

                case FieldTypeEnum.CURRENCY:
                    return wrap(
                        <CurrencyViewField
                            {...baseFieldProps}
                            value={fieldValue as CurrencyValue}
                        />
                    );

                case FieldTypeEnum.RICH_TEXT:
                    return wrap(
                        <RichTextViewField
                            {...baseFieldProps}
                            value={fieldValue as string}
                        />
                    );

                case FieldTypeEnum.COORDINATES:
                    // View mode reuses the editable component with disabled=true so
                    // the user still sees the map + pin at the right location. Lazy
                    // so leaflet only loads when a coordinates field is rendered.
                    return wrap(
                        <React.Suspense
                            fallback={<div className="h-64 animate-pulse rounded bg-muted" />}
                        >
                            <LazyCoordinatesField
                                {...baseFieldProps}
                                value={fieldValue as CoordinatesValue | undefined}
                                disabled
                            />
                        </React.Suspense>
                    );

                case FieldTypeEnum.IMAGE:
                    return wrap(
                        <ImageViewField
                            {...baseFieldProps}
                            value={fieldValue as ImageValue}
                        />
                    );

                case FieldTypeEnum.GALLERY:
                    return wrap(
                        <GalleryViewField
                            {...baseFieldProps}
                            value={fieldValue as GalleryImage[]}
                        />
                    );

                case FieldTypeEnum.VIDEO_GALLERY:
                    return wrap(
                        <VideoGalleryViewField
                            {...baseFieldProps}
                            value={fieldValue as VideoEntry[]}
                        />
                    );

                case FieldTypeEnum.I18N_TEXT:
                case FieldTypeEnum.I18N_TEXTAREA:
                    return wrap(
                        <I18nTextViewField
                            {...baseFieldProps}
                            value={fieldValue as Partial<I18nText> | null | undefined}
                        />
                    );

                case FieldTypeEnum.JSON: {
                    // Structured object/array fields (e.g. commerce openingHours)
                    // are shown read-only as pretty-printed JSON. Rendering the raw
                    // object as a React child crashes ("Objects are not valid as a
                    // React child"); stringifying is the safe, generic fallback.
                    const jsonText =
                        fieldValue == null
                            ? ''
                            : typeof fieldValue === 'string'
                              ? fieldValue
                              : JSON.stringify(fieldValue, null, 2);
                    return wrap(
                        <div className="space-y-1">
                            {field.label && (
                                <div className="font-medium text-muted-foreground text-sm">
                                    {field.label}
                                </div>
                            )}
                            {jsonText ? (
                                <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                                    {jsonText}
                                </pre>
                            ) : (
                                <div className="text-muted-foreground text-sm italic">
                                    {t('admin-common.entityView.noValue')}
                                </div>
                            )}
                        </div>
                    );
                }

                default:
                    // Fallback for unknown field types — still respects grid span via `wrap()`
                    return wrap(
                        <div
                            className={cn(
                                'space-y-1',
                                mode === 'card' && 'rounded-lg border p-3',
                                mode === 'list' && 'border-b py-2 last:border-b-0',
                                mode === 'compact' && 'flex items-center justify-between'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="font-medium text-muted-foreground text-sm">
                                        {field.id}
                                    </div>
                                    <div className="text-sm">
                                        {String(fieldValue) || (
                                            <span className="text-muted-foreground italic">
                                                {t('admin-common.entityView.noValue')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        Unknown type: {field.type}
                                    </div>
                                </div>

                                {/* Edit Controls */}
                                {showEditControls && isFieldEditable && onEditField && (
                                    <button
                                        type="button"
                                        onClick={() => onEditField(field.id)}
                                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                        title={t('ui.actions.editField')}
                                    >
                                        <EditIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
            }
        };

        // Render section content based on layout.
        //
        // Per spec §4.2 — same grid rule as edit mode:
        //   Default: 2-column grid + items-start (error messages on one field don't
        //   push its grid neighbor down). Mobile → 1 column.
        const renderSectionContent = () => {
            if (config.layout === 'TABS') {
                // TABS layout: stacked (nested sections own their layout)
                return <div className="space-y-4">{visibleFields.map(renderViewField)}</div>;
            }

            if (mode === 'list' || mode === 'compact') {
                // List/compact modes keep the original stacked layout for density
                return (
                    <div
                        className={cn(
                            mode === 'list' && 'divide-y',
                            mode === 'compact' && 'space-y-2'
                        )}
                    >
                        {visibleFields.map(renderViewField)}
                    </div>
                );
            }

            // Default (card/detailed): 2-column responsive grid with top alignment
            return (
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                    {visibleFields.map(renderViewField)}
                </div>
            );
        };

        if (!isVisible) {
            return null;
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'space-y-4',
                    mode === 'card' && 'rounded-lg border bg-card p-6',
                    mode === 'list' && 'rounded-lg border bg-card p-4',
                    mode === 'compact' && 'space-y-2',
                    className
                )}
                {...props}
            >
                {/* Section Header */}
                {(title || description) && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            {title && (
                                <h2
                                    className={cn(
                                        'font-semibold leading-none tracking-tight',
                                        mode === 'card' && 'text-lg',
                                        mode === 'list' && 'text-base',
                                        mode === 'compact' && 'text-sm'
                                    )}
                                >
                                    {title}
                                </h2>
                            )}

                            {/* Section Actions */}
                            <div className="flex items-center gap-2">
                                <EyeIcon className="h-4 w-4 text-muted-foreground" />
                                {hasEditPermission && showEditControls && (
                                    <EditIcon className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </div>

                        {description && mode !== 'compact' && (
                            <p className="text-muted-foreground text-sm">{description}</p>
                        )}
                    </div>
                )}

                {/* Section Content */}
                <div className={config.className}>{renderSectionContent()}</div>

                {/* Section Footer Info */}
                {visibleFields.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        {showEmptyFields
                            ? t('admin-common.entityForm.noAccessibleFields')
                            : t('admin-common.entityForm.noDataToDisplay')}
                    </div>
                )}

                {/* Section Stats */}
                {mode === 'card' && visibleFields.length > 0 && (
                    <div className="border-t pt-2 text-muted-foreground text-xs">
                        {tPlural('admin-common.entityView.fieldsDisplayed', visibleFields.length)}
                        {hasEditPermission && ` • ${t('admin-common.entityView.editable')}`}
                    </div>
                )}
            </div>
        );
    }
);

EntityViewSectionComponent.displayName = 'EntityViewSection';

/**
 * Memoized EntityViewSection component
 * Only re-renders when props actually change
 */
export const EntityViewSection = React.memo(EntityViewSectionComponent, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
        prevProps.config.id === nextProps.config.id &&
        prevProps.className === nextProps.className &&
        prevProps.values === nextProps.values &&
        prevProps.userPermissions === nextProps.userPermissions &&
        prevProps.currentUser === nextProps.currentUser &&
        prevProps.entityData === nextProps.entityData
    );
});
