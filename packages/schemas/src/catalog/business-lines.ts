import { AccommodationTypeEnum } from '../enums/accommodation-type.enum.js';
import { ExperienceTypeEnum } from '../enums/experience-type.enum.js';
import { VenueTypeEnum } from '../enums/venue-type.enum.js';
import type {
    BusinessLineDefinitionBase,
    BusinessLineRules,
    ListingVertical
} from './listing-catalog.types.js';

/** Business lines available for listing creation and public collections. */
export const BUSINESS_LINES = {
    venue: [
        {
            vertical: 'venue',
            value: 'food',
            urlSlug: 'gastronomia',
            public: true,
            sections: ['menu', 'dailySpecials']
        },
        {
            vertical: 'venue',
            value: 'nightlife',
            urlSlug: 'noche',
            public: true,
            sections: ['nightInfo']
        }
    ] as const satisfies readonly BusinessLineDefinitionBase<'venue'>[],
    accommodation: [
        { vertical: 'accommodation', value: 'standard', public: false, sections: [] }
    ] as const satisfies readonly BusinessLineDefinitionBase<'accommodation'>[],
    experience: [
        { vertical: 'experience', value: 'standard', public: false, sections: [] }
    ] as const satisfies readonly BusinessLineDefinitionBase<'experience'>[]
};
const foodNight = { allowed: ['food', 'nightlife'], preselect: ['food', 'nightlife'] } as const;
const foodNightRestaurant = { allowed: ['food', 'nightlife'], preselect: ['food'] } as const;
const foodOnly = { allowed: ['food'], preselect: ['food'] } as const;
const nightOnly = { allowed: ['nightlife'], preselect: ['nightlife'] } as const;
/** Type-specific rules for assigning business lines. */
export const BUSINESS_LINE_RULES = {
    venue: {
        vertical: 'venue',
        typeRules: {
            [VenueTypeEnum.RESTAURANT]: foodNightRestaurant,
            [VenueTypeEnum.CAFE]: foodOnly,
            [VenueTypeEnum.PARRILLA]: foodOnly,
            [VenueTypeEnum.HELADERIA]: foodOnly,
            [VenueTypeEnum.PANADERIA]: foodOnly,
            [VenueTypeEnum.ROTISERIA]: foodOnly,
            [VenueTypeEnum.FOOD_TRUCK]: foodOnly,
            [VenueTypeEnum.BAR]: foodNight,
            [VenueTypeEnum.CERVECERIA]: foodNight,
            [VenueTypeEnum.PUB]: foodNight,
            [VenueTypeEnum.BOLICHE]: nightOnly
        }
    } as const satisfies BusinessLineRules<'venue'>,
    accommodation: {
        vertical: 'accommodation',
        typeRules: {
            [AccommodationTypeEnum.APARTMENT]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.HOUSE]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.COUNTRY_HOUSE]: {
                allowed: ['standard'],
                preselect: ['standard']
            },
            [AccommodationTypeEnum.CABIN]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.HOTEL]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.HOSTEL]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.CAMPING]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.ROOM]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.MOTEL]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.RESORT]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.APART_HOTEL]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.ESTANCIA]: { allowed: ['standard'], preselect: ['standard'] },
            [AccommodationTypeEnum.BED_AND_BREAKFAST]: {
                allowed: ['standard'],
                preselect: ['standard']
            }
        }
    } as const satisfies BusinessLineRules<'accommodation'>,
    experience: {
        vertical: 'experience',
        typeRules: {
            [ExperienceTypeEnum.CAR_RENTAL]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.BIKE_RENTAL]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.KAYAK_RENTAL]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.QUAD_RENTAL]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.TOUR_GUIDE]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.GUIDED_VISIT]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.EXCURSION]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.BOAT_TRIP]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.FISHING_CHARTER]: {
                allowed: ['standard'],
                preselect: ['standard']
            },
            [ExperienceTypeEnum.BIRD_WATCHING]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.CULTURAL_TOUR]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.WINE_TASTING]: { allowed: ['standard'], preselect: ['standard'] },
            [ExperienceTypeEnum.OUTDOOR_ADVENTURE]: {
                allowed: ['standard'],
                preselect: ['standard']
            },
            [ExperienceTypeEnum.OTHER]: { allowed: ['standard'], preselect: ['standard'] }
        }
    } as const satisfies BusinessLineRules<'experience'>
};
/** A business line that has a public collection, and therefore a URL slug. */
type PublicBusinessLineEntry = Extract<
    (typeof BUSINESS_LINES)[ListingVertical][number],
    { readonly urlSlug: string }
>;
/** Internal value of a business line with a public collection. */
export type PublicBusinessLine = PublicBusinessLineEntry['value'];
/** Public URL slug of a business line collection. */
export type BusinessLineUrlSlug = PublicBusinessLineEntry['urlSlug'];

const PUBLIC_BUSINESS_LINES: readonly PublicBusinessLineEntry[] = Object.values(BUSINESS_LINES)
    .flat()
    .filter((line): line is PublicBusinessLineEntry => 'urlSlug' in line);

/**
 * Converts an internal business line to its public URL slug. This catalog is
 * the only place the slugs are written (G-FAC-R1 exemption b).
 *
 * @param input - The business line to convert.
 * @param input.value - Internal value of a business line with a public collection.
 * @returns The public URL slug of that business line.
 * @throws {Error} If the catalog declares no slug for the value (cannot happen
 *   for a value of type {@link PublicBusinessLine}).
 */
export function businessLineToUrlSlug({ value }: { readonly value: PublicBusinessLine }): {
    readonly urlSlug: BusinessLineUrlSlug;
} {
    const line = PUBLIC_BUSINESS_LINES.find((entry) => entry.value === value);
    if (!line) {
        throw new Error(`Business line "${value}" has no public URL slug`);
    }
    return { urlSlug: line.urlSlug };
}

/**
 * Resolves a public URL slug (for example, a route segment) to its internal
 * business line.
 *
 * @param input - The slug to resolve.
 * @param input.urlSlug - The URL segment, unvalidated.
 * @returns The business line, or `undefined` when no public line uses that slug.
 */
export function urlSlugToBusinessLine({ urlSlug }: { readonly urlSlug: string }): {
    readonly value: PublicBusinessLine | undefined;
} {
    return { value: PUBLIC_BUSINESS_LINES.find((entry) => entry.urlSlug === urlSlug)?.value };
}
