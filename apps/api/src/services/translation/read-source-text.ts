/**
 * Spanish source resolution for translatable fields (HOS-2658, spec §9.6).
 *
 * @module services/translation/read-source-text
 */

import type { I18nText } from '@repo/schemas';
import { I18N_COLUMN_MAP, type TranslatableEntityType } from './translatable-entities.js';

/**
 * Reads the Spanish source text of one translatable field from a loaded row.
 *
 * The plain column (e.g. `name`) is the canonical Spanish source. When the
 * entity has NO plain column for the field (the value is `undefined`, never
 * `null`) the source is the `es` key of the field's i18n column. That covers
 * `pointOfInterest.name` (HOS-138) and `venue.entryNote` (HOS-2658), whose
 * Spanish lives only in `nameI18n.es` / `entryNoteI18n.es`.
 *
 * @param input - The entity type, the raw row and the field id.
 * @returns Object with the `text` (empty string when absent or not a string).
 */
export function readSourceText({
    entityType,
    row,
    field
}: {
    readonly entityType: TranslatableEntityType;
    readonly row: Readonly<Record<string, unknown>>;
    readonly field: string;
}): { readonly text: string } {
    let value: unknown = row[field];
    if (value === undefined) {
        const i18nCol = I18N_COLUMN_MAP[entityType][field];
        const i18nValue = i18nCol ? (row[i18nCol] as I18nText | null | undefined) : null;
        value = i18nValue?.es;
    }
    return { text: typeof value === 'string' ? value : '' };
}
