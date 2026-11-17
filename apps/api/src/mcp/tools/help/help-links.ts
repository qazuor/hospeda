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

import type {
    OwnerHelpCallerAudience,
    OwnerHelpDestination,
    OwnerHelpTopic
} from '../../../data/owner-help/owner-help.types';
import { buildPortalUrl } from '../../portal/build-portal-url';
import { describePortalDestination } from '../../portal/portal-destination';
import type { PortalDestination, PortalListingVertical } from '../../portal/portal-routes';

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
    /** The listing's name (the owner's own text). */
    readonly name: string;
}

/** Most listings one editor-section destination expands to, per vertical. */
export const HELP_LINKS_MAX_LISTINGS_PER_VERTICAL = 3;

/** Longest listing name shown in a link label. */
const LINK_NAME_MAX_CHARS = 60;

/** The vertical a kind of owner works in. A provider has none. */
const AUDIENCE_VERTICAL: Readonly<
    Record<OwnerHelpCallerAudience, PortalListingVertical | undefined>
> = {
    host: 'accommodation',
    venue: 'venue',
    experience: 'experience',
    provider: undefined
};

/** The vertical a destination is about, when it is about one. */
function verticalOf(destination: OwnerHelpDestination): PortalListingVertical | undefined {
    return 'vertical' in destination ? destination.vertical : undefined;
}

/** Whether a destination applies to the kind of owner asking. */
function destinationFitsAudience({
    destination,
    audience
}: {
    readonly destination: OwnerHelpDestination;
    readonly audience?: OwnerHelpCallerAudience;
}): boolean {
    const vertical = verticalOf(destination);
    if (audience === undefined || vertical === undefined) {
        return true;
    }
    return AUDIENCE_VERTICAL[audience] === vertical;
}

/** A listing name as one short line. */
function nameForLabel({ name }: { readonly name: string }): string {
    const line = name.replace(/\s+/g, ' ').trim();
    return line.length > LINK_NAME_MAX_CHARS ? `${line.slice(0, LINK_NAME_MAX_CHARS - 1)}…` : line;
}

/** Builds a link, or `undefined` when the URL cannot be built. */
function toLink({
    destination,
    label,
    siteUrl
}: {
    readonly destination: PortalDestination;
    readonly label?: string;
    readonly siteUrl: string;
}): HelpLink | undefined {
    try {
        return {
            label: label ?? describePortalDestination({ destination }),
            url: buildPortalUrl({ destination, siteUrl })
        };
    } catch {
        return undefined;
    }
}

/** Arguments for {@link buildHelpLinks}. RO-RO. */
export interface BuildHelpLinksArgs {
    /** The topic. */
    readonly topic: OwnerHelpTopic;
    /** The kind of owner asking; omit for every vertical. */
    readonly audience?: OwnerHelpCallerAudience;
    /**
     * The caller's own listings. `undefined` when they could not be read: editor
     * links then fall back to the lists of listings.
     */
    readonly ownListings?: readonly HelpOwnListing[];
    /** Public base URL of the web app. */
    readonly siteUrl: string;
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
    readonly topic: OwnerHelpTopic;
    readonly audience?: OwnerHelpCallerAudience;
}): boolean {
    return topic.destinations.some(
        (destination) =>
            destination.kind === 'ownEditorSection' &&
            destinationFitsAudience({ destination, audience })
    );
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
    siteUrl
}: BuildHelpLinksArgs): readonly HelpLink[] {
    const links: HelpLink[] = [];
    const editorVerticals: PortalListingVertical[] = [];

    for (const destination of topic.destinations) {
        if (!destinationFitsAudience({ destination, audience })) {
            continue;
        }
        if (destination.kind !== 'ownEditorSection') {
            const link = toLink({ destination, label: destination.label, siteUrl });
            if (link !== undefined) {
                links.push(link);
            }
            continue;
        }
        editorVerticals.push(destination.vertical);
        if (ownListings === undefined) {
            const link = toLink({
                destination: { kind: 'ownerListings', vertical: destination.vertical },
                siteUrl
            });
            if (link !== undefined) {
                links.push(link);
            }
            continue;
        }
        for (const listing of ownListings
            .filter((candidate) => candidate.vertical === destination.vertical)
            .slice(0, HELP_LINKS_MAX_LISTINGS_PER_VERTICAL)) {
            const link = toLink({
                destination: {
                    kind: 'listingEditor',
                    vertical: destination.vertical,
                    id: listing.id,
                    section: destination.section
                },
                label: `${destination.label ?? 'Editor'} · ${nameForLabel({ name: listing.name })}`,
                siteUrl
            });
            if (link !== undefined) {
                links.push(link);
            }
        }
    }

    if (links.length === 0) {
        for (const vertical of new Set(editorVerticals)) {
            const link = toLink({ destination: { kind: 'createListing', vertical }, siteUrl });
            if (link !== undefined) {
                links.push(link);
            }
        }
    }

    if (topic.faqKey !== undefined) {
        const link = toLink({ destination: { kind: 'faq' }, siteUrl });
        if (link !== undefined) {
            links.push(link);
        }
    }

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
 * The links of an answer with no topic: the FAQ and the contact page.
 *
 * @param args.siteUrl - Public base URL of the web app
 * @returns The two links, fewer when a URL cannot be built
 */
export function buildFallbackHelpLinks({
    siteUrl
}: {
    readonly siteUrl: string;
}): readonly HelpLink[] {
    return [{ kind: 'faq' as const }, { kind: 'contact' as const }].flatMap((destination) => {
        const link = toLink({ destination, siteUrl });
        return link === undefined ? [] : [link];
    });
}
