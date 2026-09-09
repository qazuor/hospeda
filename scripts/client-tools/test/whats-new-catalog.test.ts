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

// `isUnpublished` is the predicate `drop` refuses on (HOS-1214 D-7) and
// `pending` lists by. Until the catalog held its first `on-promotion` entry,
// the ONLY assertion on it in this suite was `toBe(false)` over the real file
// — one branch. An implementation returning a constant `false` passed, and
// would have left `hops whats-new pending` reporting nothing while looking
// perfectly healthy. Both branches are pinned here, on fixtures, so the
// coverage does not depend on what the real catalog happens to hold today.
describe('isUnpublished', () => {
    it('should be true for an entry still carrying the marker', () => {
        const [entry] = parseCatalog({ content: makeSource({ entries: SIMPLE_ENTRY }) });

        expect(entry).toBeDefined();
        expect(entry && isUnpublished({ entry })).toBe(true);
    });

    it('should be false for an entry with a resolved date', () => {
        const source = makeSource({
            entries: `    {
        id: 'published',
        publishedAt: '2026-09-07T12:00:00Z',
        title: { es: 'T' },
        body: { es: 'B' }
    }`
        });
        const [entry] = parseCatalog({ content: source });

        expect(entry).toBeDefined();
        expect(entry && isUnpublished({ entry })).toBe(false);
    });
});

describe('the real catalog', () => {
    const content = readFileSync(join(REPO_ROOT, CATALOG_FILE_PATH), 'utf8');

    // Looked up BY ID, never by index. This used to assert
    // `entries).toHaveLength(4)` and pin `entries[0]`, which froze both the
    // catalog's size and whichever entry happened to be on top the day it was
    // written. The file's own authoring convention is "always insert at the
    // top", and HOS-1214 made every smoke sign-off insert one, so both pins
    // were guaranteed to break on work that had nothing to do with the parser
    // they exist to test.
    it('should read every field of a known entry off the real file', () => {
        const entries = parseCatalog({ content });

        expect(hasEntriesArray({ content })).toBe(true);
        expect(entries.length).toBeGreaterThan(0);

        const known = entries.find(
            (entry) => entry.id === '2026-09-05-commerce-publish-free-trial'
        );
        expect(known).toBeDefined();
        expect(known?.roles).toEqual(['GASTRONOMY_OWNER', 'EXPERIENCE_OWNER']);
        expect(known?.titleEs).toContain('Publicá tu comercio');
    });

    // `publishedAt` has exactly two legal shapes (HOS-1214 D-1), and
    // `isUnpublished` must agree with whichever one an entry carries. Stated
    // this way the test holds whatever the catalog happens to hold today: all
    // published, all awaiting promotion, or the mix it is in mid-tanda. It
    // used to assert `isUnpublished(entry) === false` for every entry, which
    // was true only while no sign-off had written a marker yet.
    it('should agree with the publishedAt shape of every entry in the real file', () => {
        for (const entry of parseCatalog({ content })) {
            if (isUnpublished({ entry })) {
                expect(entry.publishedAt).toBe('on-promotion');
            } else {
                expect(entry.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
            }
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
