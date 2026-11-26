import {
    LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL,
    LISTING_SECTIONS,
    partitionGalleryByCap,
    REVIEW_RULES,
    VerticalEnum
} from '@repo/schemas';
import {
    type RehydratedEffectiveSet,
    rehydrateEffectiveSet,
    resolveListingSections,
    resolvePublicBusinessLines
} from '@repo/verticals';
import { incrementDomainCounter } from '../middlewares/metrics';
import { getListingAccessPorts } from './listing-access/ports';
import { apiLogger } from './logger';

type ListingRecord = Record<string, unknown> & {
    readonly id: string;
    readonly ownerId: string;
    readonly businessLines?: readonly string[] | null;
    readonly type?: string;
};

const VERTICALS = {
    venue: VerticalEnum.VENUE,
    experience: VerticalEnum.EXPERIENCE,
    accommodation: VerticalEnum.ACCOMMODATION
} as const;
/** Verticals whose public payload the catalog projects. */
export type PublicVertical = keyof typeof VERTICALS;

/**
 * Projects nested menu-section and item shapes using the menu traits. These
 * nested fields describe content shape; section response field names come
 * from the catalog metadata below.
 */
function projectVenueMenuTraits(
    listing: Record<string, unknown>,
    states: ReadonlyMap<
        string,
        { readonly state: string; readonly traits: ReadonlyMap<string, string> }
    >
): Record<string, unknown> {
    const menu = states.get('menu');
    const sectionsField = (
        LISTING_SECTIONS.venue as readonly {
            readonly id: string;
            readonly readOnlyFields?: readonly string[];
        }[]
    )
        .find(({ id }) => id === 'menu')
        ?.readOnlyFields?.at(-1);
    if (!sectionsField) return listing;
    const sections = listing[sectionsField];
    if (menu?.state !== 'available' || !Array.isArray(sections)) return listing;
    const keepPhotos = menu.traits.get('itemPhotos') === 'available';
    const keepTranslations = menu.traits.get('translations') === 'available';
    const projectTranslation = (entity: Record<string, unknown>) =>
        keepTranslations ? entity : { ...entity, nameI18n: null, descriptionI18n: null };
    return {
        ...listing,
        [sectionsField]: sections.map((rawSection) => {
            const section = projectTranslation(rawSection as Record<string, unknown>);
            const items = Array.isArray(section.items) ? section.items : [];
            return {
                ...section,
                items: items.map((rawItem) => {
                    const { photoPublicId: _photoPublicId, ...rest } = rawItem as Record<
                        string,
                        unknown
                    >;
                    const withPhoto = keepPhotos
                        ? rest
                        : { ...rest, photoUrl: null, photoAlt: null };
                    return projectTranslation(withPhoto);
                })
            };
        })
    };
}

/**
 * Removes from a `policies` object the keys owned by an unavailable section
 * (HOS-2060, `policyKeys`). Anything that is not a plain object passes through.
 */
function stripPolicyKeys(value: unknown, keys: ReadonlySet<string>): unknown {
    if (keys.size === 0 || value === null || typeof value !== 'object' || Array.isArray(value)) {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).filter(([key]) => !keys.has(key))
    );
}

/**
 * Empties, inside a nested `media` object, the keys a catalog field removal also
 * covers (HOS-2258). A trait declares `fields: ['videos']` at the top level, but
 * the read model repeats the value as `media.videos`; without this the video
 * would leave through the nested copy. The key stays and becomes `[]`, the same
 * shape the accommodation projection has always published, so a consumer that
 * reads `media.videos` keeps getting an array. Anything that is not a plain
 * object passes through.
 */
function emptyNestedMediaFields(value: unknown, removed: ReadonlySet<string>): unknown {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
            key,
            removed.has(key) && Array.isArray(entry) ? [] : entry
        ])
    );
}

