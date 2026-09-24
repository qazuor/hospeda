/**
 * Unit tests for the Radix single-focus-scope guard (HOS-80).
 *
 * These pin the guard's PREDICATE, not the repository's current state. The
 * repo-wide run is the CI step; this is what stops the predicate from quietly
 * becoming unable to fail.
 *
 * Both directions matter:
 *
 *  - Too loose: missing a split that only shows up TRANSITIVELY (the #3365
 *    shape: admin declares one Dialog, and a dependency of a dependency pulls
 *    in another focus-scope), or one reached through a workspace `link:`.
 *  - Too strict: failing on a copy that admin cannot reach. `apps/mobile`
 *    carries an older focus-scope through `vaul` → `@expo/ui`, and a guard that
 *    trips on it gets disabled.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    bareVersion,
    findSplits,
    parseLockfile,
    run,
    scanTree
} from '../check-radix-single-focus-scope.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PEERS = '(@types/react@19.2.17)(react@19.2.7)';

/** An importer block: `deps` maps a dependency name to its version reference. */
function importer(path: string, deps: Record<string, string>): string {
    const lines = [`  ${path}:`, '    dependencies:'];
    for (const [name, ref] of Object.entries(deps)) {
        lines.push(
            `      '${name}':`,
            `        specifier: ^${bareVersion({ ref })}`,
            `        version: ${ref}`
        );
    }
    return lines.join('\n');
}

/** A snapshot block: `key` is `name@ref`, `deps` its dependency edges. */
function snapshot(key: string, deps: Record<string, string> = {}): string {
    const entries = Object.entries(deps);
    if (entries.length === 0) return `  '${key}': {}`;
    return [
        `  '${key}':`,
        '    dependencies:',
        ...entries.map(([name, ref]) => `      '${name}': ${ref}`)
    ].join('\n');
}

/** Assembles a lockfile from importer and snapshot blocks. */
function lockfile(importers: readonly string[], snapshots: readonly string[]): string {
    return [
        "lockfileVersion: '9.0'",
        '',
        'importers:',
        '',
        ...importers,
        '',
        'packages:',
        '',
        "  '@radix-ui/react-focus-scope@1.1.16':",
        '    resolution: {integrity: sha512-x}',
        '',
        'snapshots:',
        '',
        ...snapshots,
        ''
    ].join('\n');
}

/** Admin's Dialog and Select, each pulling the given focus-scope version. */
function adminTree({
    dialogScope,
    selectScope
}: {
    readonly dialogScope: string;
    readonly selectScope: string;
}): string {
    return lockfile(
        [
            importer('apps/admin', {
                '@radix-ui/react-dialog': `1.1.23${PEERS}`,
                '@radix-ui/react-select': `2.3.7${PEERS}`
            })
        ],
        [
            snapshot(`@radix-ui/react-dialog@1.1.23${PEERS}`, {
                '@radix-ui/react-focus-scope': `${dialogScope}${PEERS}`
            }),
            snapshot(`@radix-ui/react-select@2.3.7${PEERS}`, {
                '@radix-ui/react-focus-scope': `${selectScope}${PEERS}`
            }),
            snapshot(`@radix-ui/react-focus-scope@${dialogScope}${PEERS}`),
            snapshot(`@radix-ui/react-focus-scope@${selectScope}${PEERS}`)
        ]
    );
}

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    vi.restoreAllMocks();
});

/** Writes `text` as pnpm-lock.yaml in a throwaway root and returns the root. */
function rootWith(text: string | null): string {
    const root = mkdtempSync(join(tmpdir(), 'hos80-radix-'));
    dirs.push(root);
    if (text !== null) writeFileSync(join(root, 'pnpm-lock.yaml'), text, 'utf-8');
    return root;
}

/** Runs the CLI against `text` with console output silenced. */
function runOn(text: string | null): number {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    return run({ root: rootWith(text) });
}

