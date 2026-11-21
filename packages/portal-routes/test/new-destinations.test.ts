/**
 * HOS-2410 PR-2: the destination kinds and page links added for the help center.
 * Every new route must resolve to a real page of `apps/web`.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildPortalUrl,
    describePortalDestination,
    isNonIdentifyingDestination,
    PORTAL_DESTINATION_LABELS,
    PORTAL_PAGE_LABELS,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_UNRELEASED_ROUTE_KEYS,
    type PortalDestination,
    type PortalPageKey,
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

/** Pages of catalog §6.3 that have a page destination, by route. */
const CATALOG_PAGES: Readonly<Record<PortalPageKey, string>> = {
    accountHome: 'mi-cuenta',
    accountPublicProfile: 'mi-cuenta/publica',
    hostDashboard: 'mi-cuenta/host-dashboard',
    promotions: 'mi-cuenta/promociones',
    promotionNew: 'mi-cuenta/promociones/nueva',
    promotionEdit: 'mi-cuenta/promociones/[id]/editar',
    accountNews: 'mi-cuenta/novedades',
    accountEditProfile: 'mi-cuenta/editar',
    accountCompleteProfile: 'mi-cuenta/completar-perfil',
    accountChangePassword: 'mi-cuenta/cambiar-contrasena',
    accountAddPassword: 'mi-cuenta/agregar-contrasena',
    accountPreferences: 'mi-cuenta/preferencias',
    accountNewsletter: 'mi-cuenta/newsletter',
    accountAllies: 'mi-cuenta/aliados',
    checkout: 'suscriptores/checkout',
    subscriberPlans: 'suscriptores/planes',
    joinPartner: 'sumate/partner',
    joinProvider: 'sumate/proveedor',
    joinSponsor: 'sumate/sponsor',
    partnerClaim: 'partners/reclamar',
    partnerPublicPage: 'partners/[slug]',
    accommodationPublicPage: 'alojamientos/[slug]',
    venuePublicPage: 'comer-y-salir/[slug]',
    experiencePublicPage: 'experiencias/[slug]'
};

/** Fills every `[segment]` of a route with a sample value. */
const sampleParams = (route: string): Record<string, string> =>
    Object.fromEntries([...route.matchAll(/\[(\w+)\]/g)].map(([, name]) => [name as string, 'x1']));

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

    it('should only leave the help center pages without a web page, and nothing else', () => {
        const missing = Object.entries(PORTAL_ROUTE_TEMPLATES)
            .filter(([, template]) => !template.includes('[section]') && !pageExists(template))
            .map(([key]) => key)
            .sort();
        expect(missing).toEqual([...PORTAL_UNRELEASED_ROUTE_KEYS].sort());
        expect(PORTAL_UNRELEASED_ROUTE_KEYS).toEqual(['helpLanding', 'helpArticle']);
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
    const keys = Object.keys(CATALOG_PAGES) as PortalPageKey[];

    it('should cover exactly the pages listed in the catalog', () => {
        expect(Object.keys(PORTAL_PAGE_LABELS).sort()).toEqual([...keys].sort());
    });

    it.each(keys)('should resolve %s to an existing web page', (page) => {
        const route = CATALOG_PAGES[page];
        const destination: PortalDestination = { kind: 'page', page, params: sampleParams(route) };
        const template = portalDestinationTemplate({ destination });

        expect(template).toBe(route);
        expect(pageExists(template)).toBe(true);
        expect(urlOf(destination)).toBe(`${SITE}/es/${route.replace(/\[\w+\]/g, 'x1')}/`);
    });

    it.each(keys)('should give %s a Spanish label', (page) => {
        expect(
            describePortalDestination({ destination: { kind: 'page', page, params: {} } }).length
        ).toBeGreaterThan(0);
    });

    it('should throw when a dynamic page lacks its params', () => {
        expect(() => urlOf({ kind: 'page', page: 'partnerPublicPage' })).toThrow(/\[slug\]/);
    });

    it('should encode the dynamic params', () => {
        expect(
            urlOf({ kind: 'page', page: 'accommodationPublicPage', params: { slug: 'casa/rio' } })
        ).toBe(`${SITE}/es/alojamientos/casa%2Frio/`);
    });

    it('should call a static page non-identifying and a record page identifying', () => {
        expect(
            isNonIdentifyingDestination({ destination: { kind: 'page', page: 'accountHome' } })
        ).toBe(true);
        expect(
            isNonIdentifyingDestination({
                destination: { kind: 'page', page: 'accountHome', params: {} }
            })
        ).toBe(true);
        expect(
            isNonIdentifyingDestination({
                destination: { kind: 'page', page: 'partnerPublicPage', params: { slug: 'a' } }
            })
        ).toBe(false);
    });
});
