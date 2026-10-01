/**
 * Unit tests for the unconditional-fixme guard (HOS-1267).
 *
 * These pin the guard's PREDICATE, not the repository's current state. The
 * repo-wide run is the CI step; this is what stops the predicate from quietly
 * becoming unable to fail.
 *
 * The distinction under test is narrow and easy to get backwards in both
 * directions, so both directions are covered:
 *
 *  - Too strict — rejecting `if (!planId) { test.fixme(true, '...'); }`, which
 *    is the legitimate seed guard roughly thirty specs in `apps/e2e` use. A
 *    guard that fails on those gets disabled within a day.
 *  - Too loose — accepting an unconditional switch-off that merely LOOKS
 *    different: the reason moved into a constant, the condition moved into a
 *    constant, a truthy non-boolean, `test.describe.fixme`, or the
 *    `test.fixme('title', fn)` declaration form. An anchor tied to one
 *    syntactic shape lets the other four through.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    findUnconditionalFixmes,
    isConstantTruthy,
    isFixmeCallee,
    isViolation,
    MIN_SCANNED_FILES,
    run,
    SCAN_ROOT,
    scanRepo
} from '../check-no-unconditional-fixme.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Writes `files` (repo-relative paths) into a throwaway repo root. */
function makeTree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'hos1267-fixme-'));
    dirs.push(root);
    for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content, 'utf-8');
    }
    return root;
}

/** Classifies one synthetic source and returns only the violating calls. */
function violationsIn(source: string) {
    return findUnconditionalFixmes({ source, fileLabel: 'synthetic.spec.ts' }).filter(isViolation);
}

/** Wraps a body in a minimal Playwright test so the AST has a real callback. */
function inTest(body: string): string {
    return [
        "import { expect, test } from '@playwright/test';",
        "test('some test', async ({ page }) => {",
        body,
        "    await expect(page).toHaveTitle('x');",
        '});'
    ].join('\n');
}

// ---------------------------------------------------------------------------
// The trap cases — each of these MUST be reported
// ---------------------------------------------------------------------------

describe('rejects an unconditional fixme, in every shape it takes', () => {
    it('flags test.fixme(true, <fixed reason>) — the canonical case', () => {
        // Arrange: the exact construct HOS-1267 was opened about.
        const source = inTest(
            "    test.fixme(true, 'HTTP cron trigger removed in VPS migration');"
        );

        // Act
        const found = violationsIn(source);

        // Assert
        expect(found).toHaveLength(1);
        expect(found[0]?.verdict).toBe('unconditional-constant-condition');
        expect(found[0]?.line).toBe(3);
    });

    it('flags a bare test.fixme(true) with no reason at all', () => {
        // Arrange
        const source = inTest('    test.fixme(true);');

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(1);
    });

    it('flags it when the REASON is moved into a constant', () => {
        // Arrange: moving the message out of the call must not change the verdict —
        // the guard keys on the condition, not on the text beside it.
        const source = [
            "import { test } from '@playwright/test';",
            "const REASON = 'needs its own investigation';",
            "test('t', async () => {",
            '    test.fixme(true, REASON);',
            '});'
        ].join('\n');

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(1);
    });

    it('flags it when the CONDITION is moved into a constant', () => {
        // Arrange: `const OFF = true` is the most obvious way around a guard that
        // only recognises the `true` keyword in the argument position.
        const source = [
            "import { test } from '@playwright/test';",
            'const OFF = true;',
            "test('t', async () => {",
            "    test.fixme(OFF, 'disabled');",
            '});'
        ].join('\n');

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(1);
    });

    it('flags a truthy non-boolean literal in the condition slot', () => {
        // Arrange: Playwright coerces, so `1` switches the test off exactly like
        // `true` does.
        const source = inTest("    test.fixme(1, 'disabled');");

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(1);
    });

    it('flags test.describe.fixme — a whole block, no condition slot', () => {
        // Arrange
        const source = [
            "import { test } from '@playwright/test';",
            "test.describe.fixme('a whole suite', () => {",
            "    test('t', async () => {});",
            '});'
        ].join('\n');

        // Act
        const found = violationsIn(source);

        // Assert
        expect(found).toHaveLength(1);
        expect(found[0]?.verdict).toBe('unconditional-modifier');
    });

    it("flags the declaration form test.fixme('title', fn)", () => {
        // Arrange: a deferred test. It never runs either, and it is the shape the
        // repo's existing no-silent-skip guard deliberately BLESSES (a string
        // argument counts as documentation there), so this guard has to be the
        // one that sees it.
        const source = [
            "import { test } from '@playwright/test';",
            "test.fixme('startTrial compensation', async () => {",
            '    // body',
            '});'
        ].join('\n');

        // Act
        const found = violationsIn(source);

        // Assert
        expect(found).toHaveLength(1);
        expect(found[0]?.verdict).toBe('declaration-form');
    });
});

