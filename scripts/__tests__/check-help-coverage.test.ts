/**
 * HOS-2410 (`docs/guards.md` §3, AC-29, AC-30, AC-34) — guard (b) of the help
 * catalog, reverse coverage, by mutation. Each test starts from a green
 * synthetic repo and changes ONE thing, then asserts the predicate that must
 * fail. The real repo must be green, and its `pending-content` count is pinned
 * (the Phase 5 ratchet, §3.3).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { HelpContentFile } from '../../packages/help/src/generator/index';
import { greenCatalog } from '../../packages/help/test/fixtures/article-source';
import { HELP_CONTENT_PATH } from '../check-help-catalog';
import {
    type CoverageExemption,
    checkHelpCoverage,
    formatCoverageExemptions,
    HELP_COVERAGE_EXEMPTIONS_PATH,
    parseCoverageExemptions,
    run
} from '../check-help-coverage';
import { PORTAL_PAGES_DIR, type PortalRouteData } from '../check-portal-routes';
import { computeCoverageUniverse, MCP_REGISTRY_FILE } from '../help-coverage-universe';

/**
 * The number of `pending-content` exemptions left. Phase 5 PRs LOWER it by
 * exactly the entries they remove; raising it is visible in review. The
 * closing PR of HOS-2410 removes the kind entirely (AC-38).
 */
const MAX_PENDING_CONTENT = 121;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Route data of the synthetic repo: one accommodation section, `fotos`. */
const ROUTE_DATA: PortalRouteData = {
    templates: { accommodationEditorSection: 'mi-cuenta/propiedades/[id]/editar/[section]' },
    sectionSlugs: { accommodation: { photos: 'fotos' } },
    editorPageSlugs: { accommodation: {} },
    sectionTemplateByVertical: { accommodation: 'accommodationEditorSection' },
    verticalValues: [],
    sectionPlaceholder: '[section]'
};

const GREEN_PAGES = [
    'mi-cuenta/suscripcion.astro',
    'mi-cuenta/favoritos/index.astro',
    'mi-cuenta/propiedades/[id]/editar/index.astro',
    'mi-cuenta/propiedades/[id]/editar/fotos.astro'
];

const GREEN_EXEMPTIONS: readonly CoverageExemption[] = [
    { anchor: 'page:mi-cuenta/favoritos', kind: 'out-of-scope', reason: 'Tourist page (NG-1).' },
    {
        anchor: 'page:mi-cuenta/propiedades/[id]/editar',
        kind: 'pending-content',
        reason: 'Phase 5.',
        plannedArticle: 'accommodation-editor'
    }
];

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes a file, creating its folders. */
function put(root: string, file: string, content = ''): void {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
}

/** The three-article catalog, wired to cover the green universe. */
function coveringCatalog(): HelpContentFile[] {
    return greenCatalog({
        a: {
            frontmatter: {
                entryFor: ['page:mi-cuenta/suscripcion'],
                covers: ['tool:get_help', 'limit:max_photos_per_accommodation']
            }
        },
        b: {
            frontmatter: {
                entryFor: ['section:accommodation.fotos'],
                covers: ['entitlement:manage_venue_menu']
            }
        }
    });
}

interface TreeOptions {
    readonly pages?: readonly string[];
    readonly files?: readonly HelpContentFile[];
    readonly exemptions?: string;
    readonly tools?: readonly string[];
}

/** A synthetic repo; returns its root. */
function syntheticRoot({
    pages = GREEN_PAGES,
    files = coveringCatalog(),
    exemptions = formatCoverageExemptions({ entries: GREEN_EXEMPTIONS }),
    tools = ['get_help']
}: TreeOptions = {}): string {
    const root = mkdtempSync(path.join(tmpdir(), 'help-coverage-'));
    tempDirs.push(root);
    for (const page of pages) put(root, `${PORTAL_PAGES_DIR}/${page}`);
    for (const file of files) put(path.join(root, HELP_CONTENT_PATH), file.path, file.source);
    put(root, HELP_COVERAGE_EXEMPTIONS_PATH, exemptions);
    const identifiers = tools.map(
        (name) => `${name.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}Tool`
    );
    put(
        root,
        MCP_REGISTRY_FILE,
        [
            ...tools.map((name, index) => `import { ${identifiers[index]} } from './t/${name}';`),
            `export const MCP_TOOL_DEFINITIONS: readonly ToolDefinition[] = [${identifiers.join(', ')}];`
        ].join('\n')
    );
    for (const [index, name] of tools.entries()) {
        put(
            root,
            `apps/api/src/mcp/tools/t/${name}.ts`,
            `export const ${identifiers[index]} = defineTool({\n    name: '${name}',`
        );
    }
    return root;
}

