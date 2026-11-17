/**
 * @file check-portal-routes.ts
 * @description GUARD (HOS-2326, spec HOS-2335 §5.1, AC-C5, owner decision D-1):
 * every owner-portal page the assistant links to still exists in `apps/web`.
 *
 * The API cannot import the web's route knowledge, so it keeps its own copy at
 * `apps/api/src/mcp/portal/portal-routes.ts` (D-1 chose a copy plus this guard
 * over a shared module). The copy drifts silently when the web renames or
 * deletes a page: the assistant then sends owners to a 404. This guard is the
 * only thing keeping the copy honest.
 *
 * ## What it checks
 *
 * - (a) Every entry of `PORTAL_ROUTE_TEMPLATES` that has no `[section]` resolves
 *   to a page under `apps/web/src/pages/[lang]/`: `<path>.astro` or
 *   `<path>/index.astro`, every directory on the way matched BY NAME. A dynamic
 *   segment (`[id]`, `[vertical]`, `[slug]`, `[conversationId]`) must be a
 *   directory with that very name, so a rename to `[propertyId]` fails.
 * - (b) Every `EDITOR_SECTION_SLUGS` entry resolves to the section's editor
 *   page of that vertical: the vertical's section template with `[section]`
 *   replaced by the slug, for example `propiedades/[id]/editar/servicios.astro`.
 * - (c) A section template that no vertical's slugs are expanded over is never
 *   checked, so it is a violation (it would look verified and not be).
 * - (d) Where a template has a `[vertical]` segment, both values the API fills it
 *   with (`venue`, `experience`) are still keys of the web's
 *   `LISTING_EDITOR_VERTICALS`, the lookup that decides which values the page
 *   serves.
 * - (e) The scan is not empty: a missing or page-less pages folder fails, so a
 *   moved folder cannot turn the guard green by checking nothing.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - A page that exists but redirects (`mi-cuenta/comercio/nuevo/[vertical]` is a
 *   301, which is why the API map uses the `publicar/...` pages instead) or
 *   answers 404/403 for some states.
 * - A route a middleware rewrites, or a page whose file name differs from the
 *   route (a `src/pages` file with a `getStaticPaths` that does not cover the
 *   value the API fills in).
 * - Whether the section SLUG still belongs to the section id it is mapped from:
 *   a page exists for the slug, nothing more. Swapping two slugs passes.
 * - Which verticals a given editor page serves: `[vertical]` pages are shared by
 *   venue and experience, so a section that exists for one is found for both.
 * - Anything outside `apps/web/src/pages/[lang]/` (locale-specific pages).
 *
 * Fixing a failure means updating the API map in the same PR as the web change.
 *
 * Exit codes: 0 = clean; 1 = a violation.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    EDITOR_SECTION_SLUGS,
    EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_SECTION_PLACEHOLDER,
    PORTAL_VERTICAL_SEGMENT_VALUES
} from '../apps/api/src/mcp/portal/portal-routes.js';

/** Where the pages the map points at live, relative to the repo root. */
export const PORTAL_PAGES_DIR = 'apps/web/src/pages/[lang]';

/** The web file whose `LISTING_EDITOR_VERTICALS` decides which `[vertical]` values are served. */
export const LISTING_EDITOR_VERTICALS_FILE = 'apps/web/src/lib/editor/listing-editor-sections.ts';

/** Fewer pages than this means the scan is broken, not that the tree is clean. */
export const MIN_PORTAL_PAGES = 1;

/** Predicate letters, as listed in the file header. */
export type Predicate = 'a' | 'b' | 'c' | 'd' | 'e';

/** One offending entry. */
export interface Violation {
    /** Which check failed. */
    readonly predicate: Predicate;
    /** Human-readable detail, naming the entry. */
    readonly detail: string;
}

