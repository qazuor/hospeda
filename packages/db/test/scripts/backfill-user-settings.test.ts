/**
 * Unit tests for the pure backfill helper exported by
 * `scripts/backfill-user-settings.ts`. The DB-touching `main()` is covered
 * separately via integration / smoke runs against a seeded test database.
 *
 * REQ-096-05 / SPEC-096 (T-012)
 */

import type { UserSettings } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { computeUserSettingsBackfill } from '../../scripts/backfill-user-settings.ts';

const baseNotifications = {
    enabled: true,
    allowEmails: true,
    allowSms: false,
    allowPush: false
};

const buildSettings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
    notifications: baseNotifications,
    ...overrides
});

describe('computeUserSettingsBackfill', () => {
    describe('darkMode → themeWeb / themeAdmin mapping', () => {
        it('maps darkMode=true to "dark" for both surfaces', () => {
            // Arrange
            const settings = buildSettings({ darkMode: true });

            // Act
            const result = computeUserSettingsBackfill(settings);

            // Assert
            expect(result.changed).toBe(true);
            expect(result.settings.themeWeb).toBe('dark');
            expect(result.settings.themeAdmin).toBe('dark');
            expect(result.appliedFields).toContain('themeWeb');
            expect(result.appliedFields).toContain('themeAdmin');
        });

        it('maps darkMode=false to "light" for both surfaces', () => {
            const settings = buildSettings({ darkMode: false });

            const result = computeUserSettingsBackfill(settings);

            expect(result.changed).toBe(true);
            expect(result.settings.themeWeb).toBe('light');
            expect(result.settings.themeAdmin).toBe('light');
        });

        it('does not overwrite an existing themeWeb value', () => {
            const settings = buildSettings({ darkMode: true, themeWeb: 'system' });

            const result = computeUserSettingsBackfill(settings);

            expect(result.settings.themeWeb).toBe('system'); // unchanged
            expect(result.settings.themeAdmin).toBe('dark'); // backfilled
            expect(result.appliedFields).not.toContain('themeWeb');
            expect(result.appliedFields).toContain('themeAdmin');
        });

        it('does not overwrite an existing themeAdmin value', () => {
            const settings = buildSettings({ darkMode: false, themeAdmin: 'dark' });

            const result = computeUserSettingsBackfill(settings);

            expect(result.settings.themeAdmin).toBe('dark'); // unchanged
            expect(result.settings.themeWeb).toBe('light'); // backfilled
        });

        it('skips theme backfill entirely when darkMode is undefined', () => {
            const settings = buildSettings({});

            const result = computeUserSettingsBackfill(settings);

            expect(result.settings.themeWeb).toBeUndefined();
            expect(result.settings.themeAdmin).toBeUndefined();
            expect(result.appliedFields).toEqual([]);
        });
    });

    describe('language → languageWeb / languageAdmin mapping', () => {
        it.each(['es', 'en', 'pt'] as const)(
            'copies supported language %s to both surfaces',
            (lang) => {
                const settings = buildSettings({ language: lang });

                const result = computeUserSettingsBackfill(settings);

                expect(result.changed).toBe(true);
                expect(result.settings.languageWeb).toBe(lang);
                expect(result.settings.languageAdmin).toBe(lang);
                expect(result.appliedFields).toContain('languageWeb');
                expect(result.appliedFields).toContain('languageAdmin');
            }
        );

        it('does not copy unsupported locales (e.g. fr, de)', () => {
            const settings = buildSettings({ language: 'fr' });

            const result = computeUserSettingsBackfill(settings);

            expect(result.settings.languageWeb).toBeUndefined();
            expect(result.settings.languageAdmin).toBeUndefined();
            expect(result.appliedFields).toEqual([]);
        });

        it('does not overwrite an existing languageWeb value', () => {
            const settings = buildSettings({ language: 'en', languageWeb: 'es' });

            const result = computeUserSettingsBackfill(settings);

            expect(result.settings.languageWeb).toBe('es'); // unchanged
            expect(result.settings.languageAdmin).toBe('en'); // backfilled
        });
    });

    describe('combined mapping', () => {
        it('backfills both theme and language in a single pass', () => {
            const settings = buildSettings({ darkMode: true, language: 'pt' });

            const result = computeUserSettingsBackfill(settings);

            expect(result.changed).toBe(true);
            expect(result.settings.themeWeb).toBe('dark');
            expect(result.settings.themeAdmin).toBe('dark');
            expect(result.settings.languageWeb).toBe('pt');
            expect(result.settings.languageAdmin).toBe('pt');
            expect(result.appliedFields).toEqual(
                expect.arrayContaining(['themeWeb', 'themeAdmin', 'languageWeb', 'languageAdmin'])
            );
        });

        it('returns changed=false when all four destination fields are already set', () => {
            const settings = buildSettings({
                darkMode: true,
                language: 'es',
                themeWeb: 'light',
                themeAdmin: 'system',
                languageWeb: 'en',
                languageAdmin: 'pt'
            });

            const result = computeUserSettingsBackfill(settings);

            expect(result.changed).toBe(false);
            expect(result.appliedFields).toEqual([]);
            // Existing values preserved
            expect(result.settings.themeWeb).toBe('light');
            expect(result.settings.themeAdmin).toBe('system');
            expect(result.settings.languageWeb).toBe('en');
            expect(result.settings.languageAdmin).toBe('pt');
        });

        it('does not mutate the input object', () => {
            const settings = buildSettings({ darkMode: true, language: 'es' });
            const snapshot = JSON.parse(JSON.stringify(settings));

            computeUserSettingsBackfill(settings);

            expect(settings).toEqual(snapshot);
        });
    });

    describe('edge cases', () => {
        it('handles null settings (returns changed=false)', () => {
            const result = computeUserSettingsBackfill(null);

            expect(result.changed).toBe(false);
            expect(result.appliedFields).toEqual([]);
        });

        it('handles undefined settings (returns changed=false)', () => {
            const result = computeUserSettingsBackfill(undefined);

            expect(result.changed).toBe(false);
            expect(result.appliedFields).toEqual([]);
        });

        it('handles empty-string language without backfilling', () => {
            const settings = buildSettings({ language: '' });

            const result = computeUserSettingsBackfill(settings);

            expect(result.appliedFields).toEqual([]);
        });
    });
});
