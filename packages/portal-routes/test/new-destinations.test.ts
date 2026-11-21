/**
 * HOS-2410 PR-2: the destination kinds and page links added for the help center.
 * Every new route must resolve to a real page of `apps/web`.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    buildPortalUrl,
    describePortalDestination,
    isNonIdentifyingDestination,
    PORTAL_DESTINATION_LABELS,
    PORTAL_PAGE_LABELS,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_UNRELEASED_ROUTE_KEYS,
    type PortalDestination,
    type PortalPageDestination,
    type PortalPageParamNames,
    portalDestinationTemplate
} from '../src/index';

const SITE = 'https://hospeda.test';
const PAGES_ROOT = path.resolve(import.meta.dirname, '../../../apps/web/src/pages/[lang]');

/** Same lookup as `pageExists` in `scripts/check-portal-routes.ts`. */
function pageExists(route: string): boolean {
    const segments = route.split('/');
    const last = segments.pop() as string;
    const dir = path.join(PAGES_ROOT, ...segments);
    const isFile = (file: string) => existsSync(file) && statSync(file).isFile();
    return isFile(path.join(dir, `${last}.astro`)) || isFile(path.join(dir, last, 'index.astro'));
}

const urlOf = (destination: PortalDestination) => buildPortalUrl({ destination, siteUrl: SITE });

/** One typed destination per page of catalog §6.3, with the route it must resolve to. */
const PAGE_CASES: readonly {
    readonly destination: PortalPageDestination;
    readonly route: string;
}[] = [
    { destination: { kind: 'page', page: 'accountHome' }, route: 'mi-cuenta' },
    { destination: { kind: 'page', page: 'accountPublicProfile' }, route: 'mi-cuenta/publica' },
    { destination: { kind: 'page', page: 'hostDashboard' }, route: 'mi-cuenta/host-dashboard' },
    { destination: { kind: 'page', page: 'promotions' }, route: 'mi-cuenta/promociones' },
    { destination: { kind: 'page', page: 'promotionNew' }, route: 'mi-cuenta/promociones/nueva' },
    {
        destination: { kind: 'page', page: 'promotionEdit', params: { id: 'x1' } },
        route: 'mi-cuenta/promociones/[id]/editar'
    },
    { destination: { kind: 'page', page: 'accountNews' }, route: 'mi-cuenta/novedades' },
    { destination: { kind: 'page', page: 'accountEditProfile' }, route: 'mi-cuenta/editar' },
    {
        destination: { kind: 'page', page: 'accountCompleteProfile' },
        route: 'mi-cuenta/completar-perfil'
    },
    {
        destination: { kind: 'page', page: 'accountChangePassword' },
        route: 'mi-cuenta/cambiar-contrasena'
    },
    {
        destination: { kind: 'page', page: 'accountAddPassword' },
        route: 'mi-cuenta/agregar-contrasena'
    },
    { destination: { kind: 'page', page: 'accountPreferences' }, route: 'mi-cuenta/preferencias' },
    { destination: { kind: 'page', page: 'accountNewsletter' }, route: 'mi-cuenta/newsletter' },
    { destination: { kind: 'page', page: 'accountAllies' }, route: 'mi-cuenta/aliados' },
    { destination: { kind: 'page', page: 'checkout' }, route: 'suscriptores/checkout' },
    { destination: { kind: 'page', page: 'subscriberPlans' }, route: 'suscriptores/planes' },
    { destination: { kind: 'page', page: 'joinPartner' }, route: 'sumate/partner' },
    { destination: { kind: 'page', page: 'joinProvider' }, route: 'sumate/proveedor' },
    { destination: { kind: 'page', page: 'joinSponsor' }, route: 'sumate/sponsor' },
    { destination: { kind: 'page', page: 'partnerClaim' }, route: 'partners/reclamar' },
    {
        destination: { kind: 'page', page: 'partnerPublicPage', params: { slug: 'x1' } },
        route: 'partners/[slug]'
    },
    {
        destination: { kind: 'page', page: 'accommodationPublicPage', params: { slug: 'x1' } },
        route: 'alojamientos/[slug]'
    },
    {
        destination: { kind: 'page', page: 'venuePublicPage', params: { slug: 'x1' } },
        route: 'comer-y-salir/[slug]'
    },
    {
        destination: { kind: 'page', page: 'experiencePublicPage', params: { slug: 'x1' } },
        route: 'experiencias/[slug]'
    }
];