/** Runs the guard on a synthetic root with its closed vocabularies. */
function check(root: string, overrides: { limits?: string[]; entitlements?: string[] } = {}) {
    return checkHelpCoverage({
        root,
        routeData: ROUTE_DATA,
        entitlements: overrides.entitlements ?? ['manage_venue_menu'],
        limits: overrides.limits ?? ['max_photos_per_accommodation']
    });
}

/** The predicates a result fails, deduplicated and sorted. */
function predicatesOf(result: ReturnType<typeof check>): string[] {
    return [...new Set(result.violations.map((violation) => violation.predicate))].sort();
}

describe('check-help-coverage on the real repo', () => {
    it('is green', () => {
        // Act
        const result = run();

        // Assert
        expect(result.output).toMatch(/^OK GUARD:help-coverage/);
        expect(result.exitCode).toBe(0);
    });

    it(`has exactly ${MAX_PENDING_CONTENT} pending-content exemptions (the Phase 5 ratchet)`, () => {
        // Arrange
        const text = readFileSync(path.join(REPO_ROOT, HELP_COVERAGE_EXEMPTIONS_PATH), 'utf8');

        // Act
        const { entries } = parseCoverageExemptions({ text });

        // Assert
        expect(entries.filter((entry) => entry.kind === 'pending-content')).toHaveLength(
            MAX_PENDING_CONTENT
        );
    });

    it('keeps the committed exemption file in its one-entry-per-line layout', () => {
        // Arrange
        const text = readFileSync(path.join(REPO_ROOT, HELP_COVERAGE_EXEMPTIONS_PATH), 'utf8');

        // Act
        const { entries } = parseCoverageExemptions({ text });

        // Assert
        expect(formatCoverageExemptions({ entries })).toBe(text);
    });

    it('counts an editor section page as a section unit, never as a page unit', () => {
        // Act
        const { units } = computeCoverageUniverse({ root: REPO_ROOT });

        // Assert
        expect(units.section).toContain('section:venue.carta');
        expect(units.section).toContain('section:accommodation.politicas');
        expect(units.section).toContain('section:experience.preguntas-ia');
        expect(units.page).toContain('page:mi-cuenta/propiedades/[id]/editar');
        expect(units.page.filter((unit) => /\/editar\/[a-z-]+$/.test(unit))).toEqual([]);
        expect(units.tool).toContain('tool:get_help');
    });
});

