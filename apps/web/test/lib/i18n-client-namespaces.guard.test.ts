/**
 * @file i18n-client-namespaces.guard.test.ts
 * @description Keeps `CLIENT_I18N_NAMESPACES` equal to what browser code can
 * actually name, by recomputing it from the real import graph (HOS-369 W3-2).
 *
 * Why a guard rather than review: the failure mode is silent and
 * production-only. A namespace missing from the shipped asset does not throw —
 * `resolve()` in `src/lib/i18n.ts` renders the call site's inline fallback when
 * it has one, and otherwise **the raw key text**, since `[MISSING: …]` is
 * emitted only under `import.meta.env.DEV`. A wrong list therefore looks
 * correct in dev, in `astro check`, and in every component test, and ships
 * `account.profile.title` to a user.
 *
 * The graph is walked CONSERVATIVELY, because the two error directions are not
 * symmetric: over-including a namespace costs bytes, under-including it corrupts
 * a page. So every `.tsx` under `components/` counts as an island entry point,
 * and an import that cannot be resolved FAILS the test instead of quietly
 * truncating the graph — an unexplored subgraph is exactly how a namespace gets
 * misreported as unreachable.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { namespaces } from '@repo/i18n/web';
import { describe, expect, it } from 'vitest';
import {
    CLIENT_I18N_KEY_PREFIXES,
    EXTERNAL_I18N_KEY_PREFIXES
} from '../../src/lib/i18n-client-namespaces';

const REPO_ROOT = resolvePath(__dirname, '../../../..');
const WEB_SRC = join(REPO_ROOT, 'apps/web/src');

/** Workspace packages whose modules are bundled into the browser build. */
const CLIENT_PACKAGE_ROOTS: ReadonlyArray<readonly [string, string]> = [
    ['@repo/auth-ui', 'packages/auth-ui/src'],
    ['@repo/feedback', 'packages/feedback/src']
];

const ALL_NAMESPACES: ReadonlySet<string> = new Set(namespaces as readonly string[]);

