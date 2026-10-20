/**
 * @file check-plegable-discard.ts
 * @description GUARD:G-R2 (HOS-1352 program, built by V3 / HOS-1439, AC:V3:2,
 * TEST:V3:3): the fold of the effective set never folds a source of class
 * `COMPLEMENT` when the set has no live `TITLE` that is not a `TRIAL`
 * (`V/15` §2.6).
 *
 * ## What the predicate checks
 *
 * The discard lives in the resolution's single fold locus (`V/17` §1.3 forbids
 * resolving the steps per call site), so the guard reads that module and
 * requires its two halves to still be wired:
 *
 * - (a) the fold reaches the plegable set through `selectPlegableSources`
 *       (`fold.ts`), and
 * - (b) that selector actually GATES the complements with `hasLiveNonTrialTitle`
 *       (`plegable.ts`).
 *
 * ## Why (b) needs a parser, not a substring
 *
 * A presence check (`hasLiveNonTrialTitle(` appears, `'COMPLEMENT'` appears)
 * passes over a selector whose filter has been NEUTRALISED: `… || true`,
 * `true || …`, or a predicate that drops the helper's result. The class
 * `COMPLEMENT` is still named and the helper is still called, yet every
 * complement is admitted and the discard is gone. So (b) parses the selector
 * with the TypeScript compiler and requires, inside a returned `.filter(...)`,
 * a callback whose predicate BOTH excludes `COMPLEMENT` and consumes the result
 * of a `hasLiveNonTrialTitle(...)` call, and that contains no compile-time-true
 * operand of an `||`.
 *
 * ## What it does NOT prove, so a green run is not read as more
 *
 * It is a static structure check over one directory: it does not prove that
 * every call path in the app resolves through the fold, nor that `TRIAL` is the
 * only exclusion the condition needs. It proves the single-locus resolution
 * still gates the complements, which is the property AC:V3:2 names. A
 * neutralisation hidden behind indirection the parser does not follow (a helper
 * that returns `true` unconditionally) is out of its reach.
 *
 * Exit codes: 0 = clean; 1 = a half is missing, or the resolution is absent.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { isConstantTruthy } from './check-no-unconditional-fixme.js';
import { stripComments } from './check-vertical-axis-items.js';

/** Where the resolution lives; the guard reads every production file in it. */
export const RESOLUTION_DIR = 'packages/verticals/src/effective-set';

/** The two halves of the condition, each named by the message when it is absent. */
export type GR2Half = 'fold-through-selector' | 'selector-gates-complement';

/** The message per half. Each claims only what its predicate verifies. */
export const RULE_MESSAGES: Readonly<Record<GR2Half, string>> = {
    'fold-through-selector':
        'G-R2: the effective-set fold does not go through `selectPlegableSources`, so a source of ' +
        'class COMPLEMENT can reach the four strategies without the discard.',
    'selector-gates-complement':
        'G-R2: `selectPlegableSources` no longer gates the complements on a live non-TRIAL title, ' +
        'so they are admitted with any title — or the gate is neutralised (`|| true`, `true ||`, a ' +
        'filter that ignores `hasLiveNonTrialTitle`).'
};

const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/;

/** One production file of the resolution directory, with its text. */
interface ResolutionFile {
    readonly name: string;
    readonly source: string;
}

/** A call, not the definition: the expression `= name(` or `(name(`. */
function called(name: string): RegExp {
    return new RegExp(`[=(]\\s*${name}\\s*\\(`);
}

/** The dotted name of a callee chain, e.g. `hasLiveNonTrialTitle`; `null` otherwise. */
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

/** Whether `node` is any function-like boundary the return walk must not cross. */
function isFunctionLikeNode(node: ts.Node): boolean {
    return (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isConstructorDeclaration(node)
    );
}

/** Collects `const NAME = <expr>` bindings from a file. */
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

