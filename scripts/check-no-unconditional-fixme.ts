/**
 * @file check-no-unconditional-fixme.ts
 * @description HOS-1267 — fails CI when a Playwright spec under `apps/e2e/`
 * turns a test off UNCONDITIONALLY.
 *
 * ## What this is about
 *
 * An audit of the 67 specs in `apps/e2e/tests/` found 14 whose green is
 * structurally inevitable, ten of them in the `@p0` PR gate. Four of those owed
 * it to the same construct: `test.fixme(true, '<fixed reason>')` written into
 * the middle of a test body, immediately before the assertion that justifies
 * the file. Playwright reports the result as "fixme", never as a failure, so
 * the spec keeps its place in the inventory while running nothing.
 * `host-07e-cron-demote` carried one in both of its tests for four months.
 *
 * Repairing those four is a one-off. This guard is what stops a fifth.
 *
 * ## The distinction it draws — and why it needs a parser
 *
 * A `fixme` whose condition is decided AT RUNTIME is legitimate and common
 * here: a spec that needs a billing plan the seed may not carry should defer
 * itself rather than fail. Both spellings of that are fine:
 *
 * ```ts
 * test.fixme(!planId, 'No billing plan in seed — cannot run');   // conditional arg
 * if (!planId) { test.fixme(true, 'No plan in seed'); return; }  // conditional BLOCK
 * ```
 *
 * The second spelling is why a regex cannot do this job. `apps/e2e` holds
 * roughly thirty `test.fixme(true, …)` calls and almost all of them are that
 * form — a literal `true` reached only when an enclosing `if` already decided
 * the precondition is missing. A guard anchored on the text `test.fixme(true`
 * would reject every one of them, and a guard written to dodge them by matching
 * the exact message would be defeated by rewording it.
 *
 * So the check is structural: the call is a violation when its condition is a
 * COMPILE-TIME-CONSTANT truthy value **and** nothing on the path from the
 * enclosing test callback down to the call makes it conditional.
 *
 * ## What it rejects
 *
 * 1. `test.fixme(true)` / `test.fixme(true, 'reason')` reached unconditionally.
 * 2. The same with the condition behind a `const`: `const OFF = true;
 *    test.fixme(OFF, REASON)`. Keying on the CONDITION rather than the reason
 *    is what makes moving the reason into a constant not an escape.
 * 3. A truthy literal in the condition slot — `test.fixme(1, …)`,
 *    `test.fixme('x', …)` — which Playwright treats exactly like `true`.
 * 4. `test.describe.fixme(...)` / `test.fixme.only(...)` and the other modifier
 *    chains: a whole block switched off with no condition at all.
 * 5. The declaration form `test.fixme('title', async () => {…})`, which never
 *    runs either.
 *
 * ## What it allows
 *
 * - Any `fixme` whose condition is not a compile-time constant.
 * - Any `fixme` reached only through an `if` / `else` / `switch` case /
 *   ternary / `&&` / `||` / `catch` inside the test body.
 * - `test.skip(...)` in every form. Runtime self-skipping is its own problem
 *   (the audit counts 5 specs doing it where the missing selector IS the
 *   regression), and it is deliberately NOT in scope here: this guard's message
 *   must not claim more than its predicate checks.
 *
 * ## Failure modes it defends against in itself
 *
 * A guard that silently matches nothing prints the same thing as a clean tree.
 * So the run also asserts that the scan root exists, that it contributed at
 * least `MIN_SCANNED_FILES` files, and that at least one `fixme` call of ANY
 * kind was parsed — if the AST walk stops recognising Playwright's API, this
 * fails loudly instead of passing forever.
 *
 * @see https://linear.app/hospeda-beta/issue/HOS-1267
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Repository root, resolved from this file's own location. */
export const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** The only tree this guard polices. */
export const SCAN_ROOT = 'apps/e2e';

/**
 * Floor on the number of scanned files.
 *
 * `apps/e2e` held 67 spec files plus fixtures when this was written. The floor
 * is set well below that so ordinary churn does not trip it, and well above
 * zero so a wrong cwd, a renamed directory or a changed extension fails the
 * run instead of reporting a clean tree.
 */
export const MIN_SCANNED_FILES = 40;