function walk(dir: string, out: string[] = []): string[] {
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

const isTestFile = (f: string): boolean => /\.test\.tsx?$/.test(f) || f.includes('__tests__');

/**
 * Resolves an import specifier to a file on disk.
 *
 * @returns The resolved path; `null` when the specifier is external (node_modules
 *   or a workspace package that does not ship to the browser); `undefined` when
 *   it looked like ours but did not resolve — which the caller must treat as a
 *   failure, never as "external".
 */
function resolveSpecifier(spec: string, fromFile: string): string | null | undefined {
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
    // A CSS module or other asset import is legitimately not a TS module.
    if (/\.(css|svg|png|jpe?g|webp|json)$/.test(spec)) return null;
    return undefined;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]{0,400}?from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const SIDE_EFFECT_IMPORT_RE = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

interface GraphResult {
    readonly modules: ReadonlySet<string>;
    readonly unresolved: readonly string[];
}

/** Walks every module the browser can reach, starting from the island entries. */
function buildClientGraph(): GraphResult {
    const entries = [
        ...walk(join(WEB_SRC, 'components')).filter((f) => f.endsWith('.tsx')),
        ...CLIENT_PACKAGE_ROOTS.flatMap(([, root]) =>
            walk(join(REPO_ROOT, root)).filter((f) => /\.tsx?$/.test(f))
        )
    ].filter((f) => !isTestFile(f));

    const modules = new Set<string>();
    const unresolved: string[] = [];
    const queue = [...entries];

    while (queue.length > 0) {
        const file = queue.pop() as string;
        if (modules.has(file)) continue;
        modules.add(file);
        if (!/\.tsx?$/.test(file)) continue;

        const src = readFileSync(file, 'utf8');
        for (const re of [IMPORT_RE, DYNAMIC_IMPORT_RE, SIDE_EFFECT_IMPORT_RE]) {
            for (const match of src.matchAll(re)) {
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

const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Every two-segment key prefix a reachable module can name.
 *
 * Matches any string literal whose head is a known namespace — NOT only
 * literals inside a `t()` call. Keys routinely live in a data structure first
 * (`config/navigation.ts`, tour steps, filter definitions) and reach `t()`
 * through a variable, so a call-site-only scan would miss them.
 *
 * A template literal contributes only the part before its first `${`, so
 * `` `host.miniForm.types.${v}` `` yields `host.miniForm` and covers the whole
 * subtree beneath it. That is the most that can be claimed without guessing.
 */
function prefixesNameableFrom(modules: ReadonlySet<string>): Map<string, string[]> {
    const found = new Map<string, string[]>();
    const literal = /['"`]([A-Za-z0-9_-]+)\.([A-Za-z0-9_.$-]*)/g;
    for (const file of modules) {
        if (!/\.tsx?$/.test(file)) continue;
        const src = stripComments(readFileSync(file, 'utf8'));
        for (const match of src.matchAll(literal)) {
            const ns = match[1] as string;
            if (!ALL_NAMESPACES.has(ns)) continue;
            // Cut at the first interpolation, then keep at most two segments.
            const rest = (match[2] as string).split('$')[0] as string;
            const second = rest.split('.')[0] ?? '';
            const prefix = second ? `${ns}.${second}` : ns;
            const list = found.get(prefix) ?? [];
            const rel = relative(REPO_ROOT, file);
            if (list.length < 3 && !list.includes(rel)) list.push(rel);
            found.set(prefix, list);
        }
    }
    return found;
}

/** True when some declared prefix equals `key` or is an ancestor of it. */
function isCovered(key: string, declared: readonly string[]): boolean {
    return declared.some((p) => key === p || key.startsWith(`${p}.`));
}

describe('HOS-369 W3-2 — client i18n key prefixes', () => {
    const graph = buildClientGraph();
    const nameable = prefixesNameableFrom(graph.modules);
    const declared = [...CLIENT_I18N_KEY_PREFIXES] as string[];

    it('resolves every import in the client graph', () => {
        // An unresolved import truncates the graph, and a truncated graph is how
        // a prefix gets reported unreachable when it is not. Fail loudly.
        expect(graph.unresolved, `unresolved imports:\n${graph.unresolved.join('\n')}`).toEqual([]);
        expect(graph.modules.size).toBeGreaterThan(400);
    });

    it('ships every prefix browser code can name', () => {
        const missing = [...nameable.entries()]
            .filter(([prefix]) => !isCovered(prefix, declared))
            .map(([prefix, files]) => `${prefix}  (named in ${files.join(', ')})`);

        expect(
            missing,
            'These prefixes are reachable from the browser but are NOT covered by ' +
                `CLIENT_I18N_KEY_PREFIXES, so their keys would render as raw key ` +
                `text in production:\n${missing.join('\n')}`
        ).toEqual([]);
    });

    it('ships no prefix the browser cannot reach', () => {
        const nameableKeys = [...nameable.keys()];
        const dead = declared.filter(
            (p) =>
                !nameableKeys.some((n) => n === p || n.startsWith(`${p}.`) || p.startsWith(`${n}.`))
        );

        expect(
            dead,
            'These prefixes are declared but no client-reachable module names ' +
                `them — they are download weight for every visitor:\n${dead.join('\n')}`
        ).toEqual([]);
    });

    it('declares only real namespaces', () => {
        const unknown = declared
            .map((p) => (p.includes('.') ? p.slice(0, p.indexOf('.')) : p))
            .filter((ns) => !ALL_NAMESPACES.has(ns));
        expect(unknown, `not present in @repo/i18n/web: ${unknown.join(', ')}`).toEqual([]);
    });

    describe('external prefixes — key paths no scan of apps/web can see', () => {
        // Each EXTERNAL entry exists because a package builds the key. If that
        // code path is ever removed or renamed, the entry becomes dead weight
        // and nobody would notice — so assert the path itself still exists.
        it('common.apiError is still built inside @repo/i18n', () => {
            const src = readFileSync(join(REPO_ROOT, 'packages/i18n/src/api-errors.ts'), 'utf8');
            expect(EXTERNAL_I18N_KEY_PREFIXES).toContain('common.apiError');
            expect(src, 'api-errors.ts no longer builds common.apiError.* keys').toContain(
                'common.apiError.'
            );
        });

        it('validation is still fed from @repo/schemas at runtime', () => {
            const src = readFileSync(
                join(REPO_ROOT, 'apps/web/src/lib/forms/field-errors.ts'),
                'utf8'
            );
            // resolveValidationMessage rewrites zodError.X -> validation.X, so
            // the whole namespace stays reachable from PUBLIC forms.
            expect(src).toContain('resolveValidationMessage');
            expect(declared).toContain('validation');
        });
    });
});
