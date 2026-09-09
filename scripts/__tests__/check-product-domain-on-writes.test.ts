/**
 * Unit tests for the product-domain-on-writes guard (HOS-1233 T-035 / AC-15d).
 *
 * These pin the guard's PREDICATE, not the repository's current state: each one
 * feeds a synthetic source tree to the scanner and asserts the verdict. The
 * repo-wide run is the CI step; this is what stops the predicate from silently
 * becoming unable to fail.
 *
 * The spec (§9, "What would make this suite vacuous") names the two shapes that
 * would let this guard go green while the bug survives, and both have their own
 * test below:
 *
 *   - it must fail on a create shape it has never seen, not on a list of the
 *     three sites §4b happened to name;
 *   - it must fail on the SECOND omitting call site in a file, not only the
 *     first — a guard anchored on one syntactic form has escapes.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    collectSourceFiles,
    isInlineObjectLiteral,
    readBalanced,
    scanSources,
    splitTopLevelArgs,
    statesDomainUnconditionally
} from '../check-product-domain-on-writes.js';

// ---------------------------------------------------------------------------
// Throwaway trees, so the fixtures cannot be confused with the real repo
// ---------------------------------------------------------------------------

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Writes `files` into a temp repo shaped like `packages/<pkg>/src/...`. */
function makeTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'pdow-'));
    dirs.push(root);
    for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, content, 'utf8');
    }
    return root;
}

