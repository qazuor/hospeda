/**
 * @file mi-cuenta-aliados.astro.test.ts
 * @description Source-level assertions for the "Sumate como aliado"
 * discovery-door hub page (HOS-131 §6.2). Astro pages cannot be rendered via
 * Vitest, so we lean on string-level assertions on the .astro source — same
 * pattern used by `mi-cuenta-ofertas-exclusivas.astro.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/aliados/index.astro'),
    'utf8'
);

describe('mi-cuenta/aliados/index.astro (HOS-131 "Sumate como aliado" hub)', () => {
    it('is SSR (prerender = false — requires an authenticated user)', () => {
        expect(source).toContain('prerender = false');
    });

    it('redirects unauthenticated visitors to signin (safety-net guard)', () => {
        expect(source).toContain('Astro.locals.user');
        expect(source).toMatch(/if\s*\(\s*!user\s*\)/);
        expect(source).toContain("path: 'auth/signin'");
    });

    it('resolves locale from Astro.locals', () => {
        expect(source).toContain('Astro.locals.locale as SupportedLocale');
    });

    it('looks up the "partner" door from ACCOUNT_DISCOVERY_DOORS, not a hardcoded object', () => {
        expect(source).toContain(
            "import { ACCOUNT_DISCOVERY_DOORS } from '@/config/discovery-doors';"
        );
        expect(source).toContain("candidate.id === 'partner'");
    });

    it('redirects to the account dashboard if the door is somehow missing', () => {
        expect(source).toContain('if (!door)');
        expect(source).toContain("path: 'mi-cuenta' }");
    });

    it('resolves the title via resolveDoorLabelKey (HOS-134 stateful label), and the subtitle via i18n, never hardcoded strings', () => {
        expect(source).toContain(
            "import { isVisibleByRole, resolveDoorLabelKey } from '@/lib/nav-gating';"
        );
        expect(source).toContain('resolveDoorLabelKey({');
        expect(source).toContain('const title = t(labelKey);');
        expect(source).toContain('t(door.subtitleI18nKey)');
    });

    it('renders the shared DiscoveryDoorHub component, forwarding locale/door/role/adminUrl (HOS-134)', () => {
        expect(source).toContain(
            "import DiscoveryDoorHub from '@/components/account/DiscoveryDoorHub.astro';"
        );
        expect(source).toContain("import { getAdminUrl } from '@/lib/env';");
        expect(source).toContain(
            '<DiscoveryDoorHub locale={locale} door={door} role={user.role} adminUrl={getAdminUrl()} />'
        );
    });

    it('wraps content in AccountLayout with the aliados active section', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="aliados"');
    });
});
