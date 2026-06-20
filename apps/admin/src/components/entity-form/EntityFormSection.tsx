import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import {
    AccommodationSelectField,
    AmenitySelectField,
    CheckboxField,
    CurrencyField,
    // Specific entity select fields
    DestinationSelectField,
    EntitySelectField,
    EventLocationSelectField,
    EventOrganizerSelectField,
    EventSelectField,
    FeatureSelectField,
    I18nTextField,
    PostSponsorshipSelectField,
    SelectField,
    SwitchField,
    TextField,
    TextareaField,
    UserSelectField
} from '@/components/entity-form/fields';
import type { CoordinatesValue } from '@/components/entity-form/fields/CoordinatesField';
import type { CurrencyValue } from '@/components/entity-form/fields/CurrencyField';
import type { GalleryImage } from '@/components/entity-form/fields/GalleryField';
import type { ImageValue } from '@/components/entity-form/fields/ImageField';
import type { VideoEntry } from '@/components/entity-form/fields/VideoGalleryField';
import type { SelectFieldConfig } from '@/components/entity-form/types/field-config.types';
import { getFieldColSpanClass } from '@/components/entity-form/utils/field-grid.utils';
import type { I18nText } from '@repo/schemas';

// Heavy field components — lazy-loaded so tiptap/leaflet/upload don't sit in
// the components-entity chunk. Each becomes its own async chunk loaded only
// when a form actually renders that field type.
const LazyRichTextField = React.lazy(() =>
    import('./fields/RichTextField').then((m) => ({ default: m.RichTextField }))
);
const LazyCoordinatesField = React.lazy(() =>
    import('./fields/CoordinatesField').then((m) => ({ default: m.CoordinatesField }))
);
const LazyImageField = React.lazy(() =>
    import('./fields/ImageField').then((m) => ({ default: m.ImageField }))
);
const LazyGalleryField = React.lazy(() =>
    import('./fields/GalleryField').then((m) => ({ default: m.GalleryField }))
);
const LazyVideoGalleryField = React.lazy(() =>
    import('./fields/VideoGalleryField').then((m) => ({ default: m.VideoGalleryField }))
);

/**
 * Per-field upload/delete handlers for media fields (e.g., GalleryField).
 * Keys are field IDs; values are the handler callbacks.
 */
export interface FieldMediaHandlers {
    /** Called when a file is selected for upload. Should return the uploaded image URL. */
    onUpload?: (file: File) => Promise<string>;
    /** Called with the Cloudinary publicId before removing an image. */
    onDelete?: (publicId: string) => Promise<void>;
}
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { LimitProgressIndicator } from '@/features/billing/LimitProgressIndicator';
import { PremiumBlock, type PremiumBlockItem } from '@/features/billing/PremiumBlock';
import { useMyEntitlements } from '@/features/billing/use-my-entitlements';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for EntityFormSection component
 */
export interface EntityFormSectionProps {
    /** Section configuration */
    config: SectionConfig;
    /** Form values */
    values: Record<string, unknown>;
    /** Form errors */
    errors: Record<string, string | undefined>;
    /** Field change handler */
    onFieldChange: (fieldId: string, value: unknown) => void;
    /** Field blur handler */
    onFieldBlur: (fieldId: string) => void;
    /** Whether the section is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** User permissions for permission checking */
    userPermissions?: string[];
    /** Current user for predicate evaluation */
    currentUser?: unknown;
    /** Entity data for predicate evaluation */
    entityData?: Record<string, unknown>;
    /**
     * Per-field media handlers keyed by fieldId.
     * Passed to GalleryField (and other media fields) for upload/delete wiring.
     */
    fieldHandlers?: Record<string, FieldMediaHandlers>;
    /**
     * Optional per-field addon nodes keyed by fieldId.
     * Rendered below the field component inside the same grid cell.
     * Used by SPEC-198 to mount the AiTextImprovePanel alongside
     * description and summary fields without modifying the field components.
     */
    fieldAddons?: Readonly<Record<string, React.ReactNode>>;
}

/**
 * EntityFormSection component for rendering form sections
 * Handles section layout, permissions, and field rendering
 */
