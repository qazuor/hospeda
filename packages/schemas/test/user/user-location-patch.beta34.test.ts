/**
 * Regression tests for BETA-34 — "edit-profile validation fails with valid data".
 *
 * Root cause: `UserSchema` embedded `FullLocationSchema` (which REQUIRES
 * `street` and `number` and uses `state`/`zipCode` field names) for the user
 * `location` block. The web profile-edit form, and the onboarding flow, persist
 * a lightweight free-text address under different keys
 * (`{ country, region, city, addressLine1, postalCode }`). So a server-side
 * PATCH validation against `UserPatchInputSchema` rejected every
 * profile-location edit with a 400 even for valid data.
 *
 * Fix: a dedicated, all-optional `UserLocationSchema` whose field names match
 * what is actually stored and submitted. These tests pin the exact payload the
 * web form builds and prove it now validates.
 */
import { UserLocationSchema, type UserLocationType, UserPatchInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// UserLocationSchema (the dedicated schema)
// ---------------------------------------------------------------------------

describe('UserLocationSchema (BETA-34)', () => {
    it('accepts the full address shape the web edit form submits', () => {
        // Arrange — exactly the keys ProfileEditForm.client.tsx writes into
        // `locationPatch` (country, region, city, addressLine1, postalCode).
        const input = {
            country: 'Argentina',
            region: 'Entre Ríos',
            city: 'Concepción del Uruguay',
            addressLine1: 'Av. Corrientes 1234',
            postalCode: 'E3260'
        };

        // Act
        const result = UserLocationSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual(input);
        }
    });

    it('accepts the onboarding subset { country, region, city } (no migration)', () => {
        // Arrange — what BriefLocationSchema persists during profile completion.
        const input = { country: 'AR', region: 'Buenos Aires', city: 'CABA' };

        // Act
        const result = UserLocationSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts an empty object (every field is optional)', () => {
        // Act
        const result = UserLocationSchema.safeParse({});

        // Assert
        expect(result.success).toBe(true);
    });

    it('does NOT require street or number (the BETA-34 failure mode)', () => {
        // Arrange — a payload with no street/number whatsoever.
        const input: UserLocationType = { city: 'Rosario' };

        // Act
        const result = UserLocationSchema.safeParse(input);

        // Assert — FullLocationSchema would have failed here; UserLocationSchema must not.
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// UserPatchInputSchema (the server-side PATCH contract that 400'd before)
// ---------------------------------------------------------------------------

describe('UserPatchInputSchema location (BETA-34 regression)', () => {
    it('accepts the exact location PATCH payload the web form builds', () => {
        // Arrange — mirrors the `payload` object assembled in
        // ProfileEditForm.client.tsx handleSubmit(): top-level identity fields
        // plus the nested `location` JSONB block.
        const payload = {
            displayName: 'María García',
            firstName: 'María',
            lastName: 'García',
            location: {
                country: 'Argentina',
                region: 'Entre Ríos',
                city: 'Concepción del Uruguay',
                addressLine1: 'Av. Corrientes 1234',
                postalCode: 'E3260'
            }
        };

        // Act
        const result = UserPatchInputSchema.safeParse(payload);

        // Assert — this used to fail with "street is required / number is required".
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.location).toEqual(payload.location);
        }
    });

    it('accepts a location PATCH with only the partial fields a user filled in', () => {
        // Arrange
        const payload = { location: { country: 'Argentina', city: 'Gualeguaychú' } };

        // Act
        const result = UserPatchInputSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts a PATCH with no location at all (partial update)', () => {
        // Act
        const result = UserPatchInputSchema.safeParse({ displayName: 'María' });

        // Assert
        expect(result.success).toBe(true);
    });
});