describe('checkHelpCoverage on a synthetic repo', () => {
    it('is green on the starting tree, with the expected universe', () => {
        // Arrange
        const root = syntheticRoot();

        // Act
        const result = check(root);

        // Assert
        expect(result.violations).toEqual([]);
        expect(result.universe.units).toEqual({
            page: [
                'page:mi-cuenta/favoritos',
                'page:mi-cuenta/propiedades/[id]/editar',
                'page:mi-cuenta/suscripcion'
            ],
            section: ['section:accommodation.fotos'],
            entitlement: ['entitlement:manage_venue_menu'],
            limit: ['limit:max_photos_per_accommodation'],
            tool: ['tool:get_help']
        });
    });

    it('fails b1 on a new account page, naming the unit (AC-29)', () => {
        // Arrange
        const root = syntheticRoot({ pages: [...GREEN_PAGES, 'mi-cuenta/zz/index.astro'] });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['b1']);
        expect(result.violations[0]?.detail).toContain('page:mi-cuenta/zz:');
    });

    it('fails b1 on a new limit key, naming the unit (AC-29)', () => {
        // Act
        const result = check(syntheticRoot(), {
            limits: ['max_photos_per_accommodation', 'zz_key']
        });

        // Assert
        expect(predicatesOf(result)).toEqual(['b1']);
        expect(result.violations[0]?.detail).toContain('limit:zz_key:');
    });

    it('fails b1 on a new registered MCP tool', () => {
        // Act
        const result = check(syntheticRoot({ tools: ['get_help', 'zz_tool'] }));

        // Assert
        expect(predicatesOf(result)).toEqual(['b1']);
        expect(result.violations[0]?.detail).toContain('tool:zz_tool:');
    });

    it('fails b1 on an editor page no vertical lists: it stays a page unit (fail-closed)', () => {
        // Arrange
        const root = syntheticRoot({
            pages: [...GREEN_PAGES, 'mi-cuenta/propiedades/[id]/editar/zz.astro']
        });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['b1']);
        expect(result.violations[0]?.detail).toContain(
            'page:mi-cuenta/propiedades/[id]/editar/zz:'
        );
    });

    it('fails b1 when a page is only in covers: pages are covered by entryFor', () => {
        // Arrange: article a moves its page from entryFor to covers.
        const files = greenCatalog({
            a: {
                frontmatter: {
                    entryFor: [],
                    covers: [
                        'page:mi-cuenta/suscripcion',
                        'tool:get_help',
                        'limit:max_photos_per_accommodation'
                    ]
                }
            },
            b: {
                frontmatter: {
                    entryFor: ['section:accommodation.fotos'],
                    covers: ['entitlement:manage_venue_menu']
                }
            }
        });

        // Act
        const result = check(syntheticRoot({ files }));

        // Assert
        expect(predicatesOf(result)).toEqual(['b1']);
        expect(result.violations[0]?.detail).toContain('page:mi-cuenta/suscripcion:');
    });

    it('fails b2 on an exemption for a unit that does not exist (AC-30)', () => {
        // Arrange
        const exemptions = formatCoverageExemptions({
            entries: [
                ...GREEN_EXEMPTIONS,
                { anchor: 'page:mi-cuenta/does-not-exist', kind: 'out-of-scope', reason: 'Gone.' }
            ]
        });

        // Act
        const result = check(syntheticRoot({ exemptions }));

        // Assert
        expect(predicatesOf(result)).toEqual(['b2']);
        expect(result.violations[0]?.detail).toContain('page:mi-cuenta/does-not-exist');
    });

    it('fails b2 on a pending-content exemption without plannedArticle', () => {
        // Arrange
        const exemptions = JSON.stringify([
            { anchor: 'page:mi-cuenta/favoritos', kind: 'out-of-scope', reason: 'Tourist.' },
            {
                anchor: 'page:mi-cuenta/propiedades/[id]/editar',
                kind: 'pending-content',
                reason: 'Later.'
            }
        ]);

        // Act
        const result = check(syntheticRoot({ exemptions }));

        // Assert
        expect(predicatesOf(result)).toContain('b2');
    });

    it('fails b2 on an empty reason, an unknown kind, an out-of-order and a duplicated entry', () => {
        const bad = [
            [{ anchor: 'page:mi-cuenta/favoritos', kind: 'out-of-scope', reason: '  ' }],
            [{ anchor: 'page:mi-cuenta/favoritos', kind: 'later', reason: 'x' }],
            [
                {
                    anchor: 'page:mi-cuenta/propiedades/[id]/editar',
                    kind: 'out-of-scope',
                    reason: 'x'
                },
                { anchor: 'page:mi-cuenta/favoritos', kind: 'out-of-scope', reason: 'x' }
            ],
            [
                { anchor: 'page:mi-cuenta/favoritos', kind: 'out-of-scope', reason: 'x' },
                { anchor: 'page:mi-cuenta/favoritos', kind: 'out-of-scope', reason: 'y' }
            ]
        ];
        for (const entries of bad) {
            // Act
            const { violations } = parseCoverageExemptions({ text: JSON.stringify(entries) });

            // Assert
            expect(violations.map((violation) => violation.predicate)).toContain('b2');
        }
    });

    it('fails b3 when a covered unit is also exempt', () => {
        // Arrange
        const exemptions = formatCoverageExemptions({
            entries: [
                ...GREEN_EXEMPTIONS,
                { anchor: 'tool:get_help', kind: 'no-user-surface', reason: 'Stale.' }
            ]
        });

        // Act
        const result = check(syntheticRoot({ exemptions }));

        // Assert
        expect(predicatesOf(result)).toEqual(['b3']);
        expect(result.violations[0]?.detail).toContain('tool:get_help: covered by a');
    });

    it('fails b4 on an empty pages set (AC-34)', () => {
        // Arrange
        const root = syntheticRoot({ pages: [] });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toContain('b4');
        expect(result.violations.map((violation) => violation.detail)).toContain(
            'the page set of the universe is empty'
        );
    });

    it('fails b4 on an empty limit set (AC-34)', () => {
        // Act
        const result = check(syntheticRoot(), { limits: [] });

        // Assert
        expect(predicatesOf(result)).toContain('b4');
    });

    it('fails b4 when a registered tool cannot be followed to its name', () => {
        // Arrange
        const root = syntheticRoot();
        put(
            root,
            MCP_REGISTRY_FILE,
            "import { getHelpTool } from './t/get_help';\nexport const MCP_TOOL_DEFINITIONS = [getHelpTool, mysteryTool];"
        );

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toContain('b4');
        expect(
            result.violations.some((violation) => violation.detail.startsWith('mysteryTool'))
        ).toBe(true);
    });

    it('fails b4 when the content does not parse', () => {
        // Arrange
        const root = syntheticRoot({
            files: [{ path: 'es/host/a.md', source: 'no frontmatter' }]
        });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toContain('b4');
    });

    it('prints the failing predicate and exits 1', () => {
        // Arrange
        const root = syntheticRoot({ pages: [...GREEN_PAGES, 'mi-cuenta/zz/index.astro'] });

        // Act
        const result = run({
            root,
            routeData: ROUTE_DATA,
            entitlements: ['manage_venue_menu'],
            limits: ['max_photos_per_accommodation']
        });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('FAIL GUARD:help-coverage (b1)');
        expect(result.output).toContain('(b1) page:mi-cuenta/zz');
    });
});
