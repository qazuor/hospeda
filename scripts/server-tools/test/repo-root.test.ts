/**
 * Unit tests for `src/lib/repo-root.ts` — repo-root resolution, the
 * committed env-var registry JSON path, and its loader (HOS-79 T-014).
 *
 * `resolveRepoRoot()` was extracted from `src/commands/db-seed.ts`, where
 * the exact same 4-line helper had been independently copy-pasted into
 * `db-migrate.ts` and `db-migrate-test.ts` as well. These tests replace the
 * three duplicated `describe('resolveRepoRoot()', ...)` blocks that used to
 * live in `test/db-seed.test.ts` and `test/db-migrate-test.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadRegistryJson, registryJsonPath, resolveRepoRoot } from '../src/lib/repo-root.ts';

const ENV_KEYS_TOUCHED = ['HOPS_REPO_ROOT'] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
    originalEnv = {};
    for (const key of ENV_KEYS_TOUCHED) {
        originalEnv[key] = process.env[key];
        delete process.env[key];
    }
});

afterEach(() => {
    for (const key of ENV_KEYS_TOUCHED) {
        const value = originalEnv[key];
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
});

describe('resolveRepoRoot()', () => {
    it('defaults to ~/hospeda when HOPS_REPO_ROOT is unset', () => {
        expect(resolveRepoRoot()).toBe(join(homedir(), 'hospeda'));
    });

    it('honours HOPS_REPO_ROOT when set', () => {
        process.env.HOPS_REPO_ROOT = '/opt/hospeda-staging';
        expect(resolveRepoRoot()).toBe('/opt/hospeda-staging');
    });

    it('treats an empty HOPS_REPO_ROOT as unset', () => {
        process.env.HOPS_REPO_ROOT = '';
        expect(resolveRepoRoot()).toBe(join(homedir(), 'hospeda'));
    });
});

describe('registryJsonPath()', () => {
    it('joins the given repo root with the committed registry path', () => {
        expect(registryJsonPath('/opt/hospeda')).toBe(
            '/opt/hospeda/packages/config/generated/env-registry.json'
        );
    });

    it('defaults to resolveRepoRoot() when no repo root is given', () => {
        process.env.HOPS_REPO_ROOT = '/opt/hospeda-staging';
        expect(registryJsonPath()).toBe(
            '/opt/hospeda-staging/packages/config/generated/env-registry.json'
        );
    });
});

describe('loadRegistryJson()', () => {
    let scratchDir: string;

    beforeEach(() => {
        scratchDir = mkdtempSync(join(tmpdir(), 'hops-repo-root-test-'));
    });

    afterEach(() => {
        rmSync(scratchDir, { recursive: true, force: true });
    });

    it('throws a helpful error when the registry JSON file is missing', () => {
        expect(() => loadRegistryJson(scratchDir)).toThrow(/gen:env-registry-json/);
    });

    it('throws a helpful error that includes the resolved path', () => {
        expect(() => loadRegistryJson(scratchDir)).toThrow(registryJsonPath(scratchDir));
    });

    it('throws a clear error when the file is not valid JSON', () => {
        const path = registryJsonPath(scratchDir);
        mkdtempParents(path);
        writeFileSync(path, '{ not valid json');
        expect(() => loadRegistryJson(scratchDir)).toThrow(/Failed to parse/);
    });

    it('parses a well-formed registry JSON file', () => {
        const path = registryJsonPath(scratchDir);
        mkdtempParents(path);
        const fixture = {
            registry: [
                {
                    name: 'HOSPEDA_API_URL',
                    description: 'API base URL',
                    type: 'url',
                    required: true,
                    secret: false,
                    apps: ['api', 'web', 'admin'],
                    category: 'core'
                }
            ],
            crossChecks: [
                {
                    id: 'example-rule',
                    description: 'example',
                    appliesTo: ['local', 'coolify'],
                    comparator: 'equals',
                    compare: [
                        { app: 'api', key: 'HOSPEDA_REVALIDATION_SECRET' },
                        { app: 'web', key: 'HOSPEDA_REVALIDATION_SECRET' }
                    ]
                }
            ],
            constraints: {
                NODE_ENV: { enumValues: ['development', 'production', 'test'] }
            }
        };
        writeFileSync(path, JSON.stringify(fixture, null, 2));

        const parsed = loadRegistryJson(scratchDir);
        expect(parsed.registry).toHaveLength(1);
        expect(parsed.registry[0]?.name).toBe('HOSPEDA_API_URL');
        expect(parsed.crossChecks).toHaveLength(1);
        expect(parsed.constraints.NODE_ENV?.enumValues).toEqual([
            'development',
            'production',
            'test'
        ]);
    });
});

/** Ensure the parent directory chain for a file path exists. */
function mkdtempParents(filePath: string): void {
    mkdirSync(dirname(filePath), { recursive: true });
}
