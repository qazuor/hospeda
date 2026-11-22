/**
 * Tests for the account chrome model (HOS-2550): the header's site nav and
 * icon actions, and the footer's link groups.
 */

import { describe, expect, it } from 'vitest';
import {
    ACCOUNT_HEADER_INLINE_NAV_IDS,
    buildAccountFooterModel,
    buildAccountHeaderActions,
    buildAccountHeaderSiteNav
} from '../../../../src/components/account/ui/account-chrome';
import { createT } from '../../../../src/lib/i18n';

const t = createT('es');

describe('buildAccountHeaderSiteNav', () => {
    it('shows Alojamientos, Destinos, Comer y salir and Experiencias inline, never Eventos', () => {
        // Act
        const { inline } = buildAccountHeaderSiteNav({ locale: 'es', t });

        // Assert
        expect(inline.map((link) => link.label)).toEqual([
            'Alojamientos',
            'Destinos',
            'Comer y salir',
            'Experiencias'
        ]);
        expect(inline.map((link) => link.id)).toEqual([...ACCOUNT_HEADER_INLINE_NAV_IDS]);
        expect(inline.map((link) => link.href)).not.toContain('/es/eventos/');
        expect(inline[3]?.href).toBe('/es/experiencias/');
    });

    it('keeps every entry in the hamburger menu, with Eventos, Blog and Contacto', () => {
        const { menu } = buildAccountHeaderSiteNav({ locale: 'es', t });
        expect(menu.map((item) => item.href)).toEqual([
            '/es/alojamientos/',
            '/es/destinos/',
            '/es/comer-y-salir/',
            '/es/experiencias/',
            '/es/eventos/',
            '/es/publicaciones/',
            '/es/contacto/'
        ]);
    });

    it('gives only «Comer y salir» its collection sub-links', () => {
        const { menu } = buildAccountHeaderSiteNav({ locale: 'es', t });
        const withChildren = menu.filter((item) => item.children !== undefined);
        expect(withChildren.map((item) => item.href)).toEqual(['/es/comer-y-salir/']);
        expect(withChildren[0]?.children?.length).toBeGreaterThan(0);
    });

    it('builds locale-prefixed hrefs', () => {
        const { inline } = buildAccountHeaderSiteNav({ locale: 'pt', t: createT('pt') });
        expect(inline.every((link) => link.href.startsWith('/pt/'))).toBe(true);
    });
});

describe('buildAccountHeaderActions', () => {
    it('links the «?» to the help center and the sparkle to the what-s-new page', () => {
        const actions = buildAccountHeaderActions({
            locale: 'es',
            currentPath: '/es/mi-cuenta/'
        });
        expect(actions.help).toEqual({ href: '/es/mi-cuenta/ayuda/', current: false });
        expect(actions.whatsNew).toEqual({ href: '/es/mi-cuenta/novedades/', current: false });
    });

    it.each([
        ['/es/mi-cuenta/ayuda/', true],
        ['/es/mi-cuenta/ayuda', true],
        ['/es/mi-cuenta/ayuda/photos/', true],
        ['/es/mi-cuenta/ayudante/', false],
        ['/es/mi-cuenta/suscripcion/', false]
    ])('marks the «?» current on %s: %s', (currentPath, current) => {
        expect(buildAccountHeaderActions({ locale: 'es', currentPath }).help.current).toBe(current);
    });

    it('marks «Qué hay de nuevo» current on its page', () => {
        const actions = buildAccountHeaderActions({
            locale: 'en',
            currentPath: '/en/mi-cuenta/novedades/'
        });
        expect(actions.whatsNew.current).toBe(true);
        expect(actions.help.current).toBe(false);
    });
});

describe('buildAccountFooterModel', () => {
    it('row 1 holds Explorar, Para vos and Ayuda with the owner-chosen links', () => {
        const { groups } = buildAccountFooterModel({ locale: 'es', t });
        expect(groups.map((group) => [group.title, group.links.map((link) => link.label)])).toEqual(
            [
                ['Explorar', ['Alojamientos', 'Destinos', 'Experiencias']],
                ['Para vos', ['Publicá', 'Planes y precios']],
                ['Ayuda', ['Centro de ayuda', 'Contacto']]
            ]
        );
    });

    it('row 2 holds the three legal links', () => {
        const { legal } = buildAccountFooterModel({ locale: 'es', t });
        expect(legal.map((link) => link.href)).toEqual([
            '/es/legal/terminos/',
            '/es/legal/privacidad/',
            '/es/legal/cookies/'
        ]);
    });

    it('translates the new copy in en and pt', () => {
        for (const locale of ['en', 'pt'] as const) {
            const { groups } = buildAccountFooterModel({ locale, t: createT(locale) });
            const labels = groups.flatMap((group) => [
                group.title,
                ...group.links.map((link) => link.label)
            ]);
            expect(labels).not.toContain('Publicá');
            expect(labels).not.toContain('Centro de ayuda');
            expect(labels.some((label) => label.startsWith('account.'))).toBe(false);
        }
    });
});
