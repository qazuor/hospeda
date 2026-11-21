/**
 * HOS-2410 (`docs/guards.md` §4, AC-31, AC-32, AC-34) — guard (c) of the help
 * catalog, change coupling, and `pnpm help:review`, by mutation. Each test
 * starts from a green synthetic repo (lock written by `help:review` itself)
 * and changes ONE thing, then asserts the predicate that must fail.
 */

import {
    appendFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { HelpContentFile } from '../../packages/help/src/generator/index';
import { greenCatalog } from '../../packages/help/test/fixtures/article-source';
import { HELP_CONTENT_PATH, HELP_INDEX_PATH } from '../check-help-catalog';
import { checkHelpLock, PREDICATE_MESSAGES, run } from '../check-help-lock';
import { PORTAL_PAGES_DIR, type PortalRouteData } from '../check-portal-routes';
import { createAnchorHasher, type HelpHashSources } from '../help-anchor-hash';
import { formatHelpLock, HELP_LOCK_PATH, parseHelpLock } from '../help-lock';
import { listHelpReviews, reviewHelpArticles } from '../help-review';

/** 2026-11-17 in Argentina, the fixtures' reviewedAt. */
const REVIEW_DAY = new Date('2026-11-17T15:00:00Z');
const LATER_DAY = new Date('2026-11-19T15:00:00Z');

const ROUTE_DATA: PortalRouteData = {
    templates: { accommodationEditorSection: 'mi-cuenta/propiedades/[id]/editar/[section]' },
    sectionSlugs: { accommodation: { photos: 'fotos' } },
    editorPageSlugs: { accommodation: { aiQuestions: 'preguntas-ia' } },
    sectionTemplateByVertical: { accommodation: 'accommodationEditorSection' },
    verticalValues: [],
    sectionPlaceholder: '[section]'
};

const TOOL_FILE = 'apps/api/src/mcp/tools/help/get-help.ts';

/** Hash inputs of the synthetic repo. */
function sources(overrides: Partial<HelpHashSources> = {}): HelpHashSources {
    return {
        keyRows: new Map([
            [
                'entitlement:manage_venue_menu',
                ['manage_venue_menu', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']
            ],
            [
                'limit:max_photos_per_accommodation',
                ['max_photos_per_accommodation', 'vertical', 'SUM', 'ARCHIVE', 'COMMERCIAL']
            ]
        ]),
        sectionCatalog: new Map([['accommodation.photos', { id: 'photos', fields: ['photos'] }]]),
        enums: { PublicationStatus: new Set(['MODERATED', 'PUBLISHED']) },
        activations: new Map<string, unknown>([
            ['venue', 'listing_published'],
            ['partner', null]
        ]),
        routeData: ROUTE_DATA,
        toolFiles: new Map([['get_help', TOOL_FILE]]),
        ...overrides
    };
}

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes a file, creating its folders. */
function put(root: string, file: string, content = ''): void {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
}

/** a and b cover one entitlement; every article covers the subscription page. */
function catalog(): HelpContentFile[] {
    const shared = ['page:mi-cuenta/suscripcion', 'entitlement:manage_venue_menu'];
    return greenCatalog({
        a: { frontmatter: { covers: shared } },
        b: { frontmatter: { covers: shared } }
    });
}

/** A synthetic repo with its lock and index written by `help:review` on the review day. */
function syntheticRoot({
    files = catalog()
}: {
    readonly files?: readonly HelpContentFile[];
} = {}) {
    const root = mkdtempSync(path.join(tmpdir(), 'help-lock-'));
    tempDirs.push(root);
    for (const file of files) put(path.join(root, HELP_CONTENT_PATH), file.path, file.source);
    put(root, `${PORTAL_PAGES_DIR}/mi-cuenta/suscripcion.astro`, '<h1>Suscripción</h1>\n');
    put(root, `${PORTAL_PAGES_DIR}/mi-cuenta/propiedades/[id]/editar/fotos.astro`, 'fotos\n');
    put(root, `${PORTAL_PAGES_DIR}/mi-cuenta/propiedades/[id]/editar/preguntas-ia.astro`, 'ia\n');
    put(root, TOOL_FILE, "defineTool({ name: 'get_help' })\n");
    put(root, HELP_LOCK_PATH, '[\n]\n');
    put(root, HELP_INDEX_PATH, '');
    return root;
}

/** Writes the lock of every article, as `help:review a b c` does. */
function reviewAll(root: string, now: Date = REVIEW_DAY, extra: Partial<HelpHashSources> = {}) {
    return reviewHelpArticles({ root, ids: ['a', 'b', 'c'], now, sources: sources(extra) });
}

/** Runs the guard on a synthetic root. */
function check(root: string, extra: Partial<HelpHashSources> = {}) {
    return checkHelpLock({ root, sources: sources(extra) });
}

/** The predicates a result fails, deduplicated and sorted. */
function predicatesOf(result: ReturnType<typeof check>): string[] {
    return [...new Set(result.violations.map((violation) => violation.predicate))].sort();
}

/** The article file path of id `x` in a synthetic root. */
function articlePath(root: string, id: string): string {
    return path.join(root, HELP_CONTENT_PATH, 'es/host', `${id}.md`);
}

describe('check-help-lock on the real repo', () => {
    it('is green', () => {
        // Act
        const result = run();

        // Assert
        expect(result.output).toMatch(/^OK GUARD:help-lock: \d+ articles/);
        expect(result.exitCode).toBe(0);
    });

    it('keeps the committed lock in its one-entry-per-line layout', () => {
        // Arrange
        const text = readFileSync(
            path.resolve(import.meta.dirname, '../..', HELP_LOCK_PATH),
            'utf8'
        );

        // Act
        const { entries, problems } = parseHelpLock({ text });

        // Assert
        expect(problems).toEqual([]);
        expect(formatHelpLock({ entries })).toBe(text);
    });
});

describe('checkHelpLock on a synthetic repo', () => {
    it('is green after help:review', () => {
        // Arrange
        const root = syntheticRoot();

        // Act
        const review = reviewAll(root);
        const result = check(root);

        // Assert
        expect(review.exitCode).toBe(0);
        expect(result).toEqual({ violations: [], articleCount: 3 });
    });

    it('fails c2 when an anchored page changes, listing the anchor; help:review fixes it (AC-31)', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        appendFileSync(
            path.join(root, PORTAL_PAGES_DIR, 'mi-cuenta/suscripcion.astro'),
            '<p>new</p>\n'
        );

        // Act
        const before = check(root);
        const review = reviewAll(root, LATER_DAY);
        const after = check(root);

        // Assert
        expect(predicatesOf(before)).toEqual(['c2']);
        expect(before.violations).toHaveLength(3);
        expect(before.violations[0]?.detail).toContain('page:mi-cuenta/suscripcion (changed)');
        expect(before.violations[0]?.detail).toContain('pnpm help:review a');
        expect(review.exitCode).toBe(0);
        expect(after.violations).toEqual([]);
        expect(readFileSync(articlePath(root, 'a'), 'utf8')).toContain('reviewedAt: "2026-11-19"');
    });

    it('fails c2 for EVERY article covering a changed entitlement row, and only those', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const rows = new Map(sources().keyRows);
        rows.set('entitlement:manage_venue_menu', [
            'manage_venue_menu',
            'global',
            'MAX',
            'NONE',
            'COMMERCIAL'
        ]);

        // Act
        const result = check(root, { keyRows: rows });

        // Assert
        expect(predicatesOf(result)).toEqual(['c2']);
        expect(result.violations.map((violation) => violation.articleId).sort()).toEqual([
            'a',
            'b'
        ]);
    });

    it('fails c2 when an anchor is added to the article without a review', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const file = articlePath(root, 'c');
        writeFileSync(
            file,
            readFileSync(file, 'utf8').replace(
                'covers: ["page:mi-cuenta/suscripcion"]',
                'covers: ["page:mi-cuenta/suscripcion","tool:get_help"]'
            )
        );

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c2']);
        expect(result.violations[0]?.detail).toContain('tool:get_help (new in the article)');
    });

    it('fails c2 on a forged entry hash', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const { entries } = parseHelpLock({ text: readFileSync(lockFile, 'utf8') });
        writeFileSync(
            lockFile,
            formatHelpLock({
                entries: entries.map((entry) =>
                    entry.id === 'a' ? { ...entry, hash: '0'.repeat(64) } : entry
                )
            })
        );

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c2']);
        expect(result.violations[0]?.detail).toContain('entry hash');
    });

    it('fails c3 when reviewedAt changes in the frontmatter only (AC-32)', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const file = articlePath(root, 'b');
        writeFileSync(
            file,
            readFileSync(file, 'utf8').replace(
                'reviewedAt: "2026-11-17"',
                'reviewedAt: "2026-11-18"'
            )
        );

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c3']);
        expect(result.violations[0]?.articleId).toBe('b');
    });

    it('fails c1 on an article with no lock entry and on a lock entry with no article', () => {
        // Arrange
        const root = syntheticRoot();
        reviewHelpArticles({ root, ids: ['a', 'b'], now: REVIEW_DAY, sources: sources() });
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const { entries } = parseHelpLock({ text: readFileSync(lockFile, 'utf8') });
        const ghost = { ...(entries[0] as (typeof entries)[number]), id: 'zz' };
        writeFileSync(lockFile, formatHelpLock({ entries: [...entries, ghost] }));

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c1']);
        expect(result.violations.map((violation) => violation.detail).join('\n')).toMatch(
            /c has no lock entry[\s\S]*lock entry zz has no article/
        );
    });

    it('fails c1 on an out-of-order lock', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const lines = readFileSync(lockFile, 'utf8').trim().split('\n');
        const body = lines.slice(1, -1).map((line) => line.replace(/,$/, ''));
        writeFileSync(lockFile, `[\n${[...body].reverse().join(',\n')}\n]\n`);

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c1']);
    });

    it('fails c4 on an empty lock while the catalog has articles (AC-34)', () => {
        // Arrange
        const root = syntheticRoot();

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toContain('c4');
        expect(run({ root, sources: sources() }).output).toContain(PREDICATE_MESSAGES.c4);
    });

    it('fails c4 when the content does not parse', () => {
        // Arrange
        const root = syntheticRoot({ files: [{ path: 'es/host/a.md', source: 'nope' }] });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c4']);
    });
});

