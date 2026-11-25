import { describe, expect, it } from 'vitest';
import { getActiveSectionKey } from '../../src/lib/account-nav-section';

describe('canonical account route sections', () => {
    it.each([
        ['mi-cuenta', 'mi-cuenta'],
        ['/es/mi-cuenta/', 'mi-cuenta'],
        ['/en/mi-cuenta/propiedades/example-id/editar/fotos/', 'propiedades'],
        ['/pt/mi-cuenta/publicaciones/example-id/editar/', 'publicaciones'],
        ['/es/mi-cuenta/eventos/example-id/editar/', 'eventos'],
        ['/es/mi-cuenta/proveedor/editar/', 'proveedor'],
        ['/es/mi-cuenta/partner/editar/', 'partner'],
        [
            '/es/mi-cuenta/directorio-proveedores/example-slug/registrar-uso/',
            'directorio-proveedores'
        ],
        ['/es/mi-cuenta/consultas-propietario/conversation-id/', 'owner-messages'],
        ['/es/mi-cuenta/consultas/conversation-id/', 'messages'],
        ['/es/mi-cuenta/favoritos/colecciones/collection-id/', 'favoritos'],
        ['/es/mi-cuenta/promociones/example-id/editar/', 'promociones'],
        ['mi-cuenta/comercio?vertical=venue', 'comercio-venue'],
        ['/es/mi-cuenta/comercio/?filter=all&vertical=experience#top', 'comercio-experience'],
        ['/es/mi-cuenta/comercio/venue/example-id/editar/fotos/', 'comercio-venue'],
        ['/es/mi-cuenta/comercio/experience/example-id/editar/', 'comercio-experience'],
        ['promociones', 'promociones']
    ])('maps %s to its canonical parent %s', (href, expected) => {
        const section = getActiveSectionKey({ href });
        expect(section).toBe(expected);
    });

    it.each([
        'venue',
        'experience'
    ] as const)('disambiguates the commerce list using only its vertical query (%s)', (vertical) => {
        const section = getActiveSectionKey({
            href: '/es/mi-cuenta/comercio/',
            search: `?vertical=${vertical}`
        });
        expect(section).toBe(`comercio-${vertical}`);
    });

    it('keeps nested commerce pathname identity ahead of a conflicting query', () => {
        const section = getActiveSectionKey({
            href: '/es/mi-cuenta/comercio/experience/example-id/editar/',
            search: '?vertical=venue'
        });
        expect(section).toBe('comercio-experience');
    });

    it.each([
        '',
        '?vertical=invalid',
        '?other=venue'
    ])('does not invent a commerce vertical for %s', (search) => {
        expect(getActiveSectionKey({ href: '/es/mi-cuenta/comercio/', search })).toBe('comercio');
    });

    it('ignores commerce query parameters for other routes and respects path segment boundaries', () => {
        expect(
            getActiveSectionKey({
                href: '/es/mi-cuenta/propiedades/example-id/editar/',
                search: '?vertical=experience'
            })
        ).toBe('propiedades');
        expect(
            getActiveSectionKey({ href: '/es/mi-cuenta/consultas-propietario-extra/example-id/' })
        ).toBe('consultas-propietario-extra');
    });
});
