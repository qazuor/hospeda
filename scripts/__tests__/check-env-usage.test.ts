/**
 * @file check-env-usage.test.ts
 * @description Fixture-driven unit tests for the `pnpm env:check:usage`
 * scanner (HOS-79 T-007). Covers AC-1 (unregistered `process.env.X` usage
 * fails, naming file:line) via in-memory fixtures — no real filesystem
 * scanning, so these tests never depend on the state of the real tree.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ENV_REGISTRY } from '../../packages/config/src/env-registry.js';
import {
    PLATFORM_ENV_ALLOWLIST,
    blankBlockComments,
    diffUsageAgainstRegistry,
    extractEnvUsages,
    findSourceFiles
} from '../check-env-usage.js';

describe('blankBlockComments', () => {
    it('should blank out block-comment contents while preserving line count', () => {
        // Arrange
        const source = ['/**', ' * process.env.SOME_DOC_ONLY_VAR', ' */', 'const x = 1;'].join(
            '\n'
        );

        // Act
        const result = blankBlockComments(source);

        // Assert
        expect(result.split('\n')).toHaveLength(4);
        expect(result).not.toContain('process.env.SOME_DOC_ONLY_VAR');
        expect(result).toContain('const x = 1;');
    });

    it('should leave code outside block comments untouched', () => {
        // Arrange
        const source = 'const a = process.env.REAL_VAR;';

        // Act
        const result = blankBlockComments(source);

        // Assert
        expect(result).toBe(source);
    });
});

describe('extractEnvUsages', () => {
    it('should extract a dot-access process.env read with its line number', () => {
        // Arrange
        const content = ['const port = process.env.HOSPEDA_API_URL;', "const x = 'noop';"].join(
            '\n'
        );

        // Act
        const usages = extractEnvUsages({ content, filePath: 'apps/api/src/fake.ts' });

        // Assert
        expect(usages).toEqual([
            { name: 'HOSPEDA_API_URL', file: 'apps/api/src/fake.ts', line: 1 }
        ]);
    });

    it('should extract bracket-access reads with single and double quotes', () => {
        // Arrange
        const content = [
            "const a = process.env['HOSPEDA_FOO'];",
            'const b = process.env["HOSPEDA_BAR"];'
        ].join('\n');

        // Act
        const usages = extractEnvUsages({ content, filePath: 'x.ts' });

        // Assert
        expect(usages.map((u) => u.name)).toEqual(['HOSPEDA_FOO', 'HOSPEDA_BAR']);
        expect(usages[0]?.line).toBe(1);
        expect(usages[1]?.line).toBe(2);
    });

    it('should ignore process.env mentions inside JSDoc block comments', () => {
        // Arrange — mirrors the real false positive found in env-registry.mobile.ts
        const content = [
            '/**',
            ' * @example',
            ' * ```ts',
            ' * process.env.EXPO_PUBLIC_API_URL',
            ' * ```',
            ' */',
            'export const real = process.env.HOSPEDA_REAL_VAR;'
        ].join('\n');

        // Act
        const usages = extractEnvUsages({ content, filePath: 'x.ts' });

        // Assert
        expect(usages).toHaveLength(1);
        expect(usages[0]?.name).toBe('HOSPEDA_REAL_VAR');
    });

    it('should extract multiple usages of the same name from different lines', () => {
        // Arrange
        const content = [
            'if (process.env.NODE_ENV === "production") {',
            '  console.log(process.env.NODE_ENV);',
            '}'
        ].join('\n');

        // Act
        const usages = extractEnvUsages({ content, filePath: 'x.ts' });

        // Assert
        expect(usages).toHaveLength(2);
        expect(usages[0]?.line).toBe(1);
        expect(usages[1]?.line).toBe(2);
    });

    it('should return an empty array for content with no process.env reads', () => {
        // Arrange
        const content = 'export const noop = () => 1;';

        // Act
        const usages = extractEnvUsages({ content, filePath: 'x.ts' });

        // Assert
        expect(usages).toEqual([]);
    });
});

