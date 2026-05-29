import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type {
    FieldConfig,
    GalleryFieldConfig,
    RichTextFieldConfig,
    TextFieldConfig,
    TextareaFieldConfig
} from '@/components/entity-form/types/field-config.types';

/**
 * Extracts the maxLength constraint from a FieldConfig's typeConfig.
 *
 * Only TEXT, TEXTAREA, and RICH_TEXT define maxLength in their typeConfig.
 * All other field types return `undefined` (no counter rendered).
 *
 * Per spec §4.2: the max comes from typeConfig, not hardcoded per field.
 *
 * TODO (future): Wire to Zod schema extractors when FieldConfig has a `schema` link —
 * for now typeConfig.maxLength is the only source of truth.
 *
 * @example
 * ```ts
 * const max = extractMaxLength(summaryFieldConfig);
 * // → 300 (if typeConfig.maxLength was set to 300)
 * ```
 */
export function extractMaxLength(config: FieldConfig): number | undefined {
    const { type, typeConfig } = config;

    if (!typeConfig) return undefined;

    if (type === FieldTypeEnum.TEXT) {
        return (typeConfig as TextFieldConfig).maxLength;
    }

    if (type === FieldTypeEnum.TEXTAREA) {
        return (typeConfig as TextareaFieldConfig).maxLength;
    }

    if (type === FieldTypeEnum.RICH_TEXT) {
        return (typeConfig as RichTextFieldConfig).maxLength;
    }

    return undefined;
}

/**
 * Returns the item count metadata string for list/multiselect fields.
 * Returns undefined when the value is not an array or is empty.
 *
 * @example
 * ```ts
 * extractListCount(['item1', 'item2', 'item3']);
 * // → 3
 * ```
 */
export function extractListCount(value: unknown): number | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.length;
}

/**
 * Returns the image count from a gallery field value.
 * Per spec §4.2: galería → `N fotos`.
 */
export function extractGalleryCount(
    config: FieldConfig,
    value: unknown
): { count: number; max: number | undefined } | undefined {
    if (config.type !== FieldTypeEnum.GALLERY) return undefined;
    if (!Array.isArray(value)) return undefined;

    const galleryConfig = config.typeConfig as GalleryFieldConfig | undefined;
    return {
        count: value.length,
        max: galleryConfig?.maxImages
    };
}
