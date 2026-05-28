/**
 * @file mi-cuenta-notificaciones.test.ts
 * @description Source-based tests for the notifications page extracted from
 * the legacy /me/settings route as part of SPEC-156 PR-2 (T-014). Covers
 * the master toggle, the wired email channel, and the honest-disclosure
 * "(no disponible)" treatment of the SMS + push channels whose dispatch
 * backends are not implemented yet.
 *
 * Also re-asserts the `useUpdateUserSettings` hook contract (originally
 * tested by me-settings.test.ts) so the rename does not lose coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const notificacionesSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/mi-cuenta/notificaciones.tsx'),
    'utf8'
);

const hookSrc = readFileSync(resolve(__dirname, '../../src/hooks/use-user-profile.ts'), 'utf8');

describe('mi-cuenta/notificaciones.tsx (T-014)', () => {
    describe('route wiring', () => {
        it('registers the new route path', () => {
            expect(notificacionesSrc).toContain(
                "createFileRoute('/_authed/mi-cuenta/notificaciones')"
            );
        });

        it('uses the shared useUpdateUserSettings mutation hook', () => {
            expect(notificacionesSrc).toContain('useUpdateUserSettings');
        });
    });

    describe('channel toggles', () => {
        it('renders a master enable toggle', () => {
            expect(notificacionesSrc).toContain(
                "t('admin-pages.settings.notifications.enableNotifications')"
            );
        });

        it('renders a wired email toggle', () => {
            expect(notificacionesSrc).toContain(
                "t('admin-pages.settings.notifications.emailNotifications')"
            );
            expect(notificacionesSrc).toMatch(/allowEmails['"]?,\s*v\)/);
        });

        it('renders an SMS toggle marked as unavailable', () => {
            expect(notificacionesSrc).toContain(
                "t('admin-pages.settings.notifications.smsNotifications')"
            );
        });

        it('renders a push toggle marked as unavailable', () => {
            expect(notificacionesSrc).toContain(
                "t('admin-pages.settings.notifications.pushNotifications')"
            );
        });
    });

    describe('honest disclosure for SMS + push (AC-20, AC-21)', () => {
        it('forces the SMS toggle disabled (no backend yet)', () => {
            const smsBlock = notificacionesSrc.match(
                /label=\{t\('admin-pages\.settings\.notifications\.smsNotifications'\)\}[\s\S]+?\/>/
            )?.[0];
            expect(smsBlock).toBeDefined();
            expect(smsBlock).toMatch(/\n\s+disabled\n/);
            expect(smsBlock).toContain('unavailableLabel="(no disponible)"');
        });

        it('forces the push toggle disabled (no backend yet)', () => {
            const pushBlock = notificacionesSrc.match(
                /label=\{t\('admin-pages\.settings\.notifications\.pushNotifications'\)\}[\s\S]+?\/>/
            )?.[0];
            expect(pushBlock).toBeDefined();
            expect(pushBlock).toMatch(/\n\s+disabled\n/);
            expect(pushBlock).toContain('unavailableLabel="(no disponible)"');
        });

        it('renders the unavailable label as inline italic muted text', () => {
            expect(notificacionesSrc).toContain(
                '<span className="text-muted-foreground text-xs italic">'
            );
        });
    });

    describe('save preserves unrelated state', () => {
        it('forwards the current theme + language values on save', () => {
            expect(notificacionesSrc).toContain('themeWeb: currentThemeWeb');
            expect(notificacionesSrc).toContain('themeAdmin: currentThemeAdmin');
            expect(notificacionesSrc).toContain('languageWeb: currentLanguageWeb');
            expect(notificacionesSrc).toContain('languageAdmin: currentLanguageAdmin');
        });

        it('forwards the current newsletter flag on save', () => {
            expect(notificacionesSrc).toContain('settings?.newsletter ?? false');
        });

        it('turns off all channels when the master toggle is disabled', () => {
            expect(notificacionesSrc).toContain('updated.allowEmails = false');
            expect(notificacionesSrc).toContain('updated.allowSms = false');
            expect(notificacionesSrc).toContain('updated.allowPush = false');
        });
    });
});

describe('useUpdateUserSettings (carried over from T-056)', () => {
    it('exposes an AdminUserSettingsPatch type', () => {
        expect(hookSrc).toContain('export type AdminUserSettingsPatch');
    });

    it('lists all four per-surface fields plus shared keys', () => {
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
