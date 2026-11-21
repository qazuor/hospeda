/**
 * Synthetic repo for the tests of guard (c) of the help catalog and of
 * `pnpm help:review` (HOS-2410 `docs/guards.md` §4): three articles, the pages
 * and tool they anchor to, and injected hash inputs.
 *
 * @module scripts/__tests__/helpers/help-lock-fixture
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { HelpContentFile } from '../../../packages/help/src/generator/index';
import { greenCatalog } from '../../../packages/help/test/fixtures/article-source';
import { HELP_CONTENT_PATH, HELP_INDEX_PATH } from '../../check-help-catalog';
import { checkHelpLock } from '../../check-help-lock';
import { PORTAL_PAGES_DIR, type PortalRouteData } from '../../check-portal-routes';
import type { HelpHashSources } from '../../help-anchor-hash';
import { HELP_LOCK_PATH } from '../../help-lock';
import { reviewHelpArticles } from '../../help-review';

/** 2026-11-17 in Argentina, the fixtures' reviewedAt. */
export const REVIEW_DAY = new Date('2026-11-17T15:00:00Z');

/** A later review day. */
export const LATER_DAY = new Date('2026-11-19T15:00:00Z');

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
export function sources(overrides: Partial<HelpHashSources> = {}): HelpHashSources {
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

/** Removes every synthetic repo created so far; call it from `afterEach`. */
export function cleanTempDirs(): void {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** Writes a file, creating its folders. */
export function put(root: string, file: string, content = ''): void {
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

/** A synthetic repo with an empty lock and no index yet. */
export function syntheticRoot({
    files = catalog()
}: {
    readonly files?: readonly HelpContentFile[];
} = {}): string {
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
export function reviewAll(
    root: string,
    now: Date = REVIEW_DAY,
    extra: Partial<HelpHashSources> = {}
) {
    return reviewHelpArticles({ root, ids: ['a', 'b', 'c'], now, sources: sources(extra) });
}

/** Runs the guard on a synthetic root. */
export function check(root: string, extra: Partial<HelpHashSources> = {}) {
    return checkHelpLock({ root, sources: sources(extra) });
}

/** The predicates a result fails, deduplicated and sorted. */
export function predicatesOf(result: ReturnType<typeof check>): string[] {
    return [...new Set(result.violations.map((violation) => violation.predicate))].sort();
}

/** The article file path of an id in a synthetic root. */
export function articlePath(root: string, id: string): string {
    return path.join(root, HELP_CONTENT_PATH, 'es/host', `${id}.md`);
}
