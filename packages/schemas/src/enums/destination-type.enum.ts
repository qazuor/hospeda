/**
 * Destination Type Enum
 * Defines the hierarchy level of a destination in the geographic structure.
 *
 * COUNTRY: Level 0 - e.g., Argentina, Uruguay
 * REGION: Level 1 - e.g., Litoral, Cuyo, Patagonia
 * PROVINCE: Level 2 - e.g., Entre Rios, Buenos Aires
 * DEPARTMENT: Level 3 - e.g., Depto. Uruguay
 * CITY: Level 4 - e.g., Concepcion del Uruguay
 * TOWN: Level 5 - e.g., Small towns/villages
 * NEIGHBORHOOD: Level 6 - e.g., Barrio within a city
 */
export enum DestinationTypeEnum {
    COUNTRY = 'COUNTRY',
    REGION = 'REGION',
    PROVINCE = 'PROVINCE',
    DEPARTMENT = 'DEPARTMENT',
    CITY = 'CITY',
    TOWN = 'TOWN',
    NEIGHBORHOOD = 'NEIGHBORHOOD'
}

/**
 * Mapping of destination types to their expected hierarchy levels.
 * Used for validation when creating/updating destinations.
 */
export const DESTINATION_TYPE_LEVELS: Readonly<Record<DestinationTypeEnum, number>> = {
    [DestinationTypeEnum.COUNTRY]: 0,
    [DestinationTypeEnum.REGION]: 1,
    [DestinationTypeEnum.PROVINCE]: 2,
    [DestinationTypeEnum.DEPARTMENT]: 3,
    [DestinationTypeEnum.CITY]: 4,
    [DestinationTypeEnum.TOWN]: 5,
    [DestinationTypeEnum.NEIGHBORHOOD]: 6
} as const;
