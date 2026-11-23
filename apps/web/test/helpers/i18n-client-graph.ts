/**
 * @file i18n-client-graph.ts
 * @description The browser import graph and the i18n key prefixes it can name,
 * shared by the two guards that derive a declared prefix list from code:
 *
 *  - `test/lib/i18n-client-namespaces.guard.test.ts` (HOS-369 W3-2) walks the
 *    graph out of EVERY island and checks `CLIENT_I18N_KEY_PREFIXES`.
 *  - `test/lib/i18n-critical-prefixes.guard.test.ts` (HOS-2572) walks it out of
 *    the islands that can hydrate BEFORE a deferred script runs and checks
 *    `CRITICAL_I18N_KEY_PREFIXES`.
 *
 * The walk is CONSERVATIVE because the two error directions are not symmetric:
 * over-including a prefix costs bytes, under-including it renders raw keys. An
 * import that looks like ours but does not resolve is therefore reported, never
 * skipped — an unexplored subgraph is exactly how a prefix gets misreported as
 * unreachable.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { namespaces } from '@repo/i18n/web';

/** Monorepo root. */
export const REPO_ROOT = resolvePath(__dirname, '../../../..');

/** `apps/web/src`. */
export const WEB_SRC = join(REPO_ROOT, 'apps/web/src');

/** Workspace packages whose modules are bundled into the browser build. */
export const CLIENT_PACKAGE_ROOTS: ReadonlyArray<readonly [string, string]> = [
    ['@repo/auth-ui', 'packages/auth-ui/src'],
    ['@repo/feedback', 'packages/feedback/src']
];

/** Every namespace the catalog declares. */
export const ALL_NAMESPACES: ReadonlySet<string> = new Set(namespaces as readonly string[]);

/**
 * Lists every file beneath `dir`, skipping `node_modules`, `dist` and dotfiles.
 *
 * @param dir - Directory to walk.
 * @returns Absolute file paths.
 */