/** Versions of focus-scope the walk reached, sorted. */
function focusScopeVersions(text: string, rootImporter?: string): string[] {
    const scan = scanTree({ lockfile: parseLockfile({ text }), rootImporter });
    return [...(scan.versions.get('@radix-ui/react-focus-scope') ?? [])].sort();
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

describe('bareVersion', () => {
    it('strips every peer-dependency suffix', () => {
        // Arrange
        const ref = `1.1.16${PEERS}`;

        // Act
        const version = bareVersion({ ref });

        // Assert
        expect(version).toBe('1.1.16');
    });

    it('returns a reference without peers unchanged', () => {
        expect(bareVersion({ ref: '1.1.16' })).toBe('1.1.16');
    });
});

describe('parseLockfile', () => {
    it('reads importer versions and snapshot edges, unquoting scoped names', () => {
        // Arrange
        const text = adminTree({ dialogScope: '1.1.16', selectScope: '1.1.16' });

        // Act
        const parsed = parseLockfile({ text });

        // Assert
        expect(parsed.importers.get('apps/admin')?.get('@radix-ui/react-dialog')).toBe(
            `1.1.23${PEERS}`
        );
        expect(
            parsed.snapshots
                .get(`@radix-ui/react-dialog@1.1.23${PEERS}`)
                ?.get('@radix-ui/react-focus-scope')
        ).toBe(`1.1.16${PEERS}`);
    });

    it('does not mistake the packages section for snapshot edges', () => {
        // Arrange
        const text = adminTree({ dialogScope: '1.1.16', selectScope: '1.1.16' });

        // Act
        const parsed = parseLockfile({ text });

        // Assert: the `resolution:` line under packages is not an edge anywhere.
        expect(parsed.snapshots.has('@radix-ui/react-focus-scope@1.1.16')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// The predicate
// ---------------------------------------------------------------------------

describe('scanTree + findSplits', () => {
    it('passes when Dialog and Select share one focus-scope', () => {
        // Arrange
        const text = adminTree({ dialogScope: '1.1.16', selectScope: '1.1.16' });

        // Act
        const scan = scanTree({ lockfile: parseLockfile({ text }) });

        // Assert
        expect(findSplits({ scan })).toEqual([]);
        expect(focusScopeVersions(text)).toEqual(['1.1.16']);
    });

    it('fails on the #3365 shape: a transitive split under two direct deps', () => {
        // Arrange
        const text = adminTree({ dialogScope: '1.1.12', selectScope: '1.1.7' });

        // Act
        const splits = findSplits({ scan: scanTree({ lockfile: parseLockfile({ text }) }) });

        // Assert
        expect(splits).toEqual([
            { name: '@radix-ui/react-focus-scope', versions: ['1.1.12', '1.1.7'] }
        ]);
    });

    it('follows workspace link: dependencies into their importer', () => {
        // Arrange: admin's own Dialog is fine; a workspace package it links to
        // brings a second focus-scope.
        const text = lockfile(
            [
                importer('apps/admin', {
                    '@radix-ui/react-dialog': `1.1.23${PEERS}`,
                    '@repo/ui': 'link:../../packages/ui'
                }),
                importer('packages/ui', { '@radix-ui/react-select': `2.2.6${PEERS}` })
            ],
            [
                snapshot(`@radix-ui/react-dialog@1.1.23${PEERS}`, {
                    '@radix-ui/react-focus-scope': `1.1.16${PEERS}`
                }),
                snapshot(`@radix-ui/react-select@2.2.6${PEERS}`, {
                    '@radix-ui/react-focus-scope': `1.1.7${PEERS}`
                })
            ]
        );

        // Act
        const versions = focusScopeVersions(text);

        // Assert
        expect(versions).toEqual(['1.1.16', '1.1.7']);
    });

    it('ignores a copy that only an unrelated importer can reach (mobile via vaul)', () => {
        // Arrange
        const text = lockfile(
            [
                importer('apps/admin', { '@radix-ui/react-dialog': `1.1.23${PEERS}` }),
                importer('apps/mobile', { vaul: `1.1.2${PEERS}` })
            ],
            [
                snapshot(`@radix-ui/react-dialog@1.1.23${PEERS}`, {
                    '@radix-ui/react-focus-scope': `1.1.16${PEERS}`
                }),
                snapshot(`vaul@1.1.2${PEERS}`, {
                    '@radix-ui/react-dialog': `1.1.19${PEERS}`
                }),
                snapshot(`@radix-ui/react-dialog@1.1.19${PEERS}`, {
                    '@radix-ui/react-focus-scope': `1.1.12${PEERS}`
                })
            ]
        );

        // Act
        const adminVersions = focusScopeVersions(text);
        const mobileVersions = focusScopeVersions(text, 'apps/mobile');

        // Assert: the walk is scoped, and the fixture really does hold the old copy.
        expect(adminVersions).toEqual(['1.1.16']);
        expect(mobileVersions).toEqual(['1.1.12']);
    });

    it('reports the importer as missing instead of walking nothing', () => {
        // Arrange
        const text = lockfile([importer('apps/web', {})], []);

        // Act
        const scan = scanTree({ lockfile: parseLockfile({ text }) });

        // Assert
        expect(scan.importerFound).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// CLI, including the self-checks that keep it from passing blind
// ---------------------------------------------------------------------------

describe('run', () => {
    it('exits 0 on a converged tree', () => {
        expect(runOn(adminTree({ dialogScope: '1.1.16', selectScope: '1.1.16' }))).toBe(0);
    });

    it('exits 1 on a split tree', () => {
        expect(runOn(adminTree({ dialogScope: '1.1.12', selectScope: '1.1.7' }))).toBe(1);
    });

    it('exits 1 naming the missing importer when apps/admin is not in the lockfile', () => {
        // Arrange
        const text = lockfile([importer('apps/web', {})], []);

        // Act
        const code = runOn(text);

        // Assert: the sentinel check would also exit 1 here, so pin the message
        // too, or a lost importer check would point at the wrong cause.
        expect(code).toBe(1);
        expect(vi.mocked(console.error).mock.calls.flat().join('\n')).toContain(
            "importer 'apps/admin' is not in pnpm-lock.yaml"
        );
    });

    it('exits 1 when the walk never reaches focus-scope', () => {
        // Arrange: a tree with no Radix overlay at all must not read as clean.
        const text = lockfile([importer('apps/admin', { zod: '4.4.3' })], [snapshot('zod@4.4.3')]);

        // Act + Assert
        expect(runOn(text)).toBe(1);
    });

    it('exits 1 when pnpm-lock.yaml is missing', () => {
        expect(runOn(null)).toBe(1);
    });
});
