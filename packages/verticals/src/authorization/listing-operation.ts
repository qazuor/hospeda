import { PublicationStatusEnum } from '@repo/schemas';

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
    'READ_OWN_COMMERCIAL'
] as const;
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
    ]
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
    READ_OWN_COMMERCIAL: []
};

/** The floor capability that permits an owner to recover an archived listing. */
export const RECOVER_OWN_LISTING_KEY = 'recover_own_listing';

/** Step 6 requirement; PENDING fails closed until V5.3 names commercial keys. */
export const OPERATION_STEP6_KEY: Readonly<
    Record<
        ListingOperation,
        | { readonly kind: 'NONE' }
        | { readonly kind: 'KEY'; readonly key: string }
        | { readonly kind: 'PENDING' }
    >
> = {
    READ_OWN: { kind: 'NONE' },
    EXPORT: { kind: 'KEY', key: RECOVER_OWN_LISTING_KEY },
    REACTIVATE: { kind: 'KEY', key: RECOVER_OWN_LISTING_KEY },
    DELETE: { kind: 'KEY', key: RECOVER_OWN_LISTING_KEY },
    EDIT: { kind: 'PENDING' },
    PUBLISH: { kind: 'PENDING' },
    READ_PUBLIC: { kind: 'NONE' },
    WRITE_ABOUT_LISTING: { kind: 'NONE' },
    READ_OWN_COMMERCIAL: { kind: 'PENDING' }
};
