import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../src/pages/[lang]/mi-cuenta');
const families = [
    'propiedades',
    'comercio',
    'consultas-propietario',
    'promociones',
    'directorio-proveedores',
    'usos-de-beneficio',
    'publicaciones',
    'eventos',
    'partner',
    'proveedor'
];
const singles = ['host-dashboard.astro', 'tablero-locales.astro', 'tablero-experiencias.astro'];
/**
 * Retired public URLs: they only 301 to the pricing pages for ANY visitor
 * (`PUBLIC_REDIRECT_PATHS`), so gating them would break old links.
 */
const legacyPublicRedirects = new Set([
    'comercio/nuevo/index.astro',
    'comercio/nuevo/[vertical].astro'
]);
function pages(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? pages(path) : entry.name.endsWith('.astro') ? [path] : [];
    });
}
const inventory = [
    ...singles.map((name) => resolve(root, name)),
    ...families.flatMap((name) => pages(resolve(root, name)))
].filter((path) => !legacyPublicRedirects.has(path.slice(root.length + 1)));

function assertReadOrdering({
    frontmatter,
    relative
}: {
    readonly frontmatter: string;
    readonly relative: string;
}): void {
    const gate = frontmatter.indexOf('if (denied) return denied;');
    expect(gate).toBeGreaterThanOrEqual(0);
    const reads = frontmatter.matchAll(
        /\b(\w+Api\.\w+|fetch\w*|load\w*|resolveEditorPage|resolveListingEditorPage|resolveAuthoredEditorItem)\s*\(/g
    );
    for (const read of reads) {
        expect(gate, `${relative}: ${read[1]} must follow admission`).toBeLessThan(read.index);
    }
}

describe('publisher directory direct guards', () => {
    it('rejects an ordinary own-content API read moved ahead of admission', () => {
        const frontmatter =
            "const result = await postEditApi.listOwn({}); const denied = guardPublisherArea({ astro: Astro, area: 'posts' }); if (denied) return denied;";
        expect(() =>
            assertReadOrdering({ frontmatter, relative: 'publicaciones/index.astro' })
        ).toThrow();
    });
    it('rejects ownership API reads before session-based admission', () => {
        const guard =
            "const denied = guardPublisherArea({ astro: Astro, area: 'partner' }); if (denied) return denied;";
        expect(() =>
            assertReadOrdering({
                frontmatter: `await partnersApi.mine({}); ${guard}`,
                relative: 'partner/index.astro'
            })
        ).toThrow();
        expect(() =>
            assertReadOrdering({
                frontmatter: `await hostTradesApi.mine({}); ${guard}`,
                relative: 'proveedor/index.astro'
            })
        ).toThrow();
        expect(() =>
            assertReadOrdering({
                frontmatter: `await partnersApi.mineStats({}); ${guard}`,
                relative: 'partner/index.astro'
            })
        ).toThrow();
        expect(() =>
            assertReadOrdering({
                frontmatter: `await partnersApi.mine({}); ${guard}`,
                relative: 'publicaciones/index.astro'
            })
        ).toThrow();
    });
    it('covers exactly 54 real publisher pages', () => {
        expect(inventory.length).toBeGreaterThan(0);
        expect(inventory).toHaveLength(54);
    });
    it.each([...legacyPublicRedirects])('keeps %s public and ungated', (relative) => {
        const source = readFileSync(resolve(root, relative), 'utf8');
        expect(inventory).not.toContain(resolve(root, relative));
        expect(source).not.toMatch(/guardPublisherArea|canAccessPublisherArea/);
        expect(source).toMatch(/Astro\.redirect\([\s\S]*301/);
    });
    for (const path of inventory) {
        it(`guards ${path.slice(root.length + 1)} directly before work`, () => {
            const frontmatter =
                readFileSync(path, 'utf8')
                    .split(/^---\s*$/m)[1]
                    ?.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '') ?? '';
            expect(frontmatter).toMatch(
                /const denied = (?:guardPublisherArea\(\{ astro: Astro, area(?:: '[^']+')? \}\)|guardVenueOrExperienceArea\(\{ astro: Astro \}\))/
            );
            expect(frontmatter).toMatch(/if \(denied\) return denied;/);
            const helperImport = frontmatter.indexOf("from '@/lib/account/publisher-access'");
            expect(helperImport).toBeGreaterThan(0);
            expect(helperImport).toBeLessThan(frontmatter.indexOf('export const prerender'));
            expect(frontmatter).not.toContain('if (!canAccessPublisherArea(');
            const relative = path.slice(root.length + 1);
            const fixedAreas = {
                'host-dashboard.astro': 'host',
                'tablero-locales.astro': 'venue',
                'tablero-experiencias.astro': 'experience',
                'propiedades/index.astro': 'host',
                'usos-de-beneficio/index.astro': 'host',
                'partner/index.astro': 'partner',
                'proveedor/index.astro': 'provider',
                'promociones/index.astro': 'promotions',
                'promociones/nueva.astro': 'promotionCreate',
                'publicaciones/index.astro': 'posts',
                'publicaciones/nuevo.astro': 'postCreate',
                'publicaciones/[id]/editar.astro': 'postEdit',
                'eventos/index.astro': 'events',
                'eventos/nuevo.astro': 'eventCreate',
                'eventos/[id]/editar.astro': 'eventEdit'
            } as const;
            const fixedArea = fixedAreas[relative as keyof typeof fixedAreas];
            if (fixedArea) expect(frontmatter).toContain(`area: '${fixedArea}'`);
            if (relative.startsWith('consultas-propietario/'))
                expect(frontmatter).toContain("area: 'inbox'");
            if (relative.startsWith('directorio-proveedores/'))
                expect(frontmatter).toContain("area: 'directory'");
            if (relative === 'comercio/index.astro') {
                expect(frontmatter).toContain('const area = parseOwnerListVertical(');
                expect(frontmatter).toContain("?? 'venueOrExperience'");
            }
            if (relative.startsWith('propiedades/[id]/'))
                expect(frontmatter).toContain("area: 'accommodationEdit'");
            if (relative.startsWith('comercio/[vertical]/')) {
                // The helper answers 404 for a non-comercio vertical and keeps
                // the vertical literals out of the page (G-FAC-05).
                expect(frontmatter).toContain(
                    'const denied = guardVenueOrExperienceArea({ astro: Astro });'
                );
            }
            if (relative === 'promociones/[id]/editar.astro') {
                expect(frontmatter).toContain("area: 'promotionEdit'");
                expect(frontmatter).toContain("area: 'promotions'");
            }
            assertReadOrdering({ frontmatter, relative });
        });
    }
});
