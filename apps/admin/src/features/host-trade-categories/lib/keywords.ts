/**
 * @file keywords.ts
 * @description Pure rules for the per-locale keywords tag input (HOS-919 T-044).
 *
 * The limits come from `@repo/schemas` so the editor and the API can never
 * disagree: a word the editor accepts is a word the schema accepts.
 */

import {
    HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH,
    HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE
} from '@repo/schemas';

/** Why a typed word was not added. */
export type KeywordRejection = 'empty' | 'duplicate' | 'tooLong' | 'tooMany';

/** Result of trying to add one word to a locale's list. */
export interface AddKeywordResult {
    /** The list after the attempt (the same array when rejected). */
    readonly keywords: readonly string[];
    /** Set when the word was not added. */
    readonly rejection?: KeywordRejection;
}

/**
 * Normalises a typed word: trimmed and lowercased.
 *
 * @param input - Object with the raw text.
 * @returns The word as it will be stored.
 */
export function normalizeKeyword({ raw }: { readonly raw: string }): string {
    return raw.trim().toLowerCase();
}

/**
 * Adds one word to a locale's list, enforcing the catalog limits.
 *
 * The word is normalised first, then rejected when blank, when already present,
 * when longer than {@link HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH} or when the
 * list already holds {@link HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE}.
 *
 * @param input - Current list and the raw typed text.
 * @returns The next list and, when nothing was added, the reason.
 */
export function addKeyword({
    keywords,
    raw
}: {
    readonly keywords: readonly string[];
    readonly raw: string;
}): AddKeywordResult {
    const word = normalizeKeyword({ raw });

    if (word.length === 0) return { keywords, rejection: 'empty' };
    if (word.length > HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH) {
        return { keywords, rejection: 'tooLong' };
    }
    if (keywords.includes(word)) return { keywords, rejection: 'duplicate' };
    if (keywords.length >= HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE) {
        return { keywords, rejection: 'tooMany' };
    }

    return { keywords: [...keywords, word] };
}

/**
 * Removes one word from a locale's list.
 *
 * @param input - Current list and the word to drop.
 */
export function removeKeyword({
    keywords,
    keyword
}: {
    readonly keywords: readonly string[];
    readonly keyword: string;
}): readonly string[] {
    return keywords.filter((existing) => existing !== keyword);
}
