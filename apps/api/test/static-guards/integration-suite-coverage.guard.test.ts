/**
 * @file integration-suite-coverage.guard.test.ts
 * @description Keeps every file under `test/integration/**` either collected by
 * the API integration suite or excluded with a reason (HOS-1891).
 *
 * The suite used to be a hand-written allowlist of folders. 179 files matched
 * none of them and never ran in CI, and 54 of those turned out to be broken
 * with nobody noticing. Now the include is the whole tree and the exclusions
 * live, with a reason each, in `test/integration/integration-suite.ts`. Four
 * changes would quietly bring the orphans back, and each one keeps CI green:
 *
 * 1. Narrowing the config's include again, or adding an inline exclude that
 *    bypasses the module — the config must hand vitest exactly the module's
 *    include and exclusions.
 * 2. A test file the include glob cannot see (`.spec.ts`, `.test.tsx`, ...).
 * 3. An exclusion with no reason, which nobody will ever come back to.
 * 4. An exclusion whose file was moved or deleted — it then excludes nothing,
 *    and a renamed copy of the same broken file slips into the suite unseen.
 *
 * It also freezes the exclusion count, pins the package script, and checks
 * that CI's shard matrix (HOS-1775) is a complete `1..N/N` set: dropping one
 * leg would silently skip a quarter of the suite with everything green.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configDefaults } from 'vitest/config';
import integrationConfig from '../../vitest.config.integration';
import {
    API_INTEGRATION_EXCLUSIONS,
    API_INTEGRATION_INCLUDE,
    isCollectedByApiIntegration
} from '../integration/integration-suite';

const API_ROOT = join(__dirname, '../..');
const INTEGRATION_DIR = join(API_ROOT, 'test/integration');

/** Anything vitest could treat as a test file, whatever the include says. */
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

function listFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? listFiles({ dir: full }) : [full];
    });
}

const testFiles = listFiles({ dir: INTEGRATION_DIR })
    .map((full) => relative(API_ROOT, full))
    .filter((file) => TEST_FILE.test(file));

describe('API integration suite coverage (HOS-1891)', () => {
    it('the config hands vitest exactly the module include and exclusions', () => {
        const test = integrationConfig.test ?? {};
        expect(test.include).toEqual([...API_INTEGRATION_INCLUDE]);
        expect(test.exclude).toEqual([
            ...configDefaults.exclude,
            ...API_INTEGRATION_EXCLUSIONS.map((exclusion) => exclusion.file)
        ]);
    });

    it('the package script runs that config over the whole suite', () => {
        const manifest = JSON.parse(readFileSync(join(API_ROOT, 'package.json'), 'utf8')) as {
            readonly scripts: Readonly<Record<string, string>>;
        };
        expect(manifest.scripts['test:integration']).toBe(
            'vitest run --config vitest.config.integration.ts'
        );
    });

    it('CI shards the API suite into a complete 1..N/N set and keeps it out of the packages leg', () => {
        const ci = readFileSync(join(API_ROOT, '../../.github/workflows/ci.yml'), 'utf8');
        const shards = [...ci.matchAll(/^\s+shard: (\d+)\/(\d+)\s*$/gm)].map((match) => ({
            index: Number(match[1]),
            total: Number(match[2])
        }));
        const total = shards[0]?.total ?? 0;
        expect(total).toBeGreaterThan(1);
        expect(shards.every((shard) => shard.total === total)).toBe(true);
        expect(shards.map((shard) => shard.index).sort((a, b) => a - b)).toEqual(
            Array.from({ length: total }, (_, index) => index + 1)
        );
        expect(ci).toContain(
            // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal GitHub Actions expression, not a JS template.
            'run: pnpm --filter hospeda-api test:integration --shard=${{ matrix.shard }}'
        );
        expect(ci).toContain('run: pnpm test:integration --filter=!hospeda-api');
    });

    it('the exclusion list does not grow and every entry names an issue', () => {
        // Lower this number as files come back; never raise it.
        expect(API_INTEGRATION_EXCLUSIONS.length).toBeLessThanOrEqual(55);
        const untracked = API_INTEGRATION_EXCLUSIONS.filter(
            ({ reason }) => !/\bHOS-\d+\b/.test(reason)
        );
        expect(untracked.map(({ file }) => file)).toEqual([]);
    });

    it('finds integration test files at all', () => {
        expect(testFiles.length).toBeGreaterThan(300);
    });

    it('every integration test file is collected or explicitly excluded', () => {
        const excluded = new Set(API_INTEGRATION_EXCLUSIONS.map((exclusion) => exclusion.file));
        const orphans = testFiles.filter(
            (file) => !isCollectedByApiIntegration({ file }).collected && !excluded.has(file)
        );
        expect(orphans, `never run by any config: ${orphans.join(', ')}`).toEqual([]);
    });

    it('every exclusion names an existing file, once, with a reason', () => {
        const present = new Set(testFiles);
        const missing = API_INTEGRATION_EXCLUSIONS.filter(({ file }) => !present.has(file));
        const reasonless = API_INTEGRATION_EXCLUSIONS.filter(({ reason }) => !reason.trim());
        const files = API_INTEGRATION_EXCLUSIONS.map(({ file }) => file);
        const duplicates = files.filter((file, index) => files.indexOf(file) !== index);
        expect(
            missing.map(({ file }) => file),
            'stale exclusions'
        ).toEqual([]);
        expect(
            reasonless.map(({ file }) => file),
            'exclusions without a reason'
        ).toEqual([]);
        expect(duplicates, 'duplicated exclusions').toEqual([]);
    });

    it('collects a plain file and skips an excluded one', () => {
        expect(
            isCollectedByApiIntegration({ file: 'test/integration/webhooks/x.test.ts' }).collected
        ).toBe(true);
        expect(
            isCollectedByApiIntegration({ file: 'test/integration/ai/vault-roundtrip.test.ts' })
                .collected
        ).toBe(false);
        expect(isCollectedByApiIntegration({ file: 'test/unit/x.test.ts' }).collected).toBe(false);
    });
});
