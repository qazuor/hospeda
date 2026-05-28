/**
 * @file mi-cuenta-preferencias.test.ts
 * @description Source-based tests for the preferences page extracted from
 * the legacy /me/settings route as part of SPEC-156 PR-2 (T-013). Covers
 * the four per-surface theme/language fields, the timezone read-only block,
 * and verifies the notifications block was NOT included (T-014 owns it).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const preferenciasSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/account/preferences.tsx'),
    'utf8'
);

describe('account/preferences.tsx (T-013)', () => {
    describe('route wiring', () => {
        it('registers the new route path', () => {
            expect(preferenciasSrc).toContain("createFileRoute('/_authed/account/preferences')");
        });

        it('uses the existing useUpdateUserSettings mutation hook', () => {
            expect(preferenciasSrc).toContain('useUpdateUserSettings');
        });
    });

    describe('per-surface controls', () => {
        const fields = ['themeWeb', 'themeAdmin', 'languageWeb', 'languageAdmin'];

        for (const field of fields) {
            it(`exposes a handler that writes ${field}`, () => {
                expect(preferenciasSrc).toContain(field);
            });
        }

        it('renders separate ThemePicker instances for web and admin', () => {
            expect(preferenciasSrc).toContain('idPrefix="web-theme"');
            expect(preferenciasSrc).toContain('idPrefix="admin-theme"');
        });

        it('renders separate LanguagePicker instances for web and admin', () => {
            expect(preferenciasSrc).toContain('idPrefix="web-lang"');
            expect(preferenciasSrc).toContain('idPrefix="admin-lang"');
        });
    });

    describe('timezone read-only', () => {
        it('detects the browser timezone via Intl.DateTimeFormat', () => {
            expect(preferenciasSrc).toContain('Intl.DateTimeFormat().resolvedOptions().timeZone');
        });

        it('shows the timezoneAuto badge label', () => {
            expect(preferenciasSrc).toContain("'admin-pages.settings.language.timezoneAuto'");
        });
    });

    describe('notifications block excluded (owned by T-014)', () => {
        it('does not render notification toggles', () => {
            expect(preferenciasSrc).not.toContain('NotificationToggle');
        });

        it('does not call handleNotificationChange', () => {
            expect(preferenciasSrc).not.toContain('handleNotificationChange');
        });

        it('does not import BellIcon', () => {
            expect(preferenciasSrc).not.toContain('BellIcon');
        });
    });

    describe('save preserves unrelated state', () => {
        it('forwards the current notifications object on save', () => {
            // Saving a theme/language change must not blow away the user's
            // existing notification preferences — the merged patch includes
            // `notifications` so the server sees the full per-surface shape.
            expect(preferenciasSrc).toMatch(/notifications,\s*\n\s*newsletter:/);
        });

        it('forwards the current newsletter flag on save', () => {
            expect(preferenciasSrc).toContain('settings?.newsletter ?? false');
        });
    });
});