/** Scans a synthetic tree with qzpay assumed to already offer the parameter. */
function scanTree(files: Record<string, string>) {
    const root = makeTree(files);
    return scanSources(root, collectSourceFiles(root), true);
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe('balanced-text helpers', () => {
    it('reads a balanced argument list', () => {
        expect(readBalanced('f({ a: 1, b: [2, 3] }, tx)', 1)).toBe('{ a: 1, b: [2, 3] }, tx');
    });

    it('returns null when the bracket never closes', () => {
        expect(readBalanced('f({ a: 1', 1)).toBeNull();
    });

    it('splits only on top-level commas', () => {
        expect(splitTopLevelArgs('{ a: 1, b: 2 }, tx')).toEqual(['{ a: 1, b: 2 }', 'tx']);
    });

    it('recognises an inline object literal, and only that', () => {
        expect(isInlineObjectLiteral('{ productDomain }')).toBe(true);
        expect(isInlineObjectLiteral('rows')).toBe(false);
        expect(isInlineObjectLiteral('[{ productDomain }]')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// The predicate — this is where the guard is either real or decorative
// ---------------------------------------------------------------------------

describe('statesDomainUnconditionally', () => {
    it('accepts an explicit key', () => {
        expect(statesDomainUnconditionally("{ id, productDomain: 'tourist' }")).toBe(true);
    });

    it('accepts ES6 shorthand, mid-object and last', () => {
        expect(statesDomainUnconditionally('{ id, productDomain, livemode }')).toBe(true);
        expect(statesDomainUnconditionally('{ id, productDomain }')).toBe(true);
    });

    it('accepts a ternary whose branches are both real values', () => {
        expect(
            statesDomainUnconditionally(
                "{ productDomain: isCommerce ? 'gastronomy' : 'accommodation' }"
            )
        ).toBe(true);
    });

    // The four rejections below are the whole guard. Each one is a shape that
    // NAMES the identifier and still lets a row land on the column default.

    it('rejects a conditional spread — the shape that reads as compliant', () => {
        expect(statesDomainUnconditionally('{ id, ...(domain ? { productDomain } : {}) }')).toBe(
            false
        );
        expect(
            statesDomainUnconditionally(
                '{ id, ...(productDomain === undefined ? {} : { productDomain }) }'
            )
        ).toBe(false);
    });

    it('rejects a key nested inside metadata — a blob entry is not the column', () => {
        expect(statesDomainUnconditionally("{ id, metadata: { productDomain: 'tourist' } }")).toBe(
            false
        );
    });

    it('rejects an explicit undefined or null', () => {
        expect(statesDomainUnconditionally('{ id, productDomain: undefined }')).toBe(false);
        expect(statesDomainUnconditionally('{ id, productDomain: null }')).toBe(false);
    });

    it('rejects a look-alike identifier', () => {
        expect(statesDomainUnconditionally("{ id, mpProductDomain: 'x' }")).toBe(false);
        expect(statesDomainUnconditionally("{ id, productDomainOverride: 'x' }")).toBe(false);
    });

    it('rejects a payload it cannot read', () => {
        expect(statesDomainUnconditionally('rows')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Whole-tree scanning
// ---------------------------------------------------------------------------

describe('scanSources', () => {
    it('passes a create that states its domain', () => {
        const { findings, sitesChecked } = scanTree({
            'packages/seed/src/a.ts':
                "await db.insert(billingPlans).values({ name: 'x', productDomain: 'tourist' });"
        });
        expect(findings).toEqual([]);
        expect(sitesChecked).toBe(1);
    });

    it('fails a create that omits it', () => {
        const { findings } = scanTree({
            'packages/seed/src/a.ts': "await db.insert(billingPlans).values({ name: 'x' });"
        });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.verdict).toBe('omits');
        expect(findings[0]?.shape).toBe('drizzle-insert');
    });

    it('fails the SECOND omitting call site in a file, not only the first', () => {
        const { findings } = scanTree({
            'packages/seed/src/a.ts': [
                "await db.insert(billingPlans).values({ name: 'ok', productDomain: 'tourist' });",
                "await db.insert(billingPlans).values({ name: 'first' });",
                "await db.insert(billingSubscriptions).values({ id: 'second' });"
            ].join('\n')
        });
        expect(findings.map((f) => f.line).sort()).toEqual([2, 3]);
    });

    it('is not fooled by a Biome reformat splitting the call across lines', () => {
        const { findings } = scanTree({
            'packages/seed/src/a.ts': [
                'await db',
                '    .insert(',
                '        billingSubscriptions',
                '    )',
                '    .values({',
                "        id: 'x'",
                '    });'
            ].join('\n')
        });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.verdict).toBe('omits');
    });

    it('reports a payload it cannot read as unverifiable, never as a pass', () => {
        const { findings } = scanTree({
            'packages/seed/src/a.ts': 'await db.insert(billingPlans).values(preparedRows);'
        });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.verdict).toBe('unverifiable');
    });

    it('fails a raw-SQL insert that names no domain column', () => {
        const { findings } = scanTree({
            'packages/seed/src/a.ts':
                'await db.execute(sql`INSERT INTO billing_plans (name) VALUES (${slug})`);'
        });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.shape).toBe('raw-sql');
    });

    it('passes a raw-SQL insert that does', () => {
        const { findings } = scanTree({
            'packages/seed/src/a.ts':
                'await db.execute(sql`INSERT INTO billing_plans (name, product_domain) VALUES (${slug}, ${d})`);'
        });
        expect(findings).toEqual([]);
    });

    it('does not read English prose as SQL', () => {
        // Every one of these seeds throws exactly this sentence when its own
        // insert comes back empty. The case-insensitive match sees `INSERT INTO
        // billing_subscriptions` in it; requiring VALUES/SELECT is what tells
        // the two apart.
        const { findings } = scanTree({
            'packages/seed/src/a.ts':
                'throw new Error(`Insert into billing_subscriptions returned no row for ${id}`);'
        });
        expect(findings).toEqual([]);
    });

    it('ignores a create quoted in a docblock', () => {
        const { findings } = scanTree({
            'apps/api/src/a.ts': [
                '/**',
                " * Replaced by `billing.subscriptions.create({ mode: 'paid' })`, which",
                ' * issues a preapproval.',
                ' */',
                'export const noop = 1;'
            ].join('\n')
        });
        expect(findings).toEqual([]);
    });

    it('ignores a DRIZZLE insert quoted in a docblock', () => {
        // The twin of the test above, and it did not exist. The prose skip was
        // written for the qzpay shape only, so a docblock quoting the Drizzle
        // call matched, read the literal `...` as its payload, and reported
        // UNVERIFIABLE — a guard failing on a COMMENT, fixable only by
        // rewording documentation.
        //
        // This is the exact docblock that did it, added to
        // `service-core/test/integration/services/helpers.ts` on staging while
        // the scan roots were being widened. It surfaced ONLY in the merge:
        // staging did not scan that directory, and the branch that scanned it
        // did not have the file.
        const { findings } = scanTree({
            'apps/api/src/a.ts': [
                '/**',
                ' * Both billing rows are written via typed Drizzle inserts, NOT raw SQL —',
                ' * confirmed by compiling',
                ' * `tx.insert(billingSubscriptions).values(...)` against',
                ' * `typeof billingSubscriptions.$inferInsert` before writing this.',
                ' */',
                'export const noop = 1;'
            ].join('\n')
        });
        expect(findings).toEqual([]);
    });

    it('reads through a trailing type assertion on a .values() payload', () => {
        // `{ ... } as typeof billingSubscriptions.$inferInsert` is a literal
        // whose keys are perfectly readable, but it does not END in `}`. It was
        // reported UNVERIFIABLE while being complete — the right posture for
        // something the guard cannot read, the wrong answer for something it
        // can.
        const { findings } = scanTree({
            'packages/seed/src/a.ts': [
                'await tx.insert(billingSubscriptions).values({',
                '    customerId,',
                "    productDomain: 'experience'",
                '} as typeof billingSubscriptions.$inferInsert);'
            ].join('\n')
        });
        expect(findings).toEqual([]);
    });

    it('still fails an omitting payload that carries a type assertion', () => {
        // Reading through the assertion must make the guard STRONGER, not
        // weaker: this shape used to be merely "unreadable", and now says which
        // key is missing.
        const { findings } = scanTree({
            'packages/seed/src/a.ts': [
                'await tx.insert(billingSubscriptions).values({',
                '    customerId,',
                "    status: 'active'",
                '} as typeof billingSubscriptions.$inferInsert);'
            ].join('\n')
        });
        expect(findings).toHaveLength(1);
        expect(findings[0]?.verdict).toBe('omits');
    });

    it('does not scan test files — a fixture must be able to reproduce the bug', () => {
        const { findings, sitesChecked } = scanTree({
            'packages/seed/src/a.test.ts':
                "await db.insert(billingPlans).values({ name: 'misfiled' });"
        });
        expect(findings).toEqual([]);
        expect(sitesChecked).toBe(0);
    });

    it('holds a qzpay create open only while the package cannot express it', () => {
        const source = "await billing.subscriptions.create({ customerId, planId, mode: 'paid' });";
        const root = makeTree({ 'apps/api/src/a.ts': source });
        const files = collectSourceFiles(root);

        const blocked = scanSources(root, files, false);
        expect(blocked.findings.map((f) => f.verdict)).toEqual(['blocked-by-package']);

        // The same source, once the package offers the parameter: a hard
        // failure, with no edit to the guard.
        const enforced = scanSources(root, files, true);
        expect(enforced.findings.map((f) => f.verdict)).toEqual(['omits']);
    });
});
