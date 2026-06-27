/**
 * Experience price unit enum — defines the billing unit for an experience listing.
 *
 * Lowercase values are intentional: they match the PG enum strings and are
 * used as i18n keys (e.g. `experience.priceUnit.per_day`).
 *
 * - PER_DAY: Price is per day (e.g. car or bike rental).
 * - PER_HOUR: Price is per hour (e.g. kayak rental, guided tour).
 * - PER_PERSON: Price is per person (e.g. excursion, boat trip).
 * - PER_GROUP: Price is per group regardless of size (e.g. private tour).
 */
export enum ExperiencePriceUnitEnum {
    PER_DAY = 'per_day',
    PER_HOUR = 'per_hour',
    PER_PERSON = 'per_person',
    PER_GROUP = 'per_group'
}
