/**
 * @file me-settings.test.ts
 * @description Source-based tests for the admin settings route, validating
 * that the page exposes the four per-surface theme/language fields and
 * that the underlying mutation hook accepts them. SPEC-096 / REQ-096-32 (T-056).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/me/settings.tsx'),
    'utf8'
);

const hookSrc = readFileSync(resolve(__dirname, '../../src/hooks/use-user-profile.ts'), 'utf8');

describe('me/settings.tsx (4-field settings, T-056)', () => {
    describe('legacy fields removed', () => {
        it('does not reference the legacy darkMode field directly in handlers', () => {
            // It may still appear in the resolver fallback, but the page
            // must not call saveSettings({ darkMode: ... }) anymore.
            expect(settingsSrc).not.toMatch(/saveSettings\(\{\s*darkMode/);
        });

        it('does not call saveSettings with the legacy language field', () => {
            expect(settingsSrc).not.toMatch(/saveSettings\(\{\s*language:/);
        });
    });

    describe('per-surface controls', () => {
        const fields = ['themeWeb', 'themeAdmin', 'languageWeb', 'languageAdmin'];

        for (const field of fields) {
            it(`exposes a handler that writes ${field}`, () => {
                expect(settingsSrc).toContain(field);
            });
        }

        it('renders a Web preferences section', () => {
            expect(settingsSrc).toContain("t('admin-pages.settings.web.title')");
        });

        it('renders an Admin preferences section', () => {
            expect(settingsSrc).toContain("t('admin-pages.settings.admin.title')");
        });

        it('still renders the shared notifications section', () => {
            expect(settingsSrc).toContain("t('admin-pages.settings.notifications.title')");
        });
    });

    describe('falls back gracefully to legacy storage', () => {
        it('reads themeWeb but tolerates legacy darkMode in storage', () => {
            expect(settingsSrc).toContain('settings?.themeWeb');
            expect(settingsSrc).toContain('settings?.darkMode');
        });

        it('reads languageWeb but tolerates legacy language in storage', () => {
            expect(settingsSrc).toContain('settings?.languageWeb');
            expect(settingsSrc).toContain('settings?.language');
        });
    });
});

describe('useUpdateUserSettings (T-056)', () => {
    it('exposes an AdminUserSettingsPatch type', () => {
        expect(hookSrc).toContain('export type AdminUserSettingsPatch');
    });

    it('lists all four per-surface fields plus shared keys', () => {
        // Pick<UserSettings, 'themeWeb' | 'themeAdmin' | 'languageWeb' | 'languageAdmin' | 'notifications' | 'newsletter'>
        expect(hookSrc).toContain("'themeWeb'");
        expect(hookSrc).toContain("'themeAdmin'");
        expect(hookSrc).toContain("'languageWeb'");
        expect(hookSrc).toContain("'languageAdmin'");
        expect(hookSrc).toContain("'notifications'");
        expect(hookSrc).toContain("'newsletter'");
    });

    it('uses the AdminUserSettingsPatch type as mutation input', () => {
        expect(hookSrc).toContain('Partial<AdminUserSettingsPatch>');
    });
});
