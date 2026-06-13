/**
 * Silent-skip detector utility for the SPEC-217 no-silent-skip regression guard.
 *
 * Exported as a plain TypeScript module (not a test file) so biome's
 * `noExportsInTest` rule is satisfied and the logic is usable from both the
 * real-file guard tests and the self-tests.
 *
 * @see apps/e2e/test/unit/no-silent-skip-guard.test.ts
 * @see SPEC-217 T-015
 */

// ── Types ──────────────────────────────────────────────────────────────────

/** A `test.skip` / `test.fixme` occurrence that passed the documentation check. */
export interface AllowedSkip {
    readonly file: string;
    readonly line: number;
    readonly kind: 'skip' | 'fixme';
    readonly reason: 'has-reason-string' | 'has-annotation';
}

/** A `test.skip` / `test.fixme` occurrence that has NO documentation. */
export interface SilentSkip {
    readonly file: string;
    readonly line: number;
    readonly kind: 'skip' | 'fixme';
    readonly snippet: string;
}

/** Result produced by `detectSilentSkips`. */
export interface SkipDetectionResult {
    readonly silent: readonly SilentSkip[];
    readonly allowed: readonly AllowedSkip[];
}

/** Input for `detectSilentSkips`. */
export interface SkipDetectionInput {
    /** Full source text to scan. */
    readonly source: string;
    /** Label used in result entries (typically the file path). */
    readonly fileLabel: string;
}

// ── Annotation keywords that bless a nearby skip ──────────────────────────

/**
 * Keywords that, when present in a comment within the 6 lines preceding a
 * `test.skip` / `test.fixme` call, mark the skip as documented.
 *
 * Rationale for each:
 *   - `@skip-reason` — explicit opt-in marker for ad-hoc inline comments.
 *   - `SKIP-PRECONDITION:` — structured label form used in JSDoc-style blocks.
 *   - `SPEC-` — any reference to a formal spec entry (SPEC-NNN T-NNN / FINDING N)
 *     documents the skip's origin; broad enough to catch `SPEC-217 T-012`.
 *   - `deferred` — plain English defer note present in host-07d's comment block.
 *   - `Re-enable` — signals the intentional deferral pattern ("Re-enable … if").
 *   - `compensation not injectable` — host-07d specific wording captured here
 *     so the detection is self-documenting even without a SPEC marker.
 */
export const ANNOTATION_KEYWORDS = [
    '@skip-reason',
    'SKIP-PRECONDITION:',
    'SPEC-',
    'deferred',
    'Re-enable',
    'compensation not injectable'
] as const;

// ── Core detector ──────────────────────────────────────────────────────────

/**
 * Detects `test.skip(` and `test.fixme(` occurrences in the given source and
 * classifies each as either "allowed" (documented) or "silent" (undocumented).
 *
 * **Allowed** when EITHER:
 *   (a) The call supplies a non-empty string literal as its first or second
 *       argument (single-/double-quoted or template literal).
 *       This covers:
 *         - `test.fixme(condition, 'reason')` — reason string is second arg
 *         - `test.fixme('title', fn)` — title string is first arg (deferred-test form)
 *       Detection: scans the call's balanced argument list (paren-scoped,
 *       multiline-safe), so unrelated strings in the test body don't bless it.
 *   (b) A comment in the 6 lines immediately preceding the call contains at
 *       least one of the `ANNOTATION_KEYWORDS`.
 *
 * **Silent** when neither (a) nor (b) is satisfied.
 *
 * Examples of SILENT patterns (regression signals):
 *   - `test.skip()`                    — bare call, no arguments
 *   - `test.fixme(true)`               — condition only, no reason
 *   - `test.skip(someCondition)`       — flag only, no reason, no annotation comment
 *
 * Examples of ALLOWED patterns:
 *   - `test.fixme(true, 'No plan — cannot run')` — has reason string
 *   - `test.fixme('title', async () => { ... })` — has title string
 *   - `test.fixme(/regex/.test(msg), 'reason')` — has reason string (multiline OK)
 *   - `// SPEC-217 T-012 / deferred` + `test.fixme(true)` — has annotation keyword
 *
 * @param input - Source text and file label.
 * @returns Classification of every skip/fixme found.
 */
export function detectSilentSkips({ source, fileLabel }: SkipDetectionInput): SkipDetectionResult {
    const lines = source.split('\n');
    const silent: SilentSkip[] = [];
    const allowed: AllowedSkip[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';

        // Match `test.skip(` or `test.fixme(` — word-boundary safe (not inside
        // an identifier like `_fixme` or a string/comment containing the pattern).
        const skipMatch = /\btest\.(skip|fixme)\s*\(/.exec(line);
        if (!skipMatch) continue;

        const kind = skipMatch[1] as 'skip' | 'fixme';
        const lineNumber = i + 1; // 1-based

        // ── Check (a): string literal inside THIS call's argument list ───
        // Scan from the call's own opening paren, balancing parens across
        // lines, so the check is scoped to the actual arguments (not nearby
        // body code). `skipMatch[0]` ends with `(`, so its last char index in
        // `line` is the opening paren; the remainder from this line onward is
        // the multiline argument source.
        const openParenIndexInLine = skipMatch.index + skipMatch[0].length - 1;
        const remainder = lines.slice(i).join('\n');
        const hasReasonString = argsContainStringLiteral(remainder, openParenIndexInLine + 1);

        if (hasReasonString) {
            allowed.push({ file: fileLabel, line: lineNumber, kind, reason: 'has-reason-string' });
            continue;
        }

        // ── Check (b): annotation keyword in preceding 6 lines ───────────
        const precedingStart = Math.max(0, i - 6);
        const precedingLines = lines.slice(precedingStart, i).join('\n');
        const hasAnnotation = ANNOTATION_KEYWORDS.some((kw) => precedingLines.includes(kw));

        if (hasAnnotation) {
            allowed.push({ file: fileLabel, line: lineNumber, kind, reason: 'has-annotation' });
            continue;
        }

        // ── Neither: silent skip ─────────────────────────────────────────
        silent.push({
            file: fileLabel,
            line: lineNumber,
            kind,
            snippet: line.trim().slice(0, 120)
        });
    }

    return { silent, allowed };
}

// ── Internal helper ────────────────────────────────────────────────────────

/**
 * Returns true when the argument list of a `test.skip/fixme(` call contains a
 * string literal. The scan is scoped to THIS call's arguments by balancing
 * parentheses from its opening paren: the first quote reached (single-, double-,
 * or backtick) means a reason/title string is present; reaching the matching
 * close paren first means there is none.
 *
 * Scoping to the balanced argument list (rather than a fixed line window) is
 * what makes the guard catch the real regression — e.g. dropping the reason
 * from `test.fixme(cond, 'reason')` to `test.fixme(cond)` — even when the
 * surrounding test body contains unrelated string literals.
 *
 * Catches:
 *   - `test.fixme(cond, 'reason')` — reason as second arg
 *   - `test.fixme('title', fn)` — title as first arg (deferred-test form)
 *   - multiline variants where the string appears on a later line
 *
 * @param text - Source text whose `start` index points just past the call's `(`.
 * @param start - Index of the first character inside the argument list.
 * @returns Whether a string literal is present in the argument list.
 */
function argsContainStringLiteral(text: string, start: number): boolean {
    let depth = 1; // already inside the call's opening paren
    for (let j = start; j < text.length; j++) {
        const ch = text[j];
        if (ch === "'" || ch === '"' || ch === '`') return true;
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) return false;
        }
    }
    return false;
}
