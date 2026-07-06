/**
 * @file check-env-local.test.ts
 * @description Fixture-driven unit tests for the `pnpm env:check:local`
 * check (HOS-79 T-008). Covers AC-2 (an `'always'`-required var missing
 * from an app's `.env.local` fails, naming app+key; a `'production'`-scoped
 * var missing locally does NOT fail) plus the missing-file and
 * conditional/optional edge cases, all via in-memory fixtures.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { EnvVarDefinition } from '../../packages/config/src/env-registry-types.js';
import {
    findMissingAlwaysRequiredVars,
    isAlwaysRequired,
    readDotenvFile
} from '../check-env-local.js';

/** Minimal fixture builder for an EnvVarDefinition — fills in required fields with safe defaults. */
function buildEntry(overrides: Partial<EnvVarDefinition> & { name: string }): EnvVarDefinition {
    return {
        description: `Fixture entry for ${overrides.name}`,
        type: 'string',
        required: false,
        secret: false,
        exampleValue: 'example',
        apps: ['api'],
        category: 'fixture',
        ...overrides
    };
}

describe('isAlwaysRequired', () => {
    it('should be true when requiredScope is "always"', () => {
        expect(isAlwaysRequired(buildEntry({ name: 'A', requiredScope: 'always' }))).toBe(true);
    });

    it('should be true when required is true and requiredScope is omitted', () => {
        expect(isAlwaysRequired(buildEntry({ name: 'A', required: true }))).toBe(true);
    });

    it('should be false when requiredScope is "production"', () => {
        expect(
            isAlwaysRequired(
                buildEntry({ name: 'A', required: false, requiredScope: 'production' })
            )
        ).toBe(false);
    });

    it('should be false when requiredScope is "conditional"', () => {
        expect(
            isAlwaysRequired(
                buildEntry({ name: 'A', required: false, requiredScope: 'conditional' })
            )
        ).toBe(false);
    });

    it('should be false for a fully optional entry', () => {
        expect(isAlwaysRequired(buildEntry({ name: 'A', required: false }))).toBe(false);
    });
});

describe('findMissingAlwaysRequiredVars', () => {
    it('should NOT report a gap when an always-required var is present (pass case)', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_FOO', requiredScope: 'always', apps: ['api'] })
        ];
        const localValues = { HOSPEDA_FOO: 'value' };

        // Act
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([]);
    });

    it('should report a gap (AC-2) when an always-required var is missing, naming app+key', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_FOO', requiredScope: 'always', apps: ['api'] })
        ];
        const localValues = {};

        // Act
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([{ app: 'api', key: 'HOSPEDA_FOO' }]);
    });

    it('should treat an empty-string value as missing', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_FOO', requiredScope: 'always', apps: ['api'] })
        ];
        const localValues = { HOSPEDA_FOO: '' };

        // Act
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([{ app: 'api', key: 'HOSPEDA_FOO' }]);
    });

    it('should NOT fail (AC-2) when a production-scoped var is missing locally', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_PROD_ONLY', requiredScope: 'production', apps: ['api'] })
        ];
        const localValues = {};

        // Act
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([]);
    });

    it('should NOT fail when a conditional var is missing locally', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_CONDITIONAL', requiredScope: 'conditional', apps: ['api'] })
        ];
        const localValues = {};

        // Act
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([]);
    });

    it('should NOT fail when a fully optional var is missing locally', () => {
        // Arrange
        const registry = [buildEntry({ name: 'HOSPEDA_OPTIONAL', required: false, apps: ['api'] })];
        const localValues = {};

        // Act
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([]);
    });

    it('should ignore entries not scoped to the app being checked', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_WEB_ONLY', requiredScope: 'always', apps: ['web'] })
        ];
        const localValues = {};

        // Act
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([]);
    });
});

describe('readDotenvFile', () => {
    const createdDirs: string[] = [];

    afterEach(() => {
        for (const dir of createdDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('should parse a real dotenv-style file into key/value pairs', () => {
        // Arrange
        const dir = mkdtempSync(join(tmpdir(), 'hos79-local-check-'));
        createdDirs.push(dir);
        const filePath = join(dir, 'fixture.local');
        writeFileSync(filePath, 'HOSPEDA_FOO=bar\nHOSPEDA_BAZ=qux\n');

        // Act
        const values = readDotenvFile({ filePath });

        // Assert
        expect(values).toEqual({ HOSPEDA_FOO: 'bar', HOSPEDA_BAZ: 'qux' });
    });

    it('should return an empty object when the dotenv file is missing (never crash)', () => {
        // Arrange
        const missingPath = join(tmpdir(), 'hos79-does-not-exist', 'nope.local');

        // Act
        const values = readDotenvFile({ filePath: missingPath });

        // Assert
        expect(values).toEqual({});
    });
});

describe('end-to-end: missing dotenv file behaves as "everything absent" (AC-2)', () => {
    it('should report every always-required var as missing when the file does not exist', () => {
        // Arrange
        const registry = [
            buildEntry({ name: 'HOSPEDA_ALWAYS', requiredScope: 'always', apps: ['api'] }),
            buildEntry({ name: 'HOSPEDA_PROD', requiredScope: 'production', apps: ['api'] })
        ];
        const missingPath = join(tmpdir(), 'hos79-missing-dotenv-dir', 'missing.local');

        // Act
        const localValues = readDotenvFile({ filePath: missingPath });
        const gaps = findMissingAlwaysRequiredVars({ appId: 'api', localValues, registry });

        // Assert
        expect(gaps).toEqual([{ app: 'api', key: 'HOSPEDA_ALWAYS' }]);
    });
});
