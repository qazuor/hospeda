/**
 * The single writer of `translationMeta` (HOS-2658, spec §8.4, DL-6).
 *
 * Every translation that reaches a translatable row — an AI result, an owner's
 * manual correction or a staff override — is persisted through
 * {@link writeTranslationPairs}. It reads the i18n columns and the metadata
 * under a row lock (`FOR UPDATE`), so an on-save AI run and a manual PUT on the
 * same listing can never lose each other's update (risk R-2), and it re-checks
 * the MANUAL state inside that lock.
 *
 * @module services/translation/translation-pair-writer
 */

import { getDb } from '@repo/db';
import type { I18nText, TranslationMeta } from '@repo/schemas';
import { I18nTextSchema, TranslationMetaSchema, VenueEntryNoteI18nSchema } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { apiLogger } from '../../utils/logger.js';
import {
    getEntityTable,
    I18N_COLUMN_MAP,
    i18nColumn,
    type TranslatableEntityType
} from './translatable-entities.js';

/** A target locale a translation pair can be written for. */
export type TranslationPairLocale = 'en' | 'pt';

/** One `(field, locale)` write. */
export interface TranslationPairWrite {
    /** Service field id, e.g. `'description'`. */
    readonly field: string;
    readonly locale: TranslationPairLocale;
    readonly value: string;
    /** `ai` = AUTOMATIC pair, `manual` = hand-edited pair (never overwritten by AI). */
    readonly origin: 'ai' | 'manual';
    /** sha256 hex of the normalized Spanish source this value was written for. */
    readonly sourceHash: string;
    /** Provider that produced the value (ai only). */
    readonly provider?: string;
    /** Model that produced the value (ai only). */
    readonly model?: string;
    /** ai only: `true` writes even onto a MANUAL pair ("Traducir con IA"). */
    readonly overrideManual?: boolean;
}

/** Identifies one pair in a writer result. */
export interface TranslationPairRef {
    readonly field: string;
    readonly locale: TranslationPairLocale;
}

/** Input of {@link writeTranslationPairs}. */
export interface WriteTranslationPairsInput {
    readonly entityType: TranslatableEntityType;
    readonly entityId: string;
    readonly writes: readonly TranslationPairWrite[];
    /** Optional Spanish mirror per field, written into `<col>.es` of every written field. */
    readonly sourceMirror?: Readonly<Record<string, string>>;
}

/** Result of {@link writeTranslationPairs}. */
export interface WriteTranslationPairsResult {
    readonly written: readonly TranslationPairRef[];
    readonly skippedManual: readonly TranslationPairRef[];
    /** `false` when no row matches the id (soft-deleted rows ARE matched). */
    readonly found: boolean;
}

/** The i18n column schema that gates a write to `column`. */
function columnSchemaFor(column: string): typeof I18nTextSchema {
    return column === 'entryNoteI18n' ? VenueEntryNoteI18nSchema : I18nTextSchema;
}

/**
 * Persists translation pairs and their provenance under a row lock.
 *
 * Rules (spec §8.4):
 * - an `ai` write onto a pair whose stored meta is `autoTranslated: false` is
 *   skipped unless `overrideManual === true`;
 * - `ai` meta is `{ autoTranslated: true, translatedAt, provider, model, sourceHash }`,
 *   `manual` meta is `{ autoTranslated: false, translatedAt, sourceHash }`;
 * - a missing i18n value starts from `{ es: '', en: '', pt: '' }`; `es` comes from
 *   `sourceMirror[field]` when given, otherwise it is kept;
 * - every written column is validated with its Zod schema and the merged metadata
 *   with `TranslationMetaSchema` before the update; a failure throws and nothing
 *   is written;
 * - when no pair ends up written, no UPDATE is issued.
 *
 * @param input - Entity, pair writes and optional Spanish mirror.
 * @returns The written and skipped pairs and whether the row exists.
 * @throws Error when a field is not translatable for the entity type or a value
 *   fails validation.
 */
