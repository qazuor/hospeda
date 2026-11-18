/**
 * HOS-2326 (spec HOS-2335 §5.1) — the API's copy of the owner portal's routes
 * and the builder that turns a destination into an absolute URL.
 *
 * @module test/mcp/portal/build-portal-url
 */

import { LISTING_SECTIONS, LISTING_VERTICALS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildPortalUrl,
    portalDestinationTemplate
} from '../../../src/mcp/portal/build-portal-url';
import {
    isNonIdentifyingDestination,
    PORTAL_DESTINATION_LABELS
} from '../../../src/mcp/portal/portal-destination';
import {
    EDITOR_SECTION_SLUGS,
    PORTAL_ROUTE_TEMPLATES,
    type PortalDestination,
    UNRELEASED_EDITOR_SECTIONS
} from '../../../src/mcp/portal/portal-routes';

const SITE = 'https://hospeda.test';
const ID = '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7';

/** Builds the URL of a destination against the test site. */
const urlOf = (destination: PortalDestination, siteUrl = SITE): string =>
    buildPortalUrl({ destination, siteUrl });

describe('buildPortalUrl', () => {
    describe('editor', () => {
        it('builds an accommodation editor section', () => {
            expect(
                urlOf({
                    kind: 'listingEditor',
                    vertical: 'accommodation',
                    id: ID,
                    section: 'basicInfo'
                })
            ).toBe(`${SITE}/es/mi-cuenta/propiedades/${ID}/editar/datos/`);
        });

        it('builds a venue and an experience editor section under comercio', () => {
            expect(
                urlOf({ kind: 'listingEditor', vertical: 'venue', id: ID, section: 'amenities' })
            ).toBe(`${SITE}/es/mi-cuenta/comercio/venue/${ID}/editar/servicios/`);
            expect(
                urlOf({
                    kind: 'listingEditor',
                    vertical: 'experience',
                    id: ID,
                    section: 'meetingPoint'
                })
            ).toBe(`${SITE}/es/mi-cuenta/comercio/experience/${ID}/editar/punto-de-encuentro/`);
        });

        it('links the hub when no section is given', () => {
            expect(urlOf({ kind: 'listingEditor', vertical: 'accommodation', id: ID })).toBe(
                `${SITE}/es/mi-cuenta/propiedades/${ID}/editar/`
            );
            expect(urlOf({ kind: 'listingEditor', vertical: 'venue', id: ID })).toBe(
                `${SITE}/es/mi-cuenta/comercio/venue/${ID}/editar/`
            );
        });

        it('falls back to the hub for a section the vertical does not have', () => {
            // `capacityPricing` is an accommodation section; a venue has none.
            expect(
                urlOf({
                    kind: 'listingEditor',
                    vertical: 'venue',
                    id: ID,
                    section: 'capacityPricing'
                })
            ).toBe(`${SITE}/es/mi-cuenta/comercio/venue/${ID}/editar/`);
        });

        it('URL-encodes the id', () => {
            expect(urlOf({ kind: 'listingEditor', vertical: 'venue', id: 'a/b c' })).toContain(
                '/venue/a%2Fb%20c/editar/'
            );
        });

        it('refuses an empty id instead of building a link with a hole', () => {
            expect(() => urlOf({ kind: 'listingEditor', vertical: 'venue', id: ' ' })).toThrow();
        });
    });

    describe('every other destination', () => {
        const cases: readonly (readonly [string, PortalDestination, string])[] = [
            [
                'owner accommodations',
                { kind: 'ownerListings', vertical: 'accommodation' },
                'mi-cuenta/propiedades'
            ],
            ['owner venues', { kind: 'ownerListings', vertical: 'venue' }, 'mi-cuenta/comercio'],
            [
                'owner experiences',
                { kind: 'ownerListings', vertical: 'experience' },
                'mi-cuenta/comercio'
            ],
            [
                'create accommodation',
                { kind: 'createListing', vertical: 'accommodation' },
                'publicar'
            ],
            [
                'create venue',
                { kind: 'createListing', vertical: 'venue' },
                'publicar/comer-y-salir'
            ],
            [
                'create experience',
                { kind: 'createListing', vertical: 'experience' },
                'publicar/experiencias'
            ],
            [
                'plans accommodation',
                { kind: 'plans', vertical: 'accommodation' },
                'planes/anfitriones'
            ],
            ['plans venue', { kind: 'plans', vertical: 'venue' }, 'planes/comer-y-salir'],
            ['plans experience', { kind: 'plans', vertical: 'experience' }, 'planes/experiencias'],
            ['subscription', { kind: 'subscription' }, 'mi-cuenta/suscripcion'],
            ['add-ons', { kind: 'addons' }, 'mi-cuenta/complementos'],
            ['inquiry inbox', { kind: 'inquiry' }, 'mi-cuenta/consultas-propietario'],
            [
                'one inquiry',
                { kind: 'inquiry', conversationId: ID },
                `mi-cuenta/consultas-propietario/${ID}`
            ],
            [
                'provider directory',
                { kind: 'providerDirectory' },
                'mi-cuenta/directorio-proveedores'
            ],
            [
                'one provider',
                { kind: 'providerDirectory', slug: 'plomeria-sur' },
                'mi-cuenta/directorio-proveedores/plomeria-sur'
            ],
            [
                'declare a usage of one provider',
                { kind: 'declareBenefitUsage', slug: 'plomeria-sur' },
                'mi-cuenta/directorio-proveedores/plomeria-sur/registrar-uso'
            ],
            ['benefit usages', { kind: 'benefitUsages' }, 'mi-cuenta/usos-de-beneficio'],
            ['provider panel', { kind: 'providerPanel' }, 'mi-cuenta/proveedor'],
            ['AI assistants', { kind: 'aiAssistants' }, 'mi-cuenta/asistentes-ia'],
            ['FAQ', { kind: 'faq' }, 'preguntas-frecuentes'],
            ['contact', { kind: 'contact' }, 'contacto']
        ];

        it.each(cases)('%s', (_name, destination, path) => {
            expect(urlOf(destination)).toBe(`${SITE}/es/${path}/`);
        });
    });

    describe('base URL and locale', () => {
        it('tolerates trailing slashes on the site URL', () => {
            expect(urlOf({ kind: 'subscription' }, `${SITE}///`)).toBe(
                `${SITE}/es/mi-cuenta/suscripcion/`
            );
        });

        it('uses the site URL it is given, never a fixed host', () => {
            expect(urlOf({ kind: 'subscription' }, 'https://staging.example.org')).toBe(
                'https://staging.example.org/es/mi-cuenta/suscripcion/'
            );
        });

        it('honours an explicit locale', () => {
            expect(
                buildPortalUrl({ destination: { kind: 'addons' }, siteUrl: SITE, locale: 'pt' })
            ).toBe(`${SITE}/pt/mi-cuenta/complementos/`);
        });

        it('refuses an empty site URL', () => {
            expect(() => urlOf({ kind: 'addons' }, '  ')).toThrow();
        });
    });
});

