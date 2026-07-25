import { describe, expect, it } from 'vitest';
import { UserCreateInputSchema } from '../../../src/entities/user/user.crud.schema.js';
import {
    UserListItemSchema,
    UserListItemWithCountsSchema,
    UserSummarySchema
} from '../../../src/entities/user/user.query.schema.js';
import { UserSchema } from '../../../src/entities/user/user.schema.js';

/**
 * HOS-302 — read⊇write regression coverage for the user name fields.
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
 * So the guard here is specifically on the query family. The write schemas stay
 * strict; that asymmetry is the point.
 *
 * @see HOS-300 for the same two-read-family gap on event locations.
 */

/** Verbatim shape of the three affected production rows. */
const EMPTY_DISPLAY_NAME = '';

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

/** A name long enough to break the write bound, derived rather than hardcoded. */
const displayNameWriteMax = UserSchema.shape.displayName.unwrap().maxLength;
if (typeof displayNameWriteMax !== 'number') {
    throw new Error(
        `HOS-302 test guard: expected UserSchema.displayName to carry a numeric max, got ${String(displayNameWriteMax)}`
    );
}
const OVER_MAX_DISPLAY_NAME = 'A'.repeat(displayNameWriteMax + 1);

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
