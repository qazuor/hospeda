/** Entity types declared for newsletter dynamic blocks, including future types. */
export enum NewsletterDynamicEntityTypeEnum {
    ACCOMMODATION = 'ACCOMMODATION',
    VENUE = 'VENUE',
    POST = 'POST',
    EVENT = 'EVENT',
    EXPERIENCE = 'EXPERIENCE',
    PARTNER = 'PARTNER'
}

/** Entity types with operational dynamic newsletter content in F1. */
export const ENABLED_DYNAMIC_ENTITY_TYPES: readonly NewsletterDynamicEntityTypeEnum[] = [
    NewsletterDynamicEntityTypeEnum.ACCOMMODATION
] as const;
