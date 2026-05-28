/**
 * @file mi-cuenta-seguridad-index.test.ts
 * @description Source-based tests for the security area landing page
 * created in SPEC-156 PR-2 (T-016). Verifies the page links to the
 * existing password-change route and renders the deferred-feature stubs
 * with a coming-soon disclosure (2FA, sessions, login history, change email).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const landingSrc = readFileSync(
    resolve(__dirname, '../../src/routes/_authed/account/security/index.tsx'),
    'utf8'
);

describe('account/security/index.tsx (T-016)', () => {
    it('registers the new route path', () => {
        expect(landingSrc).toContain("createFileRoute('/_authed/account/security/')");
    });

    it('links to the password change page at its new location', () => {
        expect(landingSrc).toContain('to="/account/security/change-password"');
    });

    it('renders the available actions section', () => {
        expect(landingSrc).toContain("t('admin-pages.security.available.title')");
        expect(landingSrc).toContain("t('admin-pages.security.changePassword.title')");
    });

    describe('coming-soon stubs (AC-6)', () => {
        const stubs = ['twoFactorAuth', 'activeSessions', 'loginHistory', 'changeEmail'];

        it('lists all four deferred features', () => {
            for (const id of stubs) {
                expect(landingSrc).toContain(`id: '${id}'`);
            }
        });

        it('binds each stub to a translation title key', () => {
            for (const id of stubs) {
                expect(landingSrc).toContain(`admin-pages.security.stubs.${id}.title`);
            }
        });

        it('marks the stub rows as aria-disabled with visual dim styling', () => {
            expect(landingSrc).toContain('aria-disabled');
            expect(landingSrc).toContain('opacity-60');
        });

        it('renders an inline (próximamente) label using comingSoon translation', () => {
            expect(landingSrc).toContain("t('admin-common.comingSoon.title').toLowerCase()");
        });
    });
});