// ---------------------------------------------------------------------------
// The legitimate cases — none of these may be reported
// ---------------------------------------------------------------------------

describe('allows a fixme whose precondition is decided at runtime', () => {
    it('allows a non-constant condition argument', () => {
        // Arrange
        const source = inTest("    test.fixme(!planId, 'No billing plan in seed — cannot run');");

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(0);
    });

    it('allows test.fixme(true) INSIDE an if — the form ~30 specs use', () => {
        // Arrange: this is the shape a text-anchored guard would wrongly reject,
        // and rejecting it is how a guard gets deleted instead of obeyed.
        const source = inTest(
            [
                '    if (!planId) {',
                "        test.fixme(true, 'No billing plan in seed — ADM-01 cannot run');",
                '        return;',
                '    }'
            ].join('\n')
        );

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(0);
    });

    it('allows it in an else branch', () => {
        // Arrange
        const source = inTest(
            [
                '    if (planId) {',
                '        // happy path',
                '    } else {',
                "        test.fixme(true, 'no plan');",
                '    }'
            ].join('\n')
        );

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(0);
    });

    it('allows it behind a short-circuit', () => {
        // Arrange
        const source = inTest("    !planId && test.fixme(true, 'no plan');");

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(0);
    });

    it('allows a constant FALSY condition', () => {
        // Arrange: `test.fixme(false, ...)` disables nothing.
        const source = inTest("    test.fixme(false, 'left in by accident');");

        // Act / Assert
        expect(violationsIn(source)).toHaveLength(0);
    });

    it('leaves test.skip alone in every form — it is out of this guard’s scope', () => {
        // Arrange: runtime self-skipping is a separate defect class (the audit
        // counts five specs doing it). This guard's message promises only that no
        // fixme is unconditional, so it must not report skips — a message that
        // claims more than the predicate checks is its own bug.
        const skipCall = `test.${'skip'}`;
        const source = inTest(
            [`    ${skipCall}(true, 'disabled');`, `    ${skipCall}();`].join('\n')
        );

        // Act
        const all = findUnconditionalFixmes({ source, fileLabel: 'synthetic.spec.ts' });

        // Assert
        expect(all).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Anchoring — lookalikes must not match
// ---------------------------------------------------------------------------

describe('is anchored on the callee, not on a substring', () => {
    it.each([
        ['mytest.fixme', false],
        ['testHelper.fixme', false],
        ['obj.fixme', false],
        ['test.fixmeHelper', false],
        ['fixme', false],
        ['test.fixme', true],
        ['test.describe.fixme', true],
        ['test.fixme.only', true]
    ])('isFixmeCallee(%s) === %s', (name, expected) => {
        expect(isFixmeCallee(name as string)).toBe(expected);
    });

    it('does not flag a fixme-shaped call on another object', () => {
        // Arrange
        const source = inTest("    helper.fixme(true, 'not playwright');");

        // Act / Assert
        expect(findUnconditionalFixmes({ source, fileLabel: 'x.ts' })).toHaveLength(0);
    });

    it('does not read prose about test.fixme(true) as code', () => {
        // Arrange: the repo's own docblocks discuss this construct at length,
        // including in the very files the guard scans.
        const source = [
            '/**',
            " * This spec used to carry test.fixme(true, 'a fixed reason') right here.",
            ' */',
            "import { test } from '@playwright/test';",
            "test('t', async () => {",
            '    const note = "test.fixme(true, \'in a string\')";',
            '    void note;',
            '});'
        ].join('\n');

        // Act / Assert
        expect(findUnconditionalFixmes({ source, fileLabel: 'x.ts' })).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// isConstantTruthy, directly
// ---------------------------------------------------------------------------

describe('isConstantTruthy resolves through const bindings', () => {
    it('does not loop forever on a circular const pair', () => {
        // Arrange: `const A = B; const B = A;` is not valid at runtime, but the
        // guard must not hang on it either.
        const source = [
            "import { test } from '@playwright/test';",
            'const A = B;',
            'const B = A;',
            "test('t', async () => {",
            "    test.fixme(A, 'x');",
            '});'
        ].join('\n');

        // Act / Assert — terminates, and cannot prove truthiness.
        expect(violationsIn(source)).toHaveLength(0);
    });

    it('is exported for direct use', () => {
        expect(typeof isConstantTruthy).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// Whole-tree scan + self-checks
// ---------------------------------------------------------------------------

describe('scanRepo / run', () => {
    /** Enough filler files to clear the floor, none of them containing a fixme. */
    function fillerFiles(count: number): Record<string, string> {
        const out: Record<string, string> = {};
        for (let i = 0; i < count; i++) {
            out[`${SCAN_ROOT}/tests/filler-${i}.spec.ts`] = "export const n = 'noop';\n";
        }
        return out;
    }

    it('reports a violation found anywhere in the tree', () => {
        // Arrange
        const root = makeTree({
            ...fillerFiles(MIN_SCANNED_FILES),
            [`${SCAN_ROOT}/tests/bad.spec.ts`]: inTest("    test.fixme(true, 'off');"),
            [`${SCAN_ROOT}/tests/good.spec.ts`]: inTest("    test.fixme(!planId, 'seed');")
        });

        // Act
        const result = scanRepo(root);

        // Assert
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]?.file).toContain('bad.spec.ts');
        expect(run(root)).toBe(1);
    });

    it('passes a tree whose fixmes are all conditional', () => {
        // Arrange
        const root = makeTree({
            ...fillerFiles(MIN_SCANNED_FILES),
            [`${SCAN_ROOT}/tests/good.spec.ts`]: inTest("    test.fixme(!planId, 'seed');")
        });

        // Act / Assert
        expect(scanRepo(root).violations).toHaveLength(0);
        expect(run(root)).toBe(0);
    });

    it('FAILS on a tree it cannot see — an empty scan is not a clean scan', () => {
        // Arrange: the wrong cwd, a moved directory or a changed extension all
        // look identical to a clean tree unless the guard checks its own reach.
        const root = makeTree({ 'somewhere/else.ts': 'export const x = 1;\n' });

        // Act / Assert
        expect(run(root)).toBe(1);
    });

    it('FAILS when the tree has files but no fixme call is recognised', () => {
        // Arrange: enough files to clear the floor and not one fixme. In this
        // suite that means the AST walk stopped recognising Playwright's API,
        // which must be loud rather than green.
        const root = makeTree(fillerFiles(MIN_SCANNED_FILES));

        // Act / Assert
        expect(run(root)).toBe(1);
    });

    it('ignores Playwright artefact directories', () => {
        // Arrange: test-results/ holds copies of spec source; a violation there
        // is not something anyone can edit.
        const root = makeTree({
            ...fillerFiles(MIN_SCANNED_FILES),
            [`${SCAN_ROOT}/tests/good.spec.ts`]: inTest("    test.fixme(!planId, 'seed');"),
            [`${SCAN_ROOT}/test-results/copy.spec.ts`]: inTest("    test.fixme(true, 'off');"),
            [`${SCAN_ROOT}/node_modules/dep/index.ts`]: inTest("    test.fixme(true, 'off');")
        });

        // Act / Assert
        expect(scanRepo(root).violations).toHaveLength(0);
    });
});
