import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    REVIEW_DIMENSIONS_SOURCE,
    readLiteralSets,
    run,
    SECTIONS_SOURCE,
    TYPE_SOURCES
} from '../check-no-listing-dispatch';

const roots: string[] = [];

afterEach(() => {
    roots.splice(0).forEach((root) => {
        rmSync(root, { recursive: true, force: true });
    });
});

const REGISTRY_FILE = 'apps/web/src/lib/editor/listing-editor-registry.ts';
const LISTING_EDITOR_FILE = 'apps/web/src/components/listing/ListingEditor.client.tsx';
const BASIC_INFO_FILE = 'apps/web/src/components/listing/editor/BasicInfoSection.client.tsx';
const PAGE_FILE = 'apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro';

const SECTIONS_SOURCE_TEXT = `export const LISTING_SECTIONS = {
    venue: [{ id: 'basicInfo' }, { id: 'menu' }],
    experience: [{ id: 'basicInfo' }, { id: 'meetingPoint' }],
    accommodation: [{ id: 'location' }]
};\n`;

const REVIEW_FORM_FILE = 'apps/web/src/components/venue/VenueReviewForm.client.tsx';
const GUARD_LIST_PATH = path.resolve(
    import.meta.dirname,
    '../guards/no-listing-dispatch-files.json'
);

/** The committed closed-list rows for the venue review form. */
function listedReviewFormRows(): readonly Row[] {
    const list = JSON.parse(readFileSync(GUARD_LIST_PATH, 'utf8')) as {
        readonly files: readonly Row[];
    };
    return list.files.filter((row) => row.file === REVIEW_FORM_FILE);
}

const REVIEW_SOURCE_TEXT = `const REVIEW_RULES_CONTENT = {
    venue: { dimensions: [{ id: 'food' }, { id: 'value' }] },
    experience: { dimensions: [{ id: 'food' }, { id: 'value' }] }
};
export const REVIEW_RULES = REVIEW_RULES_CONTENT;\n`;

const TYPE_SOURCE_TEXTS = [
    "export enum VenueTypeEnum { RESTAURANT = 'RESTAURANT', BOLICHE = 'BOLICHE' }\n",
    "export enum ExperienceTypeEnum { EXCURSION = 'EXCURSION' }\n",
    "export enum AccommodationTypeEnum { HOTEL = 'HOTEL' }\n"
] as const;

const CLEAN_ASTRO = `---
const page = 'ok';
---
<div>{page}</div>\n`;

interface Row {
    readonly file: string;
    readonly spec: string;
}

const SPEC = '.specs/HOS-1787-rubros-y-comer-y-salir/docs/06-guards.md#g-fac-05';

const DEFAULT_ROWS: readonly Row[] = [
    { file: REGISTRY_FILE, spec: SPEC },
    { file: PAGE_FILE, spec: SPEC }
];

/** Writes one fixture repository and returns its root plus the list path. */
function fixture({
    files = {},
    rows = DEFAULT_ROWS,
    sectionsSource = SECTIONS_SOURCE_TEXT,
    reviewSource = REVIEW_SOURCE_TEXT,
    typeSources = TYPE_SOURCE_TEXTS
}: {
    readonly files?: Readonly<Record<string, string>>;
    readonly rows?: readonly Row[];
    readonly sectionsSource?: string;
    readonly reviewSource?: string;
    readonly typeSources?: readonly string[];
} = {}): { readonly root: string; readonly filesPath: string } {
    const root = mkdtempSync(path.join(tmpdir(), 'g-fac-05-'));
    roots.push(root);

    const write = (relative: string, content: string): void => {
        const target = path.join(root, relative);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
    };

    write(SECTIONS_SOURCE, sectionsSource);
    write(REVIEW_DIMENSIONS_SOURCE, reviewSource);
    TYPE_SOURCES.forEach((source, index) => {
        write(source, typeSources[index] ?? '');
    });

    const merged: Record<string, string> = {
        [REGISTRY_FILE]: 'export const registry = 1;\n',
        [LISTING_EDITOR_FILE]: 'export const editor = 1;\n',
        [BASIC_INFO_FILE]: 'export const basic = 1;\n',
        [PAGE_FILE]: CLEAN_ASTRO,
        ...files
    };
    for (const [relative, content] of Object.entries(merged)) write(relative, content);

    const filesPath = path.join(root, 'no-listing-dispatch-files.json');
    writeFileSync(filesPath, JSON.stringify({ spec: SPEC, files: rows }));
    return { root, filesPath };
}

