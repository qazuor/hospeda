/**
 * @file handler.lockout-gate.guard.test.ts
 *
 * Static guard for H-56: every lockout-recording site in `handler.ts` must be
 * gated by `shouldCountAuthAttempt`.
 *
 * Why a guard and not four more unit tests: the bug was never that the rule was
 * wrong, it was that four independent call sites each re-implemented the
 * exclusion by hand and only one status made it in. Sign-in wrote
 * `response.status === 200`; the other three wrote `response.status !== 429`.
 * Testing today's four sites would not stop a fifth endpoint from being added
 * next month with the same hand-rolled condition. This asserts the property that
 * actually matters — no recording site escapes the gate — and fails on the
 * addition, not on the incident.
 *
 * The check reads the real source file, and it counts CALLS (an opening paren)
 * rather than bare identifiers, so the import statement at the top of the file
 * is not mistaken for a call site.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HANDLER_PATH = join(__dirname, '../../../src/routes/auth/handler.ts');

/**
 * Counts non-overlapping matches of a pattern in a string.
 *
 * @param params.source - Text to scan.
 * @param params.pattern - Global regular expression to count.
 * @returns How many times the pattern matched.
 */
const countMatches = (params: { source: string; pattern: RegExp }): number =>
    params.source.match(params.pattern)?.length ?? 0;

describe('handler.ts lockout gate (H-56 static guard)', () => {
    const source = readFileSync(HANDLER_PATH, 'utf8');

    it('reads a source file that actually contains the handler (instrument check)', () => {
        // A guard that silently scanned an empty or wrong file would report
        // "nothing wrong" forever. Prove the target is really here first.
        expect(source.length).toBeGreaterThan(1000);
        expect(source).toContain('shouldCountAuthAttempt');
        expect(source).toContain("app.post('/sign-in/email'");
    });

    it('gates every lockout-recording call site', () => {
        // `recordFailedAttempt(` and `recordFailedAttemptByKey(` are the two
        // functions that increment a counter and can lock an account.
        const recordingCallSites = countMatches({
            source,
            pattern: /\brecordFailedAttempt(?:ByKey)?\(/g
        });
        const gateUsages = countMatches({
            source,
            pattern: /\bshouldCountAuthAttempt\(\{\s*status:\s*response\.status\s*\}\)/g
        });

        expect(recordingCallSites).toBeGreaterThan(0);
        expect(gateUsages).toBe(recordingCallSites);
    });

    it('leaves no hand-rolled 429-only exclusion behind', () => {
        // The exact shape of the bug: an attempt-counting condition that
        // excluded the rate limit and nothing else, so every 5xx counted.
        expect(source).not.toMatch(/response\.status\s*!==\s*429/);
    });

    it('keeps the gate exported so it cannot drift from its tests', () => {
        expect(source).toMatch(/^export const shouldCountAuthAttempt/m);
    });
});
