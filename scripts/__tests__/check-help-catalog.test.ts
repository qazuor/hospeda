/**
 * HOS-2410 (`docs/guards.md` §2, AC-13, AC-24…AC-28) — guard (a) of the help
 * catalog, by mutation. Each test starts from a green tree and changes ONE
 * thing, then asserts the predicate that must fail.
 *
 * Two kinds of tree are used: a synthetic repo root holding exactly the pages,
 * FAQ and tools a three-article catalog names, and the REAL repo with its
 * content copied to a temp dir (for the stale-index message of AC-13).
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    buildHelpIndex,
    type HelpContentFile,
    readHelpContentFiles
} from '../../packages/help/src/generator/index';
import { greenCatalog } from '../../packages/help/test/fixtures/article-source';
import {
    checkHelpCatalog,
    ES_FAQ_FILE,
    firstDifferingArticle,
    HELP_CONTENT_PATH,
    PREDICATE_MESSAGES,
    run
} from '../check-help-catalog';
import { PORTAL_PAGES_DIR } from '../check-portal-routes';
import type { HelpRepoVocabularies } from '../help-catalog-anchors';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOW = new Date('2026-11-20T12:00:00Z');

/** Closed vocabularies for the synthetic root. */
const VOCABULARIES: HelpRepoVocabularies = {
    entitlements: new Set(['manage_venue_menu']),
    limits: new Set(['max_photos_per_accommodation']),
    enums: { PublicationStatus: new Set(['MODERATED']) },
    activations: new Set(['venue'])
};

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fresh temp dir, removed after the test. */
function tempDir(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'help-catalog-'));
    tempDirs.push(dir);
    return dir;
}

/** Writes a file, creating its folders. */
function put(root: string, file: string, content = ''): void {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
}

interface Tree {
    readonly root: string;
    readonly contentDir: string;
    readonly indexFile: string;
}

/**
 * A synthetic repo: the given content files, a committed index generated from
 * them (unless `index` says otherwise), the subscription page, one FAQ item
 * and one MCP tool.
 */
function syntheticTree({
    files = greenCatalog(),
    index = 'fresh'
}: {
    readonly files?: readonly HelpContentFile[];
    readonly index?: 'fresh' | 'missing';
} = {}): Tree {
    const root = tempDir();
    const contentDir = path.join(root, HELP_CONTENT_PATH);
    const indexFile = path.join(root, 'help-index.json');
    for (const file of files) put(contentDir, file.path, file.source);
    mkdirSync(contentDir, { recursive: true });
    put(root, `${PORTAL_PAGES_DIR}/mi-cuenta/suscripcion.astro`);
    put(root, ES_FAQ_FILE, JSON.stringify({ categories: { owners: { items: { ready: {} } } } }));
    put(root, 'apps/api/src/mcp/tools/help/get-help.ts', "defineTool({\n    name: 'get_help',");
    const built = buildHelpIndex({ files });
    if (index === 'fresh' && built.json !== undefined) writeFileSync(indexFile, built.json);
    return { root, contentDir, indexFile };
}

/** The predicates a tree fails, deduplicated and sorted. */
function predicatesOf(tree: Tree, now: Date = NOW): string[] {
    const { violations } = checkHelpCatalog({ ...tree, now, vocabularies: VOCABULARIES });
    return [...new Set(violations.map((violation) => violation.predicate))].sort();
}

describe('check-help-catalog on the real repo', () => {
    it('is green, and reads every article', () => {
        // Act
        const result = run({ now: NOW });

        // Assert
        expect(result.output).toMatch(/^OK GUARD:help-catalog: 16 articles/);
        expect(result.exitCode).toBe(0);
    });

    it('fails a8 on a stale index, naming the first differing article and the command (AC-13)', () => {
        // Arrange: copy the real content, edit one article, keep the old index.
        const dir = tempDir();
        const contentDir = path.join(dir, 'content');
        const indexFile = path.join(dir, 'help-index.json');
        cpSync(path.join(REPO_ROOT, HELP_CONTENT_PATH), contentDir, { recursive: true });
        cpSync(path.join(REPO_ROOT, 'packages/help/generated/help-index.json'), indexFile);
        const photos = path.join(contentDir, 'es/common/photos.md');
        writeFileSync(photos, readFileSync(photos, 'utf8').replace('summary: ', 'summary: Ahora '));

        // Act
        const result = run({ contentDir, indexFile, now: NOW });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(PREDICATE_MESSAGES.a8);
        expect(result.output).toContain('first differing article: es/photos');
        expect(result.output).toContain('Run: pnpm help:build');
    });
});

