/**
 * @fileoverview
 * HOS-25 T-019 wiring test: verifies that `db:fresh` and `db:fresh-dev` (root
 * `package.json` scripts) invoke the versioned seed data-migration
 * baseline-stamp step (`pnpm --filter @repo/seed seed --data-migrate
 * --baseline-stamp`, T-017's CLI surface over {@link baselineStamp}, T-010)
 * exactly once, as the step immediately following the full baseline seed
 * (`--reset --required --example`).
 *
 * This does NOT re-prove that `baselineStamp` itself leaves zero pending
 * migrations against a real database — that integration coverage already
 * lives in `packages/seed/test/data-migrations/baselineStamp.test.ts`
 * (T-010). This test only proves the shell-chain WIRING is correct: the
 * stamp step exists, runs once, and is positioned after the seed step that
 * produces the fresh baseline data (not before it, and not duplicated).
 *
 * Both `db:fresh` (migrate-based, CI/prod-shaped) and `db:fresh-dev`
 * (push-based, local dev shortcut with test-users) are covered, since they
 * diverge in every other step but must both stamp once after their
 * respective `--reset --required --example` seed call.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const STAMP_COMMAND = 'pnpm --filter @repo/seed seed --data-migrate --baseline-stamp';

interface PackageJsonScripts {
    readonly scripts: Record<string, string>;
}

/** Reads and parses the repo-root `package.json`'s `scripts` map. */
function readRootScripts(): Record<string, string> {
    const raw = readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as PackageJsonScripts;
    return parsed.scripts;
}

describe('HOS-25 T-019: db:fresh / db:fresh-dev baseline-stamp wiring', () => {
    const scripts = readRootScripts();

    it('db:fresh runs the baseline-stamp step exactly once, after pnpm db:seed', () => {
        const script = scripts['db:fresh'];
        expect(script).toBeDefined();

        const stampIndex = script?.indexOf(STAMP_COMMAND) ?? -1;
        const seedIndex = script?.indexOf('pnpm db:seed') ?? -1;

        expect(stampIndex).toBeGreaterThan(-1);
        expect(seedIndex).toBeGreaterThan(-1);
        expect(stampIndex).toBeGreaterThan(seedIndex);

        // Runs exactly once — a duplicated stamp step would silently
        // re-stamp nothing (idempotent) but signals a wiring mistake.
        expect(script?.split(STAMP_COMMAND)).toHaveLength(2);
    });

    it('db:fresh-dev runs the baseline-stamp step exactly once, after the main --reset --required --example seed', () => {
        const script = scripts['db:fresh-dev'];
        expect(script).toBeDefined();

        const stampIndex = script?.indexOf(STAMP_COMMAND) ?? -1;
        const mainSeedIndex =
            script?.indexOf('--filter @repo/seed seed --reset --required --example') ?? -1;
        const testUsersIndex = script?.indexOf('pnpm db:seed:test-users') ?? -1;

        expect(stampIndex).toBeGreaterThan(-1);
        expect(mainSeedIndex).toBeGreaterThan(-1);
        expect(stampIndex).toBeGreaterThan(mainSeedIndex);

        // The stamp step targets only the versioned data-migration groups
        // ('required' | 'example') and has no relationship to the
        // dev-only test-users fixtures, so it must run before them (right
        // after the baseline seed it actually reflects), not after.
        if (testUsersIndex > -1) {
            expect(stampIndex).toBeLessThan(testUsersIndex);
        }

        expect(script?.split(STAMP_COMMAND)).toHaveLength(2);
    });

    it('neither script omits --reset when seeding the fresh baseline (stamp assumes a genuinely fresh DB)', () => {
        const freshScript = scripts['db:fresh'];
        const freshDevScript = scripts['db:fresh-dev'];

        // db:fresh delegates to db:seed, which itself carries --reset.
        expect(scripts['db:seed']).toContain('--reset');
        expect(freshScript).toContain('pnpm db:seed');

        expect(freshDevScript).toContain('--reset --required --example');
    });
});
