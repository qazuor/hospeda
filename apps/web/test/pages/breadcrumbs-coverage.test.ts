/** Source guards for the shared, intrinsic navigation/JSON-LD breadcrumb contract. */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');
const PAGES = resolve(SRC, 'pages/[lang]');

function astroFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const full = resolve(directory, entry.name);
        return entry.isDirectory() ? astroFiles(full) : entry.name.endsWith('.astro') ? [full] : [];
    });
}

const requiredPages = [
    'alojamientos/index.astro',
    'alojamientos/[slug].astro',
    'alojamientos/[slug]/fotos.astro',
    'alojamientos/mapa.astro',
    'alojamientos/comparar/index.astro',
    'alojamientos/tipo/[type]/index.astro',
    'alojamientos/caracteristicas/[slug]/index.astro',
    'alojamientos/comodidades/[slug]/index.astro',
    'autores/[slug]/index.astro',
    'colaborar/index.astro',
    'colaborar/editores/index.astro',
    'colaborar/fotos/index.astro',
    'colaborar/reportar/index.astro',
    'comer-y-salir/index.astro',
    'comer-y-salir/[slug].astro',
    'comer-y-salir/[slug]/carta.astro',
    'comer-y-salir/rubro/[rubro]/index.astro',
    'destinos/index.astro',
    'destinos/mapa.astro',
    'destinos/[...path].astro',
    'destinos/[slug]/alojamientos/index.astro',
    'destinos/[slug]/eventos/index.astro',
    'destinos/atraccion/[slug]/index.astro',
    'destinos/lugar/[slug]/index.astro',
    'eventos/index.astro',
    'eventos/[slug].astro',
    'eventos/categoria/[category]/index.astro',
    'eventos/en/[slug]/index.astro',
    'experiencias/index.astro',
    'experiencias/[slug].astro',
    'publicaciones/index.astro',
    'publicaciones/[slug].astro',
    'publicaciones/categoria/[category]/index.astro',
    'publicaciones/etiqueta/[tag]/index.astro',
    ...['anfitriones', 'turistas', 'experiencias', 'comer-y-salir'].flatMap((audience) => [
        `planes/${audience}/index.astro`,
        `planes/${audience}/precios/index.astro`
    ]),
    ...['partner', 'proveedor', 'sponsor'].map((kind) => `sumate/${kind}/index.astro`),
    ...[
        'contacto',
        'nosotros',
        'preguntas-frecuentes',
        'promociones',
        'beneficios',
        'funcionalidades'
    ].map((page) => `${page}/index.astro`),
    'integraciones/google-calendar/index.astro',
    'partners/[slug].astro',
    // partners/reclamar is a status page on ErrorLayout since HOS-2653: its only
    // ancestor is Inicio, so the trail rendered nothing under the HOS-2623 policy.
    'publicar/index.astro',
    'publicar/comer-y-salir/index.astro',
    'publicar/experiencias/index.astro'
];

describe('public breadcrumb coverage', () => {
    it.each(requiredPages)('%s uses the shared intrinsic breadcrumb component', (page) => {
        const source = readFileSync(resolve(PAGES, page), 'utf8');
        expect(source).toContain(
            "import Breadcrumbs from '@/components/shared/navigation/Breadcrumbs.astro'"
        );
        expect(source).toContain('<Breadcrumbs');
        expect(source).not.toContain('BreadcrumbJsonLd');
    });

    it('LegalLayout mounts the current page as the full trail', () => {
        const source = readFileSync(resolve(SRC, 'layouts/LegalLayout.astro'), 'utf8');
        expect(source).toContain('<Breadcrumbs');
        expect(source).toContain('items={[{ label: resolvedTitle }]}');
        expect(source).not.toContain('BreadcrumbJsonLd');
    });
});

describe('breadcrumb migration guards', () => {
    const pages = astroFiles(PAGES);
    const files = [...pages, ...astroFiles(resolve(SRC, 'layouts'))];

    it('scans a nonempty page tree', () => {
        expect(pages.length).toBeGreaterThan(50);
    });

    it('no page contains the retired manual JSON-LD component', () => {
        expect(
            pages
                .filter((file) => readFileSync(file, 'utf8').includes('BreadcrumbJsonLd'))
                .map((file) => file.slice(PAGES.length + 1))
        ).toEqual([]);
    });

    it('breadcrumb items never use marketing hero, page-title, or heading keys', () => {
        const offenders: string[] = [];
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            for (const match of source.matchAll(
                /<Breadcrumbs\b[\s\S]*?items=\{(\[[\s\S]*?\]|[\w.]+)\}/g
            )) {
                let items = match[1];
                if (/^[\w.]+$/.test(items)) {
                    const variable = items.split('.')[0];
                    items =
                        source.match(new RegExp(`const ${variable} = ([\\s\\S]*?);`))?.[1] ?? items;
                }
                if (/\.(?:hero\.title|pageTitle|heading)['"`]/.test(items))
                    offenders.push(file.slice(SRC.length + 1));
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe('breadcrumb adapter contract', () => {
    const adapter = readFileSync(
        resolve(__dirname, '../../src/components/shared/navigation/Breadcrumbs.astro'),
        'utf8'
    );

    it('derives the BreadcrumbList from the same items it renders and escapes via JsonLd', () => {
        expect(adapter).toContain('buildBreadcrumbListJsonLd');
        expect(adapter).toContain("import JsonLd from '@/components/seo/JsonLd.astro'");
        expect(adapter).toContain('items={items}');
    });

    it('keeps the React component free of raw HTML injection', () => {
        const component = readFileSync(
            resolve(__dirname, '../../src/components/shared/navigation/Breadcrumbs.tsx'),
            'utf8'
        );
        expect(component).not.toContain('dangerouslySetInnerHTML');
    });
});
