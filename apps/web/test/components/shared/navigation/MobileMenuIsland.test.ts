/**
 * @file MobileMenuIsland.test.ts
 * @description Source-level tests for the mobile menu island wrapper.
 * Astro components cannot be rendered in Vitest, so this asserts on the
 * source (per the web CLAUDE.md "Astro component test" pattern).
 *
 * The host-mode CTA logic previously lived here (SPEC-182 T-016) and moved
 * to `MobileMenu.client.tsx` (executable RTL tests — see
 * `MobileMenu.cta.test.tsx`) as part of removing this component's
 * `server:defer` directive, which used to fire an extra `get-session` call
 * on EVERY page view (mobile menu is in the global Header) and flooded the
 * API's `auth` rate-limit bucket.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/navigation/MobileMenuIsland.astro'),
    'utf8'
);

describe('MobileMenuIsland.astro — thin wrapper (no server:defer)', () => {
    it('does NOT use the server:defer directive', () => {
        expect(src).not.toMatch(/<MobileMenu\s+client:idle[\s\S]*?server:defer/);
        // Belt-and-suspenders: the literal directive must not appear at all
        // outside of explanatory prose in the file's JSDoc.
        const codeAfterFrontmatterClose = src.slice(src.indexOf('---', 4) + 3);
        expect(codeAfterFrontmatterClose).not.toContain('server:defer');
    });

    it('mounts MobileMenu with client:idle', () => {
        expect(src).toContain('<MobileMenu');
        expect(src).toContain('client:idle');
    });

    it('does NOT read Astro.locals directly (auth resolution moved client-side)', () => {
        // Prose comments legitimately mention `Astro.locals.user` for
        // historical context (see the file/prop JSDoc) — assert on the
        // actual extraction expression instead of a blanket substring check.
        expect(src).not.toMatch(/=\s*Astro\.locals/);
        expect(src).not.toContain('Astro.locals.user;');
    });

    it('does NOT compute the host-mode CTA itself (moved to MobileMenu.client.tsx)', () => {
        expect(src).not.toContain('isHostMode');
        expect(src).not.toContain('ctaLabel');
        expect(src).not.toContain('ctaHref');
    });

    it('forwards initialUser and initialRole SSR hints to MobileMenu', () => {
        expect(src).toContain('initialUser={initialUser}');
        expect(src).toContain('initialRole={initialRole}');
    });

    it('forwards adminPanelUrl to MobileMenu', () => {
        expect(src).toContain('adminPanelUrl={adminPanelUrl}');
    });

    it('declares initialUser and initialRole in Props', () => {
        expect(src).toContain('readonly initialUser: AuthMeUser | null');
        expect(src).toContain('readonly initialRole: string | null');
    });
});