export function walk(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

/** True for a test file, which never reaches a browser. */
export const isTestFile = (f: string): boolean =>
    /\.test\.tsx?$/.test(f) || f.includes('__tests__');

/**
 * Resolves an import specifier to a file on disk.
 *
 * @returns The resolved path; `null` when the specifier is external (node_modules
 *   or a workspace package that does not ship to the browser); `undefined` when
 *   it looked like ours but did not resolve — which the caller must treat as a
 *   failure, never as "external".
 */
export function resolveSpecifier(spec: string, fromFile: string): string | null | undefined {
    // An asset import is legitimately not a TS module, so it is external to
    // this graph. Checked BEFORE the path branches, and against the specifier
    // stripped of Vite's query suffix: `?url` (see `lib/ensure-stylesheet.ts`)
    // means "give me the built asset's URL as a string", and the specifier
    // then ends in `?url`, not in `.css`. An end-anchored extension test on
    // the raw specifier misses it and reports the import as UNRESOLVED —
    // which is a hard failure here, since an unresolved import truncates the
    // graph. Only `@/…` and workspace-package specifiers reach that far
    // (a bare `react-day-picker/style.css?url` exits earlier as external),
    // which is why this stayed latent until a `?url` import of a workspace
    // package's stylesheet appeared.
    if (/\.(css|svg|png|jpe?g|webp|json)$/.test(spec.replace(/\?.*$/, ''))) return null;

    let base: string;
    if (spec.startsWith('@/')) {
        base = join(WEB_SRC, spec.slice(2));
    } else if (spec.startsWith('.')) {
        base = resolvePath(dirname(fromFile), spec);
    } else {
        const pkg = CLIENT_PACKAGE_ROOTS.find(
            ([name]) => spec === name || spec.startsWith(`${name}/`)
        );
        if (!pkg) return null;
        const [name, root] = pkg;
        const sub = spec.slice(name.length).replace(/^\//, '');
        base = join(REPO_ROOT, root, sub || 'index');
    }

    // ESM specifiers carry `.js` for a `.ts`/`.tsx` file on disk.
    const stripped = base.endsWith('.js') ? base.slice(0, -3) : base;
    const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${stripped}.ts`,
        `${stripped}.tsx`,
        join(base, 'index.ts'),
        join(base, 'index.tsx')
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return undefined;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]{0,400}?from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const SIDE_EFFECT_IMPORT_RE = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

/**
 * A whole-statement `import type` / `export type`, which is erased at build
 * time and therefore reaches no browser.
 *
 * {@link IMPORT_RE} cannot tell the two apart — `import type { X } from './y'`
 * matches it exactly as a value import does — so without this the graph walks
 * edges that do not exist at runtime. The cost is not a false alarm you can
 * wave through: it is pressure to declare namespaces the client never needs,
 * which is the opposite of what the subsetting this file protects was built
 * for (HOS-369 measured a 26.9% i18n payload reduction).
 *
 * Found via HOS-1233: two islands importing `PricingAudience` as a TYPE from
 * `lib/billing-i18n.ts` pulled that module's six key prefixes into the
 * "reachable" set, and shipping them would have grown every pricing island's
 * payload for an import that does not survive compilation.
 *
 * **The inline form is deliberately NOT matched.** `import { type A, B }`
 * still imports `B` at runtime, so that statement must keep its edge — which
 * is why this anchors on `type` as the token right after `import`/`export`,
 * never on the mere presence of the word.
 */
export const TYPE_ONLY_STATEMENT_RE = /^\s*(?:import|export)\s+type\s/;

/** The modules a walk reached, and the imports it could not resolve. */
export interface GraphResult {
    readonly modules: ReadonlySet<string>;
    readonly unresolved: readonly string[];
}

/**
 * Walks every module reachable from `entries` through value imports.
 *
 * @param input.entries - Absolute paths of the entry modules.
 * @returns The reached modules plus every import that failed to resolve.
 */
export function buildGraph(input: { readonly entries: readonly string[] }): GraphResult {
    const modules = new Set<string>();
    const unresolved: string[] = [];
    const queue = [...input.entries];

    while (queue.length > 0) {
        const file = queue.pop() as string;
        if (modules.has(file)) continue;
        modules.add(file);
        if (!/\.tsx?$/.test(file)) continue;

        const src = readFileSync(file, 'utf8');
        for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE, SIDE_EFFECT_IMPORT_RE]) {
            for (const match of src.matchAll(re)) {
                // A type-only statement is erased at build time, so its edge
                // does not exist in the browser. See TYPE_ONLY_STATEMENT_RE.
                if (TYPE_ONLY_STATEMENT_RE.test(match[0])) continue;

                const target = resolveSpecifier(match[1] as string, file);
                if (target === null) continue;
                if (target === undefined) {
                    unresolved.push(`${relative(REPO_ROOT, file)} -> ${match[1]}`);
                    continue;
                }
                if (!modules.has(target)) queue.push(target);
            }
        }
    }

    return { modules, unresolved };
}

/**
 * Every browser module's entry point, for the full client graph: each `.tsx`
 * under `components/` plus every module of the client workspace packages.
 *
 * @returns Absolute entry paths.
 */
export function allIslandEntries(): string[] {
    return [
        ...walk(join(WEB_SRC, 'components')).filter((f) => f.endsWith('.tsx')),
        ...CLIENT_PACKAGE_ROOTS.flatMap(([, root]) =>
            walk(join(REPO_ROOT, root)).filter((f) => /\.tsx?$/.test(f))
        )
    ].filter((f) => !isTestFile(f));
}

/** Removes block comments and whole-line `//` comments. */
export const stripTsComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Every key prefix, `depth` segments at most, a set of modules can name.
 *
 * Matches any string literal whose head is a known namespace — NOT only
 * literals inside a `t()` call. Keys routinely live in a data structure first
 * (`config/navigation.ts`, tour steps, filter definitions) and reach `t()`
 * through a variable, so a call-site-only scan would miss them.
 *
 * A template literal contributes only the part before its first `${`, so
 * `` `host.miniForm.types.${v}` `` yields `host.miniForm` and covers the whole
 * subtree beneath it. That is the most that can be claimed without guessing.
 *
 * @param modules - Modules to scan.
 * @param depth - Maximum segments per prefix (2 for the client list, 3 for the
 *   critical one).
 * @returns Each prefix mapped to up to three repo-relative files that name it.
 */
export function prefixesNameableFrom(
    modules: ReadonlySet<string>,
    depth = 2
): Map<string, string[]> {
    const found = new Map<string, string[]>();
    const literal = /['"`]([A-Za-z0-9_-]+)\.([A-Za-z0-9_.$-]*)/g;
    for (const file of modules) {
        if (!/\.tsx?$/.test(file)) continue;
        const src = stripTsComments(readFileSync(file, 'utf8'));
        for (const match of src.matchAll(literal)) {
            const ns = match[1] as string;
            if (!ALL_NAMESPACES.has(ns)) continue;
            // Cut at the first interpolation, then keep at most `depth` segments.
            const rest = ((match[2] as string).split('$')[0] as string)
                .split('.')
                .filter(Boolean)
                .slice(0, depth - 1);
            const prefix = [ns, ...rest].join('.');
            const list = found.get(prefix) ?? [];
            const rel = relative(REPO_ROOT, file);
            if (list.length < 3 && !list.includes(rel)) list.push(rel);
            found.set(prefix, list);
        }
    }
    return found;
}

/** True when some declared prefix equals `key` or is an ancestor of it. */
export function isCovered(key: string, declared: readonly string[]): boolean {
    return declared.some((p) => key === p || key.startsWith(`${p}.`));
}

/** One `<Component client:x>` occurrence in an `.astro` template. */
export interface IslandUsage {
    /** Repo-relative path of the `.astro` file. */
    readonly file: string;
    /** The tag name as written (`UserMenu`, `Foo.Bar`). */
    readonly tag: string;
    /** The directive after `client:`. */
    readonly directive: string;
    /** The component module on disk; `undefined` when it did not resolve. */
    readonly module: string | undefined;
}

/**
 * Splits an `.astro` source at its frontmatter fence (`---` on line 1 and the
 * next line that is exactly `---`).
 */
function splitAstroSource(source: string): { frontmatter: string; template: string } {
    const lines = source.split('\n');
    if (lines[0]?.trim() !== '---') return { frontmatter: '', template: source };
    for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trimEnd() === '---') {
            return {
                frontmatter: lines.slice(1, i).join('\n'),
                template: lines.slice(i + 1).join('\n')
            };
        }
    }
    return { frontmatter: '', template: source };
}

/**
 * Maps every local binding the frontmatter imports to its specifier:
 * `import Foo from 'x'`, `import { A, B as C } from 'y'`.
 */
function importBindings(frontmatter: string): Map<string, string> {
    const out = new Map<string, string>();
    const code = stripTsComments(frontmatter);
    const re = /import\s+(?!type\s)([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;
    for (const match of code.matchAll(re)) {
        const clause = match[1] as string;
        const spec = match[2] as string;
        const named = /\{([\s\S]*)\}/.exec(clause);
        const defaultPart = clause
            .replace(/\{[\s\S]*\}/, '')
            .replace(/,/g, ' ')
            .trim();
        if (defaultPart && /^[A-Za-z_$][\w$]*$/.test(defaultPart)) out.set(defaultPart, spec);
        if (named) {
            for (const raw of (named[1] as string).split(',')) {
                const part = raw.replace(/^\s*type\s+/, '').trim();
                if (!part) continue;
                const alias = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(part);
                out.set(alias ? (alias[1] as string) : part, spec);
            }
        }
    }
    return out;
}

/**
 * Finds every island usage (`<Component client:directive …>`) in the web app's
 * `.astro` files, with the component module it hydrates.
 *
 * HTML comments, `<script>`/`<style>` bodies and `{/* … *\/}` expression
 * comments are removed first: several layouts DESCRIBE `client:load` in prose.
 * The owning tag is the nearest `<Capitalized` before the directive, which is
 * where Astro requires a hydration directive to sit.
 *
 * @returns Every usage, unresolved ones included (the caller must fail on them).
 */
export function collectIslandUsages(): IslandUsage[] {
    const usages: IslandUsage[] = [];
    for (const file of walk(WEB_SRC).filter((f) => f.endsWith('.astro'))) {
        const { frontmatter, template } = splitAstroSource(readFileSync(file, 'utf8'));
        const bindings = importBindings(frontmatter);
        const markup = template
            .replace(/<!--[\s\S]*?-->/g, '')
            // Self-closing first: `<script is:inline set:html={…} />` has no
            // closing tag, and a paired match would run on to the NEXT
            // `</script>`, swallowing every island in between.
            .replace(/<(?:script|style)\b[^>]*\/>/g, '')
            .replace(/<script\b[\s\S]*?<\/script>/g, '')
            .replace(/<style\b[\s\S]*?<\/style>/g, '')
            .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
        for (const match of markup.matchAll(/\bclient:([a-z]+)\b/g)) {
            const before = markup.slice(0, match.index);
            const tags = [...before.matchAll(/<([A-Z][\w.]*)/g)];
            const tag = tags.at(-1)?.[1] ?? '';
            const spec = bindings.get(tag.split('.')[0] ?? '');
            const module = spec ? (resolveSpecifier(spec, file) ?? undefined) : undefined;
            usages.push({
                file: relative(REPO_ROOT, file),
                tag,
                directive: match[1] as string,
                module
            });
        }
    }
    return usages;
}
