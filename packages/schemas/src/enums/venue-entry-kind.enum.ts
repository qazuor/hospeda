/**
 * Entry kind enum for the nightlife `nightInfo` section of a venue.
 *
 * - `free`: no cover charge.
 * - `paid`: a cover charge applies; `entryPriceFrom` may describe its floor.
 * - `varies`: the entry price depends on the night, the event or the area.
 */
export enum VenueEntryKindEnum {
    FREE = 'free',
    PAID = 'paid',
    VARIES = 'varies'
}
