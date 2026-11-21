/**
 * @file link-targets.ts
 * @description The closed table of `{{link:<target>[:<arg>…]}}` targets
 * (HOS-2410 `docs/data-model.md` §5.1). Each target maps 1:1 to a
 * {@link HelpDestination}, so every link in an article goes through the portal
 * route map and never names a URL.
 *
 * `page:<key>` reaches the generic `page` destination of `@repo/portal-routes`,
 * restricted to the keys whose template has no `[dynamic]` segment
 * ({@link HELP_STATIC_PAGE_KEYS}): a help article is static and names no record.
 */

import {
    EDITOR_NON_SECTION_PAGE_SLUGS,
    EDITOR_SECTION_SLUGS,
    editorSlugOf,
    PORTAL_ROUTE_TEMPLATES,
    type PortalListingVertical
} from '@repo/portal-routes';
import {
    HELP_STATIC_PAGE_KEYS,
    type HelpDestination,
    HelpDestinationSchema,
    type HelpStaticPageKey
} from './destination.schema';

/** Per vertical, every editor page id a `section` link may name. */
const HELP_EDITOR_PAGE_IDS: Readonly<Record<PortalListingVertical, readonly string[]>> = {
    accommodation: [
        ...Object.keys(EDITOR_SECTION_SLUGS.accommodation),
        ...Object.keys(EDITOR_NON_SECTION_PAGE_SLUGS.accommodation)
    ],
    venue: [
        ...Object.keys(EDITOR_SECTION_SLUGS.venue),
        ...Object.keys(EDITOR_NON_SECTION_PAGE_SLUGS.venue)
    ],
    experience: [
        ...Object.keys(EDITOR_SECTION_SLUGS.experience),
        ...Object.keys(EDITOR_NON_SECTION_PAGE_SLUGS.experience)
    ]
};

/** How many arguments a target takes and what they mean. */
type LinkTargetArity = 'none' | 'vertical' | 'section' | 'page';

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
    help: { arity: 'none' },
    page: { arity: 'page' }
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

/**
 * The static page keys of each route template, derived from
 * `PORTAL_ROUTE_TEMPLATES` (never kept by hand): what a `page:<route>` anchor
 * can be linked with as `{{link:page:<key>}}`.
 */
export const HELP_PAGE_KEYS_BY_ROUTE: ReadonlyMap<string, readonly HelpStaticPageKey[]> = (() => {
    const byRoute = new Map<string, HelpStaticPageKey[]>();
    for (const key of HELP_STATIC_PAGE_KEYS) {
        const route = PORTAL_ROUTE_TEMPLATES[key];
        byRoute.set(route, [...(byRoute.get(route) ?? []), key]);
    }
    return byRoute;
})();

/**
 * The static page keys whose template is a route.
 *
 * @param args.route - A route template, as in a `page:<route>` anchor
 * @returns The keys, empty when no `page` destination reaches the route
 *
 * @example
 * ```ts
 * helpPageKeysForRoute({ route: 'mi-cuenta' }); // ['accountHome']
 * ```
 */
export function helpPageKeysForRoute({
    route
}: {
    readonly route: string;
}): readonly HelpStaticPageKey[] {
    return HELP_PAGE_KEYS_BY_ROUTE.get(route) ?? [];
}

/** Result of {@link resolveHelpLinkTarget}. */
export type ResolveHelpLinkTargetResult =
    | { readonly ok: true; readonly destination: HelpDestination }
    | { readonly ok: false; readonly reason: string };

/** The listing vertical an argument names, or `undefined`. */
function listingVertical(arg: string | undefined): PortalListingVertical | undefined {
    return LISTING_VERTICALS.find((vertical) => vertical === arg);
}

/**
 * The `ownEditorSection` destination of an editor slug of a vertical: a catalog
 * section slug or the slug of an editor page that is not a catalog section
 * (`EDITOR_NON_SECTION_PAGE_SLUGS`). `undefined` when the vertical has neither.
 * The ids come from the destination schema, so a slug resolves exactly when the
 * schema would accept its destination.
 */
function sectionIdOfSlug({
    vertical,
    slug
}: {
    readonly vertical: PortalListingVertical;
    readonly slug: string;
}): HelpDestination | undefined {
    for (const candidate of HELP_EDITOR_PAGE_IDS[vertical]) {
        const destination = HelpDestinationSchema.safeParse({
            kind: 'ownEditorSection',
            vertical,
            section: candidate
        });
        if (
            destination.success &&
            destination.data.kind === 'ownEditorSection' &&
            editorSlugOf({ vertical, section: destination.data.section }) === slug
        ) {
            return destination.data;
        }
    }
    return undefined;
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
    if (arity === 'page') {
        const page = HELP_STATIC_PAGE_KEYS.find((key) => key === rest[0]);
        if (rest.length !== 1 || page === undefined) {
            return {
                ok: false,
                reason: `link target "page" needs one static page key (${HELP_STATIC_PAGE_KEYS.join(', ')})`
            };
        }
        return { ok: true, destination: { kind: 'page', page } };
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
