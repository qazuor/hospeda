/**
 * T-015: No-silent-skip regression guard for SPEC-217 target specs.
 *
 * Ensures that every `test.skip(` / `test.fixme(` occurrence in the six
 * SPEC-217 target spec files is documented, preventing silent regression back
 * to "skipped forever" without explanation.
 *
 * Convention (see `detectSilentSkips` in skip-detector.ts for the full rule):
 *   - A skip/fixme is ALLOWED when the call supplies a string literal argument
 *     (reason or title), OR when a nearby comment within 6 lines above contains
 *     an annotation keyword (`@skip-reason`, `SKIP-PRECONDITION:`, `SPEC-`,
 *     `deferred`, `Re-enable`, `compensation not injectable`).
 *   - A skip/fixme is SILENT (regression) when neither condition is met.
 *
 * @see SPEC-217 T-015
 * @see apps/e2e/test/unit/skip-detector.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANNOTATION_KEYWORDS, detectSilentSkips } from './skip-detector.ts';

// ── Target spec files ──────────────────────────────────────────────────────

const E2E_ROOT = join(import.meta.dirname, '..', '..');

const TARGET_SPECS = [
    'tests/host/host-03-trial-expired.spec.ts',
    'tests/host/host-04-cancellation-grace.spec.ts',
    'tests/host/host-07b-subscription-required.spec.ts',
    'tests/host/host-07c-qzpay-timeout.spec.ts',
    'tests/host/host-07d-tx-compensation.spec.ts',
    'tests/resilience/res-01-api-down-checkout.spec.ts'
] as const;

// ── Real-file guard tests ──────────────────────────────────────────────────

describe('T-015: no-silent-skip guard — SPEC-217 target specs', () => {
    for (const relPath of TARGET_SPECS) {
        it(`${relPath} — no undocumented skip/fixme`, () => {
            const absPath = join(E2E_ROOT, relPath);
            const source = readFileSync(absPath, 'utf-8');
            const { silent } = detectSilentSkips({ source, fileLabel: relPath });

            expect(
                silent,
                silent.length > 0
                    ? `Silent skip(s) found:\n${silent
                          .map((s) => `  ${s.file}:${s.line} [${s.kind}] — ${s.snippet}`)
                          .join(
                              '\n'
                          )}\nAdd a reason string or a comment with one of: ${ANNOTATION_KEYWORDS.join(', ')}`
                    : ''
            ).toHaveLength(0);
        });
    }
});

// ── Self-tests: prove the detector catches bad skips + passes good ones ────

describe('T-015: detector self-tests', () => {
    it('flags a silent test.skip with no arguments and no annotation', () => {
        // Arrange: bare `test.skip()` with no reason string and no comment —
        // the classic "skip everything unconditionally" anti-pattern.
        const source = [
            "import { test } from '@playwright/test';",
            "test('some test', () => {",
            '  test.skip();',
            '});'
        ].join('\n');

        // Act
        const { silent, allowed } = detectSilentSkips({ source, fileLabel: 'synthetic-bad.ts' });

        // Assert: exactly one silent skip detected.
        expect(silent).toHaveLength(1);
        expect(allowed).toHaveLength(0);
        expect(silent[0]?.kind).toBe('skip');
        expect(silent[0]?.line).toBe(3);
    });

    it('flags a silent test.fixme called with only a boolean (no reason string, no annotation)', () => {
        // Arrange: `test.fixme(true)` — condition only, no reason string, no comment.
        // This is the silent-regression form we are guarding against.
        const source = [
            "import { test } from '@playwright/test';",
            "test('broken test', () => {",
            '  test.fixme(true);',
            '});'
        ].join('\n');

        // Act
        const { silent } = detectSilentSkips({ source, fileLabel: 'synthetic-fixme-bad.ts' });

        // Assert: the fixme is detected as silent.
        expect(silent.length).toBeGreaterThanOrEqual(1);
        expect(silent.some((s) => s.kind === 'fixme')).toBe(true);
    });

    it('passes a test.fixme with a reason string as second arg', () => {
        // Arrange: standard conditional form — condition + reason string.
        const source = [
            "import { test } from '@playwright/test';",
            "test('foo', () => {",
            "  if (!planId) { test.fixme(true, 'No plan in seed — cannot run'); return; }",
            '});'
        ].join('\n');

        // Act
        const { silent, allowed } = detectSilentSkips({ source, fileLabel: 'synthetic-good-a.ts' });

        // Assert
        expect(silent).toHaveLength(0);
        expect(allowed).toHaveLength(1);
        expect(allowed[0]?.reason).toBe('has-reason-string');
    });

    it('passes a test.fixme title-form (deferred test) — mirrors host-07d', () => {
        // Arrange: mirrors host-07d — whole test deferred. The title string in
        // the first argument position classifies as `has-reason-string` (the
        // title itself is the documentation of what is deferred).
        const source = [
            "import { test } from '@playwright/test';",
            '// SPEC-217 T-012 / FINDING 2: deferred. The compensation contract',
            '// is covered by unit tests. Re-enable if a fault seam is added.',
            "test.fixme('startTrial OK + failure → compensation fires', async () => {",
            '  // body',
            '});'
        ].join('\n');

        // Act
        const { silent, allowed } = detectSilentSkips({ source, fileLabel: 'synthetic-good-b.ts' });

        // Assert: no silent skips. The title form counts as `has-reason-string`
        // because a string literal is present as the first argument.
        expect(silent).toHaveLength(0);
        expect(allowed).toHaveLength(1);
        expect(allowed[0]?.reason).toBe('has-reason-string');
    });

    it('passes a test.fixme with a multiline argument list containing a reason string', () => {
        // Arrange: mirrors host-07c — multiline call.
        const source = [
            "import { test } from '@playwright/test';",
            "test('bar', () => {",
            '  test.fixme(',
            '    /endpoint not mounted/.test(msg),',
            "    'endpoint disabled — set ENABLED=true'",
            '  );',
            '});'
        ].join('\n');

        // Act
        const { silent, allowed } = detectSilentSkips({
            source,
            fileLabel: 'synthetic-good-c.ts'
        });

        // Assert
        expect(silent).toHaveLength(0);
        expect(allowed).toHaveLength(1);
    });

    it('flags a silent fixme even when the test body has unrelated string literals', () => {
        // Arrange: the real regression — a documented `test.fixme(cond, 'reason')`
        // is reduced to `test.fixme(cond)` (reason dropped). The surrounding body
        // still has strings (URLs, expect messages), which must NOT bless it.
        const source = [
            "import { test } from '@playwright/test';",
            "test('regressed', () => {",
            '  if (!planId) { test.fixme(true); return; }',
            "  const url = 'http://localhost:3001/api';",
            "  expect(url, 'should be set').toBeTruthy();",
            '});'
        ].join('\n');

        // Act
        const { silent } = detectSilentSkips({ source, fileLabel: 'synthetic-regressed.ts' });

        // Assert: paren-scoped detection ignores the body strings.
        expect(silent).toHaveLength(1);
        expect(silent[0]?.kind).toBe('fixme');
        expect(silent[0]?.line).toBe(3);
    });

    it('passes when annotation keyword appears in preceding comment (no reason string)', () => {
        // Arrange: skip with only an annotation comment and no second string arg.
        const source = [
            "import { test } from '@playwright/test';",
            '// @skip-reason: waiting for upstream fix',
            'test.skip();'
        ].join('\n');

        // Act
        const { silent, allowed } = detectSilentSkips({
            source,
            fileLabel: 'synthetic-good-d.ts'
        });

        // Assert
        expect(silent).toHaveLength(0);
        expect(allowed.some((a) => a.reason === 'has-annotation')).toBe(true);
    });
});
