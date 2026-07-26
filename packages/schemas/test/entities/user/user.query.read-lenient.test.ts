import { describe, expect, it } from 'vitest';
import { ContactInfoSchema } from '../../../src/common/contact.schema.js';
import { UserLocationSchema } from '../../../src/common/location.schema.js';
import { SocialNetworkSchema } from '../../../src/common/social.schema.js';
import { UserBatchItemSchema } from '../../../src/entities/user/user.batch.schema.js';
import { UserCreateInputSchema } from '../../../src/entities/user/user.crud.schema.js';
import { UserProfileSchema } from '../../../src/entities/user/user.profile.schema.js';
import {
    UserListItemSchema,
    UserListItemWithCountsSchema,
    UserSearchResultSchema,
    UserSummarySchema
} from '../../../src/entities/user/user.query.schema.js';
import { UserSchema } from '../../../src/entities/user/user.schema.js';
import { createUserFixture } from '../../fixtures/user.fixtures.js';
import { createPaginatedResponse } from '../../helpers/pagination.helpers.js';

/**
 * HOS-302 — read⊇write regression coverage for the user READ schemas.
 *
 * Production carries users whose `display_name` is the empty string: Better Auth
 * signup persists the row without ever going through the create/update Zod
 * schemas, so `''` reaches the database even though the write schema demands
 * `.min(2)`. `.optional()` does not rescue it — the key is present, just empty.
 *
 * `UserPublicSchema` was already made lenient for exactly this reason (HOS-190),
 * which is why the API answers 200. The QUERY family was left deriving from the
 * strict base, and that is the family the admin entity-list client parses — with
 * a fail-closed `safeParse` that THROWS, taking the whole users page down.
 *
 * Three surfaces are guarded here, all reachable from one persisted row:
 *
 * 1. the query family (list item, summary, search result) — re-parsed client-side;
 * 2. `UserBatchItemSchema` — the declared `responseSchema` of
 *    `POST /api/v1/admin/users/batch`, where the strip fail-closes to HTTP 500.
 *    `.partial()` makes a key optional but does NOT drop `.min(2)`;
 * 3. the nested JSONB columns — `GET /api/v1/admin/users` responds with
 *    `UserAdminSchema`, whose `profile` is ALREADY lenient, so the API emits a
 *    5-char bio that a strict read schema then rejects. Same failure class.
 *
 * The write schemas stay strict throughout; that asymmetry is the point.
 *
 * @see HOS-300 for the same two-read-family gap on event locations.
 */

/** Verbatim shape of the three affected production rows. */
const EMPTY_DISPLAY_NAME = '';

/**
 * A `displayName` that satisfies the WRITE bounds.
 *
 * Used by the `firstName`/`lastName` cases so the field under test is the ONLY
 * violation in the payload. Spreading `baseListItem` alone would carry
 * `displayName: ''` along, leaving a reader unable to tell which field an
 * assertion protects — and keeping those cases red for the wrong reason if a
 * future revert touched `displayName` only.
 */
const VALID_DISPLAY_NAME = 'Valid Name';

const baseListItem = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'user-ea10dbb3',
    email: 'someone@example.com',
    displayName: EMPTY_DISPLAY_NAME,
    firstName: null,
    lastName: null,
    authProvider: 'BETTER_AUTH',
    role: 'USER',
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC',
    contactInfo: null,
    location: null,
    profile: null,
    createdAt: new Date(),
    updatedAt: new Date()
};

/**
 * Peels `.optional()` / `.nullable()` / `.nullish()` wrappers off a schema so a
 * bound can be DERIVED from the write schema instead of hardcoded here — a
 * hardcoded length silently stops testing anything the day the bound moves.
 */
const unwrapToInner = (schema: unknown): { minLength?: unknown; maxLength?: unknown } => {
    let current = schema as { unwrap?: () => unknown };
    while (typeof current?.unwrap === 'function') {
        current = current.unwrap() as typeof current;
    }
    return current as { minLength?: unknown; maxLength?: unknown };
};

/** Reads a numeric bound off a write schema field, failing loudly if it moved. */
const writeBound = (schema: unknown, bound: 'minLength' | 'maxLength', label: string): number => {
    const value = unwrapToInner(schema)[bound];
    if (typeof value !== 'number') {
        throw new Error(
            `HOS-302 test guard: expected ${label} to carry a numeric ${bound}, got ${String(value)}`
        );
    }
    return value;
};

