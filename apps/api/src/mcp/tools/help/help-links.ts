/**
 * @file help-links.ts
 * @description Turns the destinations of a help topic into the links `get_help`
 * returns (HOS-2333, spec HOS-2335 §5.4).
 *
 * A topic is static, so it cannot name a listing id. Its editor links are an
 * "editor section of one of your own listings": this module fills them in from
 * the caller's listings, one link per listing, so the owner lands on the real
 * page. Everything else is a portal page that names no record.
 *
 * Every URL is built here from a destination through the portal route map and
 * the configured site URL. Nothing a caller typed reaches a link.
 *
 * Pure: the listings and the site URL are arguments. It never throws: a link
 * that cannot be built is left out, because a help answer with one link fewer
 * is better than none.
 */

import type { HelpArticle, HelpDestination } from '@repo/help';
import type { PortalDestination, PortalListingVertical } from '@repo/portal-routes';
import { buildPortalUrl, describePortalDestination, type PortalLocale } from '@repo/portal-routes';
import { PublicationStatusEnum } from '@repo/schemas';
import type { OwnerHelpCallerAudience } from './help-audience';

/** The part of a help article its links are built from. */
export type HelpLinkSource = Pick<HelpArticle, 'destinations' | 'faqKey'>;

/** A link in a help answer. */
export interface HelpLink {
    /** Spanish label. */
    readonly label: string;
    /** Absolute portal URL. */
    readonly url: string;
}

/** One of the caller's own listings, as `list_my_listings` reports it. */
export interface HelpOwnListing {
    /** The listing's vertical. */
    readonly vertical: PortalListingVertical;
    /** The listing id. */
    readonly id: string;
    /** The listing's publication state: a purged listing has no editor to link. */
    readonly publicationStatus: PublicationStatusEnum;
}

/** Most listings one editor-section destination expands to, per vertical. */
export const HELP_LINKS_MAX_LISTINGS_PER_VERTICAL = 3;

/** What each vertical's listing is called in a link label. */
const VERTICAL_NOUN: Readonly<Record<PortalListingVertical, string>> = {
    accommodation: 'alojamiento',
    venue: 'comercio',
    experience: 'experiencia'
};

/** The listing vertical a kind of owner works in. A provider and a partner have none. */
const AUDIENCE_VERTICAL: Readonly<
    Record<OwnerHelpCallerAudience, PortalListingVertical | undefined>
> = {
    host: 'accommodation',
    venue: 'venue',
    experience: 'experience',
    provider: undefined,
    partner: undefined
};

/** The vertical a destination is about, when it is about one. */
function verticalOf(destination: HelpDestination): PortalListingVertical | undefined {
    return 'vertical' in destination ? destination.vertical : undefined;
}

/** Whether a destination applies to the kind of owner asking. */
function destinationFitsAudience({
    destination,
    audience
}: {
    readonly destination: HelpDestination;
    readonly audience?: OwnerHelpCallerAudience;
}): boolean {
    const vertical = verticalOf(destination);
    if (audience === undefined || vertical === undefined) {
        return true;
    }
    return AUDIENCE_VERTICAL[audience] === vertical;
}

/** Builds a link, or `undefined` when the URL cannot be built. */
function toLink({
    destination,
    label,
    siteUrl,
    locale
}: {
    readonly destination: PortalDestination;
    readonly label?: string;
    readonly siteUrl: string;
    readonly locale?: PortalLocale;
}): HelpLink | undefined {
    try {
        return {
            label: label ?? describePortalDestination({ destination }),
            url: buildPortalUrl({ destination, locale, siteUrl })
        };
    } catch {
        return undefined;
    }
}

/** Arguments for {@link buildHelpLinks}. RO-RO. */
export interface BuildHelpLinksArgs {
    /** The topic. */
    readonly topic: HelpLinkSource;
    /** The kind of owner asking; omit for every vertical. */
    readonly audience?: OwnerHelpCallerAudience;
    /**
     * The caller's own listings. `undefined` when they could not be read: editor
     * links then fall back to the lists of listings.
     */
    readonly ownListings?: readonly HelpOwnListing[];
    /** Public base URL of the web app. */
    readonly siteUrl: string;
    /** Locale prefix of the links (the user's web language). Defaults to `es`. */
    readonly locale?: PortalLocale;
}

/**
 * Whether a topic has an editor-section destination that applies to the
 * audience, that is, whether answering it needs the caller's listings.
 *
 * @param args - The topic and the optional audience
 * @returns `true` when the listings are needed
 */
export function topicNeedsOwnListings({
    topic,
    audience
}: {
    readonly topic: HelpLinkSource;
    readonly audience?: OwnerHelpCallerAudience;
}): boolean {
    return topic.destinations.some(
        (destination) =>
            destination.kind === 'ownEditorSection' &&
            destinationFitsAudience({ destination, audience })
    );
}

/** What {@link collectDestinationLinks} found. */
interface CollectedLinks {
    /** The links, in destination order, not yet deduplicated. */
    readonly links: readonly HelpLink[];
    /** The vertical of every editor-section destination that applied. */
    readonly editorVerticals: readonly PortalListingVertical[];
}

/**
 * Expands destinations into links: a portal page becomes one link, an editor
 * section one link per editable listing of the caller in that vertical (or the
 * list of listings when the listings could not be read). Destinations of
 * another audience are skipped.
 */
