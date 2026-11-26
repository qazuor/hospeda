/**
 * HOS-2658 (spec §8.7, AC-26): backfills `translation_meta` of venues and
 * experiences, whose column arrived empty with drizzle 0253.
 *
 * Every existing non-empty `en`/`pt` value whose Spanish source is non-empty and
 * that has no meta entry yet becomes AUTOMATIC: `{ autoTranslated: true,
 * translatedAt: <run start>, sourceHash: hash(current Spanish) }` (owner decision
 * 2026-11-26), so the next owner save of a changed Spanish regenerates it (AC-27).
 * The hash is the runtime helper `computeTranslationSourceHash`, never a copy, so a
 * backfilled pair is "fresh" to the state projection.
 *
 * Idempotent: an existing pair entry is never changed, and a row is written only
 * when its meta gained an entry. All rows, soft-deleted included. Accommodation is
 * never read. `contentOnly`: no fixture writes `translation_meta`, so a fresh
 * database runs it for real. Not subject to the dual-write guard: no file under
 * `src/data/**` changes.
 */
import { eq, experiences, venues } from '@repo/db';
import { type TranslationMeta, TranslationMetaSchema } from '@repo/schemas';
import { computeTranslationSourceHash } from '@repo/service-core';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

/** Ledger identity of this migration; `contentOnly` so fresh databases run it for real. */
export const meta = {
    name: '0194-hos-2658-venue-experience-translation-meta',
    group: 'required',
    destructive: false,
    contentOnly: true,
    requiresColumns: [
        { table: 'venues', column: 'translation_meta' },
        { table: 'experiences', column: 'translation_meta' }
    ]
} as const satisfies SeedMigrationModule['meta'];

type I18nValue = Readonly<Record<string, unknown>> | null | undefined;

/** One translatable field of a loaded row: its Spanish source and its i18n object. */
type FieldSource = { readonly field: string; readonly source: unknown; readonly i18n: I18nValue };

const TARGET_LOCALES = ['en', 'pt'] as const;

/**
 * Adds an AUTOMATIC entry for every non-empty pair without one.
 *
 * @param input.current - The stored meta (null/undefined reads as empty).
 * @param input.fields - The row's translatable fields.
 * @param input.translatedAt - ISO timestamp of the run.
 * @returns The new meta and how many pairs were added (0 means "do not write").
 */
export function backfillTranslationMeta({
    current,
    fields,
    translatedAt
}: {
    readonly current: TranslationMeta | null | undefined;
    readonly fields: readonly FieldSource[];
    readonly translatedAt: string;
}): { readonly meta: TranslationMeta; readonly pairsWritten: number } {
    const next: Record<string, Record<string, TranslationMeta[string][string]>> = {};
    for (const [field, locales] of Object.entries(current ?? {})) {
        next[field] = { ...locales };
    }
    let pairsWritten = 0;
    for (const { field, source, i18n } of fields) {
        const sourceText = typeof source === 'string' ? source : '';
        if (sourceText.trim() === '') continue;
        for (const locale of TARGET_LOCALES) {
            const value = i18n?.[locale];
            if (typeof value !== 'string' || value.trim() === '') continue;
            if (next[field]?.[locale]) continue;
            next[field] = {
                ...(next[field] ?? {}),
                [locale]: {
                    autoTranslated: true,
                    translatedAt,
                    sourceHash: computeTranslationSourceHash({ text: sourceText }).hash
                }
            };
            pairsWritten += 1;
        }
    }
    return { meta: next, pairsWritten };
}

/**
 * Backfills the meta of every venue and experience.
 *
 * @param ctx - Transaction-scoped migration context.
 * @returns Rows updated per table and pairs written.
 */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const translatedAt = new Date().toISOString();
    let pairsWritten = 0;

    const venueRows = await db
        .select({
            id: venues.id,
            name: venues.name,
            summary: venues.summary,
            description: venues.description,
            richDescription: venues.richDescription,
            nameI18n: venues.nameI18n,
            summaryI18n: venues.summaryI18n,
            descriptionI18n: venues.descriptionI18n,
            richDescriptionI18n: venues.richDescriptionI18n,
            entryNoteI18n: venues.entryNoteI18n,
            translationMeta: venues.translationMeta
        })
        .from(venues);
    let venuesUpdated = 0;
    for (const row of venueRows) {
        const result = backfillTranslationMeta({
            current: row.translationMeta,
            translatedAt,
            fields: [
                { field: 'name', source: row.name, i18n: row.nameI18n },
                { field: 'summary', source: row.summary, i18n: row.summaryI18n },
                { field: 'description', source: row.description, i18n: row.descriptionI18n },
                {
                    field: 'richDescription',
                    source: row.richDescription,
                    i18n: row.richDescriptionI18n
                },
                // entryNote has no plain column: its Spanish is `entryNoteI18n.es`.
                { field: 'entryNote', source: row.entryNoteI18n?.es, i18n: row.entryNoteI18n }
            ]
        });
        if (result.pairsWritten === 0) continue;
        await db
            .update(venues)
            .set({ translationMeta: TranslationMetaSchema.parse(result.meta) })
            .where(eq(venues.id, row.id));
        venuesUpdated += 1;
        pairsWritten += result.pairsWritten;
    }

    const experienceRows = await db
        .select({
            id: experiences.id,
            name: experiences.name,
            summary: experiences.summary,
            description: experiences.description,
            richDescription: experiences.richDescription,
            nameI18n: experiences.nameI18n,
            summaryI18n: experiences.summaryI18n,
            descriptionI18n: experiences.descriptionI18n,
            richDescriptionI18n: experiences.richDescriptionI18n,
            translationMeta: experiences.translationMeta
        })
        .from(experiences);
    let experiencesUpdated = 0;
    for (const row of experienceRows) {
        const result = backfillTranslationMeta({
            current: row.translationMeta,
            translatedAt,
            fields: [
                { field: 'name', source: row.name, i18n: row.nameI18n },
                { field: 'summary', source: row.summary, i18n: row.summaryI18n },
                { field: 'description', source: row.description, i18n: row.descriptionI18n },
                {
                    field: 'richDescription',
                    source: row.richDescription,
                    i18n: row.richDescriptionI18n
                }
            ]
        });
        if (result.pairsWritten === 0) continue;
        await db
            .update(experiences)
            .set({ translationMeta: TranslationMetaSchema.parse(result.meta) })
            .where(eq(experiences.id, row.id));
        experiencesUpdated += 1;
        pairsWritten += result.pairsWritten;
    }

    return {
        summary: `HOS-2658: backfilled ${pairsWritten} translation pairs on ${venuesUpdated} venues and ${experiencesUpdated} experiences.`,
        counts: { venuesUpdated, experiencesUpdated, pairsWritten }
    };
}