describe('diffUsageAgainstRegistry', () => {
    it('should pass a registered usage through as neither unregistered nor missing', () => {
        // Arrange
        const usages = [{ name: 'HOSPEDA_REGISTERED', file: 'a.ts', line: 1 }];
        const registryNames = new Set(['HOSPEDA_REGISTERED']);

        // Act
        const result = diffUsageAgainstRegistry({ usages, registryNames });

        // Assert
        expect(result.unregistered).toEqual([]);
    });

    it('should fail (AC-1) an unregistered usage, naming file:line', () => {
        // Arrange
        const usages = [
            { name: 'HOSPEDA_REGISTERED', file: 'a.ts', line: 1 },
            { name: 'HOSPEDA_NOT_REGISTERED', file: 'b.ts', line: 42 }
        ];
        const registryNames = new Set(['HOSPEDA_REGISTERED']);

        // Act
        const result = diffUsageAgainstRegistry({ usages, registryNames });

        // Assert
        expect(result.unregistered).toEqual([
            { name: 'HOSPEDA_NOT_REGISTERED', file: 'b.ts', line: 42 }
        ]);
    });

    it('should NOT fail a usage whose name is in the allowlist', () => {
        // Arrange
        const usages = [{ name: 'SOME_PLATFORM_VAR', file: 'a.ts', line: 1 }];
        const registryNames = new Set<string>();
        const allowlist = new Set(['SOME_PLATFORM_VAR']);

        // Act
        const result = diffUsageAgainstRegistry({ usages, registryNames, allowlist });

        // Assert
        expect(result.unregistered).toEqual([]);
    });

    it('should default to the real PLATFORM_ENV_ALLOWLIST when none is passed', () => {
        // Arrange — the real allowlist is intentionally empty as of HOS-79
        const usages = [{ name: 'HOSPEDA_NOT_REGISTERED', file: 'a.ts', line: 1 }];
        const registryNames = new Set<string>();

        // Act
        const result = diffUsageAgainstRegistry({ usages, registryNames });

        // Assert
        expect(PLATFORM_ENV_ALLOWLIST.size).toBe(0);
        expect(result.unregistered).toHaveLength(1);
    });

    it('should list registry names never observed as phantom, non-failing', () => {
        // Arrange
        const usages = [{ name: 'HOSPEDA_USED', file: 'a.ts', line: 1 }];
        const registryNames = new Set(['HOSPEDA_USED', 'HOSPEDA_UNUSED']);

        // Act
        const result = diffUsageAgainstRegistry({ usages, registryNames });

        // Assert
        expect(result.phantom).toEqual(['HOSPEDA_UNUSED']);
        expect(result.unregistered).toEqual([]);
    });

    it('should demonstrate the red-then-green regression shape for the 3 known-missing vars (AC-1)', () => {
        // Arrange — "before": registry lacks the 3 vars this spec's motivating bug found
        const usages = [
            { name: 'HOSPEDA_TAG_USER_QUOTA_PER_USER', file: 'tag.service.ts', line: 241 },
            { name: 'HOSPEDA_DEPLOY_ENV', file: 'environment.ts', line: 43 },
            { name: 'HOSPEDA_QZPAY_TEST_CONTROL_ENABLED', file: 'qzpay-test-control.ts', line: 77 }
        ];
        const registryWithoutThem = new Set<string>();
        const registryWithThem = new Set([
            'HOSPEDA_TAG_USER_QUOTA_PER_USER',
            'HOSPEDA_DEPLOY_ENV',
            'HOSPEDA_QZPAY_TEST_CONTROL_ENABLED'
        ]);

        // Act
        const before = diffUsageAgainstRegistry({ usages, registryNames: registryWithoutThem });
        const after = diffUsageAgainstRegistry({ usages, registryNames: registryWithThem });

        // Assert
        expect(before.unregistered).toHaveLength(3);
        expect(after.unregistered).toHaveLength(0);
    });
});

describe('AC-1 regression against the REAL registry (HOS-79 T-020)', () => {
    it('does not flag the 3 vars whose missing registration motivated this spec', () => {
        // Arrange — unlike the synthetic red/green case above, this runs the
        // scanner diff against the ACTUAL ENV_REGISTRY. Removing any of these
        // three from packages/config regresses this test, closing AC-1 end to
        // end at the scanner layer (not just the registry-presence layer).
        const knownPreviouslyMissing = [
            'HOSPEDA_TAG_USER_QUOTA_PER_USER',
            'HOSPEDA_DEPLOY_ENV',
            'HOSPEDA_QZPAY_TEST_CONTROL_ENABLED'
        ];
        const usages = knownPreviouslyMissing.map((name, index) => ({
            name,
            file: 'regression-fixture.ts',
            line: index + 1
        }));
        const registryNames = new Set(ENV_REGISTRY.map((entry) => entry.name));

        // Act
        const result = diffUsageAgainstRegistry({ usages, registryNames });

        // Assert — all three now resolve; none reported as unregistered.
        expect(result.unregistered).toEqual([]);
    });
});

describe('findSourceFiles', () => {
    const createdDirs: string[] = [];

    afterEach(() => {
        for (const dir of createdDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('should find .ts/.tsx files under apps/*/src and packages/*/src, excluding test/dist/docs/scripts dirs', () => {
        // Arrange
        const rootDir = mkdtempSync(join(tmpdir(), 'hos79-usage-scan-'));
        createdDirs.push(rootDir);

        const included = join(rootDir, 'apps/demo/src/real-file.ts');
        const excludedTest = join(rootDir, 'apps/demo/src/test/fixture.ts');
        const excludedDunderTest = join(rootDir, 'apps/demo/src/__tests__/spec.ts');
        const excludedDocs = join(rootDir, 'packages/demo-pkg/src/docs/example.ts');
        const excludedScripts = join(rootDir, 'packages/demo-pkg/src/scripts/one-off.ts');

        for (const filePath of [
            included,
            excludedTest,
            excludedDunderTest,
            excludedDocs,
            excludedScripts
        ]) {
            mkdirSync(join(filePath, '..'), { recursive: true });
            writeFileSync(filePath, 'export const x = 1;');
        }

        // Act
        const files = findSourceFiles({ rootDir });

        // Assert
        expect(files).toEqual([included]);
    });
});
