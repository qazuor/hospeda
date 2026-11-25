/** Account route inventory: only nested content receives breadcrumbs (HOS-2623 D4). */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

function pages(directory: string): readonly string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? pages(resolve(directory, entry.name)).map((path) => `${entry.name}/${path}`)
            : entry.name.endsWith('.astro')
              ? [entry.name]
              : []
    );
}

const nested = [
    'asistentes-ia/historial.astro',
    'consultas/[conversationId].astro',
    'consultas-propietario/[conversationId].astro',
    'directorio-proveedores/[slug]/index.astro',
    'directorio-proveedores/[slug]/registrar-uso/index.astro',
    'eventos/nuevo.astro',
    'eventos/[id]/editar.astro',
    'publicaciones/nuevo.astro',
    'publicaciones/[id]/editar.astro',
    'promociones/nueva.astro',
    'promociones/[id]/editar.astro'
] as const;

describe('account breadcrumb route inventory', () => {
    it.each(nested)('%s declares its trail and uses the sidebar parent label', (path) => {
        const source = read(path);
        expect(source).toContain('breadcrumbs={buildAccountBreadcrumbs(');
        expect(source).toContain('getAccountSectionLabel({ t, section:');
        expect(source).not.toMatch(/\bback=\{/);
    });

    it.each(pages(root))('%s is explicitly accounted for', (path) => {
        const source = read(path);
        if ((nested as readonly string[]).includes(path)) return;
        if (/^(propiedades|comercio)\/.*\/editar\//.test(path)) {
            expect(source).toMatch(/<(EditorSectionLayout|ListingEditorSectionLayout)\b/);
        } else if (path === 'favoritos/colecciones/[id].astro') {
            expect(source).toContain('<CollectionDetailView');
        } else if (path === 'ayuda/[id].astro') {
            expect(source).toContain('<Breadcrumbs');
        } else if (path.startsWith('comercio/nuevo/')) {
            expect(source).toContain('Astro.redirect(');
            expect(source).not.toContain('<PageHeader');
        } else {
            // First-level sections, redirects, onboarding and the account 404.
            expect(path.replace(/\/index\.astro$/, '.astro')).not.toContain('/');
            expect(source).not.toMatch(/breadcrumbs=|<Breadcrumbs\b/);
        }
    });
});