const EntityFormSectionComponent = React.forwardRef<HTMLDivElement, EntityFormSectionProps>(
    (
        {
            config,
            values,
            errors,
            onFieldChange,
            onFieldBlur,
            disabled = false,
            className,
            userPermissions = [],
            currentUser,
            entityData,
            fieldHandlers,
            fieldAddons,
            ...props
        },
        ref
    ) => {
        const { t } = useTranslations();
        // Use title and description directly from config (they are i18n keys)
        const title = config.title;
        const description = config.description;

        // Premium-feature classification (spec §4.7 sabor 1): a field is
        // "premium-locked" only when the actor lacks the entitlement. The
        // resolver is the single source of truth (SPEC-171): staff receive
        // every entitlement so `hasEntitlement` → true and nothing locks;
        // HOSTs depend on their plan. We fail-open while loading to avoid
        // flashing the locked state.
        const { has: hasEntitlement, isLoading: entitlementsLoading } = useMyEntitlements();
        const isFieldPremiumLocked = React.useCallback(
            (entitlementKey: string | undefined): boolean => {
                if (!entitlementKey) return false;
                if (entitlementsLoading) return false;
                return !hasEntitlement(entitlementKey);
            },
            [hasEntitlement, entitlementsLoading]
        );

        // Check section permissions
        const hasViewPermission = React.useMemo(() => {
            if (!config.permissions?.view || config.permissions.view.length === 0) return true;
            return config.permissions.view.some((permission) =>
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
                    if (!hasFieldPermission) return false;
                }

                // TODO: Check field visibility conditions
                // For now, show all permitted fields
                return true;
            });

            return filtered;
        }, [config.fields, userPermissions]);

        // Dynamic import of field components based on type
        const renderField = (field: SectionConfig['fields'][0]) => {
            // Support both flat and nested storage for dotted field ids.
            // Flat is the canonical write path (EntityCreateContent stores values
            // by dotted key, e.g. values["location.country"]); nested is the
            // fallback for hosts that keep a nested object tree (TanStack Form in
            // EntityEditContent, where values.location.country is the live value).
            // biome-ignore lint/suspicious/noExplicitAny: Dynamic nested object access
            const getNestedValue = (obj: any, path: string): any => {
                return path.split('.').reduce((current, key) => current?.[key], obj);
            };

            const readValue = (source: Record<string, unknown>, id: string): unknown => {
                if (!id.includes('.')) return source[id];
                // For dot-notation ids: TanStack Form treats the name as a NESTED
                // path on writes (`setFieldValue("a.b", v)` updates `values.a.b`),
                // so the nested location is the freshest copy. `prepareFormValues`
                // also seeds a flat literal key at first load — fall back to it
                // only when the nested path resolves to undefined.
                const nested = getNestedValue(source, id);
                if (nested !== undefined) return nested;
                return source[id];
            };

            const rawFieldValue = readValue(values, field.id);

            // Coalesce null to empty string for text-based fields to avoid React warning:
            // "value prop on input should not be null"
            const textFieldTypes = new Set([
                FieldTypeEnum.TEXT,
                FieldTypeEnum.TEXTAREA,
                FieldTypeEnum.EMAIL,
                FieldTypeEnum.PHONE,
                FieldTypeEnum.URL,
                FieldTypeEnum.NUMBER,
                FieldTypeEnum.DATE,
                FieldTypeEnum.TIME
            ]);
            const fieldValue =
                rawFieldValue === null && textFieldTypes.has(field.type) ? '' : rawFieldValue;

            const fieldError = readValue(errors, field.id) as string | undefined;
            const hasError = Boolean(fieldError);

            // Field props for dynamic field component loading
            const fieldProps = {
                config: field,
                value: fieldValue,
                onChange: (value: unknown) => onFieldChange(field.id, value),
                onBlur: () => onFieldBlur(field.id),
                hasError,
                errorMessage: fieldError,
                disabled: disabled, // Use section disabled state
                required: field.required,
                className: field.className
            };

            // Dynamic field component loading based on field.type
            const renderFieldComponent = () => {
                switch (field.type) {
                    case FieldTypeEnum.TEXT:
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.TEXTAREA:
                        return (
                            <TextareaField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.SELECT:
                        return (
                            <SelectField
                                {...fieldProps}
                                value={fieldValue as string}
                                options={
                                    field.type === FieldTypeEnum.SELECT
                                        ? (field.typeConfig as SelectFieldConfig)?.options || []
                                        : []
                                }
                            />
                        );

                    case FieldTypeEnum.ENTITY_SELECT:
                        return (
                            <EntitySelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    // Specific entity select fields with encapsulated logic
                    case FieldTypeEnum.DESTINATION_SELECT:
                        return (
                            <DestinationSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.USER_SELECT:
                        return (
                            <UserSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.ACCOMMODATION_SELECT:
                        return (
                            <AccommodationSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.EVENT_SELECT:
                        return (
                            <EventSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.EVENT_LOCATION_SELECT:
                        return (
                            <EventLocationSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.EVENT_ORGANIZER_SELECT:
                        return (
                            <EventOrganizerSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.AMENITY_SELECT:
                        return (
                            <AmenitySelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.FEATURE_SELECT:
                        return (
                            <FeatureSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.POST_SPONSORSHIP_SELECT:
                        return (
                            <PostSponsorshipSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.CURRENCY:
                        return (
                            <CurrencyField
                                {...fieldProps}
                                value={fieldValue as CurrencyValue}
                            />
                        );

                    case FieldTypeEnum.RICH_TEXT:
                        return (
                            <React.Suspense
                                fallback={<div className="h-10 animate-pulse rounded bg-muted" />}
                            >
                                <LazyRichTextField
                                    {...fieldProps}
                                    value={fieldValue as string}
                                />
                            </React.Suspense>
                        );

                    case FieldTypeEnum.COORDINATES:
                        return (
                            <React.Suspense
                                fallback={<div className="h-64 animate-pulse rounded bg-muted" />}
                            >
                                <LazyCoordinatesField
                                    {...fieldProps}
                                    value={fieldValue as CoordinatesValue | undefined}
                                />
                            </React.Suspense>
                        );

                    case FieldTypeEnum.IMAGE:
                        return (
                            <React.Suspense
                                fallback={<div className="h-40 animate-pulse rounded bg-muted" />}
                            >
                                <LazyImageField
                                    {...fieldProps}
                                    value={fieldValue as ImageValue}
                                />
                            </React.Suspense>
                        );

                    case FieldTypeEnum.GALLERY: {
                        const galleryHandlers = fieldHandlers?.[field.id];
                        return (
                            <React.Suspense
                                fallback={<div className="h-40 animate-pulse rounded bg-muted" />}
                            >
                                <LazyGalleryField
                                    {...fieldProps}
                                    value={fieldValue as GalleryImage[]}
                                    onUpload={galleryHandlers?.onUpload}
                                    onDelete={galleryHandlers?.onDelete}
                                />
                            </React.Suspense>
                        );
                    }

                    case FieldTypeEnum.VIDEO_GALLERY:
                        return (
                            <React.Suspense
                                fallback={<div className="h-40 animate-pulse rounded bg-muted" />}
                            >
                                <LazyVideoGalleryField
                                    {...fieldProps}
                                    value={fieldValue as VideoEntry[]}
                                />
                            </React.Suspense>
                        );

                    case FieldTypeEnum.CHECKBOX:
                        return (
                            <CheckboxField
                                {...fieldProps}
                                value={fieldValue as boolean}
                            />
                        );

                    case FieldTypeEnum.SWITCH:
                        return (
                            <SwitchField
                                {...fieldProps}
                                value={fieldValue as boolean}
                            />
                        );

                    case FieldTypeEnum.NUMBER: {
                        // SPEC-117 D-DISPLAYWEIGHT.1 — pass native min/max/step
                        // from typeConfig so browsers enforce numeric input.
                        const numericConfig = field.typeConfig as
                            | { min?: number; max?: number; step?: number }
                            | undefined;
                        return (
                            <TextField
                                {...fieldProps}
                                type="number"
                                min={numericConfig?.min}
                                max={numericConfig?.max}
                                step={numericConfig?.step}
                                value={
                                    fieldValue === null || fieldValue === undefined
                                        ? ''
                                        : String(fieldValue)
                                }
                                onChange={(value: unknown) => {
                                    const strVal = String(value).trim();
                                    const numVal = strVal === '' ? undefined : Number(strVal);
                                    onFieldChange(
                                        field.id,
                                        numVal !== undefined && !Number.isNaN(numVal)
                                            ? numVal
                                            : value
                                    );
                                }}
                            />
                        );
                    }

                    case FieldTypeEnum.DATE:
                        // Use TextField for dates for now
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.TIME:
                        // Use TextField for time for now
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.URL:
                    case FieldTypeEnum.EMAIL:
                    case FieldTypeEnum.PHONE:
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.JSON: {
                        const jsonStringValue =
                            typeof fieldValue === 'string'
                                ? fieldValue
                                : fieldValue != null
                                  ? JSON.stringify(fieldValue, null, 2)
                                  : '';
                        return (
                            <TextareaField
                                {...fieldProps}
                                value={jsonStringValue}
                            />
                        );
                    }

                    case FieldTypeEnum.FILE:
                        return (
                            <div className="space-y-2 rounded-md border border-dashed p-4">
                                <div className="font-medium text-sm">{field.label || field.id}</div>
                                <div className="text-muted-foreground text-xs">
                                    {t('admin-entities.fields.fileUploadNotImplemented')}
                                </div>
                            </div>
                        );

                    case FieldTypeEnum.I18N_TEXT:
                        return (
                            <I18nTextField
                                config={field}
                                value={fieldValue as Partial<I18nText> | null | undefined}
                                onChange={(v) => onFieldChange(field.id, v)}
                                onBlur={() => onFieldBlur(field.id)}
                                hasError={hasError}
                                errorMessage={fieldError}
                                localeErrors={{
                                    es: readValue(errors, `${field.id}.es`) as string | undefined,
                                    en: readValue(errors, `${field.id}.en`) as string | undefined,
                                    pt: readValue(errors, `${field.id}.pt`) as string | undefined
                                }}
                                disabled={disabled}
                                required={field.required}
                                className={field.className}
                                multiline={false}
                                maxLength={
                                    (field.typeConfig as { maxLength?: number } | undefined)
                                        ?.maxLength
                                }
                            />
                        );

                    case FieldTypeEnum.I18N_TEXTAREA:
                        return (
                            <I18nTextField
                                config={field}
                                value={fieldValue as Partial<I18nText> | null | undefined}
                                onChange={(v) => onFieldChange(field.id, v)}
                                onBlur={() => onFieldBlur(field.id)}
                                hasError={hasError}
                                errorMessage={fieldError}
                                localeErrors={{
                                    es: readValue(errors, `${field.id}.es`) as string | undefined,
                                    en: readValue(errors, `${field.id}.en`) as string | undefined,
                                    pt: readValue(errors, `${field.id}.pt`) as string | undefined
                                }}
                                disabled={disabled}
                                required={field.required}
                                className={field.className}
                                multiline={true}
                                rows={
                                    (field.typeConfig as { minRows?: number } | undefined)
                                        ?.minRows ?? 2
                                }
                                maxLength={
                                    (field.typeConfig as { maxLength?: number } | undefined)
                                        ?.maxLength
                                }
                            />
                        );

                    default:
                        // Fallback for unknown field types
                        return (
                            <div className="space-y-2 border p-4">
                                <div className="font-medium text-sm">{field.id}</div>
                                <div className="text-muted-foreground text-xs">
                                    {t('admin-entities.fields.unknownFieldType', {
                                        type: field.type
                                    })}
                                </div>
                            </div>
                        );
                }
            };

            const fieldContent = renderFieldComponent();

            // Derive the col-span CSS class automatically from field type.
            // Per spec §4.2: span comes from TYPE, not per-field micro-config.
            const colSpanClass = getFieldColSpanClass(field.type);

            // Spec §4.7 sabor 1: premium-locked fields are NOT rendered in the
            // grid — they are collected and surfaced together in a single
            // PremiumBlock at the bottom of the section, far from editable
            // fields. The collection happens below in the section render
            // function; here we just signal "skip me" with `null`.
            if (field.entitlementKey && isFieldPremiumLocked(field.entitlementKey)) {
                return null;
            }

            if (field.limitKey) {
                // Derive current count from the field's live value:
                // - Array fields (e.g. gallery): count of uploaded items.
                // - Other field types should not set limitKey; default to 0.
                const currentFieldCount = Array.isArray(rawFieldValue) ? rawFieldValue.length : 0;

                // Spec §4.7 sabor 2: show a soft progress indicator ABOVE the
                // resource ("junto al recurso que limita"), not as a replacement
                // for it. The previous PlanLimitGate wrapped the field and hid
                // it entirely at the cap, which surprised hosts and conflicted
                // with the spec. Server-side enforcement (e.g. enforcePhotoLimit
                // on POST /admin/media/upload) remains authoritative; this
                // indicator is the proactive UX signal.
                return (
                    <div
                        key={field.id}
                        className={cn(colSpanClass, 'space-y-2')}
                    >
                        <LimitProgressIndicator
                            limitKey={field.limitKey}
                            currentCount={currentFieldCount}
                            resourceLabel={field.label || field.id}
                        />
                        {fieldContent}
                        {fieldAddons?.[field.id]}
                    </div>
                );
            }

            return (
                <div
                    key={field.id}
                    className={cn(colSpanClass, fieldAddons?.[field.id] ? 'space-y-2' : '')}
                >
                    {fieldContent}
                    {fieldAddons?.[field.id]}
                </div>
            );
        };

        // Collect the premium-locked fields for the bottom-of-section block
        // (spec §4.7 sabor 1). Walk the visible-field list ONCE and split
        // into render-as-is vs surface-as-premium.
        const premiumItems = React.useMemo<readonly PremiumBlockItem[]>(() => {
            return visibleFields
                .filter((field) =>
                    field.entitlementKey ? isFieldPremiumLocked(field.entitlementKey) : false
                )
                .map((field) => ({
                    id: field.id,
                    label: field.label || field.id,
                    description: field.description
                }));
        }, [visibleFields, isFieldPremiumLocked]);

        // Render section content based on layout.
        //
        // Per spec §4.2 (anatomía de sección):
        //   - Default layout: 2-column grid with items-start (so a tall field with error
        //     doesn't misalign its neighbor). Mobile → 1 column (grid-cols-1).
        //   - Each field wrapper carries its own col-span class derived from field type.
        //   - TABS layout: fallback to stacked, no grid (nested sections handle their own layout).
        //   - customRender: when defined, the function is called directly and its result
        //     replaces the field-grid entirely (mirrors the view-path behaviour in
        //     EntityViewContent). Sections WITHOUT customRender are unaffected (SPEC-223).
        const renderSectionContent = () => {
            // Custom-render sections (e.g. ai-generate, stats-chips) bypass the field
            // renderer entirely — call the function and return its output. This mirrors
            // the identical branch in EntityViewContent.buildSectionBody (line ~96).
            if (typeof config.customRender === 'function') {
                return config.customRender();
            }

            if (config.layout === 'TABS') {
                // TABS: stacked layout — nested sections manage their own grid
                return <div className="space-y-4">{visibleFields.map(renderField)}</div>;
            }

            // Default and GRID: 2-column responsive grid with top alignment.
            // `items-start` is critical: fields with error messages push down only
            // themselves, not their grid neighbors. Per spec §4.6.
            return (
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                    {visibleFields.map(renderField)}
                </div>
            );
        };

        if (!isVisible) {
            return null;
        }

        return (
            <div
                ref={ref}
                className={cn('space-y-4', className)}
                {...props}
            >
                {/* Section Header */}
                {(title || description) && (
                    <div className="space-y-1">
                        {title && (
                            <h3 className="font-semibold text-lg leading-none tracking-tight">
                                {title}
                            </h3>
                        )}
                        {description && (
                            <p className="text-muted-foreground text-sm">{description}</p>
                        )}
                    </div>
                )}

                {/* Section Content */}
                <div className={config.className}>{renderSectionContent()}</div>

                {/* Premium upsell — grouped at the bottom so editable fields stay clean. */}
                <PremiumBlock items={premiumItems} />

                {/* Section Footer Info — suppressed for customRender sections whose
                    fields array is intentionally empty (e.g. ai-generate). */}
                {visibleFields.length === 0 && !config.customRender && (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        {t('admin-common.entityForm.noAccessibleFields')}
                    </div>
                )}
            </div>
        );
    }
);

EntityFormSectionComponent.displayName = 'EntityFormSection';

/**
 * Memoized EntityFormSection component
 * Only re-renders when props actually change
 */
export const EntityFormSection = React.memo(EntityFormSectionComponent, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
        prevProps.config.id === nextProps.config.id &&
        prevProps.disabled === nextProps.disabled &&
        prevProps.className === nextProps.className &&
        // Deep comparison for values and errors would be expensive
        // Let React handle these with shallow comparison
        prevProps.values === nextProps.values &&
        prevProps.errors === nextProps.errors &&
        prevProps.onFieldChange === nextProps.onFieldChange &&
        prevProps.onFieldBlur === nextProps.onFieldBlur &&
        prevProps.userPermissions === nextProps.userPermissions &&
        prevProps.currentUser === nextProps.currentUser &&
        prevProps.entityData === nextProps.entityData
    );
});