describe('pnpm help:review', () => {
    it('refuses an unknown id and writes nothing', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockBefore = readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8');

        // Act
        const result = reviewHelpArticles({
            root,
            ids: ['a', 'nope'],
            now: LATER_DAY,
            sources: sources()
        });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('unknown article id(s): nope');
        expect(readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8')).toBe(lockBefore);
        expect(readFileSync(articlePath(root, 'a'), 'utf8')).toContain('reviewedAt: "2026-11-17"');
    });

    it('rewrites only the reviewed article: its line, its date, nothing else', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        appendFileSync(path.join(root, PORTAL_PAGES_DIR, 'mi-cuenta/suscripcion.astro'), 'x\n');
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const linesBefore = readFileSync(lockFile, 'utf8').split('\n');
        const cBefore = readFileSync(articlePath(root, 'c'), 'utf8');

        // Act
        const result = reviewHelpArticles({ root, ids: ['a'], now: LATER_DAY, sources: sources() });

        // Assert
        const linesAfter = readFileSync(lockFile, 'utf8').split('\n');
        expect(result.exitCode).toBe(0);
        expect(linesAfter[1]).not.toBe(linesBefore[1]);
        expect(linesAfter.slice(2)).toEqual(linesBefore.slice(2));
        expect(readFileSync(articlePath(root, 'c'), 'utf8')).toBe(cBefore);
        expect(predicatesOf(check(root))).toEqual(['c2']);
    });

    it('writes nothing when the catalog does not build', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const file = articlePath(root, 'b');
        writeFileSync(
            file,
            readFileSync(file, 'utf8').replace('related: ["a","c"]', 'related: ["a","nope"]')
        );
        const lockBefore = readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8');

        // Act
        const result = reviewHelpArticles({ root, ids: ['a'], now: LATER_DAY, sources: sources() });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('help:review wrote nothing');
        expect(readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8')).toBe(lockBefore);
    });

    it('--list names the articles to re-read and writes nothing', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockBefore = readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8');
        const rows = new Map(sources().keyRows);
        rows.set('entitlement:manage_venue_menu', [
            'manage_venue_menu',
            'vertical',
            'SUM',
            'NONE',
            'COMMERCIAL'
        ]);

        // Act
        const clean = listHelpReviews({ root, sources: sources() });
        const dirty = listHelpReviews({ root, sources: sources({ keyRows: rows }) });

        // Assert
        expect(clean).toEqual({
            exitCode: 0,
            output: 'help:review: every article matches the lock.'
        });
        expect(dirty.exitCode).toBe(0);
        expect(dirty.output).toContain('a: entitlement:manage_venue_menu (changed)');
        expect(dirty.output).toContain('b: entitlement:manage_venue_menu (changed)');
        expect(dirty.output).not.toContain('c:');
        expect(readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8')).toBe(lockBefore);
    });
});