describe('TEST:5.8:1 GUARD:G-FAC-05 no dispatch by vertical or section', () => {
    it('passes on a clean fixture and reports the scanned files', () => {
        const { root, filesPath } = fixture();
        const result = run({ root, filesPath });

        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('2 files scanned');
    });

    it('detects the positive control: an injected vertical comparison', () => {
        const { root, filesPath } = fixture({
            files: {
                [REGISTRY_FILE]:
                    "declare const vertical: string;\nexport const sections = vertical === 'venue' ? [] : [];\n"
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain(`${REGISTRY_FILE}:2`);
        expect(result.output).toContain('vertical literal "venue"');
    });

    it('TEST:6.6:7 detects a dimension comparison inside the venue review form', () => {
        const rows = listedReviewFormRows();
        // Non-vacuity: the committed closed list must still route the form
        // through G-FAC-05. Removing the row turns this green guard red.
        expect(rows).toHaveLength(1);

        const { root, filesPath } = fixture({
            rows,
            files: {
                [REVIEW_FORM_FILE]:
                    "declare const dim: string; declare const hasMenu: boolean;\nexport const showFood = dim === 'food' && hasMenu;\n"
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain(`${REVIEW_FORM_FILE}:2`);
        expect(result.output).toContain('review dimension literal "food"');
    });

    it('rejects the section-id and vertical comparison of the listing editor', () => {
        const { root, filesPath } = fixture({
            rows: [{ file: LISTING_EDITOR_FILE, spec: SPEC }],
            files: {
                [LISTING_EDITOR_FILE]:
                    "declare const sectionId: string; declare const vertical: string;\nexport const render = sectionId === 'meetingPoint' && vertical === 'experience';\n"
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('section id literal "meetingPoint"');
        expect(result.output).toContain('vertical literal "experience"');
    });

    it('rejects a listing-type comparison in the basic info section', () => {
        const { root, filesPath } = fixture({
            rows: [{ file: BASIC_INFO_FILE, spec: SPEC }],
            files: {
                [BASIC_INFO_FILE]:
                    "declare const type: string;\nexport const showRating = type !== 'BOLICHE';\n"
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('listing type literal "BOLICHE"');
    });

    it('rejects a new *_ONLY_SECTIONS identifier', () => {
        const { root, filesPath } = fixture({
            files: {
                [REGISTRY_FILE]: 'export const VENUE_ONLY_SECTIONS = [];\n'
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('retired dispatch identifier VENUE_ONLY_SECTIONS');
    });

    it('rejects a Record<Vertical, Section[]> type', () => {
        const { root, filesPath } = fixture({
            files: {
                [REGISTRY_FILE]:
                    'interface SectionRow { id: string }\nexport type PerVertical = Record<VenueOrExperience, readonly SectionRow[]>;\n'
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('per-vertical section list type');
    });

    it('rejects a switch case and an index access against a literal', () => {
        const { root, filesPath } = fixture({
            files: {
                [REGISTRY_FILE]:
                    "declare const vertical: string; declare const map: Record<string, unknown>;\nexport function pick() { switch (vertical) { case 'experience': return 1; default: return 0; } }\nexport const value = map['menu'];\n"
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('switch case on the vertical literal "experience"');
        expect(result.output).toContain('index access with the section id literal "menu"');
    });

    it('rejects a vertical comparison inside an .astro template', () => {
        const { root, filesPath } = fixture({
            files: {
                [PAGE_FILE]: `---
const vertical = 'venue';
---
<div>{vertical === 'experience' && 'hola'}</div>\n`
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('vertical literal "experience"');
    });

    it('does not flag a literal outside the catalog sets', () => {
        const { root, filesPath } = fixture({
            files: {
                [REGISTRY_FILE]:
                    "declare const unit: string;\nexport const ok = unit === 'person';\n"
            }
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).toBe(0);
    });

    it('fails when a listed file is missing or renamed', () => {
        const { root, filesPath } = fixture({
            rows: [...DEFAULT_ROWS, { file: 'apps/web/src/lib/editor/gone.ts', spec: SPEC }]
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain(
            'listed file is missing or renamed: apps/web/src/lib/editor/gone.ts'
        );
    });

    it('fails when a row declares no spec', () => {
        const { root, filesPath } = fixture({
            rows: [{ file: REGISTRY_FILE, spec: '' }]
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('must declare a spec');
    });

    it('fails when a literal set is empty', () => {
        const { root, filesPath } = fixture({
            sectionsSource: 'export const LISTING_SECTIONS = {};\n'
        });
        const result = run({ root, filesPath });

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain('literal set is empty');
    });

    it('reads the literal sets from the schemas source', () => {
        const { root } = fixture();
        const sets = readLiteralSets(root);

        expect('error' in sets).toBe(false);
        if ('error' in sets) return;
        expect(sets.verticals).toEqual(['venue', 'experience', 'accommodation']);
        expect(sets.sectionIds).toEqual([
            'basicInfo',
            'menu',
            'basicInfo',
            'meetingPoint',
            'location'
        ]);
        expect(sets.listingTypes).toEqual(['RESTAURANT', 'BOLICHE', 'EXCURSION', 'HOTEL']);
        expect(sets.reviewDimensions).toEqual(['food', 'value']);
    });
});
