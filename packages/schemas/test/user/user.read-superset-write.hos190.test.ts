/**
 * Regression tests for HOS-190 — the read⊇write asymmetry that made a user
 * un-readable (HTTP 500) and therefore un-editable.
 *
 * Root cause: the API strips every response against its declared schema via
 * `stripWithSchema` (`apps/api/src/utils/response-helpers.ts`), which
 * FAIL-CLOSES to HTTP 500 when `schema.safeParse(storedRow)` fails. The user
 * profile RESPONSE (`UserSelfSchema` for the self-scoped `/protected/users/:id`
 * routes; `UserPublicSchema` for author views) asserted content bounds
 * (`bio` min 10, names min 2/max 50, `occupation` min 2, `country`/`region`/
 * `city` min 1, phone/URL formats) that a legacy/imported row could violate.
 * One such stored value 500'd the whole profile GET.
 *
 * Fix: the read relaxation lives ONLY on the access overlays (this file's first
 * two blocks), NOT on the base `UserSchema`/`UserProfileSchema`/
 * `UserLocationSchema` — those still gate the WRITE path (create/update),
 * asserted strict by the third block. This mirrors the accommodation
 * access-schema overlay pattern and keeps read⊇write without weakening writes.
 */
import { describe, expect, it } from 'vitest';
import { UserPublicSchema, UserSelfSchema } from '../../src/entities/user/user.access.schema.js';
import {
    UserCreateInputSchema,
    UserUpdateInputSchema
} from '../../src/entities/user/user.crud.schema.js';
import { RoleEnum } from '../../src/enums/index.js';

const baseSelf = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    slug: 'john-doe',
    role: RoleEnum.USER
};

describe('UserSelfSchema read⊇write (HOS-190 — response accepts legacy values)', () => {
    it('accepts a stored bio under the old 10-char floor (the incident)', () => {
        const result = UserSelfSchema.safeParse({ ...baseSelf, profile: { bio: 'N/A' } });
        expect(result.success).toBe(true);
    });

    it('accepts an over-length bio (no read ceiling)', () => {
        const result = UserSelfSchema.safeParse({
            ...baseSelf,
            profile: { bio: 'x'.repeat(5000) }
        });
        expect(result.success).toBe(true);
    });

    it('accepts 1-char names and occupation', () => {
        const result = UserSelfSchema.safeParse({
            ...baseSelf,
            displayName: 'A',
            firstName: 'B',
            lastName: 'C',
            profile: { occupation: 'x' }
        });
        expect(result.success).toBe(true);
    });

    it('accepts an AR local-format phone lacking the international "+" prefix', () => {
        const result = UserSelfSchema.safeParse({
            ...baseSelf,
            contactInfo: { mobilePhone: '0223-155-1234' }
        });
        expect(result.success).toBe(true);
    });

    it('accepts 1-char location strings (legacy short values)', () => {
        const result = UserSelfSchema.safeParse({
            ...baseSelf,
            location: { country: 'A', region: 'B', city: 'C', postalCode: 'x'.repeat(50) }
        });
        expect(result.success).toBe(true);
    });

    it('accepts a non-canonical social URL that fails the platform regex', () => {
        const result = UserSelfSchema.safeParse({
            ...baseSelf,
            socialNetworks: { facebook: 'https://m.facebook.com/x' }
        });
        expect(result.success).toBe(true);
    });
});

describe('UserPublicSchema read⊇write (HOS-190)', () => {
    it('accepts 1-char and over-length names (public author view never 500s)', () => {
        const result = UserPublicSchema.safeParse({
            ...baseSelf,
            displayName: 'A',
            firstName: 'x'.repeat(80)
        });
        expect(result.success).toBe(true);
    });
});

describe('User WRITE schemas stay strict (HOS-190 — read relaxation must not weaken writes)', () => {
    it('UserUpdateInputSchema still rejects a 1-char displayName', () => {
        expect(UserUpdateInputSchema.safeParse({ displayName: 'A' }).success).toBe(false);
    });

    it('UserUpdateInputSchema still rejects an empty firstName', () => {
        expect(UserUpdateInputSchema.safeParse({ firstName: '' }).success).toBe(false);
    });

    it('UserUpdateInputSchema still rejects a bio under 10 chars', () => {
        expect(UserUpdateInputSchema.safeParse({ profile: { bio: 'short' } }).success).toBe(false);
    });

    it('UserUpdateInputSchema still rejects a 1-char country', () => {
        expect(UserUpdateInputSchema.safeParse({ location: { country: 'A' } }).success).toBe(false);
    });

    it('UserCreateInputSchema still rejects a 1-char displayName', () => {
        const result = UserCreateInputSchema.safeParse({
            slug: 'x',
            email: 'a@b.com',
            role: RoleEnum.USER,
            displayName: 'A'
        });
        expect(result.success).toBe(false);
    });
});
