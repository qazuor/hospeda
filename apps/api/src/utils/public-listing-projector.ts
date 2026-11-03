import { LISTING_SECTIONS, VerticalEnum } from '@repo/schemas';
import {
    type RehydratedEffectiveSet,
    rehydrateEffectiveSet,
    resolveListingSections
} from '@repo/verticals';
import { getListingAccessPorts } from './listing-access/ports';
import { apiLogger } from './logger';

type ListingRecord = Record<string, unknown> & {
    readonly id: string;
    readonly ownerId: string;
    readonly businessLines?: readonly string[] | null;
};

const VERTICALS = { venue: VerticalEnum.VENUE, experience: VerticalEnum.EXPERIENCE } as const;
type PublicVertical = keyof typeof VERTICALS;

function projectVenueMenuTraits(
    listing: Record<string, unknown>,
    states: ReadonlyMap<
        string,
        { readonly state: string; readonly traits: ReadonlyMap<string, string> }
    >
): Record<string, unknown> {
    const menu = states.get('menu');
    const sections = listing.menuSections;
    if (menu?.state !== 'available' || !Array.isArray(sections)) return listing;
    const keepPhotos = menu.traits.get('itemPhotos') === 'available';
    const keepTranslations = menu.traits.get('translations') === 'available';
    const projectTranslation = (entity: Record<string, unknown>) =>
        keepTranslations ? entity : { ...entity, nameI18n: null, descriptionI18n: null };
    return {
        ...listing,
        menuSections: sections.map((rawSection) => {
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
    for (const section of LISTING_SECTIONS[args.vertical] as readonly {
        readonly id: string;
        readonly fields: readonly string[];
        readonly traits?: readonly { readonly id: string; readonly fields?: readonly string[] }[];
    }[]) {
        const state = args.states.get(section.id);
        if (state?.state !== 'available') {
            for (const field of section.fields) removed.add(field);
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
    // These are relation/column names from older public payloads. Their catalog
    // sections own the state, but the relation fields are not CRUD fields and
    // therefore cannot appear in LISTING_SECTIONS.fields.
    if (args.vertical === 'venue') {
        const menu = args.states.get('menu');
        if (menu?.state !== 'available') {
            for (const field of ['menuFileUrl', 'menuFileKind', 'menuSections']) removed.add(field);
        }
        if (args.states.get('dailySpecials')?.state !== 'available') removed.add('dailySpecials');
        if (args.states.get('venueEvents')?.state !== 'available') removed.add('venueEvents');
    }
    const projected = Object.fromEntries(
        Object.entries(args.listing).filter(([key]) => !removed.has(key))
    );
    return (
        args.vertical === 'venue' ? projectVenueMenuTraits(projected, args.states) : projected
    ) as T;
}

function deniedSet(userId: string, vertical: PublicVertical): RehydratedEffectiveSet {
    return rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical: VERTICALS[vertical],
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: []
    });
}

/** Resolve and project one public page, reading one effective set per distinct owner. */
export async function projectPublicListings<T extends ListingRecord>(args: {
    readonly vertical: PublicVertical;
    readonly listings: readonly T[];
}): Promise<T[]> {
    const owners = [...new Set(args.listings.map((listing) => listing.ownerId))];
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
                apiLogger.warn(
                    { userId, vertical: VERTICALS[args.vertical] },
                    'Effective set lookup failed for public listing'
                );
                effectiveByOwner.set(userId, deniedSet(userId, args.vertical));
            }
        })
    );
    return args.listings.map((listing) => {
        const resolved = resolveListingSections({
            vertical: args.vertical,
            businessLines: listing.businessLines ?? [],
            effective:
                effectiveByOwner.get(listing.ownerId) ?? deniedSet(listing.ownerId, args.vertical),
            userId: listing.ownerId
        });
        const projected = projectPublicListing({
            vertical: args.vertical,
            listing,
            states: resolved.sections
        });
        if (args.vertical === 'experience') {
            const meetingPoint = resolved.sections.get('meetingPoint');
            return {
                ...projected,
                meetingPointDirectionsEnabled:
                    meetingPoint?.traits.get('directions') === 'available'
            } as T;
        }
        return projected;
    });
}
