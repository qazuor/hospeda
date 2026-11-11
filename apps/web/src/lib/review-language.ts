/**
 * @file review-language.ts
 * @description Pure helper that decides whether a review written in another
 * language deserves a "Escrita en …" label, and renders that language's name
 * in the visitor's locale.
 *
 * Google translates reviews into its default language when the request carries
 * no `languageCode`. We now store the guest's original text and its language,
 * so the public page can label reviews whose language differs from the page.
 *
 * @module lib/review-language
 */

import { toBcp47Locale } from '@repo/i18n/web';
import type { SupportedLocale } from './i18n';

/** Input for {@link getReviewLanguageLabel}. */
export interface GetReviewLanguageLabelParams {
    /** BCP-47 language reported by the platform (e.g. `pt`, `pt-BR`). */
    readonly languageCode: string | null | undefined;
    /** Locale of the page rendering the review. */
    readonly locale: SupportedLocale;
}

/**
 * Returns the primary language subtag of a BCP-47 tag, lowercased.
 *
 * @param code - A BCP-47 language tag or a bare language subtag.
 * @returns The primary subtag, or an empty string when the input is unusable.
 */
function primarySubtag(code: string): string {
    return code.trim().toLowerCase().split(/[-_]/)[0] ?? '';
}

/**
 * BCP-47 special-purpose tags that name no human language: `und`
 * (undetermined — Google's tag for reviews it cannot classify, such as a lone
 * emoji), `mul` (multiple) and `zxx` (no linguistic content). `Intl` still
 * "names" them (`und` → "root"), so they must be refused explicitly.
 */
const NON_LANGUAGE_TAGS: ReadonlySet<string> = new Set(['und', 'mul', 'zxx']);

/**
 * Resolves the localized name for a review's language, but only when it
 * differs from the page locale's language.
 *
 * Returns `null` when:
 * - the review carries no language code,
 * - its primary language equals the page locale's primary language,
 * - or `Intl.DisplayNames` cannot name the language (unknown/invalid code).
 *
 * @param params - {@link GetReviewLanguageLabelParams}
 * @returns The language display name (e.g. `"portugués"`), or `null`.
 *
 * @example
 * ```ts
 * getReviewLanguageLabel({ languageCode: 'pt', locale: 'es' }); // 'portugués'
 * getReviewLanguageLabel({ languageCode: 'es-AR', locale: 'es' }); // null
 * getReviewLanguageLabel({ languageCode: 'zz', locale: 'es' }); // null
 * ```
 */
export function getReviewLanguageLabel({
    languageCode,
    locale
}: GetReviewLanguageLabelParams): string | null {
    if (!languageCode) {
        return null;
    }

    const reviewLanguage = primarySubtag(languageCode);
    if (reviewLanguage === '' || NON_LANGUAGE_TAGS.has(reviewLanguage)) {
        return null;
    }

    const pageLanguage = primarySubtag(locale);
    if (reviewLanguage === pageLanguage) {
        return null;
    }

    try {
        const displayName = new Intl.DisplayNames([toBcp47Locale(locale)], {
            type: 'language'
        }).of(reviewLanguage);

        if (!displayName) {
            return null;
        }

        // Intl returns the input code unchanged for languages it does not know;
        // treat that as "no label" rather than printing a raw code to a visitor.
        if (displayName.trim().toLowerCase() === reviewLanguage) {
            return null;
        }

        return displayName;
    } catch {
        return null;
    }
}