function collectDestinationLinks({
    destinations,
    audience,
    ownListings,
    siteUrl,
    locale
}: {
    readonly destinations: readonly HelpDestination[];
    readonly audience?: OwnerHelpCallerAudience;
    readonly ownListings?: readonly HelpOwnListing[];
    readonly siteUrl: string;
    readonly locale?: PortalLocale;
}): CollectedLinks {
    const links: HelpLink[] = [];
    const editorVerticals: PortalListingVertical[] = [];

    for (const destination of destinations) {
        if (!destinationFitsAudience({ destination, audience })) {
            continue;
        }
        if (destination.kind !== 'ownEditorSection') {
            const link = toLink({ destination, label: destination.label, siteUrl, locale });
            if (link !== undefined) {
                links.push(link);
            }
            continue;
        }
        editorVerticals.push(destination.vertical);
        if (ownListings === undefined) {
            const link = toLink({
                destination: { kind: 'ownerListings', vertical: destination.vertical },
                siteUrl,
                locale
            });
            if (link !== undefined) {
                links.push(link);
            }
            continue;
        }
        const editable = ownListings.filter(
            (candidate) =>
                candidate.vertical === destination.vertical &&
                candidate.publicationStatus !== PublicationStatusEnum.PURGED
        );
        for (const [index, listing] of editable
            .slice(0, HELP_LINKS_MAX_LISTINGS_PER_VERTICAL)
            .entries()) {
            const link = toLink({
                destination: {
                    kind: 'listingEditor',
                    vertical: destination.vertical,
                    id: listing.id,
                    section: destination.section
                },
                label: `${destination.label ?? 'Editor'} · ${VERTICAL_NOUN[destination.vertical]} ${index + 1}`,
                siteUrl,
                locale
            });
            if (link !== undefined) {
                links.push(link);
            }
        }
    }
    return { links, editorVerticals };
}

/** The links with every URL listed once, first occurrence kept. */
function dedupeLinks(links: readonly HelpLink[]): readonly HelpLink[] {
    const seen = new Set<string>();
    return links.filter((link) => {
        if (seen.has(link.url)) {
            return false;
        }
        seen.add(link.url);
        return true;
    });
}

/**
 * The links of one topic.
 *
 * - A portal page becomes one link.
 * - An editor section becomes one link per listing the caller owns in that
 *   vertical (at most {@link HELP_LINKS_MAX_LISTINGS_PER_VERTICAL}). When the
 *   listings could not be read it becomes the list of listings of the vertical.
 *   When the caller has none, it is left out, and if that leaves the topic with
 *   no link at all the publish page of those verticals is offered instead.
 * - A topic that extends a FAQ item ends with the FAQ page.
 * - Links to the same page are listed once.
 *
 * @param args - The topic, the audience, the caller's listings and the site URL
 * @returns The links, in the topic's order
 */
export function buildHelpLinks({
    topic,
    audience,
    ownListings,
    siteUrl,
    locale
}: BuildHelpLinksArgs): readonly HelpLink[] {
    const collected = collectDestinationLinks({
        destinations: topic.destinations,
        audience,
        ownListings,
        siteUrl,
        locale
    });
    const links = [...collected.links];

    if (links.length === 0) {
        for (const vertical of new Set(collected.editorVerticals)) {
            const link = toLink({
                destination: { kind: 'createListing', vertical },
                siteUrl,
                locale
            });
            if (link !== undefined) {
                links.push(link);
            }
        }
    }

    if (topic.faqKey !== undefined) {
        const link = toLink({ destination: { kind: 'faq' }, siteUrl, locale });
        if (link !== undefined) {
            links.push(link);
        }
    }

    return dedupeLinks(links);
}

/** Arguments for {@link appendTokenHelpLinks}. RO-RO. */
export interface AppendTokenHelpLinksArgs {
    /** The topic's own links, from {@link buildHelpLinks}. They stay first and unchanged. */
    readonly links: readonly HelpLink[];
    /** The destinations the topic's returned text names through its tokens. */
    readonly tokenDestinations: readonly HelpDestination[];
    /** The kind of owner asking; omit for every vertical. */
    readonly audience?: OwnerHelpCallerAudience;
    /** The caller's own listings, as for {@link buildHelpLinks}. */
    readonly ownListings?: readonly HelpOwnListing[];
    /** Public base URL of the web app. */
    readonly siteUrl: string;
    /** Locale prefix of the links. Defaults to `es`. */
    readonly locale?: PortalLocale;
}

/**
 * Appends the destinations a topic's tokens name to its links (HOS-2410
 * `docs/data-model.md` §5.2): the text of a resolved `{{link}}` token keeps
 * only its label, so its URL travels here. They expand like the topic's own
 * destinations (an editor section is filled in from the caller's listings) but
 * never add the publish-page fallback or the FAQ page, and a URL already in
 * `links` is not repeated. The existing links keep their order and come first,
 * so a caller that read the old answer reads the same links at the same
 * positions.
 *
 * @param args - The topic's links, its token destinations, the audience, the
 *   caller's listings and the site URL
 * @returns The links with the token links appended
 */
export function appendTokenHelpLinks({
    links,
    tokenDestinations,
    audience,
    ownListings,
    siteUrl,
    locale
}: AppendTokenHelpLinksArgs): readonly HelpLink[] {
    const collected = collectDestinationLinks({
        destinations: tokenDestinations,
        audience,
        ownListings,
        siteUrl,
        locale
    });
    return dedupeLinks([...links, ...collected.links]);
}

/**
 * The links of an answer with no topic: the FAQ and the contact page.
 *
 * @param args.siteUrl - Public base URL of the web app
 * @returns The two links, fewer when a URL cannot be built
 */
export function buildFallbackHelpLinks({
    siteUrl,
    locale
}: {
    readonly siteUrl: string;
    readonly locale?: PortalLocale;
}): readonly HelpLink[] {
    return [{ kind: 'faq' as const }, { kind: 'contact' as const }].flatMap((destination) => {
        const link = toLink({ destination, siteUrl, locale });
        return link === undefined ? [] : [link];
    });
}
