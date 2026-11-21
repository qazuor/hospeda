/**
 * @file help-coverage-universe.ts
 * @description The universe of guard (b) of the help catalog (HOS-2410
 * `docs/guards.md` §3.1): every owner-facing unit that must be covered by an
 * article or exempted, ENUMERATED FROM CODE at run time. Nothing here reads a
 * curated list, so a new page, key or tool appears in the universe on its own.
 * Split out of `check-help-coverage.ts` to keep each file small; guard (c)
 * (`help-anchor-hash.ts`) reuses the tool → file map.
 *
 * | Set | Source | Unit |
 * |---|---|---|
 * | Account pages | every `.astro` under `apps/web/src/pages/[lang]/mi-cuenta/` that is not an editor section page | `page:<template>` |
 * | Editor sections | every editor section page (`…/editar/<slug>.astro`), once per vertical whose `EDITOR_SECTION_SLUGS` or `EDITOR_NON_SECTION_PAGE_SLUGS` lists the slug for that folder (`[vertical]` pages expand over venue and experience) | `section:<v>.<slug>` |
 * | Entitlement keys | `EntitlementKeyEnum` | `entitlement:<k>` |
 * | Limit keys | `LimitKeyEnum` | `limit:<k>` |
 * | MCP tools | every tool name defined in a file whose tool `MCP_TOOL_DEFINITIONS` registers | `tool:<x>` |
 *
 * An editor section page is a `section:` unit, not a `page:` unit: the catalog
 * (`docs/catalog.md` §0) homes each one by its section anchor, so counting it
 * twice would demand two «?» targets for one screen. An editor page that no
 * vertical lists stays a `page:` unit, so it is still demanded (fail-closed).
 * The editor hubs (`…/editar/index.astro`) are `page:` units.
 *
 * Does NOT see: a tool registered by an expression the registry parse cannot
 * follow (reported as a problem, never skipped); a second tool defined in a
 * registered file but not registered itself (it is counted).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import {
    DEFAULT_ROUTE_DATA,
    editorSlugsByVertical,
    PORTAL_PAGES_DIR,
    type PortalRouteData
} from './check-portal-routes.js';
import { MCP_TOOLS_DIR, repoVocabularies } from './help-catalog-anchors.js';

/** The account area, relative to the web pages dir. */
export const ACCOUNT_PAGES_PREFIX = 'mi-cuenta';

/** The MCP registry, relative to the repo root. */
export const MCP_REGISTRY_FILE = 'apps/api/src/mcp/tools/registry.ts';

/** The five sets of the universe, in the order they are reported. */
export const COVERAGE_SETS = ['page', 'section', 'entitlement', 'limit', 'tool'] as const;

/** One set of the universe. */
export type CoverageSet = (typeof COVERAGE_SETS)[number];

/** The universe: the units of each set, sorted, plus what could not be read. */
export interface CoverageUniverse {
    readonly units: Readonly<Record<CoverageSet, readonly string[]>>;
    /** Parts of the universe that could not be read. Never empty-and-silent. */
    readonly problems: readonly string[];
}

/** Every file under a dir, with `/` separators, relative to `base`. */
function filesUnder({ dir, base }: { readonly dir: string; readonly base: string }): string[] {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
        return [];
    }
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory()
            ? filesUnder({ dir: full, base })
            : [relative(base, full).split(sep).join('/')];
    });
}

/** A page file path (relative to the pages dir) as its route template. */
export function pageTemplateOf({ file }: { readonly file: string }): string {
    const path = file.slice(0, -'.astro'.length);
    return path.endsWith('/index') ? path.slice(0, -'/index'.length) : path;
}

/** Every `.astro` under the account area, relative to the web pages dir, sorted. */
export function accountPageFiles({ root }: { readonly root: string }): string[] {
    const pagesRoot = join(root, PORTAL_PAGES_DIR);
    return filesUnder({ dir: join(pagesRoot, ACCOUNT_PAGES_PREFIX), base: pagesRoot })
        .filter((file) => file.endsWith('.astro'))
        .sort();
}

/** Per editor section folder (`…/editar/`), the verticals whose sections live there. */
function verticalsBySectionFolder({ data }: { readonly data: PortalRouteData }) {
    const folders = new Map<string, string[]>();
    for (const [vertical, key] of Object.entries(data.sectionTemplateByVertical)) {
        const template = data.templates[key];
        if (template === undefined || !template.includes(data.sectionPlaceholder)) {
            continue;
        }
        const folder = template.slice(0, template.indexOf(data.sectionPlaceholder));
        folders.set(folder, [...(folders.get(folder) ?? []), vertical]);
    }
    return folders;
}

/**
 * The `section:` units one page template stands for, or none when it is not an
 * editor section page a vertical lists.
 */
function sectionUnitsOf({
    template,
    data
}: {
    readonly template: string;
    readonly data: PortalRouteData;
}): string[] {
    const slugs = editorSlugsByVertical({ data });
    for (const [folder, verticals] of verticalsBySectionFolder({ data })) {
        if (!template.startsWith(folder)) {
            continue;
        }
        const slug = template.slice(folder.length);
        if (slug === '' || slug.includes('/')) {
            return [];
        }
        return verticals
            .filter((vertical) => Object.values(slugs[vertical] ?? {}).includes(slug))
            .map((vertical) => `section:${vertical}.${slug}`);
    }
    return [];
}

