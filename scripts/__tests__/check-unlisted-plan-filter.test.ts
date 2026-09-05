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
 * The script exposes three test-injection env vars for exactly this, mirroring
 * `SCAN_FILES_OVERRIDE` in check-no-trial-to-mercadopago.sh:
 *
 *   - `HANDLER_FILE_OVERRIDE`   — the file checks 1-3 read instead of the public route.
 *   - `PREDICATE_FILE_OVERRIDE` — the file check 4 reads instead of the schema.
 *   - `PROTECTED_FILE_OVERRIDE` — the file checks 6-8 read instead of the protected route.
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

/**
 * The public handler as it stands: the loader filters the WHOLE catalogue, and
 * every return inside the handler answers `[]` or the filtered array.
 *
 * The `handler: async` and `options: {` lines are load-bearing — check 3 slices
 * the handler body between them, and fails loudly if it cannot find them.
 */
const GOOD_HANDLER = [
    "import { isPubliclyListedPlan } from '@repo/schemas';",
    'async function loadPubliclyListedPlans() {',
    '    return collected.filter(isPubliclyListedPlan);',
    '}',
    '    handler: async (ctx: Context) => {',
    '        const publiclyListedPlans = await loadPubliclyListedPlans();',
    '        if (publiclyListedPlans === null) {',
    '            return [];',
    '        }',
    '        if (excludedSlugs === null) {',
    '            return domain === DEFAULT_DOMAIN ? publiclyListedPlans : [];',
    '        }',
    '        return publiclyListedPlans.filter((plan) => !excludedSlugs.has(plan.slug));',
    '    },',
    '    options: {',
    '        skipAuth: true',
    '    }'
];

/** The predicate as it stands. */
const GOOD_PREDICATE = [
    'export function isPubliclyListedPlan(plan: { readonly publicListing?: unknown }): boolean {',
    "    return plan.publicListing === 'listed';",
    '}'
];

/** The protected handler as it stands: both branches filter, neither returns raw qzpay data. */
const GOOD_PROTECTED = [
    'export function isPubliclyListedStoragePlan(plan) {',
    '    return isPubliclyListedPlan(resolvePlanPublicListing({ metadata: plan.metadata }));',
    '}',
    'export function servablePlans<T>(plans: readonly T[]): T[] {',
    '    return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));',
    '}',
    'async function loadServableCatalog(billing) {',
    '    return servablePlans(collected);',
    '}',
    'if (activeOnly) {',
    '    const active = await billing.plans.getActive();',
    '    return c.json({ success: true, data: servablePlans(active) });',
    '}',
    'const servable = await loadServableCatalog(billing);',
    'return c.json({ success: true, data: servable.slice(offset, offset + limit) });'
];

/**
 * Runs the guard with all three files overridden, so a fixture exercises exactly
 * one check and the other two files stay valid.
 */
