/**
 * Dress code enum for the nightlife `nightInfo` section of a venue.
 *
 * A closed list rather than free text so the label can be translated on its
 * own; anything the list cannot express goes in the section's optional note.
 */
export enum VenueDressCodeEnum {
    CASUAL = 'casual',
    SMART_CASUAL = 'smart_casual',
    ELEGANT = 'elegant',
    NO_RESTRICTIONS = 'no_restrictions'
}
