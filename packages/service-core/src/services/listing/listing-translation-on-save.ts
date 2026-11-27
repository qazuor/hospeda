/**
 * On-save AI translation of venue and experience listings (HOS-2658, spec §8.6).
 *
 * `BaseListingService` reads the Spanish translation sources of a listing
 * before an update and, after the write, fires ONE billed translation run with
 * the sources that changed (all non-empty sources on create). The run itself
 * — gate, metering, manual pairs — lives behind the `TranslationService` port
 * implemented in `apps/api`.
 *
 * @module services/listing/listing-translation-on-save
 */

import { diffTranslatableFields } from '../../translation/diff-translatable-fields';
import { getTranslationService } from '../../translation/translation-init';

/** Default translation source fields of a listing. */
export const DEFAULT_LISTING_TRANSLATION_SOURCE_FIELDS = [
    'name',
    'summary',
    'description',
    'richDescription'
] as const;

/**
 * Reads the Spanish source of each translation field from a listing row.
 *
 * The plain column is the source; `entryNote` has no plain column, so its
 * source is `entryNoteI18n.es`.
 *
 * @param input - The listing row and the field ids to read.
 * @returns Object with `sources`, field id → Spanish text (`undefined` when absent).
 */
export function readListingTranslationSources({
    entity,
    fields
}: {
    readonly entity: Readonly<Record<string, unknown>>;
    readonly fields: readonly string[];
}): { readonly sources: Readonly<Record<string, string | undefined>> } {
    const sources: Record<string, string | undefined> = {};
    for (const field of fields) {
        const raw =
            field === 'entryNote'
                ? (entity.entryNoteI18n as { es?: unknown } | null | undefined)?.es
                : entity[field];
        sources[field] = typeof raw === 'string' ? raw : undefined;
    }
    return { sources };
}

/**
 * Fires the billed on-save translation for a listing, fire-and-forget.
 *
 * On create (`previous` absent) every non-empty source is sent; on update only
 * the sources whose text changed. Nothing is sent when no source qualifies or
 * the translation service is not initialized. Never throws and never awaits
 * the run.
 *
 * @param input - Vertical, listing id, owner id, the current sources and,
 *   on update, the sources captured before the write.
 * @returns Object with the `fields` that were sent (empty when nothing fired).
 */
export function fireListingTranslationOnSave({
    vertical,
    entityId,
    ownerId,
    current,
    previous
}: {
    readonly vertical: 'venue' | 'experience';
    readonly entityId: string;
    readonly ownerId: string;
    readonly current: Readonly<Record<string, string | undefined>>;
    readonly previous?: Readonly<Record<string, string | undefined>>;
}): { readonly fields: Readonly<Record<string, string>> } {
    const fields = diffTranslatableFields({
        previous: previous ?? {},
        current,
        fieldNames: Object.keys(current)
    });
    const service = getTranslationService();
    if (!service || Object.keys(fields).length === 0) {
        return { fields: {} };
    }
    void service
        .translate({
            entityType: vertical,
            entityId,
            fields,
            billing: { vertical, ownerId }
        })
        .catch(() => {});
    return { fields };
}
