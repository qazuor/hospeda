/**
 * Translatable entity maps shared by the AI translate service, the single
 * translation writer and the listing translation state (SPEC-212, HOS-2658).
 *
 * Lives outside `ai-translate.service.ts` so the writer
 * (`translation-pair-writer.ts`) can resolve tables and columns without a
 * circular import back into the service that delegates to it.
 *
 * @module services/translation/translatable-entities
 */

import {
    accommodations,
    destinations,
    events,
    experiences,
    pointsOfInterest,
    posts,
    venues
} from '@repo/db/schemas';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

/** Entity types that can be translated. */
export type TranslatableEntityType =
    | 'accommodation'
    | 'destination'
    | 'event'
    | 'post'
    | 'pointOfInterest'
    | 'venue'
    | 'experience';

/** Content locales that participate in translation. */
export type ContentLocale = 'es' | 'en' | 'pt';

/** Fields to translate per entity type. */
export const ENTITY_FIELDS: Readonly<Record<TranslatableEntityType, readonly string[]>> = {
    accommodation: ['name', 'summary', 'description', 'richDescription'],
    destination: ['name', 'summary', 'description'],
    event: ['name', 'summary', 'description'],
    post: ['title', 'summary', 'content'],
    // HOS-143 G-6: POI (HOS-138 v2 model) only ever had `nameI18n` /
    // `descriptionI18n` — there is no plain `name` column (see
    // `readSourceText` for how the Spanish source value is still resolved).
    pointOfInterest: ['name', 'description'],
    // HOS-2658: `entryNote` has no plain column; its Spanish lives in
    // `entryNoteI18n.es` and is resolved by `readSourceText`.
    venue: ['name', 'summary', 'description', 'richDescription', 'entryNote'],
    experience: ['name', 'summary', 'description', 'richDescription']
} as const;

/** Map entity type to its i18n column per field. */
export const I18N_COLUMN_MAP: Readonly<
    Record<TranslatableEntityType, Readonly<Record<string, string>>>
> = {
    accommodation: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n',
        richDescription: 'richDescriptionI18n'
    },
    destination: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n'
    },
    event: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n'
    },
    post: {
        title: 'titleI18n',
        summary: 'summaryI18n',
        content: 'contentI18n'
    },
    pointOfInterest: {
        name: 'nameI18n',
        description: 'descriptionI18n'
    },
    venue: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n',
        richDescription: 'richDescriptionI18n',
        entryNote: 'entryNoteI18n'
    },
    experience: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n',
        richDescription: 'richDescriptionI18n'
    }
};

/**
 * Structural view of a translatable entity table.
 *
 * The content tables share the `id`, `deletedAt` and `translationMeta`
 * columns (typed here so they stay strongly typed) plus the per-field `*I18n`
 * columns that are accessed dynamically by name via {@link i18nColumn}.
 */
export type TranslatableTable = PgTable & {
    id: PgColumn;
    deletedAt: PgColumn;
    translationMeta: PgColumn;
};

/**
 * Resolves a dynamic per-field i18n column (e.g. `nameI18n`) by name. The
 * column is guaranteed to exist because the names come from {@link I18N_COLUMN_MAP}.
 */
export function i18nColumn(table: TranslatableTable, columnName: string): PgColumn {
    // TYPE-WORKAROUND: Drizzle exposes table columns under an internal symbol, so
    // dynamic by-name access needs a structural cast. The name always comes from
    // I18N_COLUMN_MAP, so the column is guaranteed to exist.
    return (table as unknown as Record<string, PgColumn>)[columnName] as PgColumn;
}

/**
 * Resolves the Drizzle table for a translatable entity type.
 *
 * Resolution is lazy and touches ONLY the requested binding: the AI translate
 * routes are registered in the global API route tree, and route tests that
 * partially mock `@repo/db/schemas` must not crash on a table they did not
 * declare.
 */
export function getEntityTable(entityType: TranslatableEntityType): TranslatableTable {
    // TYPE-WORKAROUND: a Drizzle table's structural shape does not overlap the narrow `TranslatableTable` view (columns live under an internal symbol), so the projection needs one cast from `unknown`.
    return selectEntityTable(entityType) as unknown as TranslatableTable;
}

/** Picks the requested table binding without touching the others. */
function selectEntityTable(entityType: TranslatableEntityType): unknown {
    switch (entityType) {
        case 'accommodation':
            return accommodations;
        case 'destination':
            return destinations;
        case 'event':
            return events;
        case 'post':
            return posts;
        case 'pointOfInterest':
            return pointsOfInterest;
        case 'venue':
            return venues;
        case 'experience':
            return experiences;
    }
}
