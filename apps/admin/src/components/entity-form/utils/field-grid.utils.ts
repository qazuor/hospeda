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
        FieldTypeEnum.IMAGE,
        FieldTypeEnum.FILE,
        FieldTypeEnum.JSON
    ]);

    return fullWidthTypes.has(type) ? 'col-span-2' : 'col-span-1';
}

/**
 * Returns true when a field type should span the full 2-column grid width.
 */
export function isFullWidthField(type: FieldTypeEnum): boolean {
    return getFieldColSpanClass(type) === 'col-span-2';
}
