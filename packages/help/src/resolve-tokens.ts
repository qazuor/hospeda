/**
 * @file resolve-tokens.ts
 * @description Resolution of the body tokens of an article (HOS-2410
 * `docs/data-model.md` §5.2). The index keeps tokens unresolved; each consumer
 * decides what a `limit`, `link` or `article` token becomes (`get_help` writes
 * "el tope de tu plan", the export writes "según tu plan", …). This module does
 * the part every consumer shares: it parses each token, works out the vertical
 * of a `limit`, the destination of a `link` and the target of an `article`, and
 * hands those to the consumer's resolvers.
 *
 * Pure and runtime-safe: no file system, no parser of the generator (AC-12).
 */

import { describePortalDestination } from '@repo/portal-routes';
import type { HelpArticle } from './article.schema';
import { HELP_VERTICALS, type HelpVertical } from './constants';
import type { HelpDestination } from './destination.schema';
import { toPortalDestination } from './destination-template';
import { resolveHelpLinkTarget } from './link-targets';
import { replaceHelpTokens } from './tokens';

/** What a consumer turns a `{{limit:…}}` token into. */
export interface HelpLimitTokenArgs {
    /** The limit key, for example `max_photos_per_accommodation`. */
    readonly key: string;
    /** The token's vertical, or the article's only one; `undefined` when neither names one. */
    readonly vertical: HelpVertical | undefined;
    /** The token's label, when written. */
    readonly label?: string;
}

/** What a consumer turns a `{{link:…}}` token into. */
export interface HelpLinkTokenArgs {
    /** The destination the token's target names. */
    readonly destination: HelpDestination;
    /** The token's label, when written. */
    readonly label?: string;
}

/** What a consumer turns an `{{article:…}}` token into. */
export interface HelpArticleTokenArgs {
    /** The target article id. */
    readonly id: string;
    /** The section or `###` anchor, when the token names one. */
    readonly anchor?: string;
    /** The target article, `undefined` when the catalog has no such id. */
    readonly target: HelpArticle | undefined;
    /** The token's label, when written. */
    readonly label?: string;
}

/** One resolver per token kind. Each returns the text that replaces the token. */
export interface HelpTokenResolvers {
    /** Resolves a `limit` token. */
    readonly limit: (args: HelpLimitTokenArgs) => string;
    /** Resolves a `link` token whose target names a destination. */
    readonly link: (args: HelpLinkTokenArgs) => string;
    /** Resolves an `article` token. */
    readonly article: (args: HelpArticleTokenArgs) => string;
}

/** Arguments for {@link resolveHelpText}. RO-RO. */
export interface ResolveHelpTextArgs {
    /** Markdown of one section or step, with tokens. */
    readonly text: string;
    /** The article the text belongs to: its `verticals` default a `limit` token's vertical. */
    readonly article: Pick<HelpArticle, 'verticals'>;
    /** Looks an article up by id, for `article` tokens. */
    readonly findArticle: (args: { readonly id: string }) => HelpArticle | undefined;
    /** What each token becomes. */
    readonly resolvers: HelpTokenResolvers;
}

/** The vertical a `limit` token is about: its own, or the article's only one. */
function limitVertical({
    arg,
    verticals
}: {
    readonly arg: string | undefined;
    readonly verticals: readonly HelpVertical[];
}): HelpVertical | undefined {
    if (arg !== undefined) {
        return HELP_VERTICALS.find((vertical) => vertical === arg);
    }
    return verticals.length === 1 ? verticals[0] : undefined;
}

/**
 * The Spanish label a link to a help destination is shown with when the author
 * wrote none: the portal's default label of that destination.
 *
 * @param args.destination - A help destination
 * @returns The label, for example "Ver los planes"
 */
export function helpDestinationLabel({
    destination
}: {
    readonly destination: HelpDestination;
}): string {
    return describePortalDestination({ destination: toPortalDestination({ destination }) });
}

/**
 * Replaces every token of a text through the consumer's resolvers.
 *
 * A `link` token whose target names no destination (the generator rejects
 * those, so only a hand-edited index can carry one) becomes its label, or
 * nothing: a raw `{{…}}` never reaches a reader. A malformed token is left as
 * written, as {@link replaceHelpTokens} does.
 *
 * @param args - The text, its article, the article lookup and the resolvers
 * @returns The text with its tokens resolved
 *
 * @example
 * ```ts
 * resolveHelpText({
 *     text: 'Hasta {{limit:max_photos_per_accommodation}} fotos.',
 *     article: { verticals: ['accommodation'] },
 *     findArticle: ({ id }) => findHelpArticle({ id }),
 *     resolvers: { limit: () => 'el tope de tu plan', link: ({ label }) => label ?? '', article: ({ id }) => id }
 * });
 * // 'Hasta el tope de tu plan fotos.'
 * ```
 */
export function resolveHelpText({
    text,
    article,
    findArticle,
    resolvers
}: ResolveHelpTextArgs): string {
    return replaceHelpTokens({
        text,
        replace: (token) => {
            const [first = '', second] = token.args;
            const label = token.label === undefined ? {} : { label: token.label };
            if (token.kind === 'limit') {
                return resolvers.limit({
                    key: first,
                    vertical: limitVertical({ arg: second, verticals: article.verticals }),
                    ...label
                });
            }
            if (token.kind === 'link') {
                const resolved = resolveHelpLinkTarget({ args: token.args });
                return resolved.ok
                    ? resolvers.link({ destination: resolved.destination, ...label })
                    : (token.label ?? '');
            }
            return resolvers.article({
                id: first,
                ...(second === undefined ? {} : { anchor: second }),
                target: findArticle({ id: first }),
                ...label
            });
        }
    });
}