function runWithFixtures(overrides: {
    handler?: readonly string[];
    predicate?: readonly string[];
    protectedHandler?: readonly string[];
    handlerPath?: string;
}): RunResult {
    const id = Math.random().toString(36).slice(2, 8);
    return runGuard({
        HANDLER_FILE_OVERRIDE:
            overrides.handlerPath ?? fixture(`handler-${id}.ts`, overrides.handler ?? GOOD_HANDLER),
        PREDICATE_FILE_OVERRIDE: fixture(
            `predicate-${id}.ts`,
            overrides.predicate ?? GOOD_PREDICATE
        ),
        PROTECTED_FILE_OVERRIDE: fixture(
            `protected-${id}.ts`,
            overrides.protectedHandler ?? GOOD_PROTECTED
        )
    });
}

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
        const result = runWithFixtures({
            handler: [
                'async function loadPubliclyListedPlans() {',
                '    return collected;',
                '}',
                '    handler: async (ctx: Context) => {',
                '        return await loadPubliclyListedPlans();',
                '    },',
                '    options: {',
                '        skipAuth: true',
                '    }'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer filters unlisted plans');
    });

    it('rejects a handler return that names anything but the filtered array', () => {
        // Verified by the reviewer against an earlier version of this guard:
        // `const allPlans = result.data.items; return allPlans;` left the filter
        // in place higher up, so a check looking for the raw expression in the
        // `return` found nothing and passed — tests red, guard green.
        //
        // The rule is inverted now: inside the handler slice a return may answer
        // `[]` or name the filtered array, and any other name fails. Scoped
        // claim on purpose — this is about what a RETURN LINE names, and says
        // nothing about a value re-derived through a local somewhere else in the
        // file. See the intermediate-variable note in the script's header.
        const result = runWithFixtures({
            handler: [
                "import { isPubliclyListedPlan } from '@repo/schemas';",
                'async function loadPubliclyListedPlans() {',
                '    return collected.filter(isPubliclyListedPlan);',
                '}',
                '    handler: async (ctx: Context) => {',
                '        const publiclyListedPlans = await loadPubliclyListedPlans();',
                '        const allPlans = result.data.items;',
                '        return domain === DEFAULT_DOMAIN ? allPlans : [];',
                '    },',
                '    options: {',
                '        skipAuth: true',
                '    }'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('does not answer the filtered array');
    });

    it('rejects a name that merely STARTS WITH the filtered array', () => {
        // A substring filter passed this: `publiclyListedPlansUnfiltered` is a
        // different variable holding a different thing, and it reads almost
        // identically in review. `\\b` does not help — there is no word boundary
        // between `s` and `U` — so the character class is what excludes it.
        const result = runWithFixtures({
            handler: [
                "import { isPubliclyListedPlan } from '@repo/schemas';",
                'async function loadPubliclyListedPlans() {',
                '    return collected.filter(isPubliclyListedPlan);',
                '}',
                '    handler: async (ctx: Context) => {',
                '        const publiclyListedPlansUnfiltered = result.data.items;',
                '        return publiclyListedPlansUnfiltered;',
                '    },',
                '    options: {',
                '        skipAuth: true',
                '    }'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('does not answer the filtered array');
    });

    it('rejects an unfiltered exit of the public loader', () => {
        const result = runWithFixtures({
            handler: [
                "import { isPubliclyListedPlan } from '@repo/schemas';",
                'async function loadPubliclyListedPlans() {',
                '    if (somethingWentWrong) {',
                '        return collected;',
                '    }',
                '    return collected.filter(isPubliclyListedPlan);',
                '}',
                '    handler: async (ctx: Context) => {',
                '        const publiclyListedPlans = await loadPubliclyListedPlans();',
                '        return publiclyListedPlans;',
                '    },',
                '    options: {',
                '        skipAuth: true',
                '    }'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('is not filtered');
    });

    it('still rejects it when the accumulator is RENAMED', () => {
        // The escape that disarmed the previous version: it watched the
        // identifier `collected`, so calling it `rows` made the check blind
        // (verified — guard green, five route tests red). And `\\bcollected\\b`
        // did not even match `collected2`: there is no word boundary between `d`
        // and `2`. The check is anchored on the SHAPE of the return now, so what
        // the accumulator is called stopped mattering.
        const result = runWithFixtures({
            handler: [
                "import { isPubliclyListedPlan } from '@repo/schemas';",
                'async function loadPubliclyListedPlans() {',
                '    const rows = await collectCatalogPages({});',
                '    return rows;',
                '}',
                '    handler: async (ctx: Context) => {',
                '        const publiclyListedPlans = await loadPubliclyListedPlans();',
                '        return publiclyListedPlans;',
                '    },',
                '    options: {',
                '        skipAuth: true',
                '    }'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('is not filtered');
    });

    it('fails loudly when the loader body cannot be read', () => {
        // A slice that stops at the signature would leave every exit unwatched
        // while still looking non-empty. `^}` matched `}): Promise<...> {` and
        // did exactly that — measured, guard green with a raw return in the body.
        // Requiring a return INSIDE the slice is what makes that impossible.
        const result = runWithFixtures({
            handler: [
                "import { isPubliclyListedPlan } from '@repo/schemas';",
                'const x = collected.filter(isPubliclyListedPlan);',
                '    handler: async (ctx: Context) => {',
                '        const publiclyListedPlans = await loadPubliclyListedPlans();',
                '        return publiclyListedPlans;',
                '    },',
                '    options: {',
                '        skipAuth: true',
                '    }'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("could not read the public catalogue loader's body");
    });

    it('fails loudly when the handler body cannot be located', () => {
        // A slice that comes back empty would leave every return in the handler
        // unwatched. It has to be an error, never a silent pass.
        const result = runWithFixtures({
            handler: [
                "import { isPubliclyListedPlan } from '@repo/schemas';",
                'const publiclyListedPlans = collected.filter(isPubliclyListedPlan);'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('could not locate the public handler body');
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

describe('check-unlisted-plan-filter.sh — the second door (protected /plans)', () => {
    it('rejects a protected handler that lost servablePlans() entirely', () => {
        const result = runWithFixtures({
            protectedHandler: [
                'const active = await billing.plans.getActive();',
                'return c.json({ success: true, data: active.filter((p) => !isTestPlan(p)) });'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer defines servablePlans()');
    });

    it('rejects a servablePlans() that dropped the unlisted mark and kept only isTestPlan', () => {
        // The pre-HOS-1062 state, and the likeliest regression: someone
        // "simplifies" the predicate back to the one mark it used to have.
        const result = runWithFixtures({
            protectedHandler: [
                'export function servablePlans<T>(plans: readonly T[]): T[] {',
                '    return plans.filter((plan) => !isTestPlan(plan));',
                '}',
                '    return c.json({ success: true, data: servablePlans(active) });',
                'return servablePlans(collected);'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer applies both marks');
    });

    it('rejects && swapped for || — both names present, the filter gone', () => {
        // One character, found by the adversarial review by reading. With `||` a
        // plan needs to satisfy only ONE of the two conditions to be served,
        // which every plan does. A check looking for the two NAMES separately
        // stayed green; the check pins the whole expression now.
        const result = runWithFixtures({
            protectedHandler: [
                'export function isPubliclyListedStoragePlan(plan) {',
                '    return isPubliclyListedPlan(resolvePlanPublicListing({ metadata: plan.metadata }));',
                '}',
                'export function servablePlans<T>(plans: readonly T[]): T[] {',
                '    return plans.filter((plan) => !isTestPlan(plan) || isPubliclyListedStoragePlan(plan));',
                '}',
                '    return c.json({ success: true, data: servablePlans(active) });',
                'return servablePlans(collected);'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer applies both marks, conjoined');
    });

    it('rejects a THIRD payload name, which a deny-list of two shapes would miss', () => {
        // The reason check 8 is an allowlist. Naming `data: active` and
        // `data: <x>.data` as forbidden left every other spelling — a new local
        // holding an unfiltered fetch — walking straight through.
        const result = runWithFixtures({
            protectedHandler: [
                ...GOOD_PROTECTED,
                'const everything = await billing.plans.list({ limit: 100, offset: 0 });',
                'return c.json({ success: true, data: everything });'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('answers a payload that is not filtered');
    });

    it('rejects the ?active=true branch answering unfiltered, even with the paginated one filtered', () => {
        // The asymmetric failure this guard exists for: one door watched, the
        // other left open. A call-site COUNT would have passed this fixture —
        // loadServableCatalog still calls servablePlans.
        const result = runWithFixtures({
            protectedHandler: [
                'export function servablePlans<T>(plans: readonly T[]): T[] {',
                '    return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));',
                '}',
                'async function loadServableCatalog(billing) {',
                '    return servablePlans(collected);',
                '}',
                'if (activeOnly) {',
                '    const active = await billing.plans.getActive();',
                '    return c.json({ success: true, data: active });',
                '}',
                'const servable = await loadServableCatalog(billing);',
                'return c.json({ success: true, data: servable.slice(offset, offset + limit) });'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('?active=true branch no longer filters');
        expect(result.stdout).toContain('answers a payload that is not filtered');
    });

    it('rejects a catalogue loader that returns the raw pages', () => {
        const result = runWithFixtures({
            protectedHandler: [
                'export function servablePlans<T>(plans: readonly T[]): T[] {',
                '    return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));',
                '}',
                'async function loadServableCatalog(billing) {',
                '    return collected;',
                '}',
                '    return c.json({ success: true, data: servablePlans(active) });'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('catalogue loader no longer filters');
    });

    it('rejects a protected handler that answers a raw qzpay result', () => {
        const result = runWithFixtures({
            protectedHandler: [...GOOD_PROTECTED, 'return c.json({ data: result.data });']
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('answers a payload that is not filtered');
    });

    it('rejects an adapter that restates the comparison instead of delegating', () => {
        // Measured, not hypothetical: this exact form passed all 15 route tests
        // AND the guard's other checks. `resolvePlanPublicListing` is total over
        // two values, so `=== 'listed'` and `!== 'unlisted'` are the same
        // expression here — a comparison no mutation can distinguish from its own
        // inverse. Only a static check can require the delegation.
        const result = runWithFixtures({
            protectedHandler: [
                'export function isPubliclyListedStoragePlan(plan) {',
                "    return resolvePlanPublicListing({ metadata: plan.metadata }).publicListing === 'listed';",
                '}',
                'export function servablePlans<T>(plans: readonly T[]): T[] {',
                '    return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));',
                '}',
                '    return c.json({ success: true, data: servablePlans(active) });',
                'return servablePlans(collected);'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('no longer delegates the listing verdict');
    });

    it('rejects an early unfiltered return inside the paging loop', () => {
        // The other measured escape: `return collected;` on the last page left
        // the final `return servablePlans(collected);` in place, so the "loader
        // still filters" check stayed green while five route tests went red.
        const result = runWithFixtures({
            protectedHandler: [
                'export function isPubliclyListedStoragePlan(plan) {',
                '    return isPubliclyListedPlan(resolvePlanPublicListing({ metadata: plan.metadata }));',
                '}',
                'export function servablePlans<T>(plans: readonly T[]): T[] {',
                '    return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));',
                '}',
                'async function loadServableCatalog(billing) {',
                '    if (!result.hasMore) {',
                '        return collected;',
                '    }',
                '    return servablePlans(collected);',
                '}',
                '    return c.json({ success: true, data: servablePlans(active) });'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('is not filtered');
    });

    it('still rejects it when the protected accumulator is RENAMED', () => {
        // Same escape as the public side, same fix: the check is anchored on the
        // shape of the return, so the accumulator's name no longer matters.
        const result = runWithFixtures({
            protectedHandler: [
                'export function isPubliclyListedStoragePlan(plan) {',
                '    return isPubliclyListedPlan(resolvePlanPublicListing({ metadata: plan.metadata }));',
                '}',
                'export function servablePlans<T>(plans: readonly T[]): T[] {',
                '    return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));',
                '}',
                'async function loadServableCatalog(billing) {',
                '    const rows = await collectCatalogPages({});',
                '    return rows;',
                '}',
                '    return c.json({ success: true, data: servablePlans(active) });'
            ]
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('is not filtered');
    });

    it('rejects a protected handler that has been deleted or moved', () => {
        const result = runGuard({
            PROTECTED_FILE_OVERRIDE: path.join(workDir, 'no-protected-handler.ts')
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('is missing');
    });
});

describe('check-unlisted-plan-filter.sh — it does not cry wolf', () => {
    it('passes the protected handler as it stands', () => {
        expect(runWithFixtures({}).exitCode).toBe(0);
    });

    it('does not mistake prose about raw qzpay data for a return of it', () => {
        const result = runWithFixtures({
            protectedHandler: [
                '// data: active was the pre-HOS-1062 shape.',
                ' * `data: result.data` is what this no longer answers.',
                ...GOOD_PROTECTED
            ]
        });

        expect(result.exitCode).toBe(0);
    });

    it('passes a handler that filters and never returns the raw items', () => {
        const result = runGuard({
            HANDLER_FILE_OVERRIDE: fixture('handler-ok-3.ts', GOOD_HANDLER),
            PREDICATE_FILE_OVERRIDE: fixture('predicate-ok-4.ts', GOOD_PREDICATE)
        });

        expect(result.exitCode).toBe(0);
    });

    it('does not mistake a MENTION of the raw accumulator for a return of it', () => {
        // The loader's own comments name `collected` when explaining what is
        // filtered. A guard that flagged prose would be turned off.
        const result = runWithFixtures({
            handler: [
                '// return collected; was the shape before HOS-1062.',
                ' * Every exit answers collected after filtering, never collected itself.',
                ...GOOD_HANDLER
            ]
        });

        expect(result.exitCode).toBe(0);
    });
});

describe('check-unlisted-plan-filter.sh — the metadata key is not read by hand', () => {
    it('rejects a hand-rolled read off metadata, quotes or no quotes', () => {
        // Reproduced from the adversarial review. The first version of check 5
        // required QUOTES around the key, so this file — the exact negative
        // comparison checks 4/4b forbid — sat in production while the guard
        // printed "OK - the metadata key has one production site".
        const probeDir = mkdtempSync(path.join(tmpdir(), 'hos1062-probe-'));
        writeFileSync(
            path.join(probeDir, 'probe.ts'),
            [
                'export function leak(row: { metadata?: Record<string, unknown> }): boolean {',
                '    return row.metadata?.publicListing !== "unlisted";',
                '}'
            ].join('\n'),
            'utf8'
        );

        try {
            const result = runGuard({ KEY_SCAN_EXTRA_ROOT: probeDir });

            expect(result.exitCode).toBe(1);
            expect(result.stdout).toContain('read off metadata outside its definition');
            expect(result.stdout).toContain('probe.ts');
        } finally {
            rmSync(probeDir, { recursive: true, force: true });
        }
    });

    it('rejects bracket access on metadata too', () => {
        const probeDir = mkdtempSync(path.join(tmpdir(), 'hos1062-probe-'));
        writeFileSync(
            path.join(probeDir, 'bracket.ts'),
            ["const mark = plan.metadata['publicListing'];"].join('\n'),
            'utf8'
        );

        try {
            expect(runGuard({ KEY_SCAN_EXTRA_ROOT: probeDir }).exitCode).toBe(1);
        } finally {
            rmSync(probeDir, { recursive: true, force: true });
        }
    });

    it('DOES NOT catch the same read through a local — the known ceiling', () => {
        // Not a near-miss and not a passing case: a genuine escape, pinned so it
        // is a known limit rather than an assumed absence. Every check in this
        // guard matches syntactic forms one line at a time, so a value moved
        // through a local first is a different line and a different shape.
        // Chasing each alias is a race that is lost quietly, and a guard that
        // grows while claiming ground it does not hold is worse than a modest
        // one — so the script's header declares this instead.
        //
        // What covers the BEHAVIOUR is the route tests: an aliased re-derivation
        // still has to produce a response, and those assert on responses.
        //
        // If someone closes this gap, this test goes red. That is the point:
        // update it and the header together, deliberately.
        const probeDir = mkdtempSync(path.join(tmpdir(), 'hos1062-probe-'));
        writeFileSync(
            path.join(probeDir, 'aliased.ts'),
            [
                'export function leak(row: { metadata?: Record<string, unknown> }): boolean {',
                '    const md = row.metadata;',
                "    return md?.publicListing !== 'unlisted';",
                '}'
            ].join('\n'),
            'utf8'
        );

        try {
            expect(runGuard({ KEY_SCAN_EXTRA_ROOT: probeDir }).exitCode).toBe(0);
        } finally {
            rmSync(probeDir, { recursive: true, force: true });
        }
    });

    it('does not flag the DTO field, which is spelled legitimately everywhere', () => {
        // The mark travels ON the DTO by design. Flagging `plan.publicListing`
        // would forbid the mapper, the admin types and the admin table from
        // naming their own field.
        const probeDir = mkdtempSync(path.join(tmpdir(), 'hos1062-probe-'));
        writeFileSync(
            path.join(probeDir, 'dto.ts'),
            [
                'const badge = isPubliclyListedPlan(plan) ? null : LABEL;',
                'export interface ParsedPlanRecord { publicListing: BillingPlanPublicListing; }',
                'const value = record.publicListing;'
            ].join('\n'),
            'utf8'
        );

        try {
            expect(runGuard({ KEY_SCAN_EXTRA_ROOT: probeDir }).exitCode).toBe(0);
        } finally {
            rmSync(probeDir, { recursive: true, force: true });
        }
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