describe('checkHelpCatalog on a synthetic repo', () => {
    it('is green on the starting tree', () => {
        // Arrange
        const tree = syntheticTree();

        // Act
        const result = checkHelpCatalog({ ...tree, now: NOW, vocabularies: VOCABULARIES });

        // Assert
        expect(result).toEqual({ violations: [], stale: [], articleCount: 3 });
    });

    it('fails a8 when the committed index is missing', () => {
        expect(predicatesOf(syntheticTree({ index: 'missing' }))).toEqual(['a8']);
    });

    it('fails a2 (and a5) when the linked page is gone (AC-24)', () => {
        // Arrange
        const tree = syntheticTree();
        rmSync(path.join(tree.root, PORTAL_PAGES_DIR, 'mi-cuenta/suscripcion.astro'));

        // Act / Assert
        expect(predicatesOf(tree)).toEqual(['a2', 'a5']);
    });

    it('skips a destination whose page has not shipped yet (helpLanding)', () => {
        // Arrange
        const files = greenCatalog({
            a: {
                frontmatter: { destinations: [{ kind: 'subscription' }, { kind: 'helpLanding' }] }
            }
        });

        // Act / Assert
        expect(predicatesOf(syntheticTree({ files }))).toEqual([]);
    });

    it('fails a3 when the faqKey is not an es FAQ item, and passes when it is', () => {
        expect(
            predicatesOf(
                syntheticTree({
                    files: greenCatalog({ a: { frontmatter: { faqKey: 'owners.nope' } } })
                })
            )
        ).toEqual(['a3']);
        expect(
            predicatesOf(
                syntheticTree({
                    files: greenCatalog({ a: { frontmatter: { faqKey: 'owners.ready' } } })
                })
            )
        ).toEqual([]);
    });

    it('fails a4 on a review date after today in Argentina, not in UTC', () => {
        // Arrange: 02:00 UTC on the 18th is still the 17th in Argentina (UTC-3).
        const files = greenCatalog({ a: { frontmatter: { reviewedAt: '2026-11-18' } } });
        const tree = syntheticTree({ files });

        // Act / Assert
        expect(predicatesOf(tree, new Date('2026-11-18T02:00:00Z'))).toEqual(['a4']);
        expect(predicatesOf(tree, new Date('2026-11-18T04:00:00Z'))).toEqual([]);
    });

    it('reports a stale article without failing (exit 0, WARN)', () => {
        // Arrange
        const tree = syntheticTree();
        const later = new Date('2027-06-01T12:00:00Z');

        // Act
        const result = checkHelpCatalog({ ...tree, now: later, vocabularies: VOCABULARIES });
        const printed = run({ ...tree, now: later, vocabularies: VOCABULARIES });

        // Assert
        expect(result.violations).toEqual([]);
        expect(result.stale.map((entry) => entry.id)).toEqual(['es/a', 'es/b', 'es/c']);
        expect(printed.exitCode).toBe(0);
        expect(printed.output).toContain('WARN GUARD:help-catalog: 3 stale');
    });

    it.each([
        ['an unknown tool', 'tool:nope'],
        ['an unknown entitlement', 'entitlement:nope'],
        ['an unknown limit', 'limit:nope'],
        ['an unknown enum value', 'enum:PublicationStatus.GONE'],
        ['a vertical without activation event', 'activation:partner'],
        ['a missing file', 'file:apps/web/nope.ts'],
        ['a missing page', 'page:mi-cuenta/nope'],
        ['a section whose editor page is missing', 'section:accommodation.fotos']
    ])('fails a5 with %s (AC-25)', (_label, anchor) => {
        // Arrange
        const files = greenCatalog({
            c: { frontmatter: { covers: ['page:mi-cuenta/suscripcion', anchor] } }
        });

        // Act / Assert
        expect(predicatesOf(syntheticTree({ files }))).toContain('a5');
    });

    it.each([
        ['a defined tool', 'tool:get_help'],
        ['a known entitlement', 'entitlement:manage_venue_menu'],
        ['a known limit', 'limit:max_photos_per_accommodation'],
        ['a known enum value', 'enum:PublicationStatus.MODERATED'],
        ['a vertical with an activation event', 'activation:venue'],
        ['an existing file', `file:${ES_FAQ_FILE}`]
    ])('accepts %s', (_label, anchor) => {
        // Arrange
        const files = greenCatalog({
            c: { frontmatter: { covers: ['page:mi-cuenta/suscripcion', anchor] } }
        });

        // Act / Assert
        expect(predicatesOf(syntheticTree({ files }))).toEqual([]);
    });

    it('accepts a covered page linked by {{link:page:<key>}}, and fails a2 when its page is gone', () => {
        // Arrange
        const files = greenCatalog({
            c: {
                frontmatter: {
                    covers: ['page:mi-cuenta/suscripcion', 'page:mi-cuenta'],
                    destinations: [{ kind: 'subscription' }, { kind: 'page', page: 'accountHome' }]
                },
                canDo: 'Ir a {{link:subscription}}, {{link:page:accountHome}} y {{article:a|a}}.'
            }
        });
        const tree = syntheticTree({ files });
        put(tree.root, `${PORTAL_PAGES_DIR}/mi-cuenta/index.astro`);

        // Act / Assert
        expect(predicatesOf(tree)).toEqual([]);
        rmSync(path.join(tree.root, PORTAL_PAGES_DIR, 'mi-cuenta/index.astro'));
        expect(predicatesOf(tree)).toEqual(['a2', 'a5']);
    });

    it('resolves a section anchor once its editor page exists', () => {
        // Arrange
        const files = greenCatalog({
            c: {
                frontmatter: {
                    covers: ['page:mi-cuenta/suscripcion', 'section:accommodation.fotos']
                },
                canDo: 'Ir a {{link:subscription}}, {{link:section:accommodation:fotos}} y {{article:a|a}}.'
            }
        });
        const tree = syntheticTree({ files });
        put(tree.root, `${PORTAL_PAGES_DIR}/mi-cuenta/propiedades/[id]/editar/fotos.astro`);

        // Act / Assert
        expect(predicatesOf(tree)).toEqual([]);
    });

    it('fails a6 on a limit token naming no limit key (AC-27)', () => {
        expect(
            predicatesOf(
                syntheticTree({
                    files: greenCatalog({ c: { expect: 'Hasta {{limit:nope_key}}.' } })
                })
            )
        ).toEqual(['a6']);
        expect(
            predicatesOf(
                syntheticTree({
                    files: greenCatalog({
                        c: { expect: 'Hasta {{limit:max_photos_per_accommodation}}.' }
                    })
                })
            )
        ).toEqual([]);
    });

    it('fails a9 on an empty catalog (exit 1)', () => {
        // Arrange
        const tree = syntheticTree({ files: [] });

        // Act / Assert
        expect(predicatesOf(tree)).toEqual(['a9']);
        expect(run({ ...tree, now: NOW, vocabularies: VOCABULARIES }).exitCode).toBe(1);
    });

    it('fails a9 per audience only when asked to', () => {
        // Arrange
        const tree = syntheticTree();

        // Act
        const { violations } = checkHelpCatalog({
            ...tree,
            now: NOW,
            vocabularies: VOCABULARIES,
            requireEveryAudience: true
        });

        // Assert
        expect(violations.map((violation) => violation.detail)).toEqual([
            'no es article for the venue audience',
            'no es article for the experience audience',
            'no es article for the provider audience',
            'no es article for the partner audience'
        ]);
    });

    it('passes the generator predicates through (a7 here)', () => {
        expect(
            predicatesOf(
                syntheticTree({
                    files: greenCatalog({ a: { frontmatter: { related: ['b', 'nope'] } } })
                })
            )
        ).toEqual(['a7']);
    });
});

describe('firstDifferingArticle', () => {
    it('names the first article id that differs, then falls back to the header', () => {
        // Arrange
        const fresh = buildHelpIndex({ files: readHelpContentFiles() }).index;
        if (fresh === undefined) throw new Error('the real catalog must build');
        const committed = JSON.stringify({ ...fresh, locales: { es: fresh.locales.es.slice(1) } });

        // Act / Assert
        expect(firstDifferingArticle({ committed, fresh })).toBe(`es/${fresh.locales.es[0]?.id}`);
        expect(firstDifferingArticle({ committed: JSON.stringify(fresh), fresh })).toMatch(
            /no article differs/
        );
        expect(firstDifferingArticle({ committed: '{', fresh })).toMatch(/not valid JSON/);
    });
});
