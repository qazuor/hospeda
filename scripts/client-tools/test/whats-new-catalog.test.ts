import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    CATALOG_FILE_PATH,
    hasEntriesArray,
    isUnpublished,
    parseCatalog,
    parseOriginPrs
} from '../src/commands/whats-new/catalog.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..', '..');

/** A minimal catalog whose shape matches the real file's. */
function makeSource({ entries }: { readonly entries: string }): string {
    return `import type { WhatsNewEntry } from '@repo/schemas';

export const whatsNewEntries: WhatsNewEntry[] = WhatsNewCatalogSchema.parse([
${entries}
] satisfies z.input<typeof WhatsNewCatalogSchema>);
`;
}

const SIMPLE_ENTRY = `    // origin: #3271, #3274
    {
        id: '2026-09-08-thing',
        publishedAt: 'on-promotion',
        highlight: true,
        roles: ['HOST', 'EDITOR'],
        title: { es: 'Título', en: 'Title', pt: 'Título' },
        body: { es: 'Cuerpo en español.', en: 'Body.', pt: 'Corpo.' },
        translations: { en: 'machine', pt: 'machine' }
    }`;

describe('parseCatalog', () => {
    it('should read every field of a well-formed entry', () => {
        const [entry] = parseCatalog({ content: makeSource({ entries: SIMPLE_ENTRY }) });

        expect(entry?.id).toBe('2026-09-08-thing');
        expect(entry?.publishedAt).toBe('on-promotion');
        expect(entry?.highlight).toBe(true);
        expect(entry?.roles).toEqual(['HOST', 'EDITOR']);
        expect(entry?.titleEs).toBe('Título');
        expect(entry?.bodyEs).toBe('Cuerpo en español.');
        expect(entry?.originPrs).toEqual([3271, 3274]);
    });

    it('should report roles as null (not an empty array) when the key is absent', () => {
        // `roles: []` and "no roles key" mean opposite things in this schema —
        // an empty array is not how you say "everyone".
        const source = makeSource({
            entries: `    {
        id: 'x',
        publishedAt: 'on-promotion',
        title: { es: 'T' },
        body: { es: 'B' }
    }`
        });

        expect(parseCatalog({ content: source })[0]?.roles).toBeNull();
    });

    // --- The reason this is a scanner and not a regex ---
    it('should not be derailed by an escaped quote inside a body', () => {
        const source = makeSource({
            entries: `    {
        id: 'first',
        publishedAt: 'on-promotion',
        title: { es: 'Hoy\\'s' },
        body: { es: 'Un cuerpo con { llaves }, comas y una comilla: don\\'t.' }
    },
    {
        id: 'second',
        publishedAt: '2026-09-01T00:00:00Z',
        title: { es: 'Segundo' },
        body: { es: 'Otro.' }
    }`
        });

        const entries = parseCatalog({ content: source });

        // A positional/regex read shifts every later field once one string
        // contains an escaped quote; both entries must still come out whole.
        expect(entries).toHaveLength(2);
        expect(entries[0]?.id).toBe('first');
        expect(entries[1]?.id).toBe('second');
        expect(entries[1]?.publishedAt).toBe('2026-09-01T00:00:00Z');
        expect(entries[0]?.bodyEs).toContain("don't");
    });

    it('should return an empty list, and say so via hasEntriesArray, when the declaration is missing', () => {
        const source = 'export const somethingElse = [];\n';

        expect(parseCatalog({ content: source })).toEqual([]);
        expect(hasEntriesArray({ content: source })).toBe(false);
    });

    it('should span an entry from its leading comments to past its separating comma', () => {
        const source = makeSource({ entries: `${SIMPLE_ENTRY},\n    ${SIMPLE_ENTRY.trim()}` });
        const [entry] = parseCatalog({ content: source });
        const span = source.slice(entry?.start ?? 0, entry?.end ?? 0);

        expect(span.trimStart().startsWith('// origin:')).toBe(true);
        expect(span.endsWith(',')).toBe(true);
    });

    it('should leave a syntactically valid array when an entry span is cut out', () => {
        const source = makeSource({ entries: `${SIMPLE_ENTRY},\n${SIMPLE_ENTRY}` });
        const entries = parseCatalog({ content: source });
        const first = entries[0];
        if (first === undefined) throw new Error('fixture parsed no entries');
        const cut = source.slice(0, first.start) + source.slice(first.end);

        expect(cut).not.toContain(',,');
        expect(parseCatalog({ content: cut })).toHaveLength(1);
    });
});

describe('parseOriginPrs', () => {
    it('should return an empty list when there is no origin comment', () => {
        expect(parseOriginPrs({ text: '{ id: 1 }' })).toEqual([]);
    });

    it('should read several numbers off one line, deduplicated', () => {
        expect(parseOriginPrs({ text: '// origin: #10, #12, #10\n{}' })).toEqual([10, 12]);
    });

    it('should accumulate across several origin lines', () => {
        expect(parseOriginPrs({ text: '// origin: #1\n// origin: #2\n{}' })).toEqual([1, 2]);
    });

    it('should ignore a number in an ordinary comment', () => {
        expect(parseOriginPrs({ text: '// see #99 for context\n{}' })).toEqual([]);
    });
});

describe('the real catalog', () => {
    const content = readFileSync(join(REPO_ROOT, CATALOG_FILE_PATH), 'utf8');

    it('should parse into the four entries HOS-964 loaded, in declared order', () => {
        const entries = parseCatalog({ content });

        expect(hasEntriesArray({ content })).toBe(true);
        expect(entries).toHaveLength(4);
        expect(entries[0]?.id).toBe('2026-09-05-commerce-publish-free-trial');
        expect(entries[0]?.roles).toEqual(['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER']);
        expect(entries[0]?.titleEs).toContain('Publicá tu comercio');
    });

    it('should read a real ISO publishedAt as published, never as a marker', () => {
        for (const entry of parseCatalog({ content })) {
            expect(isUnpublished({ entry })).toBe(false);
            expect(entry.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        }
    });

    it('should not mistake the module docblock example for a live entry', () => {
        // The docblock carries a fully-formed commented-out entry; a parse that
        // read it would report five.
        expect(parseCatalog({ content }).map((entry) => entry.id)).not.toContain(
            '2026-05-29-cron-history'
        );
    });
});
