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
 * ## Scope: the TRANSITIVE chain, not one level (HOS-847 PR 7b)
 *
 * The first version read only the barrel's own re-export list, which is not the
 * set of modules an import of the barrel evaluates. A re-exported module's own
 * `import` statements are evaluated too, and PR 7a put `addon-soft-cancel.ts`
 * exactly there — reachable through
 * `addon-lifecycle-cancellation.service.ts`, invisible to a depth-1 walk. So the
 * graph is now followed transitively (imports AND re-exports), stopping at the
 * `src/services` directory boundary; see {@link collectChain} for why the
 * boundary is where it is.
 *
 * ## What it checks, exactly
 *
 * For every module in that chain: no top-level `const`/`let`/`var`
 * binding is initialised with `new X(...)`, where `X` is anything other than the
 * built-in containers listed in {@link INERT_CONSTRUCTORS}. Those are allowed
 * because constructing them cannot depend on a module mock — they are what
 * module-level lookup tables are legitimately made of.
 *
 * Indentation is the discriminator: a constructor INSIDE a function is indented,
 * and is fine, because it runs when called rather than when imported. The lazy
 * `getX()` accessors this guard pushes you towards are exactly that.
 *
 * The chain is DISCOVERED from the source, never hardcoded, so a module added to
 * it later is covered without touching this file.
 */

import { existsSync, readFileSync } from 'node:fs';
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
 * Reads every relative specifier a module imports or re-exports from, resolved
 * to absolute `.ts` paths.
 *
 * Both directions matter and only one used to be read. A re-export evaluates the
 * target, and so does a plain `import` — so a barrel that re-exports A, where A
 * imports B, evaluates B on every import of the barrel just the same.
 *
 * Package specifiers are not followed: a construction inside a workspace package
 * is that package's problem, not this chain's.
 *
 * @param modulePath - Absolute path of the module to read.
 * @returns Absolute paths of the sibling modules it pulls in.
 */
function readRelativeDependencies(modulePath: string): readonly string[] {
    const source = readFileSync(modulePath, 'utf8');
    const specifiers = [
        ...source.matchAll(/^(?:import|export)\s+[\s\S]*?\bfrom\s+'(\.[^']+)'/gm)
    ].map((match) => match[1] as string);

    return [
        ...new Set(
            specifiers.map((specifier) =>
                join(dirname(modulePath), specifier.replace(/\.js$/, '.ts'))
            )
        )
    ];
}

/**
 * Walks the barrel's relative dependency graph transitively, stopping at the
 * `src/services` directory boundary.
 *
 * **Why the boundary, and why it is not an escape hatch.** The chain leaves
 * `src/services` in exactly one place: `addon-lifecycle-cancellation.service.ts`
 * imports `clearEntitlementCache` from `../middlewares/entitlement`, and that
 * module constructs a `PlanService` in its body. That construction predates
 * HOS-847 by a long way, every suite in this chain mocks the middleware whole,
 * and un-picking it is a change to the entitlement middleware with its own
 * blast radius — not something to smuggle in under an add-on guard. The
 * boundary is a directory, not a list of forgiven files, so nothing can be
 * quietly added to it.
 *
 * Cycles are expected (the modules re-export back through the barrel) and the
 * visited set handles them.
 *
 * @param barrelPath - Absolute path of the barrel file.
 * @returns The barrel plus every `src/services` module reachable from it.
 */
function collectChain(barrelPath: string): readonly string[] {
    const visited = new Set<string>();
    const queue = [barrelPath];

    while (queue.length > 0) {
        const current = queue.shift() as string;
        if (visited.has(current) || !existsSync(current)) {
            continue;
        }
        visited.add(current);

        for (const dependency of readRelativeDependencies(current)) {
            if (dependency.startsWith(`${SERVICES_DIR}/`) && !visited.has(dependency)) {
                queue.push(dependency);
            }
        }
    }

    return [...visited];
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
    const modules = collectChain(BARREL);

    it('walks the chain TRANSITIVELY, not one level (anti-vacuity)', () => {
        // A guard whose input silently becomes empty passes forever while
        // checking nothing, and one that stops at depth 1 checks a third of what
        // it claims to. `addon-soft-cancel.ts` is the proof: HOS-847 PR 7a put
        // it in the chain through `addon-lifecycle-cancellation.service.ts`, and
        // the one-level version could not see it. Named rather than counted so
        // a MOVED module reads as a deliberate change.
        expect(modules.length).toBeGreaterThan(1);
        expect(modules).toContain(join(SERVICES_DIR, 'addon-lifecycle-cancellation.service.ts'));
        expect(modules).toContain(join(SERVICES_DIR, 'addon-soft-cancel.ts'));
        expect(modules).toContain(join(SERVICES_DIR, 'addon-preapproval-cancel.ts'));
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
