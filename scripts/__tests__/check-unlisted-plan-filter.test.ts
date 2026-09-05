/**
 * @fileoverview
 * HOS-1062 AC-14: the POSITIVE CONTROL for `check-unlisted-plan-filter.sh`.
 *
 * AC-14 does not ask for a guard, it asks for a guard that goes RED when the
 * filter is removed — and a guard that is only ever run over a clean tree has
 * proved nothing: it would be just as green if its regexes matched no input at
 * all. So this file never asserts "the repo is clean" alone. It points the guard
 * at fixtures that REMOVE the protection and asserts it exits 1, and at
 * near-miss fixtures and asserts it does not.
 *
 * The script exposes two test-injection env vars for exactly this, mirroring
 * `SCAN_FILES_OVERRIDE` in check-no-trial-to-mercadopago.sh:
 *
 *   - `HANDLER_FILE_OVERRIDE`   — the file checks 1-3 read instead of the route.
 *   - `PREDICATE_FILE_OVERRIDE` — the file check 4 reads instead of the schema.
 *
 * Each test spawns the real script as a subprocess and asserts its exit code and
 * stdout, since the artifact under test is bash rather than a TS module.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-unlisted-plan-filter.sh');

interface RunResult {
    readonly exitCode: number;
    readonly stdout: string;
}

function runGuard(env: Record<string, string>): RunResult {
    try {
        const stdout = execFileSync('bash', [SCRIPT_PATH], {
            cwd: REPO_ROOT,
            env: { ...process.env, ...env },
            encoding: 'utf8'
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const err = error as { status: number | null; stdout: string };
        return { exitCode: err.status ?? 1, stdout: err.stdout ?? '' };
    }
}

let workDir: string;

/** Writes a fixture and returns its absolute path. */
function fixture(name: string, lines: readonly string[]): string {
    const filePath = path.join(workDir, name);
    writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
    return filePath;
}

/** The handler as it stands: filters once, returns only from the filtered array. */
const GOOD_HANDLER = [
    "import { isPubliclyListedPlan } from '@repo/schemas';",
    'const publiclyListedPlans = result.data.items.filter(isPubliclyListedPlan);',
    'if (excludedSlugs === null) {',
    '    return domain === DEFAULT_DOMAIN ? publiclyListedPlans : [];',
    '}',
    'return publiclyListedPlans.filter((plan) => !excludedSlugs.has(plan.slug));'
];

/** The predicate as it stands. */
const GOOD_PREDICATE = [
    'export function isPubliclyListedPlan(plan: { readonly publicListing?: unknown }): boolean {',
    "    return plan.publicListing === 'listed';",
    '}'
];

beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'hos1062-unlisted-'));
});

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe('check-unlisted-plan-filter.sh — it fails when the lock is removed', () => {
    it('rejects a handler that no longer calls the predicate', () => {
        // The refactor this whole guard exists for: someone tidies the filter
        // away and every active plan becomes public again, silently.
        const handler = fixture('no-filter.ts', [
            'const publiclyListedPlans = result.data.items;',
            'return publiclyListedPlans;'
        ]);

        const result = runGuard({
            HANDLER_FILE_OVERRIDE: handler,
            PREDICATE_FILE_OVERRIDE: fixture('predicate-ok-1.ts', GOOD_PREDICATE)
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer filters unlisted plans');
    });

    it('rejects a handler that keeps the filter but returns the raw items somewhere', () => {
        // The subtle half of AC-13: the filter is still there, so a check that
        // only looked for its presence would pass — while the domain-failure
        // branch answered with the unfiltered list.
        const handler = fixture('raw-return-in-branch.ts', [
            ...GOOD_HANDLER,
            'if (excludedSlugs === null) {',
            '    return domain === DEFAULT_DOMAIN ? result.data.items : [];',
            '}'
        ]);

        const result = runGuard({
            HANDLER_FILE_OVERRIDE: handler,
            PREDICATE_FILE_OVERRIDE: fixture('predicate-ok-2.ts', GOOD_PREDICATE)
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('returns the UNFILTERED service items');
    });

    it('rejects a handler that has been deleted or moved', () => {
        const result = runGuard({
            HANDLER_FILE_OVERRIDE: path.join(workDir, 'does-not-exist.ts'),
            PREDICATE_FILE_OVERRIDE: fixture('predicate-ok-3.ts', GOOD_PREDICATE)
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('is missing');
    });

    it('rejects a predicate rewritten as a negative test', () => {
        // `!== 'unlisted'` reads like a simplification and inverts the failure
        // direction: a plan whose mark went missing would be published.
        const predicate = fixture('negative-predicate.ts', [
            'export function isPubliclyListedPlan(plan: { readonly publicListing?: unknown }): boolean {',
            "    return plan.publicListing !== 'unlisted';",
            '}'
        ]);

        const result = runGuard({
            HANDLER_FILE_OVERRIDE: fixture('handler-ok-1.ts', GOOD_HANDLER),
            PREDICATE_FILE_OVERRIDE: predicate
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer a positive test');
    });

    it('rejects a predicate whose positive comparison disappeared entirely', () => {
        const predicate = fixture('always-true-predicate.ts', [
            'export function isPubliclyListedPlan(): boolean {',
            '    return true;',
            '}'
        ]);

        const result = runGuard({
            HANDLER_FILE_OVERRIDE: fixture('handler-ok-2.ts', GOOD_HANDLER),
            PREDICATE_FILE_OVERRIDE: predicate
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer a positive test');
    });
});

describe('check-unlisted-plan-filter.sh — it does not cry wolf', () => {
    it('passes a handler that filters and never returns the raw items', () => {
        const result = runGuard({
            HANDLER_FILE_OVERRIDE: fixture('handler-ok-3.ts', GOOD_HANDLER),
            PREDICATE_FILE_OVERRIDE: fixture('predicate-ok-4.ts', GOOD_PREDICATE)
        });

        expect(result.exitCode).toBe(0);
    });

    it('does not mistake a MENTION of the service items for a return of them', () => {
        // The handler's own comments name `result.data.items` when explaining
        // what is filtered. A guard that flagged prose would be turned off.
        const handler = fixture('prose.ts', [
            '// result.data.items is what the filter below consumes.',
            '/* Every return answers from result.data.items only after filtering. */',
            ...GOOD_HANDLER
        ]);

        const result = runGuard({
            HANDLER_FILE_OVERRIDE: handler,
            PREDICATE_FILE_OVERRIDE: fixture('predicate-ok-5.ts', GOOD_PREDICATE)
        });

        expect(result.exitCode).toBe(0);
    });
});

describe('check-unlisted-plan-filter.sh — over the repository as it stands', () => {
    it('names the real handler it inspected, so a pass cannot mean it looked at nothing', () => {
        const result = runGuard({});

        expect(result.stdout).toContain('apps/api/src/routes/billing/public/listPlans.ts');
        expect(result.stdout).toContain('packages/schemas/src/api/billing/billing-plan.schema.ts');
    });

    it('passes', () => {
        // Last and deliberately least: on its own this asserts nothing, which is
        // why every test above exists. It is here so a real regression in the
        // tree is reported by this suite too, not only by CI.
        const result = runGuard({});

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('All checks passed.');
    });
});
