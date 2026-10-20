/**
 * AC:B1:2, the package's own side: the payments package depends on no app and
 * on no legacy billing library, may depend on internal `@repo/*` packages, and
 * absorbs no table (it declares no schema and depends on no database layer).
 *
 * The repo-wide side (no `package.json` declares the legacy library, and a
 * from-scratch database holds none of its tables) is TEST:B1:2 in
 * `packages/db/test/integration/payments-absorbs-no-table-from-empty.test.ts`;
 * the static guard over the whole tree is G16 (TEST:B1:10).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');

/** The legacy billing library's scope, built in parts so no guard trips on this file. */
const LEGACY_SCOPE = ['@qazuor', 'qzpay'].join('/');

/** Database layers whose presence would mean the package absorbs a table or a model. */
const DATABASE_LAYERS = ['@repo/db', 'drizzle-orm', 'drizzle-kit', 'pg', 'postgres'] as const;

const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as Record<
    string,
    Record<string, string> | string | undefined
>;

/** Every dependency name across the four dependency blocks. */
const dependencyNames = (
    ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
).flatMap((block) => Object.keys((manifest[block] as Record<string, string> | undefined) ?? {}));

/** Names of the app packages, read from `apps/*`. */
const appNames = readdirSync(join(REPO_ROOT, 'apps'))
    .map((dir) => join(REPO_ROOT, 'apps', dir, 'package.json'))
    .filter((file) => {
        try {
            return statSync(file).isFile();
        } catch {
            return false;
        }
    })
    .map((file) => (JSON.parse(readFileSync(file, 'utf8')) as { name: string }).name);

/** Every source file of the package. */
function sourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory()
            ? sourceFiles({ dir: full })
            : name.endsWith('.ts')
              ? [full]
              : [];
    });
}

describe('@repo/payments package boundary', () => {
    it('reads the app package names it must not depend on', () => {
        expect(appNames).toContain('hospeda-api');
    });

    it('declares no app as a dependency', () => {
        for (const app of appNames) expect(dependencyNames, app).not.toContain(app);
    });

    it('declares no package of the legacy billing library', () => {
        expect(dependencyNames.filter((name) => name.startsWith(LEGACY_SCOPE))).toEqual([]);
    });

    it('depends on nothing outside zod, its build tooling and internal @repo/* packages', () => {
        const external = dependencyNames.filter((name) => !name.startsWith('@repo/'));
        expect(external.sort()).toEqual(
            ['@types/node', '@vitest/coverage-v8', 'tsup', 'typescript', 'vitest', 'zod'].sort()
        );
    });

    it('absorbs no table: no database layer, no table definition', () => {
        for (const layer of DATABASE_LAYERS) expect(dependencyNames, layer).not.toContain(layer);
        for (const file of sourceFiles({ dir: join(PACKAGE_ROOT, 'src') })) {
            expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bpgTable\s*\(/);
        }
    });
});
