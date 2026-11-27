/**
 * Source fingerprint for listing translations (HOS-2658, DL-2).
 *
 * Every translation pair stores the hash of the Spanish source it was written
 * for. Comparing it with the hash of the current Spanish text tells the editor
 * whether a manual translation may be outdated. This module is the ONLY place
 * that hash is computed: `apps/api` and `packages/seed` import it from here so
 * the runtime and the backfill can never disagree.
 *
 * @module translation-source-hash
 */

import { createHash } from 'node:crypto';

/**
 * Normalizes a Spanish source before hashing.
 *
 * Applies Unicode NFC, converts CRLF and lone CR line endings to LF and trims
 * both ends. Internal whitespace is NOT collapsed: line breaks inside Markdown
 * (`richDescription`) are meaningful.
 *
 * @param input - Object with the raw `text`.
 * @returns Object with the `normalized` text.
 */
export function normalizeTranslationSource({ text }: { readonly text: string }): {
    readonly normalized: string;
} {
    const normalized = text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
    return { normalized };
}

/**
 * Computes the sha256 fingerprint of a Spanish source.
 *
 * @param input - Object with the raw `text`; it is normalized first
 *   (see {@link normalizeTranslationSource}).
 * @returns Object with the lowercase 64-char hex `hash`.
 */
export function computeTranslationSourceHash({ text }: { readonly text: string }): {
    readonly hash: string;
} {
    const { normalized } = normalizeTranslationSource({ text });
    const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');
    return { hash };
}