/** Finds the `selectPlegableSources` function, declared or bound to an arrow. */
function findSelectorFunction(sourceFile: ts.SourceFile): ts.FunctionLikeDeclaration | null {
    let found: ts.FunctionLikeDeclaration | null = null;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (ts.isFunctionDeclaration(node) && node.name?.text === 'selectPlegableSources') {
            found = node;
            return;
        }
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === 'selectPlegableSources' &&
            node.initializer !== undefined &&
            (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        ) {
            found = node.initializer;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found;
}

/** The expressions the selector returns, without descending into nested callbacks. */
function collectReturnExpressions(fn: ts.FunctionLikeDeclaration): readonly ts.Expression[] {
    const body: ts.ConciseBody | undefined = (fn as { readonly body?: ts.ConciseBody }).body;
    if (!body) return [];
    if (!ts.isBlock(body)) return [body];

    const found: ts.Expression[] = [];
    const visit = (node: ts.Node): void => {
        if (isFunctionLikeNode(node)) return;
        if (ts.isReturnStatement(node) && node.expression) {
            found.push(node.expression);
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(body);
    return found;
}

/** Every `.filter(...)` call inside one expression. */
function collectFilterCalls(root: ts.Node): readonly ts.CallExpression[] {
    const found: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === 'filter'
        ) {
            found.push(node);
        }
        ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
}

/** The expression a `.filter(callback)` callback returns, or `null`. */
function callbackPredicate(call: ts.CallExpression): ts.Expression | null {
    const callback = call.arguments[0];
    if (!callback) return null;
    if (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) return null;
    const body = callback.body;
    if (!body) return null;
    if (!ts.isBlock(body)) return body;
    for (const statement of body.statements) {
        if (ts.isReturnStatement(statement) && statement.expression) return statement.expression;
    }
    return null;
}

/** Whether a node is the string literal `'COMPLEMENT'`. */
function isComplementLiteral(node: ts.Node): boolean {
    return ts.isStringLiteral(node) && node.text === 'COMPLEMENT';
}

/** Whether the predicate compares something against `'COMPLEMENT'`. */
function excludesComplement(predicate: ts.Expression): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (
            ts.isBinaryExpression(node) &&
            (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
            (isComplementLiteral(node.left) || isComplementLiteral(node.right))
        ) {
            found = true;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(predicate);
    return found;
}

/** Whether the predicate consumes the result of `hasLiveNonTrialTitle(...)`. */
function usesHelper(
    predicate: ts.Expression,
    constants: ReadonlyMap<string, ts.Expression>
): boolean {
    const seen = new Set<string>();
    const visit = (node: ts.Node): boolean => {
        if (ts.isCallExpression(node) && dottedName(node.expression) === 'hasLiveNonTrialTitle') {
            return true;
        }
        if (ts.isIdentifier(node)) {
            if (seen.has(node.text)) return false;
            const bound = constants.get(node.text);
            if (bound) {
                seen.add(node.text);
                const resolved = visit(bound);
                seen.delete(node.text);
                if (resolved) return true;
            }
        }
        let found = false;
        ts.forEachChild(node, (child) => {
            if (!found && visit(child)) found = true;
        });
        return found;
    };
    return visit(predicate);
}

/**
 * Whether the predicate is neutralised: some operand of an `||` (or the
 * predicate itself) is a compile-time truthy value, so the gate is bypassed.
 */
function isNeutralized(
    predicate: ts.Expression,
    constants: ReadonlyMap<string, ts.Expression>
): boolean {
    const seen = new Set<string>();
    const visit = (node: ts.Expression): boolean => {
        if (isConstantTruthy(node, constants)) return true;
        if (ts.isParenthesizedExpression(node)) return visit(node.expression);
        if (ts.isIdentifier(node)) {
            if (seen.has(node.text)) return false;
            const bound = constants.get(node.text);
            if (bound) {
                seen.add(node.text);
                const resolved = visit(bound);
                seen.delete(node.text);
                return resolved;
            }
            return false;
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            return visit(node.left) || visit(node.right);
        }
        return false;
    };
    return visit(predicate);
}

/**
 * Whether the selector really gates the complements: a returned `.filter(...)`
 * predicate excludes `COMPLEMENT`, consumes `hasLiveNonTrialTitle(...)`, and is
 * not neutralised.
 */
function selectorGatesComplements(files: readonly ResolutionFile[]): boolean {
    for (const file of files) {
        const sourceFile = ts.createSourceFile(
            file.name,
            file.source,
            ts.ScriptTarget.Latest,
            /* setParentNodes */ true,
            ts.ScriptKind.TS
        );
        const selector = findSelectorFunction(sourceFile);
        if (!selector) continue;

        const constants = collectConstBindings(sourceFile);
        let good = false;
        let neutralized = false;
        for (const expression of collectReturnExpressions(selector)) {
            for (const call of collectFilterCalls(expression)) {
                const predicate = callbackPredicate(call);
                if (!predicate) continue;
                if (isNeutralized(predicate, constants)) neutralized = true;
                else if (excludesComplement(predicate) && usesHelper(predicate, constants)) {
                    good = true;
                }
            }
        }
        return good && !neutralized;
    }
    return false;
}

/**
 * The two halves over the resolution's files. The fold half is a presence check
 * on the comment-stripped concatenation; the selector half is the structural
 * check above.
 *
 * @param args.files - The resolution's production files.
 * @returns One entry per half that is missing.
 */
export function findMissingHalves({
    files
}: {
    readonly files: readonly ResolutionFile[];
}): readonly GR2Half[] {
    const missing: GR2Half[] = [];
    const code = files.map((file) => stripComments({ source: file.source })).join('\n');
    if (!called('selectPlegableSources').test(code)) missing.push('fold-through-selector');
    if (!selectorGatesComplements(files)) missing.push('selector-gates-complement');
    return missing;
}

/** Production files of the resolution directory, or `null` when it is absent. */
function readResolutionFiles({
    root
}: {
    readonly root: string;
}): readonly ResolutionFile[] | null {
    const dir = join(root, RESOLUTION_DIR);
    let names: readonly string[];
    try {
        names = readdirSync(dir);
    } catch {
        return null;
    }
    const files = names.filter((name) => name.endsWith('.ts') && !TEST_FILE.test(name));
    if (files.length === 0) return null;
    return files.map((name) => ({ name, source: readFileSync(join(dir, name), 'utf8') }));
}

/**
 * Runs GUARD:G-R2.
 *
 * @param args - Run input.
 * @param args.root - Repository root; defaults to this repo.
 * @returns The exit code and the report.
 */
export function run(args: { readonly root?: string } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const lines = [
        '=== GUARD:G-R2 - the effective set discards complements without a live non-TRIAL title ==='
    ];

    const files = readResolutionFiles({ root });
    if (files === null) {
        lines.push('', `FAIL G-R2: the resolution under ${RESOLUTION_DIR} has no production file.`);
        return { exitCode: 1, output: lines.join('\n') };
    }

    const missing = findMissingHalves({ files });
    if (missing.length > 0) {
        for (const half of missing) lines.push('', `FAIL ${RULE_MESSAGES[half]}`);
        return { exitCode: 1, output: lines.join('\n') };
    }

    lines.push(
        `OK: ${RESOLUTION_DIR} folds through selectPlegableSources, and the selector gates the complements on a live non-TRIAL title.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
