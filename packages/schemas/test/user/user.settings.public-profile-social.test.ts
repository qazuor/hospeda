/**
 * Tests for `publicProfileShowSocialNetworks` (HOS-375 T-008, spec §6.7).
 *
 * The key is the explicit opt-in that decides whether an author's social
 * networks appear on their public author page. Two things have to hold:
 *
 * 1. A settings object stored before the key existed still parses — every user
 *    on the platform today has one, and a parse failure here surfaces as a
 *    toast error on any unrelated settings change (that is exactly how BETA-36
 *    happened; see `user.settings.beta36.test.ts`).
 * 2. `UserSettingsWebPatchSchema` accepts it. That schema is `.strict()`, so a
 *    key it does not declare makes the web PATCH fail with a 400 whose cause is
 *    invisible from the UI.
 */
// Imported from `src/`, not from the `@repo/schemas` barrel: this package has a
// built `dist/` and no vitest alias for its own name, so a barrel import here
// tests the LAST BUILD rather than the working tree — a new key would silently
// read as absent. Same reason `entities/user/user.settings.onboarding.test.ts`
// imports by relative path.
import { describe, expect, it } from 'vitest';
import {
    UserSettingsSchema,
    UserSettingsWebPatchSchema
} from '../../src/entities/user/user.settings.schema.js';

const LEGACY_STORED_SETTINGS = {
    themeWeb: 'system' as const,
    languageWeb: 'es' as const,
    newsletter: false
};

describe('UserSettingsSchema.publicProfileShowSocialNetworks', () => {
    it('parses a stored settings object that predates the key', () => {
        const result = UserSettingsSchema.safeParse({ ...LEGACY_STORED_SETTINGS });

        expect(result.success).toBe(true);
    });

    it('defaults to false — publishing social handles is opt-in, never inferred', () => {
        const result = UserSettingsSchema.safeParse({
            ...LEGACY_STORED_SETTINGS,
            publicProfileShowSocialNetworks: undefined
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.publicProfileShowSocialNetworks).toBe(false);
        }
    });

    it('round-trips an explicit true', () => {
        const result = UserSettingsSchema.safeParse({
            ...LEGACY_STORED_SETTINGS,
            publicProfileShowSocialNetworks: true
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.publicProfileShowSocialNetworks).toBe(true);
        }
    });

    it('rejects a non-boolean value', () => {
        const result = UserSettingsSchema.safeParse({
            ...LEGACY_STORED_SETTINGS,
            publicProfileShowSocialNetworks: 'yes'
        });

        expect(result.success).toBe(false);
    });
});

describe('UserSettingsWebPatchSchema.publicProfileShowSocialNetworks', () => {
    it('accepts the key — without this the web PATCH would 400', () => {
        const result = UserSettingsWebPatchSchema.safeParse({
            publicProfileShowSocialNetworks: true
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.publicProfileShowSocialNetworks).toBe(true);
        }
    });

    it('still accepts a patch that omits the key entirely', () => {
        const result = UserSettingsWebPatchSchema.safeParse({ languageWeb: 'en' });

        expect(result.success).toBe(true);
    });

    it('still rejects unknown keys — the schema stays strict', () => {
        // Non-vacuity guard for the test above: if `.strict()` had been dropped
        // to make the new key fit, this would start passing.
        const result = UserSettingsWebPatchSchema.safeParse({
            publicProfileShowSocialNetworks: true,
            publicProfileShowEmailAddress: true
        });

        expect(result.success).toBe(false);
    });
});