/** A `fixme` call the walker found, with the verdict it reached. */
export interface FixmeCall {
    /** Repo-relative path of the file holding the call. */
    readonly file: string;
    /** 1-based line number. */
    readonly line: number;
    /** The call's source text, trimmed to one line for reporting. */
    readonly snippet: string;
    /** Why this call is (or is not) a violation. */
    readonly verdict:
        | 'unconditional-constant-condition'
        | 'unconditional-modifier'
        | 'declaration-form'
        | 'allowed-runtime-condition'
        | 'allowed-conditional-block';
}

/** Verdicts that fail the run. */
const VIOLATION_VERDICTS: ReadonlySet<FixmeCall['verdict']> = new Set([
    'unconditional-constant-condition',
    'unconditional-modifier',
    'declaration-form'
]);

/**
 * Whether a `FixmeCall` fails the guard.
 *
 * @param call - A call classified by {@link findUnconditionalFixmes}.
 * @returns `true` when the call must fail CI.
 */
export function isViolation(call: FixmeCall): boolean {
    return VIOLATION_VERDICTS.has(call.verdict);
}

/**
 * Collects the `.ts` files under `dir`, recursively.
 *
 * `node_modules`, build output and Playwright's own artefact directories are
 * skipped: `test-results/` and `playwright-report/` can contain copies of spec
 * source, and counting them would both inflate the floor and report violations
 * at paths nobody can edit.
 *
 * @param dir - Absolute directory to walk.
 * @returns Absolute paths of every `.ts` file found.
 */
export function collectSourceFiles(dir: string): readonly string[] {
    const skip = new Set([
        'node_modules',
        'test-results',
        'playwright-report',
        'dist',
        '.output',
        '.turbo'
    ]);
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: string[];
        try {
            entries = readdirSync(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (skip.has(entry) || entry.startsWith('.')) continue;
            const full = join(current, entry);
            let isDir = false;
            try {
                isDir = statSync(full).isDirectory();
            } catch {
                continue;
            }
            if (isDir) {
                walk(full);
            } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
                out.push(full);
            }
        }
    };
    walk(dir);
    return out;
}

/**
 * Reads the dotted name of a call's callee, e.g. `test.fixme`,
 * `test.describe.fixme`, `test.fixme.only`.
 *
 * Returns `null` for anything that is not a plain identifier chain, so a
 * computed access (`obj[key]()`) or a call on a call is never mistaken for one.
 *
 * @param expression - The `CallExpression`'s callee.
 * @returns The dotted name, or `null`.
 */
function dottedName(expression: ts.Expression): string | null {
    const parts: string[] = [];
    let node: ts.Expression = expression;
    while (ts.isPropertyAccessExpression(node)) {
        parts.unshift(node.name.text);
        node = node.expression;
    }
    if (!ts.isIdentifier(node)) return null;
    parts.unshift(node.text);
    return parts.join('.');
}

/**
 * Whether a dotted callee name is a Playwright `fixme` entry point.
 *
 * Anchored on the SEGMENTS, not on a substring: the first segment must be
 * exactly `test` (so a helper named `mytest.fixme` or a property called
 * `notATest` never matches) and `fixme` must be one of the segments after it
 * (so `test.fixmeHelper` does not match either).
 *
 * @param name - A dotted name from {@link dottedName}.
 * @returns `true` when the call is a Playwright fixme.
 */
export function isFixmeCallee(name: string): boolean {
    const parts = name.split('.');
    if (parts.length < 2) return false;
    if (parts[0] !== 'test') return false;
    return parts.slice(1).includes('fixme');
}

/**
 * Whether the callee carries a modifier chain that switches a block off with no
 * condition slot at all — `test.describe.fixme(...)`, `test.fixme.only(...)`.
 *
 * `test.fixme(...)` itself is NOT one of these: it takes a condition, so it is
 * judged by that condition instead.
 *
 * @param name - A dotted name from {@link dottedName}.
 * @returns `true` for a modifier form.
 */
export function isUnconditionalModifierForm(name: string): boolean {
    return name !== 'test.fixme';
}

/**
 * Evaluates whether an expression is a compile-time-constant TRUTHY value,
 * resolving single-assignment `const` identifiers declared in the same file.
 *
 * This is what makes "move the reason into a constant" — and "move the
 * CONDITION into a constant" — not an escape hatch.
 *
 * @param node - The condition expression.
 * @param constants - `const` bindings collected from the file.
 * @returns `true` when the value is known at parse time and is truthy.
 */