describe('partnerPanel, helpLanding and helpArticle', () => {
    it('should build the partner panel URL and resolve to an existing page', () => {
        const destination: PortalDestination = { kind: 'partnerPanel' };
        expect(urlOf(destination)).toBe(`${SITE}/es/mi-cuenta/partner/`);
        expect(pageExists(portalDestinationTemplate({ destination }))).toBe(true);
    });

    it('should build the help landing URL', () => {
        expect(urlOf({ kind: 'helpLanding' })).toBe(`${SITE}/es/mi-cuenta/ayuda/`);
    });

    it('should build the help article URL and encode the id', () => {
        expect(urlOf({ kind: 'helpArticle', id: 'pause-resume' })).toBe(
            `${SITE}/es/mi-cuenta/ayuda/pause-resume/`
        );
        expect(urlOf({ kind: 'helpArticle', id: 'a b' })).toBe(`${SITE}/es/mi-cuenta/ayuda/a%20b/`);
    });

    it('should throw when the article id is blank', () => {
        expect(() => urlOf({ kind: 'helpArticle', id: ' ' })).toThrow(/\[id\]/);
    });

    it('should honour the locale', () => {
        expect(
            buildPortalUrl({ destination: { kind: 'helpLanding' }, locale: 'pt', siteUrl: SITE })
        ).toBe(`${SITE}/pt/mi-cuenta/ayuda/`);
    });

    it('should leave no route without a web page once the help center shipped (HOS-2410 PR-5)', () => {
        const missing = Object.entries(PORTAL_ROUTE_TEMPLATES)
            .filter(([, template]) => !template.includes('[section]') && !pageExists(template))
            .map(([key]) => key)
            .sort();
        expect(missing).toEqual([...PORTAL_UNRELEASED_ROUTE_KEYS].sort());
        expect(PORTAL_UNRELEASED_ROUTE_KEYS).toEqual([]);
        expect(pageExists(PORTAL_ROUTE_TEMPLATES.helpLanding)).toBe(true);
        expect(pageExists(PORTAL_ROUTE_TEMPLATES.helpArticle)).toBe(true);
    });

    it('should label the new kinds', () => {
        for (const kind of ['partnerPanel', 'helpLanding', 'helpArticle'] as const) {
            expect(PORTAL_DESTINATION_LABELS[kind].length).toBeGreaterThan(0);
        }
        expect(describePortalDestination({ destination: { kind: 'partnerPanel' } })).toBe(
            'Abrir mi panel de partner'
        );
    });

    it('should not treat the new kinds as identifying', () => {
        expect(isNonIdentifyingDestination({ destination: { kind: 'partnerPanel' } })).toBe(true);
        expect(isNonIdentifyingDestination({ destination: { kind: 'helpLanding' } })).toBe(true);
        expect(isNonIdentifyingDestination({ destination: { kind: 'helpArticle', id: 'x' } })).toBe(
            true
        );
    });
});

