import { describe, expect, it } from 'vitest';
import { ProfileEditSchema } from '../../src/user/profile.js';

// ---------------------------------------------------------------------------
// Valid base input
// ---------------------------------------------------------------------------

const VALID_BASE = {
    displayName: 'María García',
    firstName: 'María',
    lastName: 'García'
};

// ---------------------------------------------------------------------------
// ProfileEditSchema
// ---------------------------------------------------------------------------

describe('ProfileEditSchema', () => {
    describe('happy path', () => {
        it('should accept minimal valid input (required fields only)', () => {
            // Arrange
            const input = { ...VALID_BASE };

            // Act
            const result = ProfileEditSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.displayName).toBe('María García');
                expect(result.data.firstName).toBe('María');
                expect(result.data.lastName).toBe('García');
                expect(result.data.bio).toBeUndefined();
                expect(result.data.avatarUrl).toBeUndefined();
                expect(result.data.phone).toBeUndefined();
            }
        });

        it('should accept all optional fields populated', () => {
            const input = {
                ...VALID_BASE,
                bio: 'Amante de los viajes y el litoral argentino.',
                avatarUrl: 'https://cdn.example.com/avatars/maria.jpg',
                phone: '+541134567890'
            };
            const result = ProfileEditSchema.safeParse(input);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.bio).toBe('Amante de los viajes y el litoral argentino.');
                expect(result.data.avatarUrl).toBe('https://cdn.example.com/avatars/maria.jpg');
                expect(result.data.phone).toBe('+541134567890');
            }
        });

        it('should accept an empty string for avatarUrl (clearing the avatar)', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, avatarUrl: '' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.avatarUrl).toBe('');
            }
        });

        it('should accept an empty string for phone (clearing the phone)', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, phone: '' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.phone).toBe('');
            }
        });

        it('should accept a phone with a 3-digit country code', () => {
            // +1868 = Trinidad and Tobago
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, phone: '+18684567890' });
            expect(result.success).toBe(true);
        });

        it('should accept bio at exactly 1000 characters', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, bio: 'x'.repeat(1000) });
            expect(result.success).toBe(true);
        });

        it('should accept displayName at exactly 100 characters', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                displayName: 'a'.repeat(100)
            });
            expect(result.success).toBe(true);
        });
    });

    describe('extra fields rejected (strictObject)', () => {
        it('should reject an extra field like role', () => {
            // Arrange
            const input = { ...VALID_BASE, role: 'admin' };

            // Act
            const result = ProfileEditSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const messages = result.error.issues.map((i) => i.message);
                // Zod strictObject emits "Unrecognized key(s) in object" error
                expect(messages.some((m) => m.toLowerCase().includes('unrecognized'))).toBe(true);
            }
        });

        it('should reject an extra field like email', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                email: 'hacker@example.com'
            });
            expect(result.success).toBe(false);
        });

        it('should reject an extra field like permissions', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                permissions: ['admin:write']
            });
            expect(result.success).toBe(false);
        });
    });

    describe('required fields validation', () => {
        it('should reject when displayName is missing', () => {
            const { displayName: _dn, ...rest } = VALID_BASE;
            const result = ProfileEditSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when firstName is missing', () => {
            const { firstName: _fn, ...rest } = VALID_BASE;
            const result = ProfileEditSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when lastName is missing', () => {
            const { lastName: _ln, ...rest } = VALID_BASE;
            const result = ProfileEditSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject an empty displayName', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, displayName: '' });
            expect(result.success).toBe(false);
        });

        it('should reject displayName longer than 100 characters', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                displayName: 'a'.repeat(101)
            });
            expect(result.success).toBe(false);
        });

        it('should reject an empty firstName', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, firstName: '' });
            expect(result.success).toBe(false);
        });

        it('should reject an empty lastName', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, lastName: '' });
            expect(result.success).toBe(false);
        });
    });

    describe('bio validation', () => {
        it('should reject bio exceeding 1000 characters', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                bio: 'x'.repeat(1001)
            });
            expect(result.success).toBe(false);
        });
    });

    describe('avatarUrl validation', () => {
        it('should reject a non-URL, non-empty string', () => {
            // Arrange
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                avatarUrl: 'not-a-valid-url'
            });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a relative path as avatarUrl', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                avatarUrl: '/avatars/me.jpg'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('phone validation', () => {
        it('should reject a phone without leading +', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, phone: '541134567890' });
            expect(result.success).toBe(false);
        });

        it('should reject a phone with letters', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, phone: '+54abc4567890' });
            expect(result.success).toBe(false);
        });

        it('should reject a phone that is too short (< 5 total digits after +)', () => {
            // The regex /^\+\d{1,3}\d{4,14}$/ requires 5-17 total digits after +.
            // +1234 = + followed by 4 digits → below minimum
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, phone: '+1234' });
            expect(result.success).toBe(false);
        });

        it('should reject a phone with more than 17 total digits after +', () => {
            // The regex /^\+\d{1,3}\d{4,14}$/ requires at most 17 total digits after +.
            // +123456789012345678 = + followed by 18 digits → above maximum
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                phone: '+123456789012345678'
            });
            expect(result.success).toBe(false);
        });
    });

    // ─── SPEC-113 polish: extended profile fields ────────────────────────────
    describe('extended fields (SPEC-113 polish)', () => {
        it('accepts a valid ISO birthDate', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                birthDate: '1990-05-12'
            });
            expect(result.success).toBe(true);
        });

        it('accepts empty string to clear birthDate', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, birthDate: '' });
            expect(result.success).toBe(true);
        });

        it('rejects a malformed birthDate', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                birthDate: '12-05-1990'
            });
            expect(result.success).toBe(false);
        });

        it('accepts a valid website URL', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                website: 'https://mipagina.com'
            });
            expect(result.success).toBe(true);
        });

        it('rejects an invalid website URL', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                website: 'not-a-url'
            });
            expect(result.success).toBe(false);
        });

        it('accepts a 2-100 char occupation', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                occupation: 'Frontend Engineer'
            });
            expect(result.success).toBe(true);
        });

        it('rejects an occupation shorter than 2 chars', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                occupation: 'a'
            });
            expect(result.success).toBe(false);
        });

        it('accepts empty string for occupation (clearing it)', () => {
            const result = ProfileEditSchema.safeParse({ ...VALID_BASE, occupation: '' });
            expect(result.success).toBe(true);
        });

        it('accepts valid social network URLs', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                facebookUrl: 'https://facebook.com/maria',
                instagramUrl: 'https://instagram.com/maria',
                twitterUrl: 'https://x.com/maria',
                linkedinUrl: 'https://linkedin.com/in/maria',
                youtubeUrl: 'https://youtube.com/@maria'
            });
            expect(result.success).toBe(true);
        });

        it('rejects an invalid social network URL', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                facebookUrl: 'maria-on-facebook'
            });
            expect(result.success).toBe(false);
        });

        it('accepts postal address fields when provided', () => {
            const result = ProfileEditSchema.safeParse({
                ...VALID_BASE,
                addressLine1: 'Av. Corrientes 1234',
                city: 'Buenos Aires',
                province: 'CABA',
                country: 'Argentina',
                postalCode: 'C1043'
            });
            expect(result.success).toBe(true);
        });
    });
});