/** What each predicate means; printed with the violations. */
export const PREDICATE_MESSAGES: Readonly<Record<Predicate, string>> = {
    a: 'GUARD:portal-routes (a): a PORTAL_ROUTE_TEMPLATES entry has no page in apps/web (dynamic segments are matched by name).',
    b: 'GUARD:portal-routes (b): an EDITOR_SECTION_SLUGS entry has no editor page for its vertical.',
    c: 'GUARD:portal-routes (c): a section template is not expanded over any vertical, so it is never checked.',
    d: 'GUARD:portal-routes (d): the web no longer serves a [vertical] value the API links with.',
    e: 'GUARD:portal-routes (e): the pages folder is missing or has no pages, so nothing was checked.'
};

/** The route data the guard checks. Injected by tests. */
export interface PortalRouteData {
    /** One path template per destination. */
    readonly templates: Readonly<Record<string, string>>;
    /** Per vertical, the editor slug of each section id. */
    readonly sectionSlugs: Readonly<Record<string, Readonly<Record<string, string>>>>;
    /** Per vertical, the key of the template its sections live under. */
    readonly sectionTemplateByVertical: Readonly<Record<string, string>>;
    /** The `[vertical]` segment values the API fills in. */
    readonly verticalValues: readonly string[];
    /** The placeholder of a section slug in a template. */
    readonly sectionPlaceholder: string;
}

/** The route data of the API, as shipped. */
export const DEFAULT_ROUTE_DATA: PortalRouteData = {
    templates: PORTAL_ROUTE_TEMPLATES,
    sectionSlugs: EDITOR_SECTION_SLUGS,
    sectionTemplateByVertical: EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    verticalValues: PORTAL_VERTICAL_SEGMENT_VALUES,
    sectionPlaceholder: PORTAL_SECTION_PLACEHOLDER
};

function isDirectory(path: string): boolean {
    return existsSync(path) && statSync(path).isDirectory();
}

function isFile(path: string): boolean {
    return existsSync(path) && statSync(path).isFile();
}

/**
 * Whether a route path resolves to a page file under `pagesRoot`.
 *
 * @param args.pagesRoot - `apps/web/src/pages/[lang]`
 * @param args.path - Route path, no locale, no edge slashes
 * @returns `true` for `<path>.astro` or `<path>/index.astro`, every directory
 *   on the way matched by its exact name (a dynamic segment is a directory with
 *   that same bracketed name)
 */
export function pageExists({
    pagesRoot,
    path
}: {
    readonly pagesRoot: string;
    readonly path: string;
}): boolean {
    const segments = path.split('/').filter((segment) => segment !== '');
    const last = segments.pop();
    if (last === undefined) {
        return false;
    }
    let dir = pagesRoot;
    for (const segment of segments) {
        dir = join(dir, segment);
        if (!isDirectory(dir)) {
            return false;
        }
    }
    return isFile(join(dir, `${last}.astro`)) || isFile(join(dir, last, 'index.astro'));
}

/** Counts the `.astro` pages under a folder. */
function countPages(dir: string): number {
    if (!isDirectory(dir)) {
        return 0;
    }
    return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            return total + countPages(full);
        }
        return total + (entry.name.endsWith('.astro') ? 1 : 0);
    }, 0);
}

/** Whether `LISTING_EDITOR_VERTICALS` in the web file lists `value` as a key. */
function webServesVertical({ source, value }: { readonly source: string; readonly value: string }) {
    const block = /LISTING_EDITOR_VERTICALS[^=]*=\s*\{([^}]*)\}/.exec(source)?.[1] ?? '';
    return new RegExp(`(^|[\\s,{])${value}\\s*:`).test(block);
}

/**
 * Checks the route data against a repo.
 *
 * @param args.root - Repo root; defaults to this repo
 * @param args.data - The route data; defaults to the API's
 * @param args.minPages - Smallest believable page count
 * @returns The violations found (empty when clean)
 */