/** The tool names a source file defines (`defineTool({ name: '<x>'` or `*_TOOL_NAME = '<x>'`). */
function toolNamesIn({ source }: { readonly source: string }): string[] {
    return [
        ...[...source.matchAll(/[A-Z_]+_TOOL_NAME\s*=\s*'([a-z0-9_]+)'/g)],
        ...[...source.matchAll(/defineTool\(\{\s*name:\s*'([a-z0-9_]+)'/g)]
    ].map((match) => match[1] ?? '');
}

/**
 * Every MCP tool name defined under the tools dir, with the repo-relative file
 * that defines it (the file guard (c) hashes for a `tool:` anchor).
 *
 * @param args.root - The repo root
 * @returns tool name → defining file
 */
export function mcpToolFiles({ root }: { readonly root: string }): ReadonlyMap<string, string> {
    const files = new Map<string, string>();
    const toolsRoot = join(root, MCP_TOOLS_DIR);
    for (const file of filesUnder({ dir: toolsRoot, base: root })) {
        if (!file.endsWith('.ts') || file.endsWith('.test.ts')) {
            continue;
        }
        for (const name of toolNamesIn({ source: readFileSync(join(root, file), 'utf8') })) {
            if (!files.has(name)) {
                files.set(name, file);
            }
        }
    }
    return files;
}

/**
 * The names of the tools `MCP_TOOL_DEFINITIONS` registers: each identifier of
 * the array is followed to its import, and the tools defined in that file are
 * read.
 *
 * @param args.root - The repo root
 * @returns The names, and every identifier that could not be followed
 */
export function registeredToolNames({ root }: { readonly root: string }): {
    readonly names: readonly string[];
    readonly problems: readonly string[];
} {
    const registry = join(root, MCP_REGISTRY_FILE);
    if (!existsSync(registry)) {
        return { names: [], problems: [`${MCP_REGISTRY_FILE} does not exist`] };
    }
    const source = readFileSync(registry, 'utf8');
    const block = /MCP_TOOL_DEFINITIONS[^=]*=\s*\[([^\]]*)\]/.exec(source)?.[1];
    if (block === undefined) {
        return { names: [], problems: [`no MCP_TOOL_DEFINITIONS array in ${MCP_REGISTRY_FILE}`] };
    }
    const imports = new Map<string, string>();
    for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
        for (const name of (match[1] ?? '').split(',').map((part) => part.trim())) {
            if (name !== '' && !name.startsWith('type ')) {
                imports.set(name, match[2] ?? '');
            }
        }
    }
    const names = new Set<string>();
    const problems: string[] = [];
    const identifiers = block
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '');
    for (const identifier of identifiers) {
        const from = imports.get(identifier);
        const file = from === undefined ? undefined : join(dirname(registry), `${from}.ts`);
        const found =
            file !== undefined && existsSync(file)
                ? toolNamesIn({ source: readFileSync(file, 'utf8') })
                : [];
        if (found.length === 0) {
            problems.push(`${identifier} in ${MCP_REGISTRY_FILE}: no tool name found in its file`);
        }
        for (const name of found) names.add(name);
    }
    return { names: [...names].sort(), problems };
}

/** Arguments for {@link computeCoverageUniverse}. RO-RO. */
export interface ComputeCoverageUniverseArgs {
    readonly root: string;
    /** The portal route data; defaults to `@repo/portal-routes`. */
    readonly routeData?: PortalRouteData;
    /** Entitlement keys; default `EntitlementKeyEnum`. */
    readonly entitlements?: Iterable<string>;
    /** Limit keys; default `LimitKeyEnum`. */
    readonly limits?: Iterable<string>;
}

/**
 * Enumerates the universe of guard (b).
 *
 * @param args - See {@link ComputeCoverageUniverseArgs}
 * @returns The units per set (sorted) and what could not be read
 */
export function computeCoverageUniverse({
    root,
    routeData = DEFAULT_ROUTE_DATA,
    entitlements,
    limits
}: ComputeCoverageUniverseArgs): CoverageUniverse {
    const vocabularies =
        entitlements === undefined || limits === undefined ? repoVocabularies({ root }) : undefined;
    const pages = new Set<string>();
    const sections = new Set<string>();
    for (const file of accountPageFiles({ root })) {
        const template = pageTemplateOf({ file });
        const units = sectionUnitsOf({ template, data: routeData });
        if (units.length === 0) {
            pages.add(`page:${template}`);
        }
        for (const unit of units) sections.add(unit);
    }
    const tools = registeredToolNames({ root });
    const sortedUnits = (kind: CoverageSet, values: Iterable<string>) =>
        [...new Set([...values].map((value) => `${kind}:${value}`))].sort();
    return {
        units: {
            page: [...pages].sort(),
            section: [...sections].sort(),
            entitlement: sortedUnits(
                'entitlement',
                entitlements ?? vocabularies?.entitlements ?? []
            ),
            limit: sortedUnits('limit', limits ?? vocabularies?.limits ?? []),
            tool: sortedUnits('tool', tools.names)
        },
        problems: tools.problems
    };
}