/** Removes every catalog field whose section or trait is not available. */
export function projectPublicListing<T extends Record<string, unknown>>(args: {
    readonly vertical: PublicVertical;
    readonly listing: T;
    readonly states: ReadonlyMap<
        string,
        { readonly state: string; readonly traits: ReadonlyMap<string, string> }
    >;
}): T {
    const removed = new Set<string>();
    const removedPolicyKeys = new Set<string>();
    for (const section of LISTING_SECTIONS[args.vertical] as readonly {
        readonly id: string;
        readonly fields: readonly string[];
        readonly readOnlyFields?: readonly string[];
        readonly policyKeys?: readonly string[];
        readonly traits?: readonly { readonly id: string; readonly fields?: readonly string[] }[];
    }[]) {
        const state = args.states.get(section.id);
        if (state?.state !== 'available') {
            for (const field of section.fields) removed.add(field);
            for (const key of section.policyKeys ?? []) removedPolicyKeys.add(key);
            for (const field of section.readOnlyFields ?? []) removed.add(field);
            for (const trait of section.traits ?? []) {
                for (const field of trait.fields ?? []) removed.add(field);
            }
            continue;
        }
        for (const trait of section.traits ?? []) {
            if (state.traits.get(trait.id) !== 'available')
                for (const field of trait.fields ?? []) removed.add(field);
        }
    }
    const projected = Object.fromEntries(
        Object.entries(args.listing)
            .map(([key, value]): [string, unknown] => {
                if (key === 'policies') return [key, stripPolicyKeys(value, removedPolicyKeys)];
                if (key === 'media') return [key, emptyNestedMediaFields(value, removed)];
                return [key, value];
            })
            .filter(([key, value]) => {
                if (removed.has(key)) return false;
                return !(
                    args.vertical === 'experience' &&
                    key === 'meetingPointDirections' &&
                    Array.isArray(value) &&
                    value.length === 0
                );
            })
    );
    if (args.vertical === 'venue') return projectVenueMenuTraits(projected, args.states) as T;
    return projected as T;
}

/**
 * Trims the public gallery of one projected listing to its owner's effective
 * photo cap (HOS-2495, D-13/D-14). `media.gallery` is the composed public
 * gallery (approved, visible, non-featured, `sort_order`): its first N items are
 * shown and the rest hidden, without touching any row. `featuredImage` is never
 * touched. A key absent from the set reads as 0 (cover only), which is also what
 * a failed lookup yields through {@link deniedSet} (AC-22).
 *
 * @param args.vertical - The listing vertical.
 * @param args.listing - The projected public listing.
 * @param args.effective - The owner's effective set, already read for the page.
 * @returns The listing with `media.gallery` trimmed, or unchanged when it has none.
 */
export function trimPublicGallery<T extends Record<string, unknown>>(args: {
    readonly vertical: PublicVertical;
    readonly listing: T;
    readonly ownerId: string;
    readonly effective: RehydratedEffectiveSet;
}): T {
    const media = args.listing.media;
    if (media === null || typeof media !== 'object' || Array.isArray(media)) return args.listing;
    const gallery = (media as Record<string, unknown>).gallery;
    if (!Array.isArray(gallery)) return args.listing;
    const cap =
        args.effective.limits.get({
            key: LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL[args.vertical],
            userId: args.ownerId,
            vertical: VERTICALS[args.vertical]
        }) ?? 0;
    return {
        ...args.listing,
        media: { ...media, gallery: partitionGalleryByCap({ items: gallery, cap }).shown }
    };
}

/** The effective set of an owner that holds nothing: every section keyed by an entitlement is `locked`. */
export function deniedSet(userId: string, vertical: PublicVertical): RehydratedEffectiveSet {
    return rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical: VERTICALS[vertical],
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: []
    });
}

/**
 * Reads one effective set per distinct owner (the N+1 guard of every public page).
 * A lookup that fails is logged and answered with {@link deniedSet}, so a failure
 * hides paid content instead of leaking it.
 */
export async function readOwnerEffectiveSets(args: {
    readonly vertical: PublicVertical;
    readonly ownerIds: readonly string[];
    readonly onEffectiveSetFailure?: () => void;
}): Promise<Map<string, RehydratedEffectiveSet>> {
    const owners = [...new Set(args.ownerIds)];
    const effectiveByOwner = new Map<string, RehydratedEffectiveSet>();
    await Promise.all(
        owners.map(async (userId) => {
            try {
                effectiveByOwner.set(
                    userId,
                    await getListingAccessPorts().effectiveSet({
                        userId,
                        vertical: VERTICALS[args.vertical]
                    })
                );
            } catch {
                args.onEffectiveSetFailure?.();
                apiLogger.warn(
                    { userId, vertical: VERTICALS[args.vertical] },
                    'Effective set lookup failed for public listing'
                );
                effectiveByOwner.set(userId, deniedSet(userId, args.vertical));
            }
        })
    );
    return effectiveByOwner;
}

