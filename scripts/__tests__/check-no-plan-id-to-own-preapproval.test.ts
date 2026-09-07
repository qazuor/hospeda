/**
 * @fileoverview
 * HOS-1221: the POSITIVE CONTROL for `check-no-plan-id-to-own-preapproval.sh`
 * (guard G-2).
 *
 * A guard that is green over a clean tree has proved nothing — it would be
 * equally green with regexes that match no input, or with a file derivation
 * that silently returns nothing. So this file never asserts "the repo is
 * clean". It points the guard at fixtures that REINTRODUCE the defect and
 * asserts it exits 1, at near-misses and asserts it does not, and at an empty
 * derivation and asserts it refuses to pass vacuously.
 *
 * Two injection points, mirroring `SCAN_FILES_OVERRIDE` in
 * check-no-trial-to-mercadopago.sh:
 *
 *   - `SCAN_FILES_OVERRIDE` — newline-separated paths used verbatim instead of
 *     the derived in-scope TypeScript files.
 *   - `SQL_FILES_OVERRIDE`  — the same for the migration half of RULE B.
 *
 * Each test spawns the real script as a subprocess and asserts exit code plus
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
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-no-plan-id-to-own-preapproval.sh');

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

function fixture(name: string, contents: string): string {
    const filePath = path.join(workDir, name);
    writeFileSync(filePath, contents, 'utf8');
    return filePath;
}

/**
 * The two files the guard's inventory allows to send a plan id. Duplicated here
 * on purpose: the guard checks its inventory in BOTH directions, so every scan
 * that is supposed to end green has to include them or it fails as "stale".
 * Duplicating the list means changing the inventory breaks this file too, which
 * is the review prompt we want.
 */
const ALLOWED_FILES = [
    'apps/api/src/services/billing/paid-subscription-create.ts',
    'apps/api/src/services/addon.checkout.recurring.ts'
];

const BASELINE_MIGRATION = 'packages/db/src/migrations/0000_baseline.sql';

/**
 * Scans a fixture alongside the inventoried files. RULE A's inventory is keyed
 * on repo-relative paths, so a fixture in a temp dir is by construction NOT
 * allowed — which is what makes these assertions about the rule rather than
 * about the inventory.
 *
 * `SQL_FILES_OVERRIDE` is pinned to the baseline migration so RULE B's SQL half
 * stays quiet and each test fails for the one reason it is about.
 */
function scan(filePath: string): RunResult {
    return runGuard({
        SCAN_FILES_OVERRIDE: [...ALLOWED_FILES, filePath].join('\n'),
        SQL_FILES_OVERRIDE: BASELINE_MIGRATION
    });
}

beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'g2-no-plan-id-'));
});

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe('check-no-plan-id-to-own-preapproval.sh — RULE A, the direct route', () => {
    it('rejects providerPriceId as an explicit key in a create payload', () => {
        const file = fixture(
            'explicit-key.ts',
            [
                'const created = await createOwnPreapprovalSubscription({',
                '    billing,',
                '    customerId,',
                '    providerPriceId: mpPlanId,',
                '});'
            ].join('\n')
        );

        const result = scan(file);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('plan id is being sent to a preapproval create');
        expect(result.stdout).toContain('explicit-key.ts');
    });

    it('rejects the shorthand form, which is how all four checkouts wrote it', () => {
        const file = fixture(
            'shorthand.ts',
            [
                'const created = await createOwnPreapprovalSubscription({',
                '    notificationUrl: urls.notificationUrl,',
                '    providerPriceId,',
                '    payerEmail',
                '});'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('rejects it inside the creator itself, where a rename-proof guard has to look', () => {
        // The own-preapproval creator imports no qzpay symbol, so the qzpay
        // derivation alone would never scan it. This is the shape the second
        // derivation exists for: a file that RECORDS the plan id and also sends
        // it. Under SCAN_FILES_OVERRIDE the derivation is bypassed, so what this
        // pins is that such a file is judged by RULE A like any other.
        const file = fixture(
            'creator.ts',
            [
                'const result = await createPaidSubscription({',
                '    ...paidInput,',
                '    providerPriceId: mpPreapprovalPlanId',
                '});',
                'const recoveryMetadata = { mpPreapprovalPlanId };'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('does NOT reject a typed function parameter — a signature is not a payload', () => {
        const file = fixture(
            'param.ts',
            [
                'export const adapter = {',
                '    retrieve: async (providerPriceId: string): Promise<Price> => ({',
                '        id: providerPriceId',
                '    })',
                '};'
            ].join('\n')
        );

        const result = scan(file);

        expect(result.exitCode).toBe(0);
    });

    it('does NOT reject a member access — reading the field is not building it', () => {
        const file = fixture(
            'member-access.ts',
            [
                'const legacy = paidInput.providerPriceId;',
                'log(input.providerPriceId ?? null);'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(0);
    });

    it('does NOT reject a longer identifier that merely contains the name', () => {
        const file = fixture(
            'anchored.ts',
            [
                'const payload = {',
                '    providerPriceIdentifier: value,',
                '    legacyProviderPriceId: other',
                '};'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(0);
    });

    it('does NOT reject prose that names the field to explain the ban', () => {
        const file = fixture(
            'prose.ts',
            [
                '/**',
                ' * providerPriceId: never pass this — MercadoPago answers 400.',
                ' */',
                '// providerPriceId,',
                'export const noop = true;'
            ].join('\n')
        );

        expect(scan(file).exitCode).toBe(0);
    });
});

describe('check-no-plan-id-to-own-preapproval.sh — RULE B, the indirect route', () => {
    it('rejects writing the price row provider map', () => {
        const file = fixture(
            'price-map.ts',
            [
                'await db.insert(billingPrices).values({',
                "    providerPriceIds: { mercadopago: 'x' }",
                '});'
            ].join('\n')
        );

        const result = scan(file);

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('INDIRECT route');
    });

    it('rejects writing the mp_price_id column that hydrates it', () => {
        const file = fixture(
            'column.ts',
            ['await db.update(billingPrices).set({', "    mpPriceId: 'mp_plan_1'", '});'].join('\n')
        );

        expect(scan(file).exitCode).toBe(1);
    });

    it('rejects a migration other than the baseline naming mp_price_id', () => {
        const sqlFile = fixture(
            'backfill.sql',
            "UPDATE billing_prices SET mp_price_id = 'mp_plan_1';"
        );

        const result = runGuard({
            SCAN_FILES_OVERRIDE: [
                ...ALLOWED_FILES,
                fixture('clean.ts', 'export const ok = true;')
            ].join('\n'),
            SQL_FILES_OVERRIDE: sqlFile
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('names billing_prices.mp_price_id');
        // ...and for THAT reason: the TypeScript half stayed green.
        expect(result.stdout).not.toContain('plan id is being sent to a preapproval create');
    });

    it('accepts the baseline migration, which only CREATEs the column', () => {
        const result = runGuard({
            SCAN_FILES_OVERRIDE: [
                ...ALLOWED_FILES,
                fixture('clean2.ts', 'export const ok = true;')
            ].join('\n'),
            SQL_FILES_OVERRIDE: BASELINE_MIGRATION
        });

        expect(result.exitCode).toBe(0);
    });
});

describe('check-no-plan-id-to-own-preapproval.sh — it cannot pass vacuously', () => {
    it('fails loudly when the file derivation yields nothing', () => {
        // A green run over zero files is the classic silent fail-open. The guard
        // must treat an empty scope as broken, not as clean.
        const result = runGuard({ SCAN_FILES_OVERRIDE: ' ' });

        expect(result.exitCode).toBe(1);
    });

    it('fails when the inventory lists a file that no longer sends a plan id', () => {
        // The inventory is checked in BOTH directions: an allowance that
        // outlives its reason is an escape hatch nobody is watching. Scanning
        // only a clean fixture — deliberately WITHOUT the inventoried files —
        // makes every listed file "stale".
        const result = runGuard({
            SCAN_FILES_OVERRIDE: fixture('clean3.ts', 'export const ok = true;'),
            SQL_FILES_OVERRIDE: BASELINE_MIGRATION
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("guard's inventory is stale");
    });
});