export function isConstantTruthy(
    node: ts.Expression,
    constants: ReadonlyMap<string, ts.Expression>
): boolean {
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isNumericLiteral(node)) return Number(node.text) !== 0;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text.length > 0;
    }
    if (ts.isParenthesizedExpression(node)) return isConstantTruthy(node.expression, constants);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
        return isConstantTruthy(node.expression, constants);
    }
    if (ts.isIdentifier(node)) {
        const bound = constants.get(node.text);
        // Guard against `const A = B; const B = A;` — depth is bounded by
        // removing the binding before recursing.
        if (!bound) return false;
        const narrowed = new Map(constants);
        narrowed.delete(node.text);
        return isConstantTruthy(bound, narrowed);
    }
    return false;
}

/**
 * Collects `const NAME = <literal-ish>` bindings from a source file.
 *
 * Only `const` is collected: a `let` can be reassigned, so its value at the
 * call site is not knowable from the declaration.
 *
 * @param sourceFile - The parsed file.
 * @returns A map of binding name to its initialiser.
 */
function collectConstBindings(sourceFile: ts.SourceFile): ReadonlyMap<string, ts.Expression> {
    const map = new Map<string, ts.Expression>();
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.Const) !== 0) {
            for (const decl of node.declarations) {
                if (ts.isIdentifier(decl.name) && decl.initializer) {
                    map.set(decl.name.text, decl.initializer);
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return map;
}

/**
 * Whether anything between `node` and the enclosing test callback makes the
 * call conditionally reached.
 *
 * Walks ancestors and stops at the first function boundary — the arrow passed
 * to `test(...)` — because a branch OUTSIDE that callback says nothing about
 * whether this call runs when the test does.
 *
 * @param node - The `fixme` call.
 * @returns `true` when some branch guards the call.
 */
export function isConditionallyReached(node: ts.Node): boolean {
    let current: ts.Node | undefined = node.parent;
    let child: ts.Node = node;
    while (current) {
        if (ts.isIfStatement(current)) {
            // Only the branches are conditional; sitting in the `expression`
            // slot of an `if` is not being guarded by it.
            if (child === current.thenStatement || child === current.elseStatement) return true;
        }
        if (ts.isConditionalExpression(current)) {
            if (child === current.whenTrue || child === current.whenFalse) return true;
        }
        if (ts.isCaseClause(current) || ts.isDefaultClause(current)) return true;
        if (ts.isCatchClause(current)) return true;
        if (ts.isBinaryExpression(current)) {
            const op = current.operatorToken.kind;
            const shortCircuits =
                op === ts.SyntaxKind.AmpersandAmpersandToken ||
                op === ts.SyntaxKind.BarBarToken ||
                op === ts.SyntaxKind.QuestionQuestionToken;
            if (shortCircuits && child === current.right) return true;
        }
        if (
            ts.isArrowFunction(current) ||
            ts.isFunctionExpression(current) ||
            ts.isFunctionDeclaration(current) ||
            ts.isMethodDeclaration(current)
        ) {
            // Reached the test body's own boundary — nothing above it applies.
            return false;
        }
        child = current;
        current = current.parent;
    }
    return false;
}

/** Input for {@link findUnconditionalFixmes}. */
export interface FixmeScanInput {
    /** Full source text to parse. */
    readonly source: string;
    /** Label used in the results (typically a repo-relative path). */
    readonly fileLabel: string;
}

/**
 * Classifies every Playwright `fixme` call in one source file.
 *
 * @param input - Source text and the label to report it under.
 * @returns One entry per `fixme` call found, violations and allowed alike.
 */
export function findUnconditionalFixmes(input: FixmeScanInput): readonly FixmeCall[] {
    const { source, fileLabel } = input;
    const sourceFile = ts.createSourceFile(
        fileLabel,
        source,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TS
    );
    const constants = collectConstBindings(sourceFile);
    const found: FixmeCall[] = [];

    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
            const name = dottedName(node.expression);
            if (name !== null && isFixmeCallee(name)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(
                    node.getStart(sourceFile)
                );
                const snippet = node
                    .getText(sourceFile)
                    .split('\n')
                    .map((l) => l.trim())
                    .join(' ')
                    .slice(0, 160);
                found.push({
                    file: fileLabel,
                    line: line + 1,
                    snippet,
                    verdict: classify(node, name, constants)
                });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found;
}

/**
 * Decides the verdict for one `fixme` call.
 *
 * @param node - The call.
 * @param name - Its dotted callee name.
 * @param constants - `const` bindings from the same file.
 * @returns The verdict.
 */
function classify(
    node: ts.CallExpression,
    name: string,
    constants: ReadonlyMap<string, ts.Expression>
): FixmeCall['verdict'] {
    if (isUnconditionalModifierForm(name)) return 'unconditional-modifier';

    const first = node.arguments[0];
    if (!first) return 'unconditional-constant-condition';

    // `test.fixme('title', fn)` — the declaration form. A string in the FIRST
    // slot followed by a function is a deferred test, not a condition.
    const second = node.arguments[1];
    const firstIsString = ts.isStringLiteral(first) || ts.isTemplateExpression(first);
    const secondIsFn =
        second !== undefined && (ts.isArrowFunction(second) || ts.isFunctionExpression(second));
    if (firstIsString && secondIsFn) return 'declaration-form';

    if (!isConstantTruthy(first, constants)) return 'allowed-runtime-condition';
    if (isConditionallyReached(node)) return 'allowed-conditional-block';
    return 'unconditional-constant-condition';
}

/** Outcome of a whole-tree scan. */
export interface ScanResult {
    readonly scannedFiles: number;
    readonly allCalls: readonly FixmeCall[];
    readonly violations: readonly FixmeCall[];
}

/**
 * Scans every `.ts` file under `<root>/apps/e2e`.
 *
 * @param root - Repository root to scan (overridable so tests can point it at a
 *   throwaway tree).
 * @returns The scan totals and the violations found.
 */
export function scanRepo(root: string = REPO_ROOT): ScanResult {
    const dir = join(root, SCAN_ROOT);
    const files = collectSourceFiles(dir);
    const allCalls: FixmeCall[] = [];
    for (const file of files) {
        const source = readFileSync(file, 'utf-8');
        if (!source.includes('.fixme')) continue;
        allCalls.push(...findUnconditionalFixmes({ source, fileLabel: relative(root, file) }));
    }
    return {
        scannedFiles: files.length,
        allCalls,
        violations: allCalls.filter(isViolation)
    };
}

/**
 * CLI entry point.
 *
 * @param root - Repository root (tests override it).
 * @returns Process exit code: 0 clean, 1 violations or a self-check failure.
 */
export function run(root: string = REPO_ROOT): number {
    const problems: string[] = [];
    let result: ScanResult;
    try {
        result = scanRepo(root);
    } catch (error) {
        console.error(
            `check-no-unconditional-fixme: scan of ${join(root, SCAN_ROOT)} threw — ${
                error instanceof Error ? error.message : String(error)
            }`
        );
        return 1;
    }

    // Self-checks first: a scan that matched nothing must not read as clean.
    if (result.scannedFiles < MIN_SCANNED_FILES) {
        problems.push(
            `only ${result.scannedFiles} file(s) scanned under ${SCAN_ROOT}, expected at least ` +
                `${MIN_SCANNED_FILES}. The scan root moved, the cwd is wrong, or the extension ` +
                'filter no longer matches — this is not a clean tree.'
        );
    }
    if (result.allCalls.length === 0) {
        problems.push(
            `no Playwright fixme call of ANY kind was parsed under ${SCAN_ROOT}. The suite has ` +
                'always carried conditional seed guards, so zero means the AST walk stopped ' +
                'recognising the API, not that the tree is clean.'
        );
    }

    if (problems.length > 0) {
        console.error('=== check-no-unconditional-fixme: SELF-CHECK FAILED ===');
        for (const p of problems) console.error(`  - ${p}`);
        return 1;
    }

    if (result.violations.length > 0) {
        console.error('=== Unconditional test.fixme found (HOS-1267) ===\n');
        for (const v of result.violations) {
            console.error(`  ${v.file}:${v.line}  [${v.verdict}]`);
            console.error(`      ${v.snippet}\n`);
        }
        console.error(
            'A fixme that is reached unconditionally turns the test off forever while it keeps\n' +
                'its place in the suite inventory: Playwright reports "fixme", never a failure.\n\n' +
                'If the precondition is decided at runtime, say so — `test.fixme(!planId, "...")`,\n' +
                'or a `test.fixme(true, "...")` inside the `if` that detected it. If the test cannot\n' +
                'be made to run, delete it; a guard that cannot fail is worse than no guard, because\n' +
                'it is counted as coverage.\n'
        );
        return 1;
    }

    console.log(
        `check-no-unconditional-fixme: OK — ${result.scannedFiles} file(s) scanned under ` +
            `${SCAN_ROOT}, ${result.allCalls.length} fixme call(s) classified, none unconditional.`
    );
    return 0;
}

// Only run when invoked directly, so the test file can import the predicates.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(run());
}