describe('page destinations (catalog §6.3)', () => {
    it('should cover exactly the pages of PORTAL_PAGE_LABELS', () => {
        expect(PAGE_CASES.map(({ destination }) => destination.page).sort()).toEqual(
            Object.keys(PORTAL_PAGE_LABELS).sort()
        );
    });

    it.each(PAGE_CASES)('should resolve $destination.page to an existing web page', ({
        destination,
        route
    }) => {
        const template = portalDestinationTemplate({ destination });

        expect(template).toBe(route);
        expect(pageExists(template)).toBe(true);
        expect(urlOf(destination)).toBe(`${SITE}/es/${route.replace(/\[\w+\]/g, 'x1')}/`);
    });

    it.each(PAGE_CASES)('should give $destination.page a Spanish label', ({ destination }) => {
        expect(describePortalDestination({ destination }).length).toBeGreaterThan(0);
    });

    it.each(
        PAGE_CASES
    )('should call $destination.page identifying only when it has a dynamic segment', ({
        destination,
        route
    }) => {
        expect(isNonIdentifyingDestination({ destination })).toBe(!route.includes('['));
    });

    it('should throw at runtime when a dynamic page reaches the builder without params', () => {
        // Defends callers that bypass the types (JSON, `any`).
        const untyped = JSON.parse(
            '{"kind":"page","page":"partnerPublicPage"}'
        ) as PortalDestination;
        expect(() => urlOf(untyped)).toThrow(/\[slug\]/);
    });

    it('should encode the dynamic params', () => {
        expect(
            urlOf({ kind: 'page', page: 'accommodationPublicPage', params: { slug: 'casa/rio' } })
        ).toBe(`${SITE}/es/alojamientos/casa%2Frio/`);
    });
});

describe('page destination types', () => {
    it('should derive the required params from the template', () => {
        expectTypeOf<PortalPageParamNames<'promotionEdit'>>().toEqualTypeOf<'id'>();
        expectTypeOf<PortalPageParamNames<'partnerPublicPage'>>().toEqualTypeOf<'slug'>();
        expectTypeOf<PortalPageParamNames<'accommodationPublicPage'>>().toEqualTypeOf<'slug'>();
        expectTypeOf<PortalPageParamNames<'venuePublicPage'>>().toEqualTypeOf<'slug'>();
        expectTypeOf<PortalPageParamNames<'experiencePublicPage'>>().toEqualTypeOf<'slug'>();
        expectTypeOf<PortalPageParamNames<'accountHome'>>().toEqualTypeOf<never>();
    });

    it('should accept the right params and reject the wrong or missing ones', () => {
        const accepted: PortalPageDestination[] = [
            { kind: 'page', page: 'promotionEdit', params: { id: 'a' } },
            { kind: 'page', page: 'partnerPublicPage', params: { slug: 'a' } },
            { kind: 'page', page: 'accountHome' }
        ];
        expect(accepted).toHaveLength(3);

        const probe = (_destination: PortalPageDestination): void => undefined;
        // @ts-expect-error a dynamic page requires params
        probe({ kind: 'page', page: 'promotionEdit' });
        // @ts-expect-error promotionEdit takes `id`, not `slug`
        probe({ kind: 'page', page: 'promotionEdit', params: { slug: 'a' } });
        // @ts-expect-error a slug page takes `slug`, not `id`
        probe({ kind: 'page', page: 'venuePublicPage', params: { id: 'a' } });
        // @ts-expect-error a static page takes no params
        probe({ kind: 'page', page: 'accountHome', params: { id: 'a' } });
    });
});

describe('buildPortalUrl site URL normalisation (js/polynomial-redos)', () => {
    const destination = { kind: 'page', page: 'accountHome' } satisfies PortalDestination;

    it('strips a long run of trailing slashes in linear time', () => {
        const started = Date.now();
        const url = buildPortalUrl({ destination, siteUrl: `${SITE}${'/'.repeat(100000)}` });

        expect(url.startsWith(`${SITE}/`)).toBe(true);
        expect(url.startsWith(`${SITE}//`)).toBe(false);
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('keeps slashes that are not trailing and still rejects a slash-only site URL', () => {
        const started = Date.now();
        const noisy = `${'/'.repeat(100000)}x`;

        expect(buildPortalUrl({ destination, siteUrl: noisy }).startsWith(noisy)).toBe(true);
        expect(() => buildPortalUrl({ destination, siteUrl: '/'.repeat(100000) })).toThrow(
            'site URL'
        );
        expect(Date.now() - started).toBeLessThan(1000);
    });
});
