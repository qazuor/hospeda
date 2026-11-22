/**
 * @file help-tokens.ts
 * @description Server-side resolution of the `{{…}}` tokens of an article body
 * for the web (HOS-2410 `docs/data-model.md` §5.2, web row):
 *
 * - `limit` → `<span data-help-limit="<key>" data-vertical="<v>">` holding the
 *   neutral text; the `HelpLimitValues` island swaps in the reader's value.
 * - `link` → `<a>` to the relative portal URL. An editor `section:` link points
 *   to the vertical's list page, because no listing id is known on the server.
 * - `article` → `<a>` to that help article (and section anchor), labelled with
 *   its title when the token has no label.
 *
 * The result is still Markdown (with inline HTML); `render-help-markdown.ts`
 * turns it into sanitized HTML. Nothing here reads the session (D-H4).
 */

import {
    type HelpArticle,
    type HelpAudience,
    type HelpDestination,
    type HelpToken,
    replaceHelpTokens,
    resolveHelpLinkTarget,
    toPortalDestination
} from '@repo/help';
import {
    buildPortalUrl,
    describePortalDestination,
    type PortalDestination,
    type PortalLocale
} from '@repo/portal-routes';
import { buildUrl } from '@/lib/urls';
import { withHelpAudienceParam } from './help-audience-shared';

/** Placeholder origin: only the path of the built URL is kept. */
const PATH_ONLY_ORIGIN = 'http://hospeda.invalid';

/** Escapes text for an HTML text node or a double-quoted attribute. */
export function escapeHelpHtml({ text }: { readonly text: string }): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * The portal destination a help destination opens on the web. An editor
 * section of "your listing" becomes the vertical's list page: the server does
 * not know which listing the reader means.
 *
 * @param args.destination - A help destination
 * @returns A destination that names no record
 */
export function webHelpDestination({
    destination
}: {
    readonly destination: HelpDestination;
}): PortalDestination {
    if (destination.kind === 'ownEditorSection') {
        return { kind: 'ownerListings', vertical: destination.vertical };
    }
    return toPortalDestination({ destination });
}

/**
 * The relative, locale-prefixed path of a help destination.
 *
 * @param args.destination - A help destination
 * @param args.locale - The page locale
 * @returns For example `/es/mi-cuenta/suscripcion/`
 */
export function helpDestinationPath({
    destination,
    locale
}: {
    readonly destination: HelpDestination;
    readonly locale: PortalLocale;
}): string {
    const url = buildPortalUrl({
        destination: webHelpDestination({ destination }),
        locale,
        siteUrl: PATH_ONLY_ORIGIN
    });
    return new URL(url).pathname;
}

/**
 * The text a link to a help destination shows: its own label, else the
 * default label of where it really goes.
 *
 * @param args.destination - A help destination
 * @returns The link text
 */
export function helpDestinationLabel({
    destination
}: {
    readonly destination: HelpDestination;
}): string {
    return (
        destination.label ??
        describePortalDestination({ destination: webHelpDestination({ destination }) })
    );
}

/**
 * The path of a help article, with an optional section anchor.
 *
 * @param args.id - The article id
 * @param args.locale - The page locale
 * @param args.anchor - A section or `###` anchor of that article
 * @returns For example `/es/mi-cuenta/ayuda/photos/#problemas-comunes`
 */
export function helpArticlePath({
    id,
    locale,
    anchor
}: {
    readonly id: string;
    readonly locale: PortalLocale;
    readonly anchor?: string;
}): string {
    const path = buildUrl({ locale, path: `mi-cuenta/ayuda/${encodeURIComponent(id)}` });
    return anchor === undefined ? path : `${path}#${anchor}`;
}

/** Arguments for {@link resolveHelpTokensForWeb}. RO-RO. */
export interface ResolveHelpTokensForWebArgs {
    /** Markdown with tokens. */
    readonly text: string;
    /** The article the text belongs to: its single vertical is a `limit` token's default. */
    readonly article: Pick<HelpArticle, 'verticals'>;
    /** The page locale, used in every link. */
    readonly locale: PortalLocale;
    /** What a `limit` token reads before the island fills the reader's value. */
    readonly neutralLimitText: string;
    /** The title of another article, used when an `article` token has no label. */
    readonly titleOf: (id: string) => string | undefined;
    /**
     * The reader's tab (a validated `?para=`). When set, an `article` link
     * carries it to a target written for that audience (HOS-2552).
     */
    readonly readerAudience?: HelpAudience;
    /** The audiences of another article, for {@link ResolveHelpTokensForWebArgs.readerAudience}. */
    readonly audiencesOf?: (id: string) => readonly HelpAudience[] | undefined;
}

/** Resolves one token, or keeps it as written when it cannot be resolved. */
function resolveOne({
    token,
    args
}: {
    readonly token: HelpToken;
    readonly args: ResolveHelpTokensForWebArgs;
}): string {
    const { article, locale, neutralLimitText, titleOf } = args;
    if (token.kind === 'limit') {
        const [key = '', vertical = article.verticals[0] ?? ''] = token.args;
        return `<span data-help-limit="${escapeHelpHtml({ text: key })}" data-vertical="${escapeHelpHtml({ text: vertical })}">${escapeHelpHtml({ text: neutralLimitText })}</span>`;
    }
    if (token.kind === 'link') {
        const resolved = resolveHelpLinkTarget({ args: token.args });
        if (!resolved.ok) {
            // Guard (a) rejects such a token, so this is unreachable on the
            // committed index; the label (or nothing) keeps the sentence readable.
            return escapeHelpHtml({ text: token.label ?? '' });
        }
        const href = helpDestinationPath({ destination: resolved.destination, locale });
        const label = token.label ?? helpDestinationLabel({ destination: resolved.destination });
        return `<a href="${escapeHelpHtml({ text: href })}">${escapeHelpHtml({ text: label })}</a>`;
    }
    const [id = '', anchor] = token.args;
    const label = token.label ?? titleOf(id) ?? id;
    const href = withHelpAudienceParam({
        href: helpArticlePath({ id, locale, anchor }),
        audience: args.readerAudience,
        audiences: args.audiencesOf?.(id) ?? []
    });
    return `<a href="${escapeHelpHtml({ text: href })}">${escapeHelpHtml({ text: label })}</a>`;
}

/**
 * Replaces every token of an article text with its web rendering.
 *
 * @param args - The text, its article, the locale and the label sources
 * @returns Markdown with inline HTML and no well-formed token left
 *
 * @example
 * ```ts
 * resolveHelpTokensForWeb({ text: 'Mirá {{link:faq}}.', article, locale: 'es', neutralLimitText, titleOf });
 * // 'Mirá <a href="/es/preguntas-frecuentes/">Ver las preguntas frecuentes</a>.'
 * ```
 */
export function resolveHelpTokensForWeb(args: ResolveHelpTokensForWebArgs): string {
    return replaceHelpTokens({ text: args.text, replace: (token) => resolveOne({ token, args }) });
}