/** Names long enough to break the write bounds, derived rather than hardcoded. */
const OVER_MAX_DISPLAY_NAME = 'A'.repeat(
    writeBound(UserSchema.shape.displayName, 'maxLength', 'UserSchema.displayName') + 1
);
const OVER_MAX_FIRST_NAME = 'B'.repeat(
    writeBound(UserSchema.shape.firstName, 'maxLength', 'UserSchema.firstName') + 1
);
const OVER_MAX_LAST_NAME = 'C'.repeat(
    writeBound(UserSchema.shape.lastName, 'maxLength', 'UserSchema.lastName') + 1
);

/**
 * A profile that the WRITE schema rejects but `GET /api/v1/admin/users` already
 * emits: `UserAdminSchema.profile` is the lenient `UserProfileReadSchema`, so a
 * bio under the write minimum reaches the client, which then re-parses it.
 */
const UNDER_MIN_BIO = 'D'.repeat(
    writeBound(UserProfileSchema.shape.bio, 'minLength', 'UserProfileSchema.bio') - 1
);
const OVER_MAX_OCCUPATION = 'E'.repeat(
    writeBound(UserProfileSchema.shape.occupation, 'maxLength', 'UserProfileSchema.occupation') + 1
);

/**
 * The other three lenient JSONB families — `contactInfo`, `location` and
 * `socialNetworks`. All three are unbounded JSONB columns shallow-merged at the
 * DB layer, so a legacy/imported/partially-edited row can hold a value the
 * strict WRITE shape rejects. Without these fixtures, reverting
 * `ContactInfoReadSchema` / `UserLocationReadSchema` / `SocialNetworkReadSchema`
 * off the read base would go entirely undetected.
 */

/** Legacy AR local mobile format; fails the write `InternationalPhoneRegex`. */
const LEGACY_AR_MOBILE_PHONE = '0223-155-1234';

/** Non-canonical Facebook URL; fails both the write `.url()` and `FacebookUrlRegex`. */
const NON_CANONICAL_FACEBOOK_URL = 'm.facebook.com/x';

const UNDER_MIN_COUNTRY = 'G'.repeat(
    writeBound(UserLocationSchema.shape.country, 'minLength', 'UserLocationSchema.country') - 1
);
const OVER_MAX_POSTAL_CODE = 'H'.repeat(
    writeBound(UserLocationSchema.shape.postalCode, 'maxLength', 'UserLocationSchema.postalCode') +
        1
);