export async function writeTranslationPairs(
    input: WriteTranslationPairsInput
): Promise<WriteTranslationPairsResult> {
    const { entityType, entityId, writes, sourceMirror } = input;
    const columnMap = I18N_COLUMN_MAP[entityType];

    for (const write of writes) {
        if (!columnMap[write.field]) {
            throw new Error(
                `translation-pair-writer: field "${write.field}" is not translatable for ${entityType}`
            );
        }
    }
    if (writes.length === 0) {
        return { written: [], skippedManual: [], found: true };
    }

    const table = getEntityTable(entityType);
    const fields = [...new Set(writes.map((write) => write.field))];
    const selection: Record<string, PgColumn> = { translationMeta: table.translationMeta };
    for (const field of fields) {
        const column = columnMap[field] as string;
        selection[column] = i18nColumn(table, column);
    }

    return getDb().transaction(async (tx) => {
        const [row] = await tx
            .select(selection)
            .from(table)
            .where(eq(table.id, entityId))
            .for('update');
        if (!row) {
            return { written: [], skippedManual: [], found: false };
        }

        const stored = row as Record<string, unknown>;
        const storedMeta = (stored.translationMeta as TranslationMeta | null) ?? {};
        const nextMeta: TranslationMeta = { ...storedMeta };
        const nextColumns = new Map<string, I18nText>();
        const written: TranslationPairRef[] = [];
        const skippedManual: TranslationPairRef[] = [];
        const translatedAt = new Date().toISOString();

        for (const write of writes) {
            const { field, locale } = write;
            const storedPair = storedMeta[field]?.[locale];
            if (
                write.origin === 'ai' &&
                storedPair?.autoTranslated === false &&
                write.overrideManual !== true
            ) {
                skippedManual.push({ field, locale });
                continue;
            }

            const column = columnMap[field] as string;
            const current = nextColumns.get(column) ?? {
                es: (stored[column] as I18nText | null)?.es ?? '',
                en: (stored[column] as I18nText | null)?.en ?? '',
                pt: (stored[column] as I18nText | null)?.pt ?? ''
            };
            const mirroredEs = sourceMirror?.[field];
            nextColumns.set(column, {
                ...current,
                es: mirroredEs ?? current.es,
                [locale]: write.value
            });

            nextMeta[field] = {
                ...(nextMeta[field] ?? {}),
                [locale]:
                    write.origin === 'ai'
                        ? {
                              autoTranslated: true,
                              translatedAt,
                              ...(write.provider === undefined ? {} : { provider: write.provider }),
                              ...(write.model === undefined ? {} : { model: write.model }),
                              sourceHash: write.sourceHash
                          }
                        : { autoTranslated: false, translatedAt, sourceHash: write.sourceHash }
            };
            written.push({ field, locale });
        }

        if (written.length === 0) {
            return { written, skippedManual, found: true };
        }

        const updateSet: Record<string, unknown> = {};
        for (const [column, value] of nextColumns) {
            const parsed = columnSchemaFor(column).safeParse(value);
            if (!parsed.success) {
                throw new Error(
                    `translation-pair-writer: refusing to persist malformed i18n value for column "${column}" (${entityType}/${entityId}): ${parsed.error.message}`
                );
            }
            updateSet[column] = parsed.data;
        }
        const parsedMeta = TranslationMetaSchema.safeParse(nextMeta);
        if (!parsedMeta.success) {
            throw new Error(
                `translation-pair-writer: refusing to persist malformed translationMeta (${entityType}/${entityId}): ${parsedMeta.error.message}`
            );
        }
        updateSet.translationMeta = parsedMeta.data;

        await tx.update(table).set(updateSet).where(eq(table.id, entityId));

        apiLogger.info(
            { entityType, entityId, written: written.length, skippedManual: skippedManual.length },
            'translation-pair-writer: pairs persisted'
        );
        return { written, skippedManual, found: true };
    });
}