export function checkPortalRoutes({
    root,
    data = DEFAULT_ROUTE_DATA,
    minPages = MIN_PORTAL_PAGES
}: {
    readonly root: string;
    readonly data?: PortalRouteData;
    readonly minPages?: number;
}): readonly Violation[] {
    const pagesRoot = join(root, PORTAL_PAGES_DIR);
    if (countPages(pagesRoot) < minPages) {
        return [
            {
                predicate: 'e',
                detail: `${PORTAL_PAGES_DIR} has fewer than ${minPages} page(s)`
            }
        ];
    }

    const violations: Violation[] = [];
    const placeholder = data.sectionPlaceholder;
    const sectionTemplateKeys = new Set(Object.values(data.sectionTemplateByVertical));

    for (const [key, template] of Object.entries(data.templates)) {
        if (template.includes(placeholder)) {
            if (!sectionTemplateKeys.has(key)) {
                violations.push({
                    predicate: 'c',
                    detail: `${key} (${template}) is a section template no vertical expands`
                });
            }
            continue;
        }
        if (!pageExists({ pagesRoot, path: template })) {
            violations.push({
                predicate: 'a',
                detail: `${key}: no page for ${template} under ${PORTAL_PAGES_DIR}`
            });
        }
    }

    for (const [vertical, slugs] of Object.entries(data.sectionSlugs)) {
        const templateKey = data.sectionTemplateByVertical[vertical];
        const template = templateKey === undefined ? undefined : data.templates[templateKey];
        if (template === undefined || !template.includes(placeholder)) {
            violations.push({
                predicate: 'b',
                detail: `${vertical}: no section template to expand its ${Object.keys(slugs).length} slug(s) over`
            });
            continue;
        }
        for (const [sectionId, slug] of Object.entries(slugs)) {
            const path = template.replace(placeholder, slug);
            if (!pageExists({ pagesRoot, path })) {
                violations.push({
                    predicate: 'b',
                    detail: `${vertical}/${sectionId}: no page for ${path} under ${PORTAL_PAGES_DIR}`
                });
            }
        }
    }

    if (Object.values(data.templates).some((template) => template.includes('[vertical]'))) {
        const file = join(root, LISTING_EDITOR_VERTICALS_FILE);
        const source = isFile(file) ? readFileSync(file, 'utf8') : '';
        for (const value of data.verticalValues) {
            if (!webServesVertical({ source, value })) {
                violations.push({
                    predicate: 'd',
                    detail: `[vertical]=${value} is not a key of LISTING_EDITOR_VERTICALS in ${LISTING_EDITOR_VERTICALS_FILE}`
                });
            }
        }
    }

    return violations;
}

/** Repo root of this script. */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Runs the guard.
 *
 * @param args.root - Repo root; defaults to this repo
 * @param args.data - The route data; defaults to the API's
 * @param args.minPages - Smallest believable page count
 * @returns The exit code and the text to print
 */
export function run({
    root = REPO_ROOT,
    data = DEFAULT_ROUTE_DATA,
    minPages = MIN_PORTAL_PAGES
}: {
    readonly root?: string;
    readonly data?: PortalRouteData;
    readonly minPages?: number;
} = {}): { readonly exitCode: 0 | 1; readonly output: string } {
    const violations = checkPortalRoutes({ root, data, minPages });
    if (violations.length > 0) {
        const predicates = [...new Set(violations.map((violation) => violation.predicate))].sort();
        const lines = [
            ...predicates.map((predicate) => `FAIL ${PREDICATE_MESSAGES[predicate]}`),
            ...violations.map((violation) => `  - (${violation.predicate}) ${violation.detail}`),
            'Fix: update apps/api/src/mcp/portal/portal-routes.ts in the same PR as the web change.'
        ];
        return { exitCode: 1, output: lines.join('\n') };
    }
    const sections = Object.values(data.sectionSlugs).reduce(
        (total, slugs) => total + Object.keys(slugs).length,
        0
    );
    return {
        exitCode: 0,
        output: `OK GUARD:portal-routes: ${Object.keys(data.templates).length} route templates and ${sections} editor sections all resolve to a page in apps/web`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
