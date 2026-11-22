import { describe, expect, it } from 'vitest';
import { ProfileEditSchema } from '../../src/user/profile.js';

/**
 * HOS-2542: an invalid Facebook/Instagram URL used to surface zod's built-in
 * English "Invalid URL" because `.url()` carried no i18n key.
 */
describe('ProfileEditSchema social URL messages (HOS-2542)', () => {
    const networks = [
        ['facebookUrl', 'facebook'],
        ['instagramUrl', 'instagram'],
        ['twitterUrl', 'twitter'],
        ['linkedinUrl', 'linkedIn'],
        ['youtubeUrl', 'youtube']
    ] as const;

    it.each(networks)('%s: a non-URL yields an i18n key, never the zod default', (field, key) => {
        // Arrange
        const input = { [field]: 'not a url' };

        // Act
        const result = ProfileEditSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
        const messages = result.success ? [] : result.error.issues.map((i) => i.message);
        expect(messages).not.toContain('Invalid URL');
        expect(messages.every((m) => m.startsWith('zodError.'))).toBe(true);
        expect(messages).toContain(`zodError.common.social.${key}.invalid`);
    });

    it('facebookUrl: a valid URL on another domain yields the pattern key', () => {
        const result = ProfileEditSchema.safeParse({ facebookUrl: 'https://example.com/me' });
        const messages = result.success ? [] : result.error.issues.map((i) => i.message);
        expect(messages).toEqual(['zodError.common.social.facebook.pattern']);
    });
});
