/**
 * @file link-targets.ts
 * @description The closed table of `{{link:<target>[:<arg>…]}}` targets
 * (HOS-2410 `docs/data-model.md` §5.1). Each target maps 1:1 to a
 * {@link HelpDestination}, so every link in an article goes through the portal
 * route map and never names a URL.
 */

import { EDITOR_SECTION_SLUGS, type PortalListingVertical } from '@repo/portal-routes';
import type { HelpDestination } from './destination.schema';

/** How many arguments a target takes and what they mean. */
type LinkTargetArity = 'none' | 'vertical' | 'section';

/** One entry of {@link HELP_LINK_TARGETS}. */
interface LinkTargetSpec {
    /** The arguments after the target name. */
    readonly arity: LinkTargetArity;
}

/** Every link target, with its arguments. */
export const HELP_LINK_TARGETS = {
    plans: { arity: 'vertical' },
    subscription: { arity: 'none' },
    addons: { arity: 'none' },
    list: { arity: 'vertical' },
    create: { arity: 'vertical' },
    section: { arity: 'section' },
    inquiries: { arity: 'none' },
    providerDirectory: { arity: 'none' },
    benefitUsages: { arity: 'none' },
    providerPanel: { arity: 'none' },
    partnerPanel: { arity: 'none' },
    aiAssistants: { arity: 'none' },
    faq: { arity: 'none' },
    contact: { arity: 'none' },
    help: { arity: 'none' }
} as const satisfies Record<string, LinkTargetSpec>;

/** Name of a link target. */
export type HelpLinkTargetName = keyof typeof HELP_LINK_TARGETS;

/** The destination of each argument-less target. A test checks every one is listed. */
const BARE_DESTINATIONS: Readonly<Partial<Record<HelpLinkTargetName, HelpDestination>>> = {
    subscription: { kind: 'subscription' },
    addons: { kind: 'addons' },
    inquiries: { kind: 'inquiry' },
    providerDirectory: { kind: 'providerDirectory' },
    benefitUsages: { kind: 'benefitUsages' },
    providerPanel: { kind: 'providerPanel' },
    partnerPanel: { kind: 'partnerPanel' },
    aiAssistants: { kind: 'aiAssistants' },
    faq: { kind: 'faq' },
    contact: { kind: 'contact' },
    help: { kind: 'helpLanding' }
};

/** The listing verticals a `vertical` argument may name. */
const LISTING_VERTICALS: readonly PortalListingVertical[] = [
    'accommodation',
    'venue',
    'experience'
];

/** Result of {@link resolveHelpLinkTarget}. */
export type ResolveHelpLinkTargetResult =
    | { readonly ok: true; readonly destination: HelpDestination }
    | { readonly ok: false; readonly reason: string };

/** The listing vertical an argument names, or `undefined`. */
function listingVertical(arg: string | undefined): PortalListingVertical | undefined {
    return LISTING_VERTICALS.find((vertical) => vertical === arg);
}

/** The catalog section id of an editor slug of a vertical, or `undefined`. */
function sectionIdOfSlug({
    vertical,
    slug
}: {
    readonly vertical: PortalListingVertical;
    readonly slug: string;
}): HelpDestination | undefined {
    switch (vertical) {
        case 'accommodation': {
            const slugs = EDITOR_SECTION_SLUGS.accommodation;
            const section = (Object.keys(slugs) as Array<keyof typeof slugs>).find(
                (id) => slugs[id] === slug
            );
            return section === undefined
                ? undefined
                : { kind: 'ownEditorSection', vertical, section };
        }
        case 'venue': {
            const slugs = EDITOR_SECTION_SLUGS.venue;
            const section = (Object.keys(slugs) as Array<keyof typeof slugs>).find(
                (id) => slugs[id] === slug
            );
            return section === undefined
                ? undefined
                : { kind: 'ownEditorSection', vertical, section };
        }
        case 'experience': {
            const slugs = EDITOR_SECTION_SLUGS.experience;
            const section = (Object.keys(slugs) as Array<keyof typeof slugs>).find(
                (id) => slugs[id] === slug
            );
            return section === undefined
                ? undefined
                : { kind: 'ownEditorSection', vertical, section };
        }
    }
}

/**
 * The destination a `link` token's arguments name.
 *
 * @param args.args - The token's arguments, target first (`['plans', 'venue']`)
 * @returns The destination, or why the arguments name none
 *
 * @example
 * ```ts
 * resolveHelpLinkTarget({ args: ['section', 'venue', 'carta'] });
 * // { ok: true, destination: { kind: 'ownEditorSection', vertical: 'venue', section: 'menu' } }
 * ```
 */
export function resolveHelpLinkTarget({
    args
}: {
    readonly args: readonly string[];
}): ResolveHelpLinkTargetResult {
    const [target, ...rest] = args;
    const name = (Object.keys(HELP_LINK_TARGETS) as HelpLinkTargetName[]).find(
        (candidate) => candidate === target
    );
    if (name === undefined) {
        return { ok: false, reason: `unknown link target "${target ?? ''}"` };
    }
    const { arity } = HELP_LINK_TARGETS[name];
    if (arity === 'none') {
        const destination = BARE_DESTINATIONS[name];
        if (rest.length > 0 || destination === undefined) {
            return { ok: false, reason: `link target "${name}" takes no argument` };
        }
        return { ok: true, destination };
    }
    const vertical = listingVertical(rest[0]);
    if (vertical === undefined) {
        return { ok: false, reason: `link target "${name}" needs a listing vertical` };
    }
    if (arity === 'vertical') {
        if (rest.length !== 1) {
            return { ok: false, reason: `link target "${name}" takes exactly one vertical` };
        }
        const kind =
            name === 'plans' ? 'plans' : name === 'list' ? 'ownerListings' : 'createListing';
        return { ok: true, destination: { kind, vertical } };
    }
    const slug = rest[1];
    const destination =
        rest.length === 2 && slug !== undefined ? sectionIdOfSlug({ vertical, slug }) : undefined;
    if (destination === undefined) {
        return {
            ok: false,
            reason: `link target "section" needs <vertical>:<slug> with an editor slug of that vertical`
        };
    }
    return { ok: true, destination };
}
