/**
 * @file G-R1-B static guard for successor first-charge timing.
 * @description GUARD:G-R1-B (HOS-1352 program, built by B3 / HOS-1527, AC:B3:24, TEST:B3:25)
 * What it checks: each succession object stores a provider firstChargeAt read and its writer function
 * proves strict ordering after the authorization window, except within the confirmed suspended-card
 * branch. Exit 0 is clean; exit 1 reports findings or an undersized scan.
 * What it does NOT see, so a green run is not read as more: helper comparisons such as isAfter(),
 * alternative exception syntax, or whether the provider's value is truthful. B3.10 tests that value.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { findSuccessionWrites, listProductionFiles } from './succession-writers-scan.js';
export const SUSPENDED_CARD_BASIS = 'CARD_SUSPENDED_CONFIRMED_CANCELLED';
export const MIN_SCANNED_FILES = 1000;
export const RULE_MESSAGES = {
    noFirstCharge: 'NO_FIRST_CHARGE',
    notProviderDate: 'NOT_PROVIDER_DATE',
    noStrictAfter: 'NO_STRICT_AFTER'
} as const;
type Finding = { file: string; line: number; rule: string; detail: string };
function name(p: ts.PropertyName): string | null {
    return ts.isIdentifier(p) || ts.isStringLiteral(p) ? p.text : null;
}
function providerRead(expr: ts.Expression, fn: ts.FunctionLikeDeclaration): boolean {
    if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'firstChargeAt') return true;
    if (!ts.isIdentifier(expr) || !ts.isBlock(fn.body)) return false;
    let ok = false;
    function visit(n: ts.Node): void {
        if (
            ts.isVariableDeclaration(n) &&
            ts.isIdentifier(n.name) &&
            n.name.text === expr.text &&
            n.initializer &&
            ts.isPropertyAccessExpression(n.initializer) &&
            n.initializer.name.text === 'firstChargeAt'
        )
            ok = true;
        if (
            ts.isVariableDeclaration(n) &&
            ts.isObjectBindingPattern(n.name) &&
            n.initializer &&
            n.name.elements.some(
                (e) =>
                    ts.isIdentifier(e.name) &&
                    e.name.text === expr.text &&
                    (e.propertyName?.getText() ?? e.name.text) === 'firstChargeAt'
            )
        )
            ok = true;
        ts.forEachChild(n, visit);
    }
    visit(fn.body);
    return ok;
}
function isException(write: ReturnType<typeof findSuccessionWrites>[number]): boolean {
    for (let n: ts.Node | undefined = write.property; n; n = n.parent) {
        if (
            ts.isIfStatement(n) &&
            n.thenStatement &&
            contains(n.expression, SUSPENDED_CARD_BASIS) &&
            within(write.property, n.thenStatement)
        )
            return true;
        if (
            ts.isConditionalExpression(n) &&
            contains(n.condition, SUSPENDED_CARD_BASIS) &&
            within(write.property, n.whenTrue)
        )
            return true;
    }
    return false;
}
function within(node: ts.Node, parent: ts.Node): boolean {
    for (let n: ts.Node | undefined = node; n; n = n.parent) if (n === parent) return true;
    return false;
}
function contains(node: ts.Node, text: string): boolean {
    return node.getText().includes(text);
}
function hasStrictComparison(fn: ts.FunctionLikeDeclaration, source: ts.SourceFile): boolean {
    if (!ts.isBlock(fn.body)) return false;
    let found = false;
    function has(n: ts.Expression, word: RegExp): boolean {
        return word.test(n.getText(source));
    }
    function visit(n: ts.Node): void {
        if (ts.isBinaryExpression(n)) {
            const op = n.operatorToken.kind;
            const lCharge = has(n.left, /firstChargeAt/),
                rCharge = has(n.right, /firstChargeAt/);
            const lWindow = has(n.left, /(?:authorizationWindowEndsAt|windowEndsAt)/),
                rWindow = has(n.right, /(?:authorizationWindowEndsAt|windowEndsAt)/);
            if (
                (lCharge && rWindow && op === ts.SyntaxKind.GreaterThanToken) ||
                (lWindow && rCharge && op === ts.SyntaxKind.LessThanToken) ||
                (lCharge && rWindow && op === ts.SyntaxKind.LessThanEqualsToken) ||
                (lWindow && rCharge && op === ts.SyntaxKind.GreaterThanEqualsToken)
            )
                found = true;
        }
        ts.forEachChild(n, visit);
    }
    visit(fn.body);
    return found;
}
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listProductionFiles({ root });
    const min = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < min)
        return {
            exitCode: 1,
            output: `G-R1-B: scanned ${files.length} files; expected at least ${min}`
        };
    const findings: Finding[] = [];
    let writers = 0;
    for (const file of files) {
        const source = readFileSync(join(root, file), 'utf8');
        const writes = findSuccessionWrites({ file, source });
        writers += writes.length;
        for (const w of writes) {
            const first = w.object.properties.find(
                (p) =>
                    (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
                    name(p.name) === 'firstChargeAt'
            );
            const value =
                first && ts.isPropertyAssignment(first)
                    ? first.initializer
                    : first && ts.isShorthandPropertyAssignment(first)
                      ? first.name
                      : null;
            if (
                !value ||
                (first &&
                    ts.isPropertyAssignment(first) &&
                    (value.kind === ts.SyntaxKind.NullKeyword ||
                        value.kind === ts.SyntaxKind.UndefinedKeyword))
            ) {
                findings.push({
                    file,
                    line: w.line,
                    rule: 'NO_FIRST_CHARGE',
                    detail: 'succession object has no non-null firstChargeAt'
                });
                continue;
            }
            const exceptional = isException(w);
            if (!exceptional && (!ts.isFunctionLike(w.fn) || !providerRead(value, w.fn)))
                findings.push({
                    file,
                    line: w.line,
                    rule: 'NOT_PROVIDER_DATE',
                    detail: 'firstChargeAt is not visibly read from a provider firstChargeAt property'
                });
            if (
                !exceptional &&
                (!ts.isFunctionLike(w.fn) || !hasStrictComparison(w.fn, w.sourceFile))
            )
                findings.push({
                    file,
                    line: w.line,
                    rule: 'NO_STRICT_AFTER',
                    detail: 'writer has no strict firstChargeAt/window ordering comparison'
                });
        }
    }
    return findings.length
        ? {
              exitCode: 1,
              output: findings
                  .map((f) => `G-R1-B (${f.rule}): ${f.file}:${f.line} ${f.detail}`)
                  .join('\n')
          }
        : {
              exitCode: 0,
              output: `G-R1-B: OK; ${writers} succession writers; ${files.length} production files scanned`
          };
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
