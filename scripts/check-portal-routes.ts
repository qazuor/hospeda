/**
 * @file check-portal-routes.ts
 * @description GUARD (HOS-2326, spec HOS-2335 §5.1, AC-C5, owner decision D-1):
 * every owner-portal page the assistant links to still exists in `apps/web`.
 *
 * The API cannot import the web's route knowledge, so it keeps its own copy at
 * `packages/portal-routes/src/portal-routes.ts` (D-1 chose a copy plus this guard
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
 *   Keys in `PORTAL_UNRELEASED_ROUTE_KEYS` (the help center pages, HOS-2410) are
 *   skipped until their page ships; that PR empties the list.
 * - (b) Every `EDITOR_SECTION_SLUGS` entry resolves to the section's editor
 *   page of that vertical: the vertical's section template with `[section]`
 *   replaced by the slug, for example `propiedades/[id]/editar/servicios.astro`.
 *   So does every `EDITOR_NON_SECTION_PAGE_SLUGS` entry, the editor pages that
 *   are not catalog sections (`politicas`, `preguntas-ia`, HOS-2410).
 * - (b2) The reverse: every page under an editor section folder
 *   (`propiedades/[id]/editar/`, `comercio/[vertical]/[id]/editar/`), as
 *   `<slug>.astro` or `<slug>/index.astro`, is a slug of `EDITOR_SECTION_SLUGS`
 *   or `EDITOR_NON_SECTION_PAGE_SLUGS` of a vertical that folder serves. The
 *   folder's own `index.astro` (the editor hub) is exempt. Venue and
 *   experience share the `comercio` folder, so a page there passes when either
 *   vertical lists it. Without this a new editor page the API does not know
 *   would be unlinkable, and the help guard could not anchor it.
 * - (b3) No non-section page reuses the id or the slug of a catalog section of
 *   the same vertical: the slug lookup would silently pick one of the two.
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
 *   venue and experience, so a section that exists for one is found for both,
 *   and (b2) accepts a `comercio` page that only one of them lists. A page
 *   meant for venue only that experience also lists passes.
 * - Editor pages outside the section folders, or nested deeper than
 *   `<slug>/index.astro` under them (b2 lists one level).
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
    EDITOR_NON_SECTION_PAGE_SLUGS,
    EDITOR_SECTION_SLUGS,
    EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_SECTION_PLACEHOLDER,
    PORTAL_UNRELEASED_ROUTE_KEYS,
    PORTAL_VERTICAL_SEGMENT_VALUES
} from '../packages/portal-routes/src/index.js';

/** Where the pages the map points at live, relative to the repo root. */
export const PORTAL_PAGES_DIR = 'apps/web/src/pages/[lang]';

/** The web file whose `LISTING_EDITOR_VERTICALS` decides which `[vertical]` values are served. */
export const LISTING_EDITOR_VERTICALS_FILE = 'apps/web/src/lib/editor/listing-editor-sections.ts';

/** Fewer pages than this means the scan is broken, not that the tree is clean. */
export const MIN_PORTAL_PAGES = 1;

/** Predicate letters, as listed in the file header. */
export type Predicate = 'a' | 'b' | 'b2' | 'b3' | 'c' | 'd' | 'e';

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
    b: 'GUARD:portal-routes (b): an EDITOR_SECTION_SLUGS or EDITOR_NON_SECTION_PAGE_SLUGS entry has no editor page for its vertical.',
    b2: 'GUARD:portal-routes (b2): an editor page in apps/web has a slug the API does not know: add it to EDITOR_NON_SECTION_PAGE_SLUGS or EDITOR_SECTION_SLUGS.',
    b3: 'GUARD:portal-routes (b3): a non-section editor page reuses the id or the slug of a catalog section of the same vertical.',
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
    /**
     * Per vertical, the editor slug of each page that is not a catalog section.
     * Required, so injected data cannot leave these pages unchecked.
     */
    readonly editorPageSlugs: Readonly<Record<string, Readonly<Record<string, string>>>>;
    /** Per vertical, the key of the template its sections live under. */
    readonly sectionTemplateByVertical: Readonly<Record<string, string>>;
    /** The `[vertical]` segment values the API fills in. */
    readonly verticalValues: readonly string[];
    /** The placeholder of a section slug in a template. */
    readonly sectionPlaceholder: string;
    /** Keys of `templates` whose page has not shipped yet; predicate (a) skips them. */
    readonly unreleasedRouteKeys?: readonly string[];
}

/** Per vertical, the slugs of its catalog sections and of its other editor pages, merged. */
export function editorSlugsByVertical({
    data
}: {
    readonly data: PortalRouteData;
}): Readonly<Record<string, Readonly<Record<string, string>>>> {
    const pages = data.editorPageSlugs;
    const verticals = new Set([...Object.keys(data.sectionSlugs), ...Object.keys(pages)]);
    return Object.fromEntries(
        [...verticals].map((vertical) => [
            vertical,
            { ...data.sectionSlugs[vertical], ...pages[vertical] }
        ])
    );
}

