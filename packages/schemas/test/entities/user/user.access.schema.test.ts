/**
 * Tests for user access (tier) schemas — UserPublicSchema, UserProtectedSchema,
 * UserSelfSchema, UserAdminSchema.
 *
 * Regression coverage for the complete-profile data-loss bug:
 * the onboarding flow persists phone into the `contactInfo.mobilePhone` JSONB,
 * location into the `location` JSONB and socials into the `socialNetworks`
 * JSONB — but the self-profile GET response was stripped with
 * `UserProtectedSchema`, which does not declare those JSONB fields, so the
 * web edit-profile form always rehydrated empty. `UserSelfSchema` is the
 * response contract for self-scoped profile routes and MUST preserve them.
 *
 * `UserProtectedSchema` intentionally keeps stripping the JSONB blobs: it is
 * embedded as a relation (`owner`, `author`, reviewer `user`, `sponsorUser`)
 * in other entities' protected-tier responses that reach users OTHER than the
 * profile owner. Exposing `contactInfo`/`location` there would leak PII.
 */
import { describe, expect, it } from 'vitest';
import { RoleEnum, UserProtectedSchema, UserSelfSchema } from '../../../src/index.js';

/**
 * A realistic `users` row as returned by the model: phone/location/socials
 * live in JSONB columns, never as flat top-level fields.
 */
const buildDbUserRow = () => ({
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    slug: 'maria-perez',
    displayName: 'María Pérez',
    firstName: 'María',
    lastName: 'Pérez',
    role: RoleEnum.USER,
    email: 'maria@example.com',
    contactInfo: {
        mobilePhone: '+5493442123456',
        personalEmail: 'maria@example.com'
    },
    location: {
        country: 'AR',
        region: 'Entre Ríos',
        city: 'Concepción del Uruguay'
    },
    socialNetworks: {
        facebook: 'https://facebook.com/mariaperez',
        linkedIn: 'https://linkedin.com/in/mariaperez'
    },
    profile: null,
    settings: null,
    permissions: []
});

describe('UserSelfSchema (self-profile response contract)', () => {
    it('preserves contactInfo, location and socialNetworks JSONB fields (regression: complete-profile data loss)', () => {
        const result = UserSelfSchema.safeParse(buildDbUserRow());

        expect(result.success).toBe(true);
        expect(result.data?.contactInfo?.mobilePhone).toBe('+5493442123456');
        expect(result.data?.location).toEqual({
            country: 'AR',
            region: 'Entre Ríos',
            city: 'Concepción del Uruguay'
        });
        expect(result.data?.socialNetworks?.facebook).toBe('https://facebook.com/mariaperez');
        expect(result.data?.socialNetworks?.linkedIn).toBe('https://linkedin.com/in/mariaperez');
    });

    it('accepts contactInfo without mobilePhone (read-side tolerance for rows saved without a phone)', () => {
        const row = {
            ...buildDbUserRow(),
            contactInfo: { personalEmail: 'maria@example.com' }
        };

        const result = UserSelfSchema.safeParse(row);

        expect(result.success).toBe(true);
        expect(result.data?.contactInfo?.personalEmail).toBe('maria@example.com');
    });

    it('accepts null JSONB columns (user that never completed onboarding)', () => {
        const row = {
            ...buildDbUserRow(),
            contactInfo: null,
            location: null,
            socialNetworks: null
        };

        const result = UserSelfSchema.safeParse(row);

        expect(result.success).toBe(true);
        expect(result.data?.contactInfo).toBeNull();
        expect(result.data?.location).toBeNull();
        expect(result.data?.socialNetworks).toBeNull();
    });
});

describe('UserProtectedSchema (embedded-relation contract)', () => {
    it('still strips contactInfo, location and socialNetworks (PII guard for owner/author/reviewer relations)', () => {
        const result = UserProtectedSchema.safeParse(buildDbUserRow());

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('contactInfo');
        expect(result.data).not.toHaveProperty('location');
        expect(result.data).not.toHaveProperty('socialNetworks');
    });
});
