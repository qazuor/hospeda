/**
 * Static guard: the `addon-lifecycle.service.ts` barrel and every module it
 * re-exports must not construct anything at module level (HOS-847 PR 6).
 *
 * ## Why this guard exists
 *
 * `addon-lifecycle.service.ts` is a barrel: it re-exports symbols from sibling
 * modules, so importing it for ANY one symbol evaluates ALL of them. When one of
 * those modules held a bare `const svc = new AddonCatalogService()` in its body,
 * that constructor ran on every import of the barrel — including from suites
 * that only wanted an unrelated function.
 *
 * The failure mode is nasty in three specific ways, which is why a comment was
 * not enough:
 *
 * 1. It surfaces on the IMPORT, never on the behaviour under test, so the test
 *    that breaks is not the test that is wrong.
 * 2. The stack names the barrel — a file the failing suite does not knowingly
 *    use — so the obvious next step (read the failing test's imports) leads
 *    nowhere.
 * 3. It only fires for suites whose `vi.mock('@repo/service-core')` happens not
 *    to name that class, so it is invisible until an unrelated PR widens who
 *    reaches the chain. HOS-847 PR 6 was that PR: the constructors predated it,
 *    the red shard did not.
 *
 * Fixing it one module per CI round cost three rounds, because each fix moved
 * the failure to the next constructor in the chain rather than removing the
 * class of defect. This guard removes the class.
 *
 * ## What it checks, exactly
 *
 * For the barrel and each module it re-exports: no top-level `const`/`let`/`var`
 * binding is initialised with `new X(...)`, where `X` is anything other than the
 * built-in containers listed in {@link INERT_CONSTRUCTORS}. Those are allowed
 * because constructing them cannot depend on a module mock — they are what
 * module-level lookup tables are legitimately made of.
 *
 * Indentation is the discriminator: a constructor INSIDE a function is indented,
 * and is fine, because it runs when called rather than when imported. The lazy
 * `getX()` accessors this guard pushes you towards are exactly that.
 *
 * The re-export list is READ FROM THE BARREL, never hardcoded, so a fourth
 * re-export added later is covered without touching this file.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SERVICES_DIR = resolve(import.meta.dirname, '../../src/services');
const BARREL = join(SERVICES_DIR, 'addon-lifecycle.service.ts');

/**
 * Constructors that are safe to evaluate at import time: built-in containers
 * whose construction cannot fail because of a module mock. Anything else — a
 * service, a client, a class imported from a workspace package — is the pattern
 * this guard rejects.
 */
const INERT_CONSTRUCTORS: ReadonlySet<string> = new Set([
    'Map',
    'Set',
    'WeakMap',
    'WeakSet',
    'Date',
    'RegExp',
    'Error',
    'URL',
    'Array',
    'Object',
    'Int32Array',
    'Uint8Array',
    'TextEncoder',
    'TextDecoder',
    'AbortController'
]);

/**
 * Matches a TOP-LEVEL binding initialised with `new X(`.
 *
 * Anchored at the start of the line on purpose: that is what separates a
 * constructor that runs on import from one that runs inside a function. An
 * optional `export ` is accepted so `export const svc = new Foo()` cannot slip
 * past by adding a keyword.
 */
const TOP_LEVEL_NEW = /^(?:export\s+)?(?:const|let|var)\s+\w+(?::[^=]+)?\s*=\s*new\s+(\w+)\s*\(/gm;

/**
 * Reads the modules a barrel re-exports from, resolved to absolute paths.
 *
 * Only relative specifiers are followed: a re-export from a package is that
 * package's problem, not this chain's.
 *
 * @param barrelPath - Absolute path of the barrel file.
 * @returns Absolute paths of the sibling modules it re-exports from.
 */
function readReExportedModules(barrelPath: string): readonly string[] {
    const source = readFileSync(barrelPath, 'utf8');
    const specifiers = [...source.matchAll(/^export\s+.*?\bfrom\s+'(\.[^']+)'/gm)].map(
        (match) => match[1] as string
    );

    return [
        ...new Set(
            specifiers.map((specifier) =>
                join(dirname(barrelPath), specifier.replace(/\.js$/, '.ts'))
            )
        )
    ];
}

/**
 * Finds top-level constructions of non-inert classes in one file.
 *
 * @param filePath - Absolute path of the module to scan.
 * @returns One entry per offending construction, with its 1-based line number.
 */
function findImportTimeConstructions(
    filePath: string
): readonly { readonly className: string; readonly line: number }[] {
    const source = readFileSync(filePath, 'utf8');

    return [...source.matchAll(TOP_LEVEL_NEW)]
        .filter((match) => !INERT_CONSTRUCTORS.has(match[1] as string))
        .map((match) => ({
            className: match[1] as string,
            line: source.slice(0, match.index).split('\n').length
        }));
}

describe('addon-lifecycle barrel — no construction at import time (HOS-847 PR 6)', () => {
    const modules = [BARREL, ...readReExportedModules(BARREL)];

    it('reads the re-export list from the barrel rather than a hardcoded one', () => {
        // Sanity check on the discovery itself: a guard whose input silently
        // becomes empty passes forever while checking nothing.
        expect(modules.length).toBeGreaterThan(1);
    });

    it.each(modules)('%s constructs nothing at module level', (modulePath) => {
        const offenders = findImportTimeConstructions(modulePath);

        expect(
            offenders,
            offenders.length === 0
                ? ''
                : `${modulePath} constructs ${offenders
                      .map((o) => `\`new ${o.className}()\` (line ${o.line})`)
                      .join(', ')} in its module body. This module is in the ` +
                      '`addon-lifecycle.service.ts` re-export chain, so that runs on every ' +
                      'import of the barrel and throws in any suite whose module mock does ' +
                      'not name the class — failing on the import rather than on the ' +
                      'behaviour. Build it on first use instead:\n\n' +
                      '    let svc: Foo | undefined;\n' +
                      '    const getSvc = (): Foo => {\n' +
                      '        svc ??= new Foo();\n' +
                      '        return svc;\n' +
                      '    };\n'
        ).toEqual([]);
    });
});