/** The route data of the API, as shipped. */
export const DEFAULT_ROUTE_DATA: PortalRouteData = {
    templates: PORTAL_ROUTE_TEMPLATES,
    sectionSlugs: EDITOR_SECTION_SLUGS,
    editorPageSlugs: EDITOR_NON_SECTION_PAGE_SLUGS,
    sectionTemplateByVertical: EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    verticalValues: PORTAL_VERTICAL_SEGMENT_VALUES,
    sectionPlaceholder: PORTAL_SECTION_PLACEHOLDER,
    unreleasedRouteKeys: PORTAL_UNRELEASED_ROUTE_KEYS
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

/** The page slugs directly under an editor folder: `<slug>.astro` or `<slug>/index.astro`, hub excluded. */
function editorPageSlugsIn(dir: string): string[] {
    if (!isDirectory(dir)) {
        return [];
    }
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.isDirectory()) {
            return isFile(join(dir, entry.name, 'index.astro')) ? [entry.name] : [];
        }
        if (!entry.name.endsWith('.astro') || entry.name === 'index.astro') {
            return [];
        }
        return [entry.name.slice(0, -'.astro'.length)];
    });
}

/** (b2): editor pages in the web whose slug no vertical served by their folder lists. */
function unknownEditorPages({
    data,
    pagesRoot
}: {
    readonly data: PortalRouteData;
    readonly pagesRoot: string;
}): Violation[] {
    const slugs = editorSlugsByVertical({ data });
    const verticalsByTemplate = new Map<string, string[]>();
    for (const [vertical, key] of Object.entries(data.sectionTemplateByVertical)) {
        const template = data.templates[key];
        if (template === undefined || !template.includes(data.sectionPlaceholder)) {
            continue;
        }
        verticalsByTemplate.set(template, [...(verticalsByTemplate.get(template) ?? []), vertical]);
    }
    const violations: Violation[] = [];
    for (const [template, verticals] of verticalsByTemplate) {
        const folder = template.slice(0, template.indexOf(data.sectionPlaceholder));
        const known = new Set(
            verticals.flatMap((vertical) => Object.values(slugs[vertical] ?? {}))
        );
        for (const slug of editorPageSlugsIn(join(pagesRoot, folder)).sort()) {
            if (!known.has(slug)) {
                violations.push({
                    predicate: 'b2',
                    detail: `${folder}${slug} (${verticals.join(', ')}) is an editor page no vertical lists: add it to EDITOR_NON_SECTION_PAGE_SLUGS or EDITOR_SECTION_SLUGS`
                });
            }
        }
    }
    return violations;
}

/** (b3): a non-section page id or slug that is also a catalog section's, per vertical. */
function editorPageCollisions({ data }: { readonly data: PortalRouteData }): Violation[] {
    return Object.entries(data.editorPageSlugs).flatMap(([vertical, pages]) => {
        const sections = data.sectionSlugs[vertical] ?? {};
        const sectionSlugValues = new Set(Object.values(sections));
        return Object.entries(pages).flatMap(([id, slug]) => [
            ...(Object.hasOwn(sections, id)
                ? [
                      {
                          predicate: 'b3' as const,
                          detail: `${vertical}/${id}: the id is also a catalog section id`
                      }
                  ]
                : []),
            ...(sectionSlugValues.has(slug)
                ? [
                      {
                          predicate: 'b3' as const,
                          detail: `${vertical}/${id}: the slug "${slug}" is also a catalog section slug`
                      }
                  ]
                : [])
        ]);
    });
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
    // Required by the type; checked again for a JS caller, so a missing list is
    // a violation and never "no non-section page to check".
    if (!Object.hasOwn(data, 'editorPageSlugs') || data.editorPageSlugs === undefined) {
        return [
            {
                predicate: 'b',
                detail: 'the route data has no editorPageSlugs, so its pages cannot be checked'
            }
        ];
    }
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
        if (data.unreleasedRouteKeys?.includes(key) === true) {
            continue;
        }
        if (!pageExists({ pagesRoot, path: template })) {
            violations.push({
                predicate: 'a',
                detail: `${key}: no page for ${template} under ${PORTAL_PAGES_DIR}`
            });
        }
    }

    for (const [vertical, slugs] of Object.entries(editorSlugsByVertical({ data }))) {
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

    violations.push(...unknownEditorPages({ data, pagesRoot }), ...editorPageCollisions({ data }));

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
            'Fix: update packages/portal-routes/src/portal-routes.ts in the same PR as the web change.'
        ];
        return { exitCode: 1, output: lines.join('\n') };
    }
    const sections = Object.values(editorSlugsByVertical({ data })).reduce(
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
