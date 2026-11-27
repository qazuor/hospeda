/**
 * Pure field configuration and state derivation for the admin
 * `TranslationSection` (SPEC-212, widened to venue/experience by HOS-2658).
 *
 * @module features/content/components/translation-section.fields
 */

import type { TranslationFieldState } from './TranslationStatus';

/** Entity types the admin translation section can render. */
export type TranslationSectionEntityType =
    | 'accommodation'
    | 'destination'
    | 'event'
    | 'post'
    | 'pointOfInterest'
    | 'venue'
    | 'experience';

/**
 * Translatable fields per entity type. Mirrors the API's `ENTITY_FIELDS`
 * (`apps/api/src/services/translation/translatable-entities.ts`); the venue's
 * `entryNote` has no plain column, its i18n object is `entryNoteI18n`.
 */
export const TRANSLATABLE_FIELDS: Readonly<
    Record<TranslationSectionEntityType, readonly string[]>
> = {
    accommodation: ['name', 'summary', 'description', 'richDescription'],
    destination: ['name', 'summary', 'description'],
    event: ['name', 'summary', 'description'],
    post: ['title', 'summary', 'content'],
    pointOfInterest: ['name', 'description'],
    venue: ['name', 'summary', 'description', 'richDescription', 'entryNote'],
    experience: ['name', 'summary', 'description', 'richDescription']
} as const;

type StoredMeta = Record<
    string,
    Record<string, { autoTranslated?: boolean; translatedAt?: string }>
>;

/**
 * Builds the per-field, per-locale display state from an admin entity payload.
 *
 * @param input.entityType - The entity type whose field list applies.
 * @param input.entity - The admin GET payload (i18n columns + `translationMeta`).
 * @returns One {@link TranslationFieldState} per translatable field.
 */
export function deriveTranslationFieldStates({
    entityType,
    entity
}: {
    readonly entityType: TranslationSectionEntityType;
    readonly entity: Readonly<Record<string, unknown>>;
}): TranslationFieldState[] {
    const meta = (entity.translationMeta as StoredMeta | null | undefined) ?? {};
    return TRANSLATABLE_FIELDS[entityType].map((fieldType): TranslationFieldState => {
        const i18nValue = entity[`${fieldType}I18n`] as Record<string, string> | null | undefined;
        const fieldMeta = meta[fieldType] ?? {};
        const locales: TranslationFieldState['locales'] = {};
        for (const locale of ['en', 'pt'] as const) {
            const localeMeta = fieldMeta[locale];
            const value = i18nValue?.[locale] ?? '';
            locales[locale] = {
                value,
                autoTranslated: localeMeta?.autoTranslated ?? value.length > 0,
                translatedAt: localeMeta?.translatedAt
            };
        }
        return { fieldType, locales };
    });
}
