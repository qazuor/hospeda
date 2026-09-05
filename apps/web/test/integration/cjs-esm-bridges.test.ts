/**
 * @file cjs-esm-bridges.test.ts
 * @description Guard against the HOS-370 class of production outage.
 *
 * A CommonJS package that depends on an ESM-only package forces Node 22 down the
 * `require(esm)` path, which links the ESM subgraph synchronously. When that link
 * happens mid-traffic (from a lazily loaded route chunk) it can race an
 * `import()` of the same subgraph and throw
 * `request for './<file>.js' is from a module not been linked`. Node caches the
 * rejected chunk, so the affected route serves 500s until the process restarts.
 *
 * Every such bridge reachable from this app must be handled in one of two ways:
 *
 *  1. Bundled — listed in `ssr.noExternal` in `astro.config.mjs`. Preferred: the
 *     bundler resolves the CommonJS -> ESM interop at build time, so no
 *     `require(esm)` exists at runtime at all.
 *  2. Warmed — imported by `src/lib/warm-cjs-esm-bridges.ts`, which the server
 *     entry pulls in so the link happens during single-threaded boot.
 *
 * This test discovers bridges from the *installed dependency tree* rather than
 * from a hardcoded list, so a dependency bump that introduces a new one fails CI
 * instead of failing in production.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = resolve(__dirname, '../..');
const REPO_ROOT = resolve(APP_DIR, '../..');
const NODE_MODULES = 'node_modules';
const STORE = join(REPO_ROOT, NODE_MODULES, '.pnpm');

interface PackageManifest {
    readonly name?: string;
    readonly version?: string;
    readonly type?: string;
    readonly main?: string;
    readonly exports?: unknown;
    readonly dependencies?: Record<string, string>;
}

interface Bridge {
    /** The CommonJS package whose `require()` triggers `require(esm)`. */
    readonly from: string;
    /** The ESM-only package being required. */
    readonly to: string;
}

/**
 * Extracts the package name a pnpm store directory belongs to.
 *
 * Store directory names are `<name>@<version>` with `/` encoded as `+`, plus an
 * optional `_<peer>@<version>` suffix chain. Splitting on the LAST `@` is wrong
 * and was a real bug here: `better-auth@1.4.2_react@19.2.7` yielded
 * `better-auth@1.4.2_react`, so `better-auth`'s dependencies never entered the
 * index and the `@better-auth/utils` bridge was invisible to this guard.
 * The name always ends at the first `@` after position 0 (position 0 belongs to
 * the `@scope` prefix).
 */
function ownerOfStoreDir(storeDir: string): string {
    const versionAt = storeDir.indexOf('@', 1);
    const name = versionAt === -1 ? storeDir : storeDir.slice(0, versionAt);
    return name.replace(/\+/g, '/');
}

function readManifest(dir: string): PackageManifest | null {
    try {
        return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageManifest;
    } catch {
        return null;
    }
}

/**
 * A package is ESM-only when it declares `"type": "module"` and exposes no
 * CommonJS entry point — neither a `main` pointing at a CommonJS artifact nor a
 * `require` condition in `exports`.
 */
