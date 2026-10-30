import ts from 'typescript';
import { isConstantTruthy } from './check-no-unconditional-fixme.js';

export const S14_FILE =
    'packages/service-core/src/services/billing/reconciliation/open-reconciliation-mark.service.ts';
export const S15_FILE =
    'packages/service-core/src/services/billing/reconciliation/lift-reconciliation-mark.service.ts';
export type LifecycleFinding = { file: string; line: number; rule: string; detail: string };
type Fn = ts.FunctionLikeDeclaration | ts.SourceFile;

const functionLike = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);

function callName(node: ts.CallExpression): string | null {
    const expression = node.expression;
    return ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : ts.isIdentifier(expression)
          ? expression.text
          : null;
}

function calls(root: ts.Node, name: string): ts.CallExpression[] {
    const result: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && callName(node) === name) result.push(node);
        ts.forEachChild(node, visit);
    };
    visit(root);
    return result;
}

function findNamedFunction(sf: ts.SourceFile, name: string): ts.FunctionLikeDeclaration | null {
    let found: ts.FunctionLikeDeclaration | null = null;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (functionLike(node) && ts.isFunctionDeclaration(node) && node.name?.text === name) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
}

function insideIfPayment(node: ts.Node, fn: Fn): boolean {
    for (let parent = node.parent; parent && parent !== fn; parent = parent.parent)
        if (
            ts.isIfStatement(parent) &&
            parent.expression.getText().replace(/\s/g, '') === 'input.payment' &&
            parent.thenStatement.getStart() <= node.getStart() &&
            parent.thenStatement.getEnd() >= node.getEnd()
        )
            return true;
    return false;
}

function hasUnresolvedThrow(fn: Fn, count: ts.CallExpression): boolean {
    let valid = false;
    const references = new Set<string>();
    for (let parent: ts.Node | undefined = count; parent; parent = parent.parent) {
        if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
            references.add(parent.name.text);
            break;
        }
        if (parent === fn) break;
    }
    const visit = (node: ts.Node): void => {
        if (ts.isIfStatement(node)) {
            const text = node.expression.getText();
            const uses =
                text.includes(count.getText()) ||
                [...references].some((value) => new RegExp(`\\b${value}\\b`).test(text));
            const comparison = /(?:>\s*0|>=\s*1|!==\s*0)/.test(text);
            let neutralized = false;
            const findNeutralized = (expression: ts.Node): void => {
                if (
                    ts.isBinaryExpression(expression) &&
                    expression.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
                    (isConstantTruthy(expression.left, new Map()) ||
                        isConstantTruthy(expression.right, new Map()))
                )
                    neutralized = true;
                ts.forEachChild(expression, findNeutralized);
            };
            findNeutralized(node.expression);
            let throws = false;
            const findThrow = (statement: ts.Node): void => {
                if (ts.isThrowStatement(statement)) throws = true;
                ts.forEachChild(statement, findThrow);
            };
            findThrow(node.thenStatement);
            if (uses && comparison && throws && !neutralized) valid = true;
        }
        ts.forEachChild(node, visit);
    };
    visit(fn);
    return valid;
}

export function checkLifecycleRules(asts: ReadonlyMap<string, ts.SourceFile>): LifecycleFinding[] {
    const findings: LifecycleFinding[] = [];
    const report = (sf: ts.SourceFile, file: string, rule: string, node: ts.Node, detail: string) =>
        findings.push({
            file,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            rule,
            detail
        });
    const s14 = asts.get(S14_FILE);
    const s15 = asts.get(S15_FILE);
    if (!s14)
        findings.push({
            file: S14_FILE,
            line: 1,
            rule: '(e)',
            detail: 'S14 source is missing from the scanned tree'
        });
    if (!s15)
        findings.push({
            file: S15_FILE,
            line: 1,
            rule: '(f)',
            detail: 'S15 source is missing from the scanned tree'
        });
    if (s14) {
        const fn = findNamedFunction(s14, 'openReconciliationMark');
        const inserts = fn ? calls(fn, 'insertOpen') : [];
        const finds = fn ? calls(fn, 'findOpen') : [];
        const firstInsert = inserts[0];
        if (
            !fn ||
            !firstInsert ||
            !finds.some((find) => find.getStart(s14) < firstInsert.getStart(s14))
        )
            report(
                s14,
                S14_FILE,
                '(e)',
                fn ?? s14,
                'S14 must find an open mark before its first insertOpen'
            );
        const hangs = fn ? calls(fn, 'hang') : [];
        if (!fn || !hangs.some((hang) => insideIfPayment(hang, fn)))
            report(s14, S14_FILE, '(e)', fn ?? s14, 'S14 must call hang inside if (input.payment)');
        for (const [file, sf] of asts)
            if (file !== S14_FILE)
                for (const hang of calls(sf, 'hang'))
                    report(sf, file, '(e)', hang, 'payment hang is only called from S14');
    }
    if (s15) {
        const fn = findNamedFunction(s15, 'liftReconciliationMark');
        const count = fn ? calls(fn, 'countUnresolved') : [];
        const lifts = fn ? calls(fn, 'lift') : [];
        const countCall = count[0];
        const liftCall = lifts[0];
        const valid =
            !!fn &&
            !!countCall &&
            !!liftCall &&
            countCall.getStart(s15) < liftCall.getStart(s15) &&
            hasUnresolvedThrow(fn, countCall);
        if (!valid)
            report(
                s15,
                S15_FILE,
                '(f)',
                fn ?? s15,
                'S15 must compare countUnresolved > 0, >= 1, or !== 0 in a non-neutralized if whose then branch throws, before lift'
            );
    }
    return findings;
}