describe('createAnchorHasher', () => {
    it('hashes each anchor kind from its narrow input, and refuses what names nothing', () => {
        // Arrange
        const root = syntheticRoot();
        put(root, 'apps/web/src/components/X.tsx', 'x\n');
        const base = createAnchorHasher({ root, sources: sources() });
        const anchors = [
            'page:mi-cuenta/suscripcion',
            'section:accommodation.fotos',
            'section:accommodation.preguntas-ia',
            'entitlement:manage_venue_menu',
            'limit:max_photos_per_accommodation',
            'enum:PublicationStatus.MODERATED',
            'tool:get_help',
            'activation:venue',
            'activation:partner',
            'file:apps/web/src/components/X.tsx'
        ];

        // Act
        const results = anchors.map((anchor) => base(anchor));

        // Assert
        expect(results.every((result) => result.ok)).toBe(true);
        expect(new Set(results.map((result) => (result.ok ? result.hash : ''))).size).toBe(
            anchors.length
        );
        for (const anchor of [
            'page:mi-cuenta/nope',
            'section:accommodation.nope',
            'tool:nope',
            'limit:nope',
            'enum:PublicationStatus.NOPE',
            'activation:tourist',
            'file:nope.ts'
        ]) {
            expect(base(anchor).ok).toBe(false);
        }
    });

    it('moves a section hash when its catalog entry changes, and an enum hash when a value is added', () => {
        // Arrange
        const root = syntheticRoot();
        const hashBefore = createAnchorHasher({ root, sources: sources() });
        const hashAfter = createAnchorHasher({
            root,
            sources: sources({
                sectionCatalog: new Map([
                    ['accommodation.photos', { id: 'photos', fields: ['photos', 'video'] }]
                ]),
                enums: { PublicationStatus: new Set(['MODERATED', 'PUBLISHED', 'ARCHIVED']) }
            })
        });

        // Act + Assert
        expect(hashAfter('section:accommodation.fotos')).not.toEqual(
            hashBefore('section:accommodation.fotos')
        );
        expect(hashAfter('section:accommodation.preguntas-ia')).toEqual(
            hashBefore('section:accommodation.preguntas-ia')
        );
        expect(hashAfter('enum:PublicationStatus.MODERATED')).not.toEqual(
            hashBefore('enum:PublicationStatus.MODERATED')
        );
        expect(hashAfter('page:mi-cuenta/suscripcion')).toEqual(
            hashBefore('page:mi-cuenta/suscripcion')
        );
    });
});
