/**
 * @file help-index.ts
 * @description The committed help index (`generated/help-index.json`), parsed
 * by {@link HelpIndexSchema} when this module loads (HOS-2410 spec §5.2,
 * AC-14). A malformed index throws at import, so the API fails at boot instead
 * of answering from a catalog it cannot trust.
 *
 * The JSON is imported, never read from disk: the API and web bundlers inline
 * it (spec §5.3), so no file has to ship next to the bundle. Regenerate it with
 * `pnpm help:build`; `pnpm check:help-catalog` fails when it is stale.
 */

import rawHelpIndex from '../generated/help-index.json' with { type: 'json' };
import { type HelpArticle, type HelpIndex, parseHelpIndex } from './article.schema';
import type { HelpLocale } from './constants';

/** The whole help index, validated. */
export const HELP_INDEX: HelpIndex = parseHelpIndex({ raw: rawHelpIndex });

/** Every Spanish article, sorted by id: the catalog `get_help` answers from. */
export const HELP_ARTICLES: readonly HelpArticle[] = HELP_INDEX.locales.es;

/**
 * One article by id.
 *
 * @param args.id - The article id
 * @param args.locale - The locale; defaults to `es`
 * @returns The article, or `undefined` when that locale has none with this id
 */
export function findHelpArticle({
    id,
    locale = 'es'
}: {
    readonly id: string;
    readonly locale?: HelpLocale;
}): HelpArticle | undefined {
    return HELP_INDEX.locales[locale]?.find((article) => article.id === id);
}
