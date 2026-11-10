import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG_FILE, MANUAL_FILE, run } from '../check-accommodation-editor-frozen';

const roots: string[] = [];

afterEach(() => {
    roots.splice(0).forEach((root) => {
        rmSync(root, { recursive: true, force: true });
    });
});

interface Row {
    readonly id: string;
    readonly slug: string;
    readonly group: string;
}

const SECTIONS: readonly Row[] = [
    { id: 'basicInfo', slug: 'datos', group: 'property' },
    { id: 'capacityPricing', slug: 'capacidad-precio', group: 'property' },
    { id: 'location', slug: 'ubicacion', group: 'property' },
    { id: 'amenities', slug: 'servicios', group: 'property' },
    { id: 'photos', slug: 'fotos', group: 'content' },
    { id: 'faqs', slug: 'preguntas', group: 'content' },
    { id: 'contact', slug: 'contacto', group: 'content' },
    { id: 'seo', slug: 'seo', group: 'content' },
    { id: 'calendar', slug: 'calendario', group: 'management' },
    { id: 'translations', slug: 'traducciones', group: 'management' },
    { id: 'externalReputation', slug: 'reputacion', group: 'management' }
];

function manualSource(sections: readonly Row[], prefix = ''): string {
    const rows = sections
        .map(
            (section) =>
                `    { id: '${section.id}', slug: '${section.slug}', group: '${section.group}' }`
        )
        .join(',\n');

    return `${prefix}export const ACCOMMODATION_EDITOR_SECTIONS = [\n${rows}\n] as const;\n`;
}

function catalogSource(sections: readonly Row[]): string {
    const rows = sections
        .map(
            (section, index) =>
                `        { id: '${section.id}', vertical: 'accommodation', order: ${index + 1}, group: '${section.group}' }`
        )
        .join(',\n');

    return `export const LISTING_SECTIONS = {\n    venue: [],\n    experience: [],\n    accommodation: [\n${rows}\n    ] as const\n};\n`;
}

function fixture({
    manualSections = SECTIONS,
    catalogSections = SECTIONS,
    manualPrefix = '',
    inventory = {
        spec: 'docs/06-guards.md#g-fac-08',
        count: SECTIONS.length,
        sections: SECTIONS
    }
}: {
    readonly manualSections?: readonly Row[];
    readonly catalogSections?: readonly Row[];
    readonly manualPrefix?: string;
    readonly inventory?: unknown;
} = {}): { readonly root: string; readonly inventoryPath: string } {
    const root = mkdtempSync(path.join(tmpdir(), 'g-fac-08-'));
    roots.push(root);
    mkdirSync(path.join(root, path.dirname(MANUAL_FILE)), { recursive: true });
    mkdirSync(path.join(root, path.dirname(CATALOG_FILE)), { recursive: true });
    writeFileSync(path.join(root, MANUAL_FILE), manualSource(manualSections, manualPrefix));
    writeFileSync(path.join(root, CATALOG_FILE), catalogSource(catalogSections));
    const inventoryPath = path.join(root, 'inventory.json');
    writeFileSync(inventoryPath, JSON.stringify(inventory));
    return { root, inventoryPath };
}

describe('TEST:5.1:2 GUARD:G-FAC-08 accommodation editor frozen', () => {
    it('passes on a clean fixture', () => {
        const { root, inventoryPath } = fixture();
        const result = run({ root, inventoryPath });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('11 accommodation editor sections frozen');
    });

    it('fails when a section is added to the manual list', () => {
        const { root, inventoryPath } = fixture({
            manualSections: [...SECTIONS, { id: 'invented', slug: 'inventada', group: 'content' }]
        });
        const result = run({ root, inventoryPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('manual list has 12 sections');
    });

    it('fails when a section is removed from the manual list', () => {
        const { root, inventoryPath } = fixture({ manualSections: SECTIONS.slice(0, -1) });
        const result = run({ root, inventoryPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('manual list has 10 sections');
    });

    it('fails when the manual list imports LISTING_SECTIONS', () => {
        const { root, inventoryPath } = fixture({
            manualPrefix: "import { LISTING_SECTIONS } from '@repo/schemas';\n"
        });
        const result = run({ root, inventoryPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('derives from the catalog');
    });

    it('fails when a section is added to the catalog only', () => {
        const { root, inventoryPath } = fixture({
            catalogSections: [
                ...SECTIONS,
                { id: 'catalogOnly', slug: 'solo-catalogo', group: 'content' }
            ]
        });
        const result = run({ root, inventoryPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('catalog accommodation sections has 12 sections');
    });

    it('fails closed when the inventory cannot be read', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'g-fac-08-'));
        roots.push(root);
        const result = run({ root, inventoryPath: path.join(root, 'missing.json') });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('inventory cannot be read');
    });

    it('fails closed when the inventory has no spec', () => {
        const { root, inventoryPath } = fixture({
            inventory: { count: SECTIONS.length, sections: SECTIONS }
        });
        const result = run({ root, inventoryPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('non-empty spec');
    });

    it('fails closed when the inventory is below the minimum floor', () => {
        const { root, inventoryPath } = fixture();
        const result = run({ root, inventoryPath, minSections: 100 });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('expected at least 100');
    });

    it('passes against the real repository (positive control)', () => {
        const result = run();

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('OK GUARD:G-FAC-08');
    });
});
