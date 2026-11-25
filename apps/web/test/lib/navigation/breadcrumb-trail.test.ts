import { describe, expect, it } from 'vitest';
import {
    buildBreadcrumbListJsonLd,
    buildBreadcrumbTrail
} from '../../../src/lib/navigation/breadcrumb-trail';

const input = {
    locale: 'es',
    homeLabel: 'Inicio',
    items: [
        { label: 'Destinos', path: 'destinos/' },
        { label: 'Grouping without a page' },
        { label: 'Colón', path: 'destinos/colon' },
        { label: 'Eventos', path: 'ignored-current-path' }
    ]
} as const;

describe('buildBreadcrumbTrail', () => {
    it('returns linked ancestors with home first, dropping the current page and dead levels', () => {
        expect(buildBreadcrumbTrail(input)).toEqual({
            entries: [
                { label: 'Inicio', href: '/es/' },
                { label: 'Destinos', href: '/es/destinos/' },
                { label: 'Colón', href: '/es/destinos/colon/' }
            ]
        });
    });

    it('omits home when requested, retaining a single linked ancestor', () => {
        expect(
            buildBreadcrumbTrail({
                ...input,
                includeHome: false,
                items: [{ label: 'Mi cuenta', path: 'mi-cuenta' }, { label: 'Perfil' }]
            }).entries
        ).toEqual([{ label: 'Mi cuenta', href: '/es/mi-cuenta/' }]);
    });

    it.each([
        { items: [] },
        { items: [{ label: 'Current' }] },
        { items: [{ label: 'Dead level' }, { label: 'Current' }] }
    ])('returns no visible trail without linked ancestors: $items', ({ items }) => {
        expect(buildBreadcrumbTrail({ ...input, items }).entries).toEqual([]);
        expect(buildBreadcrumbTrail({ ...input, items, includeHome: false }).entries).toEqual([]);
    });

    it('resolves all links for the active locale without mutating input', () => {
        const before = JSON.stringify(input);
        expect(
            buildBreadcrumbTrail({ ...input, locale: 'pt' }).entries.map((entry) => entry.href)
        ).toEqual(['/pt/', '/pt/destinos/', '/pt/destinos/colon/']);
        expect(JSON.stringify(input)).toBe(before);
    });
});

describe('buildBreadcrumbListJsonLd', () => {
    const canonical = {
        siteOrigin: 'https://hospeda.test/',
        currentPath: '/es/destinos/colon/eventos/'
    };

    it('uses absolute URLs, drops dead levels, and puts the canonical current page last', () => {
        expect(buildBreadcrumbListJsonLd({ ...input, ...canonical })).toEqual({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Inicio',
                    item: 'https://hospeda.test/es/'
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Destinos',
                    item: 'https://hospeda.test/es/destinos/'
                },
                {
                    '@type': 'ListItem',
                    position: 3,
                    name: 'Colón',
                    item: 'https://hospeda.test/es/destinos/colon/'
                },
                {
                    '@type': 'ListItem',
                    position: 4,
                    name: 'Eventos',
                    item: 'https://hospeda.test/es/destinos/colon/eventos/'
                }
            ]
        });
    });

    it('keeps structured data for a top-level page despite an empty visible trail', () => {
        const result = buildBreadcrumbListJsonLd({
            ...input,
            ...canonical,
            items: [{ label: 'Eventos' }]
        });
        expect(result.itemListElement.map((entry) => entry.name)).toEqual(['Inicio', 'Eventos']);
    });

    it('renders no visible trail when Inicio would be the only ancestor (D4b), JSON-LD stays complete', () => {
        const items = [{ label: 'Grupo' }, { label: 'Pagina' }];
        expect(buildBreadcrumbTrail({ ...input, items }).entries).toEqual([]);
        expect(
            buildBreadcrumbListJsonLd({ ...input, ...canonical, items }).itemListElement.map(
                (entry) => entry.name
            )
        ).toEqual(['Inicio', 'Pagina']);
    });

    it('honors includeHome and numbers the remaining levels consecutively', () => {
        const result = buildBreadcrumbListJsonLd({ ...input, ...canonical, includeHome: false });
        expect(result.itemListElement.map((entry) => [entry.name, entry.position])).toEqual([
            ['Destinos', 1],
            ['Colón', 2],
            ['Eventos', 3]
        ]);
    });
});
