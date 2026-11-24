/**
 * The user footer's "Preguntas frecuentes" links (HOS-2565 PR-4).
 *
 * A mail declares the help articles it relates to (by id, in the email catalog).
 * Titles come from each article's frontmatter through `@repo/help`, so a renamed
 * article renames its footer link. A mail with no declaration gets
 * {@link EMAIL_DEFAULT_HELP_ARTICLE_IDS}.
 *
 * @module templates/user-layout/help-links
 */

import { findHelpArticle } from '@repo/help';
import { EMAIL_PUBLIC_SITE_URL } from '../../email-assets.js';

/** Most links the footer shows. */
export const EMAIL_MAX_HELP_LINKS = 4;

/**
 * Generic set for a mail that declares no related article: how the help works,
 * what publishing needs, changing plan and pausing a listing.
 */
export const EMAIL_DEFAULT_HELP_ARTICLE_IDS = [
    'help-center',
    'publish-requirements',
    'change-plan',
    'pause-resume'
] as const;

/** One footer FAQ link. */
export interface EmailHelpLink {
    /** Help article id. */
    readonly id: string;
    /** Article title from its frontmatter. */
    readonly title: string;
    /** Absolute URL of the article page (always production, like every footer link). */
    readonly href: string;
}

/**
 * Absolute URL of a help article page.
 *
 * @param input - The article id.
 * @returns `https://hospeda.com.ar/es/mi-cuenta/ayuda/<id>/`.
 */
export function buildEmailHelpArticleUrl(input: { readonly id: string }): string {
    return `${EMAIL_PUBLIC_SITE_URL}/es/mi-cuenta/ayuda/${input.id}/`;
}

/**
 * Resolves the footer FAQ links of one mail.
 *
 * Unknown ids are skipped here so a footer never breaks a send; the catalog test
 * (`email-help-articles.test.ts` in `@repo/notifications`) fails on them instead.
 * When the declared ids resolve to nothing, the default set is used.
 *
 * @param input - The declared ids, if any.
 * @returns `{ links }`, at most {@link EMAIL_MAX_HELP_LINKS}.
 */
export function resolveEmailHelpLinks(input: { readonly ids?: readonly string[] }): {
    readonly links: readonly EmailHelpLink[];
} {
    const toLinks = (ids: readonly string[]): EmailHelpLink[] =>
        ids.flatMap((id) => {
            const article = findHelpArticle({ id });
            return article
                ? [{ id, title: article.title, href: buildEmailHelpArticleUrl({ id }) }]
                : [];
        });
    const declared = toLinks(input.ids ?? []);
    const links = declared.length > 0 ? declared : toLinks(EMAIL_DEFAULT_HELP_ARTICLE_IDS);
    return { links: links.slice(0, EMAIL_MAX_HELP_LINKS) };
}