describe('the route map', () => {
    it('has a slug for every catalog section of every vertical, and no stale one', () => {
        for (const vertical of LISTING_VERTICALS) {
            const unreleased: readonly string[] = UNRELEASED_EDITOR_SECTIONS[vertical];
            const catalogIds = LISTING_SECTIONS[vertical]
                .map((section) => section.id)
                .filter((id) => !unreleased.includes(id))
                .sort();
            expect(Object.keys(EDITOR_SECTION_SLUGS[vertical]).sort()).toEqual(catalogIds);
        }
    });

    it('uses only paths with no locale and no edge slashes', () => {
        for (const template of Object.values(PORTAL_ROUTE_TEMPLATES)) {
            expect(template).not.toMatch(/^\/|\/$/);
            expect(template).not.toMatch(/^(es|en|pt)\//);
        }
    });

    it('labels every destination kind', () => {
        expect(Object.keys(PORTAL_DESTINATION_LABELS).sort()).toEqual(
            [
                'listingEditor',
                'ownerListings',
                'createListing',
                'plans',
                'subscription',
                'addons',
                'inquiry',
                'providerDirectory',
                'declareBenefitUsage',
                'benefitUsages',
                'providerPanel',
                'aiAssistants',
                'faq',
                'contact'
            ].sort()
        );
    });
});

describe('isNonIdentifyingDestination', () => {
    it('is false for any link built around an id or slug', () => {
        expect(
            isNonIdentifyingDestination({
                destination: { kind: 'listingEditor', vertical: 'venue', id: ID }
            })
        ).toBe(false);
        expect(
            isNonIdentifyingDestination({ destination: { kind: 'inquiry', conversationId: ID } })
        ).toBe(false);
        expect(
            isNonIdentifyingDestination({ destination: { kind: 'providerDirectory', slug: 'x' } })
        ).toBe(false);
        expect(
            isNonIdentifyingDestination({ destination: { kind: 'declareBenefitUsage', slug: 'x' } })
        ).toBe(false);
    });

    it('is true for lists, plans and the inbox', () => {
        expect(
            isNonIdentifyingDestination({
                destination: { kind: 'ownerListings', vertical: 'venue' }
            })
        ).toBe(true);
        expect(isNonIdentifyingDestination({ destination: { kind: 'inquiry' } })).toBe(true);
        expect(isNonIdentifyingDestination({ destination: { kind: 'subscription' } })).toBe(true);
        expect(isNonIdentifyingDestination({ destination: { kind: 'providerDirectory' } })).toBe(
            true
        );
        expect(isNonIdentifyingDestination({ destination: { kind: 'faq' } })).toBe(true);
        expect(isNonIdentifyingDestination({ destination: { kind: 'contact' } })).toBe(true);
    });
});

describe('portalDestinationTemplate', () => {
    it('keeps the dynamic segments and puts the section slug in an editor path', () => {
        // Assert
        expect(
            portalDestinationTemplate({
                destination: { kind: 'listingEditor', vertical: 'venue', id: ID, section: 'media' }
            })
        ).toBe('mi-cuenta/comercio/[vertical]/[id]/editar/fotos');
        expect(
            portalDestinationTemplate({
                destination: {
                    kind: 'listingEditor',
                    vertical: 'accommodation',
                    id: ID,
                    section: 'photos'
                }
            })
        ).toBe('mi-cuenta/propiedades/[id]/editar/fotos');
    });

    it('is the hub for a section the vertical does not have, like the URL', () => {
        // Assert
        expect(
            portalDestinationTemplate({
                destination: {
                    kind: 'listingEditor',
                    vertical: 'venue',
                    id: ID,
                    section: 'capacityPricing'
                }
            })
        ).toBe('mi-cuenta/comercio/[vertical]/[id]/editar');
    });

    it('is the plain path of a destination with no dynamic segment', () => {
        // Assert
        expect(portalDestinationTemplate({ destination: { kind: 'faq' } })).toBe(
            'preguntas-frecuentes'
        );
        expect(
            portalDestinationTemplate({ destination: { kind: 'plans', vertical: 'venue' } })
        ).toBe('planes/comer-y-salir');
    });
});
