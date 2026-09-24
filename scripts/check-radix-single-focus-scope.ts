/**
 * @file check-radix-single-focus-scope.ts
 * @description HOS-80 — fails CI when the dependency tree of `apps/admin`
 * resolves more than one version of a Radix primitive that keeps shared state
 * at module level.
 *
 * ## What this is about
 *
 * `@radix-ui/react-focus-scope` keeps the stack of active focus traps in a
 * module-level variable. Two copies of the package mean two stacks that cannot
 * see each other. Open a Radix `Select` inside a Radix `Dialog` whose
 * focus-scope comes from the other copy, and each trap takes focus back from the
 * other forever. In the browser the tab hangs. Under jsdom the recursion grows
 * until V8 dies with `FatalProcessOutOfMemory`, which is how it surfaced: admin's
 * unit-test shard crashed on `PromoCodeFormDialog.test.tsx` in #2019 and again
 * in #3365. It was read as a memory ceiling for two months.
 *
 * #3365 did not bump Radix at all. Dependabot regenerated the lockfile for
 * unrelated dev dependencies and the `^` ranges moved `react-dialog` to a
 * version with a newer focus-scope, while `react-select` kept the old one.
 * Neither `package.json` nor the Dependabot `radix` group can see that; only
 * the resolved graph can.
 *
 * ## What it proves
 *
 * Walking the lockfile graph from the `apps/admin` importer (following
 * workspace `link:` dependencies into their own importers), each package in
 * {@link STATEFUL_PACKAGES} resolves to exactly one version.
 *
 * ## What it does not prove
 *
 * - Which version. A tree converged on an old focus-scope passes.
 * - Anything outside admin's tree. `apps/mobile` pulls an older copy through
 *   `vaul` → `@expo/ui`, and that is deliberately out of scope: it is not
 *   reachable from admin, so it cannot split admin's traps.
 * - It reads the lockfile, not `node_modules`.
 *
 * ## How to fix a failure
 *
 * Move the whole Radix family in `apps/admin/package.json` to the current
 * release set and reinstall with `CI=true pnpm install --no-frozen-lockfile`.
 * Do not pin a single package back with an override: that hides the split
 * until the next lockfile regeneration.
 *
 * @see https://linear.app/hospeda-beta/issue/HOS-80
 */

import { readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, resolved from this file's own location. */
export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The importer whose tree this guard polices. */
export const ROOT_IMPORTER = 'apps/admin';

/**
 * Radix packages whose correctness depends on a single module instance.
 *
 * - `react-focus-scope`: module-level stack of active focus traps.
 * - `react-focus-guards`: module-level counter of mounted guards.
 * - `react-dismissable-layer`: a context created at module level, so layers
 *   from two copies do not nest.
 */
export const STATEFUL_PACKAGES = [
    '@radix-ui/react-focus-scope',
    '@radix-ui/react-focus-guards',
    '@radix-ui/react-dismissable-layer'
] as const;

/** The package that must be reached at least once, or the walk went blind. */
const SENTINEL_PACKAGE = '@radix-ui/react-focus-scope';

/** One parsed lockfile: dependency edges of importers and of snapshots. */
export interface ParsedLockfile {
    /** Importer path → (dependency name → version reference). */
    readonly importers: ReadonlyMap<string, ReadonlyMap<string, string>>;
    /** Snapshot key (`name@version(peers)`) → (dependency name → version reference). */
    readonly snapshots: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

/** Sections of an importer or snapshot entry that hold real dependency edges. */
const EDGE_SECTIONS = new Set(['dependencies', 'devDependencies', 'optionalDependencies']);

/**
 * Removes the YAML single quotes pnpm puts around keys and values that start
 * with `@` or contain special characters.
 *
 * @param input - The raw token.
 * @returns The token without surrounding quotes.
 */
function unquote({ value }: { readonly value: string }): string {
    const trimmed = value.trim();
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
    return trimmed;
}

/**
 * Parses the `importers:` and `snapshots:` sections of a pnpm v9 lockfile.
 *
 * Line-based on purpose: the root workspace does not depend on a YAML parser,
 * and the two sections have a fixed shape. Importer entries are
 * `name:` followed by an indented `version:` line; snapshot entries are
 * `name: ref` on one line.
 *
 * @param input - The lockfile text.
 * @returns The dependency edges of every importer and snapshot.
 */
export function parseLockfile({ text }: { readonly text: string }): ParsedLockfile {
    const importers = new Map<string, Map<string, string>>();
    const snapshots = new Map<string, Map<string, string>>();

    let section: 'importers' | 'snapshots' | null = null;
    let entry: Map<string, string> | null = null;
    let inEdges = false;
    let pendingImporterDep: string | null = null;

    for (const line of text.split('\n')) {
        if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
        const indent = line.length - line.trimStart().length;

        if (indent === 0) {
            const top = line.replace(/:.*$/, '');
            section = top === 'importers' ? 'importers' : top === 'snapshots' ? 'snapshots' : null;
            entry = null;
            inEdges = false;
            continue;
        }
        if (section === null) continue;

        if (indent === 2) {
            const key = unquote({ value: line.trim().replace(/:\s*(\{\})?$/, '') });
            entry = new Map<string, string>();
            (section === 'importers' ? importers : snapshots).set(key, entry);
            inEdges = false;
            pendingImporterDep = null;
            continue;
        }
        if (entry === null) continue;

        if (indent === 4) {
            inEdges = EDGE_SECTIONS.has(line.trim().replace(/:$/, ''));
            pendingImporterDep = null;
            continue;
        }
        if (!inEdges) continue;

        if (section === 'snapshots' && indent === 6) {
            const separator = line.indexOf(': ');
            if (separator === -1) continue;
            const name = unquote({ value: line.slice(0, separator) });
            entry.set(name, unquote({ value: line.slice(separator + 2) }));
            continue;
        }
        if (section === 'importers') {
            if (indent === 6) {
                pendingImporterDep = unquote({ value: line.trim().replace(/:$/, '') });
            } else if (indent === 8 && pendingImporterDep !== null) {
                const match = /^version:\s*(.+)$/.exec(line.trim());
                if (match?.[1]) entry.set(pendingImporterDep, unquote({ value: match[1] }));
            }
        }
    }
    return { importers, snapshots };
}

/**
 * Strips the peer-dependency suffix from a version reference:
 * `1.1.16(@types/react@19.2.17)(react@19.2.7)` → `1.1.16`.
 *
 * @param input - The version reference.
 * @returns The bare version.
 */
export function bareVersion({ ref }: { readonly ref: string }): string {
    const paren = ref.indexOf('(');
    return paren === -1 ? ref : ref.slice(0, paren);
}

/** Outcome of walking one importer's tree. */
export interface TreeScan {
    /** Whether the root importer exists in the lockfile at all. */
    readonly importerFound: boolean;
    /** Number of distinct snapshot nodes visited. */
    readonly visitedNodes: number;
    /** For each stateful package, the bare versions reached. */
    readonly versions: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Walks every dependency reachable from `rootImporter`, following workspace
 * `link:` references into their own importers, and records the versions of the
 * {@link STATEFUL_PACKAGES} it reaches.
 *
 * @param input - The parsed lockfile and the importer to start from.
 * @returns What the walk found.
 */
export function scanTree({
    lockfile,
    rootImporter = ROOT_IMPORTER
}: {
    readonly lockfile: ParsedLockfile;
    readonly rootImporter?: string;
}): TreeScan {
    const versions = new Map<string, Set<string>>(
        STATEFUL_PACKAGES.map((name) => [name, new Set<string>()])
    );
    if (!lockfile.importers.has(rootImporter)) {
        return { importerFound: false, visitedNodes: 0, versions };
    }

    const seenImporters = new Set<string>();
    const seenSnapshots = new Set<string>();
    const importerQueue: string[] = [rootImporter];
    const snapshotQueue: string[] = [];

    const follow = ({
        name,
        ref,
        fromImporter
    }: {
        readonly name: string;
        readonly ref: string;
        readonly fromImporter: string | null;
    }): void => {
        if (ref.startsWith('link:')) {
            // Workspace links are only resolvable relative to an importer path.
            if (fromImporter !== null) {
                importerQueue.push(posix.normalize(posix.join(fromImporter, ref.slice(5))));
            }
            return;
        }
        versions.get(name)?.add(bareVersion({ ref }));
        snapshotQueue.push(`${name}@${ref}`);
    };

    while (importerQueue.length > 0 || snapshotQueue.length > 0) {
        const importer = importerQueue.pop();
        if (importer !== undefined) {
            if (seenImporters.has(importer)) continue;
            seenImporters.add(importer);
            for (const [name, ref] of lockfile.importers.get(importer) ?? []) {
                follow({ name, ref, fromImporter: importer });
            }
            continue;
        }
        const key = snapshotQueue.pop();
        if (key === undefined || seenSnapshots.has(key)) continue;
        seenSnapshots.add(key);
        for (const [name, ref] of lockfile.snapshots.get(key) ?? []) {
            follow({ name, ref, fromImporter: null });
        }
    }

    return { importerFound: true, visitedNodes: seenSnapshots.size, versions };
}

/**
 * Lists the stateful packages that resolve to more than one version.
 *
 * @param input - A tree scan.
 * @returns One entry per split package, versions sorted.
 */
export function findSplits({
    scan
}: {
    readonly scan: TreeScan;
}): readonly { readonly name: string; readonly versions: readonly string[] }[] {
    const splits: { name: string; versions: string[] }[] = [];
    for (const [name, found] of scan.versions) {
        if (found.size > 1) splits.push({ name, versions: [...found].sort() });
    }
    return splits;
}

/**
 * CLI entry point.
 *
 * @param input - Repository root (tests override it).
 * @returns Process exit code: 0 clean, 1 split or a self-check failure.
 */
export function run({ root = REPO_ROOT }: { readonly root?: string } = {}): number {
    let text: string;
    try {
        text = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf-8');
    } catch (error) {
        console.error(
            `check-radix-single-focus-scope: cannot read pnpm-lock.yaml under ${root} — ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return 1;
    }

    const scan = scanTree({ lockfile: parseLockfile({ text }) });

    // Self-checks first: a walk that reached nothing must not read as clean.
    if (!scan.importerFound) {
        console.error(
            `check-radix-single-focus-scope: SELF-CHECK FAILED — importer '${ROOT_IMPORTER}' is ` +
                'not in pnpm-lock.yaml. The app moved or the lockfile format changed; this is not a clean tree.'
        );
        return 1;
    }
    if ((scan.versions.get(SENTINEL_PACKAGE)?.size ?? 0) === 0) {
        console.error(
            `check-radix-single-focus-scope: SELF-CHECK FAILED — walked ${scan.visitedNodes} node(s) ` +
                `from '${ROOT_IMPORTER}' without reaching ${SENTINEL_PACKAGE}. Either admin no longer ` +
                'uses Radix overlays (then delete this guard) or the lockfile parser went blind.'
        );
        return 1;
    }

    const splits = findSplits({ scan });
    if (splits.length > 0) {
        console.error(
            `=== Radix primitive resolved to more than one version in ${ROOT_IMPORTER} (HOS-80) ===\n`
        );
        for (const split of splits) {
            console.error(`  ${split.name}: ${split.versions.join(', ')}`);
        }
        console.error(
            '\nEach copy keeps its own module-level state. Two focus-scope copies mean two stacks of\n' +
                'focus traps that cannot see each other: a Select inside a Dialog steals focus back and\n' +
                'forth forever. It hangs the browser tab and OOM-kills the vitest worker.\n\n' +
                'Move the whole Radix family in apps/admin/package.json to one release set and run\n' +
                '`CI=true pnpm install --no-frozen-lockfile`. Do not pin one package back with an override.\n'
        );
        return 1;
    }

    const summary = STATEFUL_PACKAGES.map(
        (name) =>
            `${name.replace('@radix-ui/react-', '')}@${[...(scan.versions.get(name) ?? [])].join('') || '—'}`
    ).join(', ');
    console.log(
        `check-radix-single-focus-scope: OK — ${scan.visitedNodes} node(s) walked from ` +
            `${ROOT_IMPORTER}, one version each: ${summary}.`
    );
    return 0;
}

// Only run when invoked directly, so the test file can import the predicates.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(run());
}
