/**
 * Staff edits of the venue `entryNote` translations (HOS-2658, DL-6, DL-9).
 *
 * The venue service writes ONLY `entryNoteI18n.es` from a PATCH body and keeps
 * the stored `en` / `pt` (AC-25): on the owner side that is what stops a stale
 * form from clobbering a pair. An admin PATCH/PUT (including a support edit,
 * action 15) is an explicit human edit of the three locales, so dropping its
 * `en` / `pt` silently would lose input. This module persists them AFTER the
 * source write, through the single translation writer, as MANUAL pairs whose
 * `sourceHash` is the hash of the Spanish just written.
 *
 * Only a locale whose body value differs from the stored one is written: an
 * unchanged value is a resend, not a correction, and writing it would flip an
 * AUTOMATIC pair to MANUAL and stop the AI from ever refreshing it.
 *
 * The source write and the pair write are two transactions (the service owns
 * the first and the writer opens its own row-locked one). A concurrent AI
 * on-save run cannot overwrite the manual pairs: the writer re-checks the
 * MANUAL state under its row lock.
 *
 * @module services/translation/staff-entry-note-pairs
 */

import { getDb } from '@repo/db';
import { venues } from '@repo/db/schemas';
import type { I18nText } from '@repo/schemas';
import { computeTranslationSourceHash } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { type TranslationPairWrite, writeTranslationPairs } from './translation-pair-writer.js';

/** The two locales a staff edit can write as translation pairs. */
const PAIR_LOCALES = ['en', 'pt'] as const;

/** Input of {@link applyStaffEntryNotePairs}. */
export interface ApplyStaffEntryNotePairsInput<TVenue extends Record<string, unknown>> {
    /** Venue id the PATCH/PUT targeted. */
    readonly venueId: string;
    /** The request body's `entryNoteI18n` value (any shape; only an object acts). */
    readonly body: unknown;
    /** The venue the service returned after the source write. */
    readonly updated: TVenue;
}

/** Result of {@link applyStaffEntryNotePairs}. */
export interface ApplyStaffEntryNotePairsResult<TVenue extends Record<string, unknown>> {
    /** The venue to answer with: `updated`, refreshed with the written pairs. */
    readonly venue: TVenue;
    /** Locales persisted as MANUAL pairs (empty when nothing changed). */
    readonly writtenLocales: readonly ('en' | 'pt')[];
}

/**
 * Persists the `en` / `pt` of a staff `entryNoteI18n` edit as MANUAL pairs.
 *
 * @param input - Venue id, the body's `entryNoteI18n` and the updated venue.
 * @returns The venue to answer with and the locales that were written.
 */
export async function applyStaffEntryNotePairs<TVenue extends Record<string, unknown>>(
    input: ApplyStaffEntryNotePairsInput<TVenue>
): Promise<ApplyStaffEntryNotePairsResult<TVenue>> {
    const { venueId, body, updated } = input;
    if (body === null || typeof body !== 'object') {
        return { venue: updated, writtenLocales: [] };
    }

    const sent = body as Partial<Record<'en' | 'pt', unknown>>;
    const stored = (updated.entryNoteI18n as I18nText | null | undefined) ?? null;
    const { hash } = computeTranslationSourceHash({ text: stored?.es ?? '' });

    const writes: TranslationPairWrite[] = [];
    for (const locale of PAIR_LOCALES) {
        const value = sent[locale];
        if (typeof value !== 'string' || value === (stored?.[locale] ?? '')) {
            continue;
        }
        writes.push({ field: 'entryNote', locale, value, origin: 'manual', sourceHash: hash });
    }
    if (writes.length === 0) {
        return { venue: updated, writtenLocales: [] };
    }

    await writeTranslationPairs({ entityType: 'venue', entityId: venueId, writes });

    const [row] = await getDb()
        .select({ entryNoteI18n: venues.entryNoteI18n, translationMeta: venues.translationMeta })
        .from(venues)
        .where(eq(venues.id, venueId))
        .limit(1);

    return {
        venue: row ? { ...updated, ...row } : updated,
        writtenLocales: writes.map((write) => write.locale as 'en' | 'pt')
    };
}
