/**
 * Regression tests for BETA-36 — "toast error when changing language while logged in".
 *
 * Root cause: `UserSettingsSchema` (the base read/response schema) required
 * `notifications`. Users whose stored JSONB settings pre-date that field had no
 * `notifications` key, so any settings update (e.g. a language change) triggered
 * a parse failure which surfaced as a toast error in the web app.
 *
 * Fix: `notifications` is now `.optional()` in `UserSettingsSchema`.
 * `UserSettingsWebPatchSchema` already had it optional and is NOT changed.
 */
import { UserSettingsSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal valid settings without the notifications block
// ---------------------------------------------------------------------------

const SETTINGS_WITHOUT_NOTIFICATIONS = {
    themeWeb: 'system' as const,
    languageWeb: 'es' as const,
    newsletter: false
};

const SETTINGS_WITH_NOTIFICATIONS = {
    ...SETTINGS_WITHOUT_NOTIFICATIONS,
    notifications: {
        enabled: true,
        allowEmails: true,
        allowSms: false,
        allowPush: true
    }
};

describe('UserSettingsSchema (BETA-36)', () => {
    it('accepts a settings object that has no notifications key (legacy stored JSONB)', () => {
        // Arrange — simulates stored JSONB that predates the notifications block.
        const input = { ...SETTINGS_WITHOUT_NOTIFICATIONS };

        // Act
        const result = UserSettingsSchema.safeParse(input);

        // Assert — this was the failure mode that caused the toast error.
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.notifications).toBeUndefined();
            expect(result.data.languageWeb).toBe('es');
        }
    });

    it('accepts a settings object with notifications present (new users)', () => {
        // Arrange
        const input = { ...SETTINGS_WITH_NOTIFICATIONS };

        // Act
        const result = UserSettingsSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.notifications?.enabled).toBe(true);
            expect(result.data.notifications?.allowEmails).toBe(true);
        }
    });

    it('accepts an empty object (all fields are optional or have defaults)', () => {
        // Act
        const result = UserSettingsSchema.safeParse({});

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects invalid notifications shape when the key IS present', () => {
        // Arrange — a present-but-malformed notifications block must still fail.
        const input = {
            ...SETTINGS_WITHOUT_NOTIFICATIONS,
            notifications: { enabled: 'not-a-boolean' }
        };

        // Act
        const result = UserSettingsSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});