/** Resolve and project one public page, reading one effective set per distinct owner. */
export async function projectPublicListings<T extends ListingRecord>(args: {
    readonly vertical: Exclude<PublicVertical, 'accommodation'>;
    readonly listings: readonly T[];
    readonly onEffectiveSetFailure?: () => void;
}): Promise<T[]> {
    const effectiveByOwner = await readOwnerEffectiveSets({
        vertical: args.vertical,
        ownerIds: args.listings.map((listing) => listing.ownerId),
        onEffectiveSetFailure: args.onEffectiveSetFailure
    });
    return args.listings.map((listing) => {
        const businessLines = resolvePublicBusinessLines({
            vertical: args.vertical,
            type: listing.type ?? '',
            businessLines: listing.businessLines
        });
        if (!listing.businessLines?.length) {
            apiLogger.error(
                { vertical: args.vertical, id: listing.id, type: listing.type ?? null },
                'Listing has no business lines; applying type preselection for public projection'
            );
            incrementDomainCounter('listing_empty_business_lines_total', 'failure');
        }
        const effective =
            effectiveByOwner.get(listing.ownerId) ?? deniedSet(listing.ownerId, args.vertical);
        const resolved = resolveListingSections({
            vertical: args.vertical,
            businessLines,
            effective,
            userId: listing.ownerId
        });
        const projected = trimPublicGallery({
            vertical: args.vertical,
            listing: projectPublicListing({
                vertical: args.vertical,
                listing,
                states: resolved.sections
            }),
            ownerId: listing.ownerId,
            effective
        });
        if (args.vertical === 'experience') {
            const meetingPoint = resolved.sections.get('meetingPoint');
            return {
                ...projected,
                meetingPointDirectionsEnabled:
                    meetingPoint?.traits.get('directions') === 'available'
            } as T;
        }
        // HOS-1849 / 4.5: `multiLine` is the same resolved fact the owner's
        // `sectionStates` route already exposes. It travels with the public
        // listing so the web never re-derives it from business lines.
        // HOS-1866 / 6.6: `reviewSectionStates` publishes only the sections a
        // review dimension is bound to, so the web can decide which dimensions
        // to offer without comparing business lines (G-FAC-03).
        return projectVenueDimensionRatings(
            {
                ...projected,
                multiLine: resolved.multiLine,
                reviewSectionStates: projectVenueReviewSectionStates(resolved.sections)
            },
            resolved.sections
        ) as T;
    });
}

/**
 * Publishes the state of only the sections a review dimension is bound to
 * (HOS-1866 / 6.6).
 *
 * `locked` is published as `available`: a tourist who reached the listing may
 * have eaten there even when the owner's current plan does not grant the menu,
 * and the public, cacheable page must not reveal the owner's plan (DEC-FAC-072).
 * `absent` is the only state that changes with the business lines, which is the
 * only reason the detail-page cache is purged — so publishing anything else
 * would leave a stale value behind a plan change.
 *
 * @param states - The resolver's section states for this listing.
 * @returns One `{ state }` entry per bound section, `absent` or `available`.
 */
export function projectVenueReviewSectionStates(
    states: ReadonlyMap<string, { readonly state: string }>
): Partial<Record<string, { readonly state: 'absent' | 'available' }>> {
    const projected: Record<string, { readonly state: 'absent' | 'available' }> = {};
    for (const dimension of REVIEW_RULES.venue.dimensions) {
        if (!('boundSection' in dimension)) continue;
        const state = states.get(dimension.boundSection)?.state;
        if (!state) continue;
        projected[dimension.boundSection] = {
            state: state === 'absent' ? 'absent' : 'available'
        };
    }
    return projected;
}

/** Hide persisted dimension aggregates when the dimension's section is absent. */
export function projectVenueDimensionRatings<T extends Record<string, unknown>>(
    listing: T,
    states: ReadonlyMap<
        string,
        { readonly state: string; readonly traits: ReadonlyMap<string, string> }
    >
): T {
    const rating = listing.rating;
    if (!rating || typeof rating !== 'object' || Array.isArray(rating)) return listing;
    const next = { ...(rating as Record<string, unknown>) };
    for (const dimension of REVIEW_RULES.venue.dimensions) {
        if ('boundSection' in dimension && states.get(dimension.boundSection)?.state === 'absent') {
            delete next[dimension.id];
        }
    }
    return { ...listing, rating: next } as T;
}
