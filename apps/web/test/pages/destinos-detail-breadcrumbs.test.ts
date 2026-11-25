import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
    type BreadcrumbInputItem,
    buildBreadcrumbListJsonLd,
    buildBreadcrumbTrail
} from '@/lib/navigation/breadcrumb-trail';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/[...path].astro'),
    'utf8'
);
// Execute the page's actual construction with API doubles, preserving the
// network/error boundary without loading unrelated destination sections.
const block = source.slice(
    source.indexOf('// --- Breadcrumbs '),
    source.indexOf('// --- TouristDestination JSON-LD')
);

interface AncestorResult {
    readonly ok: boolean;
    readonly data?: { readonly name: string };
}

async function loadTrail({
    path,
    slugResult = { ok: true, data: { name: 'Entre Ríos' } },
    pathResult = { ok: true, data: { name: 'Concepción del Uruguay' } },
    rejectSlug = false
}: {
    readonly path: string;
    readonly slugResult?: AncestorResult;
    readonly pathResult?: AncestorResult;
    readonly rejectSlug?: boolean;
}) {
    const getBySlug = rejectSlug
        ? vi.fn().mockRejectedValue(new Error('Unavailable'))
        : vi.fn().mockResolvedValue(slugResult);
    const getByPath = vi.fn().mockResolvedValue(pathResult);
    const markResponseDegraded = vi.fn();
    const items: BreadcrumbInputItem[] = await runInNewContext(
        `(async () => { ${block}; return breadcrumbItems; })()`,
        {
            segments: path.split('/'),
            name: 'San José',
            destinationsApi: { getBySlug, getByPath },
            breadcrumbLabel: () => 'Destinos',
            t: vi.fn(),
            Astro: { locals: {} },
            markResponseDegraded
        }
    );
    return { items, getBySlug, getByPath, markResponseDegraded };
}

describe('destination detail breadcrumb names', () => {
    it('preserves real API names and hierarchy in navigation and JSON-LD', async () => {
        const { items, getBySlug, getByPath, markResponseDegraded } = await loadTrail({
            path: 'entre-rios/concepcion-del-uruguay/san-jose'
        });
        expect(getBySlug).toHaveBeenCalledWith({ slug: 'entre-rios' });
        expect(getByPath).toHaveBeenCalledWith({ path: '/entre-rios/concepcion-del-uruguay' });
        expect(items).toEqual([
            { label: 'Destinos', path: 'destinos' },
            { label: 'Entre Ríos', path: 'destinos/entre-rios' },
            { label: 'Concepción del Uruguay', path: 'destinos/entre-rios/concepcion-del-uruguay' },
            { label: 'San José' }
        ]);
        const input = { items, locale: 'es' as const, homeLabel: 'Inicio' };
        const { entries } = buildBreadcrumbTrail(input);
        expect(entries.map((entry) => entry.label)).toEqual([
            'Inicio',
            'Destinos',
            'Entre Ríos',
            'Concepción del Uruguay'
        ]);
        const jsonLd = buildBreadcrumbListJsonLd({
            ...input,
            siteOrigin: 'https://hospeda.test',
            currentPath: '/es/destinos/entre-rios/concepcion-del-uruguay/san-jose/'
        });
        expect(jsonLd.itemListElement.map((entry) => entry.name)).toEqual([
            ...entries.map((entry) => entry.label),
            'San José'
        ]);
        expect(jsonLd.itemListElement.at(-1)?.item).toBe(
            'https://hospeda.test/es/destinos/entre-rios/concepcion-del-uruguay/san-jose/'
        );
        expect(markResponseDegraded).not.toHaveBeenCalled();
    });

    it('uses the entity name without fetching ancestors on a single-slug URL', async () => {
        const { items, getBySlug, getByPath } = await loadTrail({ path: 'san-jose' });
        expect(items).toEqual([{ label: 'Destinos', path: 'destinos' }, { label: 'San José' }]);
        expect(getBySlug).not.toHaveBeenCalled();
        expect(getByPath).not.toHaveBeenCalled();
    });

    it.each([
        { slugResult: { ok: false } },
        { slugResult: { ok: true, data: { name: ' ' } } },
        { rejectSlug: true }
    ])('omits failed or unnamed ancestors and marks the response degraded: %j', async (failure) => {
        const { items, markResponseDegraded } = await loadTrail({
            path: 'entre-rios/concepcion-del-uruguay/san-jose',
            ...failure
        });
        expect(items.map((item) => item.label)).toEqual([
            'Destinos',
            'Concepción del Uruguay',
            'San José'
        ]);
        expect(markResponseDegraded).toHaveBeenCalledOnce();
    });

    it('mounts one intrinsic trail and suppresses it for thin noindex destinations', () => {
        expect(source).toMatch(/<Breadcrumbs\s+slot="breadcrumbs"/);
        expect(source).toContain('items={breadcrumbItems}');
        expect(source).toContain('jsonLd={!isThinContent}');
        expect(source).not.toContain('BreadcrumbJsonLd');
        expect(source).not.toContain('segment.replace(');
    });
});
