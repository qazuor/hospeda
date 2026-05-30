import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';

/**
 * Returns the CSS `col-span-*` class for a given field type in a 2-column grid.
 *
 * Fields that occupy the full width (span-2):
 *  - TEXTAREA / RICH_TEXT / GALLERY / IMAGE → always full width (long content)
 *  - FILE, JSON → full width by convention
 *  - All other field types → 1 column (half width)
 *
 * Mobile: the parent grid collapses to 1 column at `sm` breakpoint, so both
 * classes behave identically on mobile — no special handling needed here.
 *
 * @example
 * ```tsx
 * <div className={getFieldColSpanClass(FieldTypeEnum.TEXTAREA)}>
 *   // "col-span-2"
 * </div>
 * ```
 */
export function getFieldColSpanClass(type: FieldTypeEnum): 'col-span-2' | 'col-span-1' {
    const fullWidthTypes: ReadonlySet<FieldTypeEnum> = new Set([
        FieldTypeEnum.TEXTAREA,
        FieldTypeEnum.RICH_TEXT,
        FieldTypeEnum.COORDINATES,
        FieldTypeEnum.GALLERY,
        FieldTypeEnum.VIDEO_GALLERY,
        FieldTypeEnum.IMAGE,
        FieldTypeEnum.FILE,
        FieldTypeEnum.JSON,
        // i18n fields stack three inputs vertically — they need full width
        FieldTypeEnum.I18N_TEXT,
        FieldTypeEnum.I18N_TEXTAREA,
        // Catalog multi-select chip fields need full width so chips wrap naturally
        FieldTypeEnum.AMENITY_SELECT,
        FieldTypeEnum.FEATURE_SELECT
    ]);

    return fullWidthTypes.has(type) ? 'col-span-2' : 'col-span-1';
}

/**
 * Returns true when a field type should span the full 2-column grid width.
 */
export function isFullWidthField(type: FieldTypeEnum): boolean {
    return getFieldColSpanClass(type) === 'col-span-2';
}
