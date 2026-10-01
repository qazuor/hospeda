/**
 * @file better-auth-expo-bundled.guard.test.ts
 * @description Keeps `@better-auth/expo` BUNDLED into the API instead of shipped
 * as a runtime dependency (HOS-418).
 *
 * `@better-auth/expo` declares `expo-constants`, `expo-linking`, `expo-network`
 * and `expo-web-browser` as OPTIONAL peers. `apps/mobile` installs all four, so
 * pnpm also resolves them for `apps/api`, and `pnpm deploy --prod` (the API
 * Dockerfile) then shipped expo -> react-native -> metro inside the production
 * image. None of it ever ran: the plugin's server entry imports no `expo-*`
 * module (only its `client` entry does). But metro pins `image-size@1.2.1`,
 * which carries two high DoS advisories (GHSA-w3rx-r6r6-pgpr,
 * GHSA-5p2g-fcmc-qvqq) that have no 1.x fix.
 *
 * Declaring the plugin as a devDependency makes tsup bundle its server entry
 * (tsup externalises `dependencies`, `peerDependencies` and
 * `optionalDependencies`, never `devDependencies`), so the deployed image no
 * longer carries the expo tree at all. Four changes would silently undo that,
 * and each one still typechecks, builds and passes every auth test:
 *
 * 1. Declaring the plugin in any externalised manifest section — the expo tree
 *    returns to the image and to `pnpm audit --prod`.
 * 2. Adding it to tsup's `external` option — the bundle then requires it at
 *    runtime from a `node_modules` that `pnpm deploy --prod` no longer fills,
 *    and the API crashes at boot in production only.
 * 3. Importing `@better-auth/expo/client` from server code — the bundle would
 *    pull in `expo-constants` and `expo-linking`.
 * 4. A plugin release whose SERVER entry starts importing `expo-*` — the
 *    bundle would inline it. The plugin is pinned exact, so this only happens
 *    on a deliberate bump, and the last test here catches it on that bump.
 *
 * Bundling a second copy of `@better-auth/core` is safe: better-auth keeps its
 * shared context on `globalThis[Symbol.for('better-auth:global')]` precisely so
 * that duplicated module instances share it, and the plugin imports `APIError`
 * from the external `better-auth/api`, so error identity stays single. Keep the
 * plugin's exact pin in step with `better-auth`'s version: a bundled core from a
 * different release would share that global with a mismatched runtime.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = join(__dirname, '../..');
const PLUGIN = '@better-auth/expo';

/** Manifest sections tsup treats as external. */
const EXTERNALISED_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;

type Manifest = Readonly<
    Partial<
        Record<
            (typeof EXTERNALISED_SECTIONS)[number] | 'devDependencies',
            Readonly<Record<string, string>>
        >
    >
>;

/**
 * Reads the API's package.json.
 */
function readManifest(): Manifest {
    return JSON.parse(readFileSync(join(API_ROOT, 'package.json'), 'utf-8')) as Manifest;
}

/**
 * Removes block and line comments, so a bracket or a package name inside a
 * comment can neither truncate nor satisfy the parsing below.
 *
 * A comment only counts when it opens at the start of a line or after
 * whitespace, `,` or `[`. That keeps `/*` inside a glob string
 * (`'src/**\/*.ts'`) and `//` inside a URL from swallowing real config.
 */
function stripComments({ source }: { readonly source: string }): string {
    return source.replace(/(^|[\s,[])\/\*[\s\S]*?\*\//g, '$1').replace(/(^|[\s,[])\/\/.*$/gm, '$1');
}

/**
 * Reads tsup.config.ts without comments and returns the body of its `external`
 * array, matched by bracket depth rather than by the first `]`.
 */
function readTsupConfig(): { readonly source: string; readonly external: string } {
    const source = stripComments({
        source: readFileSync(join(API_ROOT, 'tsup.config.ts'), 'utf-8')
    });
    const start = source.search(/\bexternal:\s*\[/);
    expect(start, 'tsup `external` array not found — did the config move?').toBeGreaterThan(-1);

    const open = source.indexOf('[', start);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '[') depth++;
        if (source[i] === ']') depth--;
        if (depth === 0) return { source, external: source.slice(open + 1, i) };
    }
    throw new Error('tsup `external` array is not closed');
}

/**
 * Lists every .ts/.tsx file under a directory, recursively.
 */
function listSourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return listSourceFiles({ dir: path });
        return /\.tsx?$/.test(entry) ? [path] : [];
    });
}

/**
 * Collects the bare module specifiers imported by a JS file and by every file
 * it reaches through relative imports (the plugin splits its entry into chunks).
 */
function collectBareImports({
    file,
    seen = new Set<string>()
}: {
    readonly file: string;
    readonly seen?: Set<string>;
}): readonly string[] {
    if (seen.has(file)) return [];
    seen.add(file);

    const source = readFileSync(file, 'utf-8');
    const specifiers = [
        ...source.matchAll(
            /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g
        )
    ].map((match) => match[1] ?? '');

    return specifiers.flatMap((specifier) =>
        specifier.startsWith('.')
            ? collectBareImports({ file: resolve(dirname(file), specifier), seen })
            : [specifier]
    );
}

describe('@better-auth/expo stays bundled into the API (HOS-418)', () => {
    it('is declared only as a devDependency, in no section tsup externalises', () => {
        const manifest = readManifest();

        for (const section of EXTERNALISED_SECTIONS) {
            expect(manifest[section]?.[PLUGIN], `found in ${section}`).toBeUndefined();
        }
        expect(manifest.devDependencies?.[PLUGIN]).toBeDefined();
    });

    it('is not externalised by tsup', () => {
        const { source, external } = readTsupConfig();

        // Control: a known entry, so a truncated block cannot pass vacuously.
        expect(external).toContain("'image-size'");
        // A string entry for the plugin or any subpath of it.
        expect(external).not.toMatch(/['"]@better-auth\/expo(\/[^'"]*)?['"]/);
        // A regex entry broad enough to catch it (e.g. /@better-auth\/.*/).
        expect(external).not.toMatch(/\/[^/\n]*better-auth[^/\n]*\//);
        // tsup's switch that externalises every package.
        expect(source).not.toMatch(/\bpackages:\s*['"]external['"]/);
    });

    it('is only imported through its server entry', () => {
        const offenders = listSourceFiles({ dir: join(API_ROOT, 'src') }).filter((file) =>
            /['"]@better-auth\/expo\/[^'"]+['"]/.test(readFileSync(file, 'utf-8'))
        );

        expect(offenders).toEqual([]);
    });

    it('has a server entry that imports no expo module, in the installed version', () => {
        const requireFromApi = createRequire(join(API_ROOT, 'package.json'));
        const isExpo = (specifier: string): boolean =>
            /^(expo|react-native)(-|\/|$)/.test(specifier);

        // Control: the client entry DOES import expo, so a parser that sees
        // nothing cannot pass the real assertion below vacuously.
        const clientImports = collectBareImports({
            file: requireFromApi.resolve(`${PLUGIN}/client`)
        });
        expect(clientImports).toContain('expo-constants');

        const serverImports = collectBareImports({ file: requireFromApi.resolve(PLUGIN) });
        expect(serverImports.filter(isExpo)).toEqual([]);
    });
});