describe('User query schemas — HOS-302 read⊇write', () => {
    it('UserListItemSchema accepts a persisted empty displayName', () => {
        const result = UserListItemSchema.safeParse(baseListItem);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.displayName).toBe(EMPTY_DISPLAY_NAME);
        }
    });

    it('UserListItemWithCountsSchema accepts it — this is what the admin client parses', () => {
        const result = UserListItemWithCountsSchema.safeParse(baseListItem);

        expect(result.success).toBe(true);
    });

    it('UserSummarySchema accepts it', () => {
        const result = UserSummarySchema.safeParse(baseListItem);

        expect(result.success).toBe(true);
    });

    it('the query family also accepts a name longer than the write maximum', () => {
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            displayName: OVER_MAX_DISPLAY_NAME
        });

        expect(result.success).toBe(true);
    });

    it('accepts a null displayName — the column is nullable, so a read schema must tolerate it', () => {
        const result = UserListItemSchema.safeParse({ ...baseListItem, displayName: null });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.displayName).toBeNull();
        }
    });

    it.each([
        ['empty', EMPTY_DISPLAY_NAME],
        ['over the write maximum', OVER_MAX_FIRST_NAME]
    ])('accepts a firstName that is %s', (_label, firstName) => {
        // `displayName` is overridden to a VALID value so `firstName` is the only
        // field violating the write bounds — otherwise this case would also pass
        // (or fail) on `displayName`, and could not tell you which.
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            displayName: VALID_DISPLAY_NAME,
            firstName
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.firstName).toBe(firstName);
        }
    });

    it.each([
        ['empty', EMPTY_DISPLAY_NAME],
        ['over the write maximum', OVER_MAX_LAST_NAME]
    ])('accepts a lastName that is %s', (_label, lastName) => {
        // Same isolation as the `firstName` cases above: `lastName` is the only
        // field in this payload that breaks a write bound.
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            displayName: VALID_DISPLAY_NAME,
            lastName
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.lastName).toBe(lastName);
        }
    });

    it('UserSearchResultSchema accepts a page containing such a row', () => {
        const user = createUserFixture({ displayName: EMPTY_DISPLAY_NAME });
        const result = UserSearchResultSchema.safeParse(createPaginatedResponse([user], 1, 10, 1));

        expect(result.success).toBe(true);
    });

    it('UserBatchItemSchema accepts exactly what the admin batch handler emits', () => {
        // `.partial()` makes the key optional but does NOT drop `.min(2)`, and the
        // handler force-includes the three name fields even when `fields` is passed —
        // so field selection cannot dodge the bound. This route's `responseSchema`
        // fail-closes to HTTP 500.
        const result = UserBatchItemSchema.safeParse({
            id: baseListItem.id,
            displayName: EMPTY_DISPLAY_NAME,
            firstName: null,
            lastName: null,
            email: baseListItem.email
        });

        expect(result.success).toBe(true);
    });

    it('accepts a profile bio shorter than the write minimum — the admin list endpoint already emits one', () => {
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            profile: { bio: UNDER_MIN_BIO }
        });

        expect(result.success).toBe(true);
    });

    it('accepts a profile occupation longer than the write maximum', () => {
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            profile: { occupation: OVER_MAX_OCCUPATION }
        });

        expect(result.success).toBe(true);
    });

    it('the write schema stays strict on the profile bounds it owns', () => {
        const result = UserProfileSchema.safeParse({
            bio: UNDER_MIN_BIO,
            occupation: OVER_MAX_OCCUPATION
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('bio') && issue.code === 'too_small'
                )
            ).toBe(true);
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('occupation') && issue.code === 'too_big'
                )
            ).toBe(true);
        }
    });

    it('accepts a contactInfo mobilePhone in the legacy AR local format', () => {
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            contactInfo: { mobilePhone: LEGACY_AR_MOBILE_PHONE }
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.contactInfo?.mobilePhone).toBe(LEGACY_AR_MOBILE_PHONE);
        }
    });

    it('the write schema stays strict on the phone format it owns', () => {
        const result = ContactInfoSchema.safeParse({ mobilePhone: LEGACY_AR_MOBILE_PHONE });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('mobilePhone'))).toBe(
                true
            );
        }
    });

    it('accepts a location with a country under the write minimum', () => {
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            location: { country: UNDER_MIN_COUNTRY }
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.country).toBe(UNDER_MIN_COUNTRY);
        }
    });

    it('accepts a location with a postalCode over the write maximum', () => {
        const result = UserListItemSchema.safeParse({
            ...baseListItem,
            location: { postalCode: OVER_MAX_POSTAL_CODE }
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location?.postalCode).toBe(OVER_MAX_POSTAL_CODE);
        }
    });

    it('the write schema stays strict on the location bounds it owns', () => {
        const result = UserLocationSchema.safeParse({
            country: UNDER_MIN_COUNTRY,
            postalCode: OVER_MAX_POSTAL_CODE
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('country') && issue.code === 'too_small'
                )
            ).toBe(true);
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('postalCode') && issue.code === 'too_big'
                )
            ).toBe(true);
        }
    });

    it('accepts a non-canonical socialNetworks URL — asserted through the batch item', () => {
        // `UserListItemSchema` does not pick `socialNetworks`, so the leniency has
        // to be asserted through a read schema that actually exposes the column.
        // `UserBatchItemSchema` is `UserReadSchema.partial().required({ id })` and
        // is the declared `responseSchema` of `POST /api/v1/admin/users/batch`.
        const result = UserBatchItemSchema.safeParse({
            id: baseListItem.id,
            socialNetworks: { facebook: NON_CANONICAL_FACEBOOK_URL }
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.socialNetworks?.facebook).toBe(NON_CANONICAL_FACEBOOK_URL);
        }
    });

    it('the write schema stays strict on the social URL format it owns', () => {
        const result = SocialNetworkSchema.safeParse({ facebook: NON_CANONICAL_FACEBOOK_URL });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('facebook'))).toBe(true);
        }
    });

    it('read schemas still reject a displayName of the wrong type', () => {
        const result = UserListItemSchema.safeParse({ ...baseListItem, displayName: 42 });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('displayName') && issue.code === 'invalid_type'
                )
            ).toBe(true);
        }
    });

    it('the write schema stays strict — an empty displayName is still rejected on create', () => {
        const result = UserCreateInputSchema.safeParse({
            slug: 'user-ea10dbb3',
            email: 'someone@example.com',
            displayName: EMPTY_DISPLAY_NAME,
            role: 'USER'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('displayName') && issue.code === 'too_small'
                )
            ).toBe(true);
        }
    });

    it('the write schema stays strict — an over-long displayName is still rejected on create', () => {
        const result = UserCreateInputSchema.safeParse({
            slug: 'user-ea10dbb3',
            email: 'someone@example.com',
            displayName: OVER_MAX_DISPLAY_NAME,
            role: 'USER'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('displayName') && issue.code === 'too_big'
                )
            ).toBe(true);
        }
    });
});