function isEsmOnly(manifest: PackageManifest | null): boolean {
    if (!manifest || manifest.type !== 'module') return false;

    const main = manifest.main ?? '';
    if (/(^|\/)(commonjs|cjs)\//.test(main)) return false;
    if (main.endsWith('.cjs')) return false;

    if (manifest.exports && typeof manifest.exports === 'object') {
        const serialized = JSON.stringify(manifest.exports);
        if (serialized.includes('"require"')) return false;
        if (/commonjs|\.cjs/.test(serialized)) return false;
    }

    return true;
}

/** A package is CommonJS unless it explicitly declares `"type": "module"`. */
function isCommonJs(manifest: PackageManifest | null): boolean {
    return manifest !== null && manifest.type !== 'module';
}

/**
 * Walks the pnpm store and returns every CommonJS -> ESM-only dependency edge.
 *
 * Each store directory owns exactly one package; its siblings under
 * `node_modules/` are that package's resolved dependencies, which is what makes
 * per-package resolution (rather than a flat hoisted guess) possible here.
 */
function findBridges(): readonly Bridge[] {
    const bridges: Bridge[] = [];

    for (const storeDir of readdirSync(STORE)) {
        if (storeDir.startsWith('.')) continue;

        // `foo@1.2.3` / `@scope+bar@1.2.3(peer@1)` -> `foo` / `@scope/bar`
        const owner = ownerOfStoreDir(storeDir);
        const depsDir = join(STORE, storeDir, NODE_MODULES);

        const ownerManifest = readManifest(join(depsDir, owner));
        if (!isCommonJs(ownerManifest)) continue;

        for (const dep of Object.keys(ownerManifest?.dependencies ?? {})) {
            if (isEsmOnly(readManifest(join(depsDir, dep)))) {
                bridges.push({ from: owner, to: dep });
            }
        }
    }

    return bridges;
}

/** Packages `astro.config.mjs` bundles into the SSR output. */
function readBundledPackages(): readonly string[] {
    const config = readFileSync(join(APP_DIR, 'astro.config.mjs'), 'utf8');
    const block = config.match(/noExternal:\s*\[([^\]]*)\]/);
    if (!block) return [];
    return [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

/**
 * Packages listed in `ssr.optimizeDeps.include` — the ones esbuild pre-bundles
 * for the DEV server's SSR graph.
 *
 * Read from the slice of the config that follows `noExternal:`, because
 * `astro.config.mjs` carries a second, unrelated `optimizeDeps` for the CLIENT
 * graph earlier in the file; matching the first occurrence would read the wrong
 * list and quietly compare against client entries.
 *
 * Unlike `readBundledPackages`, a failure to locate the block THROWS instead of
 * returning `[]`. A guard whose extraction silently yields nothing reports every
 * package as missing or as present depending on which side it lands on, and
 * either way it stops describing reality — so the parse failing must be loud.
 */
function readSsrPrebundledPackages(): readonly string[] {
    const config = readFileSync(join(APP_DIR, 'astro.config.mjs'), 'utf8');
    const ssrSlice = config.slice(config.indexOf('noExternal:'));
    if (!ssrSlice) {
        throw new Error('cjs-esm-bridges guard: no `noExternal:` found in astro.config.mjs');
    }

    const block = ssrSlice.match(/optimizeDeps:\s*\{\s*include:\s*\[([^\]]*)\]/);
    if (!block) {
        throw new Error(
            'cjs-esm-bridges guard: no `ssr.optimizeDeps.include` found after `noExternal:` in astro.config.mjs'
        );
    }

    return [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

/** Packages `src/lib/warm-cjs-esm-bridges.ts` links at boot. */
function readWarmedPackages(): readonly string[] {
    const source = readFileSync(join(APP_DIR, 'src/lib/warm-cjs-esm-bridges.ts'), 'utf8');
    return [...source.matchAll(/^import\s+['"]([^'"]+)['"];/gm)].map((match) => match[1]);
}

/**
 * Index of every package name in the store to the dependency names it declares,
 * merged across versions.
 *
 * Merging by name over-approximates: if two versions of a package are installed
 * and only one pulls a given dependency, both are treated as pulling it. That is
 * deliberate — this guard must fail closed. An over-approximation produces a
 * false positive that a human resolves once, in a review; an under-approximation
 * produces a silent production outage, which is the failure this whole file
 * exists to prevent.
 */
function buildDependencyIndex(): ReadonlyMap<string, ReadonlySet<string>> {
    const index = new Map<string, Set<string>>();

    for (const storeDir of readdirSync(STORE)) {
        if (storeDir.startsWith('.')) continue;
        const owner = ownerOfStoreDir(storeDir);
        const manifest = readManifest(join(STORE, storeDir, NODE_MODULES, owner));
        if (!manifest) continue;

        const deps = index.get(owner) ?? new Set<string>();
        for (const dep of Object.keys(manifest.dependencies ?? {})) deps.add(dep);
        index.set(owner, deps);
    }

    return index;
}

const DEPENDENCY_INDEX = buildDependencyIndex();

/** Expands a set of package names to its transitive closure, roots included. */
function closureOf(roots: Iterable<string>): ReadonlySet<string> {
    const closure = new Set<string>(roots);
    const queue = [...closure];

    while (queue.length > 0) {
        const current = queue.pop() as string;
        for (const dep of DEPENDENCY_INDEX.get(current) ?? []) {
            if (closure.has(dep)) continue;
            closure.add(dep);
            queue.push(dep);
        }
    }

    return closure;
}

/**
 * Every package this app can reach at runtime, transitively.
 *
 * Seeded from `apps/web`'s runtime `dependencies` (never `devDependencies` —
 * those do not ship in the server bundle), walking into `@repo/*` workspace
 * manifests, then expanded to a fixed point.
 *
 * Walking only DIRECT dependencies is not sufficient and was an early bug in
 * this guard: the `better-auth` bridge is owned by `@better-auth/utils`, a
 * transitive package, so a direct-only check let it through while reporting
 * green.
 */
function readAppReachablePackages(): ReadonlySet<string> {
    const seeds = new Set<string>();

    const seed = (packageJsonPath: string): void => {
        const manifest = readManifest(resolve(packageJsonPath, '..'));
        for (const dep of Object.keys(manifest?.dependencies ?? {})) {
            if (seeds.has(dep)) continue;
            seeds.add(dep);
            if (dep.startsWith('@repo/')) {
                seed(join(REPO_ROOT, 'packages', dep.replace('@repo/', ''), 'package.json'));
            }
        }
    };

    seed(join(APP_DIR, 'package.json'));
    return closureOf(seeds);
}

/**
 * Bridges present in the dependency graph but proven not to execute inside the
 * SSR server.
 *
 * ## The only accepted evidence
 *
 * The package does not appear as an external import in the BUILT server output.
 * Re-verify with:
 *
 * ```sh
 * pnpm --filter hospeda-web build
 * grep -rE "from ['\"]<package>" apps/web/dist/server
 * ```
 *
 * A package absent from `dist/server` cannot be linked at runtime, so its bridge
 * cannot take the server down. A package present there is live regardless of how
 * unlikely its code path looks.
 *
 * "It has never broken" is NOT evidence. The sanitize-html bridge had never
 * broken either — until it took production down for an hour. Reasoning about
 * whether a route "probably" loads a package is also not evidence; the build
 * output is.
 */
const INERT_BRIDGES: Readonly<Record<string, string>> = {
    // Build tooling (Vite/Astro CSS target resolution). Absent from dist/server.
    browserslist: 'build-time only — resolves CSS targets during `astro build`',
    // Drizzle's migration CLI, pulled in by `@repo/db` for the `db:*` scripts.
    // The server never imports it. Absent from dist/server.
    'drizzle-kit': 'CLI only — invoked by database scripts, not by the server',
    // Nitro/unstorage HTTP layer. Reachable through Astro's session storage
    // dependency chain, but Astro bundles what it needs into the entry rather
    // than importing h3 externally. Absent from dist/server.
    h3: 'bundled into the Astro entry by the adapter — never an external import',
    // Backs Astro's filesystem session driver. Same situation as h3: bundled by
    // Astro, not externally imported. Absent from dist/server.
    unstorage: 'bundled into the Astro entry by the adapter — never an external import'
};

describe('CommonJS -> ESM-only dependency bridges (HOS-370)', () => {
    const bridges = findBridges();
    const bundled = readBundledPackages();
    const warmed = readWarmedPackages();
    const reachable = readAppReachablePackages();

    it('discovers bridges from the installed tree (guard is not vacuous)', () => {
        // If this ever hits zero the discovery logic has silently broken — every
        // assertion below would then pass without checking anything.
        expect(bridges.length).toBeGreaterThan(0);
    });

    it('still detects the sanitize-html -> htmlparser2 bridge that caused the outage', () => {
        // The concrete edge from the production incident. Its presence proves the
        // detector recognises the exact shape that took destination pages down.
        expect(bridges).toContainEqual({ from: 'sanitize-html', to: 'htmlparser2' });
    });

    it('classifies a known dual-build package as NOT ESM-only', () => {
        // `entities@4.5.0` ships both builds. Misclassifying dual packages as
        // ESM-only would flood this guard with false positives.
        const dual = readManifest(join(STORE, 'entities@4.5.0', NODE_MODULES, 'entities'));
        expect(dual).not.toBeNull();
        expect(isEsmOnly(dual)).toBe(false);
    });

    it('reaches transitive packages, not just direct dependencies', () => {
        // `@better-auth/utils` owns a bridge and is only reachable transitively
        // (via `better-auth`). An early version of this guard walked direct
        // dependencies only and therefore reported green while that bridge was
        // completely unhandled.
        expect(reachable.has('better-auth')).toBe(true);
        expect(reachable.has('@better-auth/utils')).toBe(true);
    });

    it('handles every bridge reachable from this app', () => {
        // Bundling or warming a package also covers every bridge owned by the
        // packages it pulls in — importing `better-auth` at boot is what links
        // the `@better-auth/utils` -> `@noble/hashes` bridge, even though the
        // warm list never names `@better-auth/utils` itself.
        const handled = closureOf([...bundled, ...warmed]);

        const unhandled = bridges
            .filter((bridge) => reachable.has(bridge.from))
            .filter((bridge) => !(bridge.from in INERT_BRIDGES))
            .filter((bridge) => !handled.has(bridge.from))
            .map((bridge) => `${bridge.from} requires ESM-only ${bridge.to}`);

        expect(
            unhandled,
            [
                'New CommonJS -> ESM-only bridge(s) reachable from apps/web.',
                'Each one can 500 a route in production after a deploy (HOS-370).',
                'Fix by either:',
                '  1. adding the CommonJS package to `ssr.noExternal` in astro.config.mjs (preferred), or',
                '  2. importing it from src/lib/warm-cjs-esm-bridges.ts.',
                `Unhandled: ${unhandled.join(', ')}`
            ].join('\n')
        ).toEqual([]);
    });

    it('keeps the entry wired to the warm-up module', () => {
        // The warm-up only works while the server ENTRY imports it. If middleware
        // stops referencing it, the module leaves the entry chunk and the bridges
        // silently go back to being linked mid-traffic.
        const middleware = readFileSync(join(APP_DIR, 'src/middleware.ts'), 'utf8');
        expect(middleware).toContain('warm-cjs-esm-bridges');
        expect(middleware).toContain('CJS_ESM_BRIDGES_WARMED');
    });

    it('pre-bundles every bundled package for the dev server too (HOS-1166)', () => {
        // `ssr.noExternal` fixes the BUILD: Rollup resolves the CommonJS -> ESM
        // interop while bundling, so no `require()` survives into the server chunk.
        // The dev server never bundles — it runs each package through
        // `ssrTransform`, which rewrites ESM syntax but leaves `require` calls
        // intact, so a CommonJS package executes as ESM and throws
        // `ReferenceError: require is not defined` on the first line that calls it.
        //
        // That is not a corner case: it took down EVERY detail page of the site in
        // dev for over a month while production stayed healthy and this very file
        // passed, because listing `noExternal` was believed to be the whole fix.
        //
        // Both lists must therefore carry the same packages: `noExternal` for the
        // build, `ssr.optimizeDeps.include` for dev.
        const bundled = readBundledPackages();
        const prebundled = readSsrPrebundledPackages();

        // Guard the guard: if the extraction ever reads an empty list, the
        // comparison below passes for the wrong reason.
        expect(bundled.length, 'no packages read from ssr.noExternal').toBeGreaterThan(0);

        const missing = bundled.filter((pkg) => !prebundled.includes(pkg));

        expect(
            missing,
            `These packages are in \`ssr.noExternal\` but not in \`ssr.optimizeDeps.include\`: ${missing.join(', ')}. ` +
                'The production build is fine and the dev server will answer 500 on every page that imports them. ' +
                'Add them to `ssr.optimizeDeps.include` in astro.config.mjs.'
        ).toEqual([]);
    });
});
