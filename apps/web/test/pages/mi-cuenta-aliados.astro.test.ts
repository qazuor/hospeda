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
            "import { isVisibleByRoles, resolveDoorLabelKey } from '@/lib/nav-gating';"
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
        expect(source).toContain('<DiscoveryDoorHub');
        expect(source).toContain('locale={locale}');
        expect(source).toContain('door={door}');
        expect(source).toContain('roles={user.roles}');
        expect(source).toContain('adminUrl={getAdminUrl()}');
    });

    it('wraps content in AccountLayout with the aliados active section', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="aliados"');
    });

    // HOS-278 AC-14 — the hub now also reports the state of what you applied to.
    describe('own applications (HOS-278 AC-14)', () => {
        it('fetches the caller own applications, forwarding the session cookie', () => {
            expect(source).toContain(
                "import { allianceLeadsApi, hostTradesApi, partnersApi } from '@/lib/api/endpoints-protected';"
            );
            expect(source).toContain('allianceLeadsApi.mine({');
            expect(source).toContain("Astro.request.headers.get('cookie')");
        });

        it('degrades to an empty list rather than erroring the hub', () => {
            // The applications panel is an addition to a hub that stood on its
            // own for two specs; an API failure must not take the page down.
            expect(source).toContain('myLeadsResult.ok ? myLeadsResult.data.leads : []');
        });

        it('renders the applications section above the discovery hub', () => {
            expect(source).toContain(
                "import AllianceApplicationsSection from '@/components/account/AllianceApplicationsSection.astro';"
            );
            expect(source).toContain(
                '<AllianceApplicationsSection locale={locale} leads={myLeads} />'
            );
            expect(source.indexOf('<AllianceApplicationsSection')).toBeLessThan(
                source.indexOf('<DiscoveryDoorHub')
            );
        });
    });

    // HOS-278 §8 — the serviceProvider door option force-acquires once the
    // caller owns a host-trades listing.
    describe('serviceProvider acquired signal (HOS-278 §8)', () => {
        it('fetches the caller own host-trade listing, forwarding the session cookie', () => {
            expect(source).toContain(
                "import { allianceLeadsApi, hostTradesApi, partnersApi } from '@/lib/api/endpoints-protected';"
            );
            expect(source).toContain('hostTradesApi.mine({');
        });

        it('degrades to null on fetch failure, rather than erroring the hub', () => {
            expect(source).toContain('myTradeResult.ok ? myTradeResult.data.trade : null');
        });

        it('adds "serviceProvider" to acquiredOptionIds only when a trade exists', () => {
            // HOS-278 D3 moved this out of an inline ternary on the prop and
            // into a named array, because a SECOND force-acquired option
            // joined it. The conditionality is what matters and it now lives
            // in the spread — asserting only `acquiredOptionIds={...}` would
            // pass even if the guard were dropped and the option always sent.
            expect(source).toContain("...(myTrade ? (['serviceProvider'] as const) : [])");
            expect(source).toContain('acquiredOptionIds={acquiredOptionIds}');
        });
    });

    // HOS-278 D3 — the partner door option force-acquires the same way, once
    // the caller owns a `partners` row. Neither option declares an
    // `acquiredPermission`: an approved aliado is an ordinary account (AC-7),
    // so there is no permission for the normal mechanism to read.
    describe('partner acquired signal (HOS-278 D3)', () => {
        it('fetches the caller own partner listing, forwarding the session cookie', () => {
            expect(source).toContain('partnersApi.mine({');
            expect(source).toContain("Astro.request.headers.get('cookie')");
        });

        it('degrades to null on fetch failure, rather than erroring the hub', () => {
            expect(source).toContain('myPartnerResult.ok ? myPartnerResult.data.partner : null');
        });

        it('adds "partner" to acquiredOptionIds only when a partner exists', () => {
            expect(source).toContain("...(myPartner ? (['partner'] as const) : [])");
        });

        it('fetches all three in parallel, not chained', () => {
            // This is an uncacheable actor-scoped SSR page: chaining the three
            // reads would add two full API round-trips to its TTFB for nothing.
            expect(source).toContain('await Promise.all([');
        });
    });
});
