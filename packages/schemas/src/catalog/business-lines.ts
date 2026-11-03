import { AccommodationTypeEnum } from '../enums/accommodation-type.enum.js';
import { ExperienceTypeEnum } from '../enums/experience-type.enum.js';
import { VenueTypeEnum } from '../enums/venue-type.enum.js';
import type { BusinessLineDefinition, BusinessLineRules } from './listing-catalog.types.js';

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
    ] as const satisfies readonly BusinessLineDefinition<'venue'>[],
    accommodation: [
        { vertical: 'accommodation', value: 'standard', public: false, sections: [] }
    ] as const satisfies readonly BusinessLineDefinition<'accommodation'>[],
    experience: [
        { vertical: 'experience', value: 'standard', public: false, sections: [] }
    ] as const satisfies readonly BusinessLineDefinition<'experience'>[]
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
/** Convert an internal business line to its public URL slug. */
export function businessLineToUrlSlug(value: 'food' | 'nightlife'): 'gastronomia' | 'noche' {
    return value === 'food' ? 'gastronomia' : 'noche';
}
/** Resolve a public URL slug to its internal business line. */
export function urlSlugToBusinessLine(slug: 'gastronomia' | 'noche'): 'food' | 'nightlife' {
    return slug === 'gastronomia' ? 'food' : 'nightlife';
}
