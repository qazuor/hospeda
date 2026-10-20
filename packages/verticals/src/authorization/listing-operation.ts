import { PublicationStatusEnum, VERTICAL_ACTIVATION_KEY, VerticalEnum } from '@repo/schemas';

/** Operations on a listing owned by the requesting person. */
export const LISTING_OPERATIONS = [
    'READ_OWN',
    'EXPORT',
    'REACTIVATE',
    'DELETE',
    'EDIT',
    'PUBLISH',
    'READ_PUBLIC',
    'WRITE_ABOUT_LISTING',
    'READ_OWN_COMMERCIAL',
    'CREATE'
] as const;
/** Verticals that have listings. */
export type ListingVertical =
    | VerticalEnum.ACCOMMODATION
    | VerticalEnum.GASTRONOMY
    | VerticalEnum.EXPERIENCE;
export type ListingOperation = (typeof LISTING_OPERATIONS)[number];

/** States in which the owner may attempt each operation. PURGED admits none. */
export const OWNER_ADMITTING_STATES: Readonly<
    Record<ListingOperation, readonly PublicationStatusEnum[]>
> = {
    READ_OWN: [
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED
    ],
    EXPORT: [
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED
    ],
    REACTIVATE: [PublicationStatusEnum.ARCHIVED],
    DELETE: [
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED
    ],
    EDIT: [
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.MODERATED
    ],
    PUBLISH: [PublicationStatusEnum.DRAFT, PublicationStatusEnum.UNPUBLISHED_BY_BILLING],
    READ_PUBLIC: [
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED
    ],
    WRITE_ABOUT_LISTING: [PublicationStatusEnum.PUBLISHED],
    READ_OWN_COMMERCIAL: [
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED
    ],
    CREATE: []
};

/** States visible to a person who does not own the listing. */
export const FOREIGN_ADMITTING_STATES: Readonly<
    Record<ListingOperation, readonly PublicationStatusEnum[]>
> = {
    READ_OWN: [],
    EXPORT: [],
    REACTIVATE: [],
    DELETE: [],
    EDIT: [],
    PUBLISH: [],
    READ_PUBLIC: [PublicationStatusEnum.PUBLISHED],
    WRITE_ABOUT_LISTING: [PublicationStatusEnum.PUBLISHED],
    READ_OWN_COMMERCIAL: [],
    CREATE: []
};

/** The floor capability that permits an owner to recover an archived listing. */
export const RECOVER_OWN_LISTING_KEY = 'recover_own_listing';

/** The capability required by step 6 for a listing operation. */
export type Step6Requirement =
    | { readonly kind: 'NONE' }
    | { readonly kind: 'KEY'; readonly key: string }
    | {
          readonly kind: 'VERTICAL_KEY';
          readonly keys: Readonly<Record<ListingVertical, string>>;
          readonly exceptInStates: readonly PublicationStatusEnum[];
      }
    | {
          readonly kind: 'ANY_OF_VERTICAL';
          readonly keys: Readonly<Record<ListingVertical, readonly string[]>>;
      }
    | { readonly kind: 'CALLER_KEY' };

/** Step 6 requirements by operation. */
export const OPERATION_STEP6_KEY: Readonly<Record<ListingOperation, Step6Requirement>> = {
    READ_OWN: { kind: 'NONE' },
    EXPORT: { kind: 'KEY', key: RECOVER_OWN_LISTING_KEY },
    REACTIVATE: { kind: 'KEY', key: RECOVER_OWN_LISTING_KEY },
    DELETE: { kind: 'KEY', key: RECOVER_OWN_LISTING_KEY },
    EDIT: {
        kind: 'VERTICAL_KEY',
        keys: {
            [VerticalEnum.ACCOMMODATION]: 'edit_accommodation_info',
            [VerticalEnum.GASTRONOMY]: 'edit_gastronomy_info',
            [VerticalEnum.EXPERIENCE]: 'edit_experience_info'
        },
        exceptInStates: [PublicationStatusEnum.DRAFT]
    },
    PUBLISH: {
        kind: 'ANY_OF_VERTICAL',
        keys: {
            [VerticalEnum.ACCOMMODATION]: ['publish_accommodations', VERTICAL_ACTIVATION_KEY],
            [VerticalEnum.GASTRONOMY]: ['publish_gastronomy', VERTICAL_ACTIVATION_KEY],
            [VerticalEnum.EXPERIENCE]: ['publish_experience', VERTICAL_ACTIVATION_KEY]
        }
    },
    READ_PUBLIC: { kind: 'NONE' },
    WRITE_ABOUT_LISTING: { kind: 'NONE' },
    READ_OWN_COMMERCIAL: { kind: 'CALLER_KEY' },
    CREATE: { kind: 'NONE' }
};

/** Whether the operation requires a live coverage source at step 5. */
export const OPERATION_PASSES_STEP5: Readonly<Record<ListingOperation, boolean>> = {
    READ_OWN: false,
    EXPORT: false,
    REACTIVATE: true,
    DELETE: true,
    EDIT: true,
    PUBLISH: true,
    READ_PUBLIC: false,
    WRITE_ABOUT_LISTING: false,
    READ_OWN_COMMERCIAL: false,
    CREATE: true
};
