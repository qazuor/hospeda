/**
 * @file check-reconciliation-mark-discipline.ts
 * @description GUARD:G-R1-F (HOS-1352 program, built by B3 / HOS-1527, AC:B3:26, TEST:B3:27)
 *
 * ## What it checks
 *
 * AST checks for the current G-R1-F loci: (a) opening reasons are catalog
 * literals or locally declared ReconciliationMarkReason values and only S14
 * inserts; (b) lifts identify one mark, only S15 lifts, and only the model
 * writes liftedAt; (d) the same function does not open motives 14 and 15;
 * (e) S14 finds an open mark before inserting and hangs the supplied payment;
 * (f) S15 checks unresolved attached payments before lifting and throws when
 * the count is positive; (h) courtesy balance closure writes both columns and
 * uses a catalog close reason. The two catalogs are read from their source AST.
 *
 * Until the next run adds the action list and inventories, (c) and (g) are
 * covered by the next run.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * A reason passed through an untyped variable, a computed reason, or whether a
 * caller chose the right reason for its event. (e) and (f) are structural
 * checks of two files, not data-flow proofs; (e) checks S14 as the sole current
 * locus. This does not prove B5's payment-port implementation. Writers of the
 * courtesy close added by B9a/B9b/B8b enter the check when they exist.
 *
 * Exit codes: 0 = no findings; 1 = a predicate failed or a catalog was unreadable.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { isConstantTruthy } from './check-no-unconditional-fixme.js';
import { listProductionFiles } from './succession-writers-scan.js';

export const S14_FILE =
    'packages/service-core/src/services/billing/reconciliation/open-reconciliation-mark.service.ts';
export const S15_FILE =
    'packages/service-core/src/services/billing/reconciliation/lift-reconciliation-mark.service.ts';
export const MARK_MODEL_FILE =
    'packages/db/src/models/reconciliation-mark/reconciliation-mark.model.ts';
export const REASONS_FILE = 'packages/db/src/schemas/vertical/reconciliation-mark-reasons.ts';
export const COURTESY_FILE = 'packages/db/src/schemas/vertical/courtesy-grant.dbschema.ts';
export const MIN_SCANNED_FILES = 1000;
const MOTIVE_14 = 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA';
const MOTIVE_15 = 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION';
type Finding = { file: string; line: number; rule: string; detail: string };
type Fn = ts.FunctionLikeDeclaration | ts.SourceFile;
const functionLike = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n);
function owner(node: ts.Node, sf: ts.SourceFile): Fn {
    for (let p = node.parent; p; p = p.parent) if (functionLike(p)) return p;
    return sf;
}
function propName(n: ts.Node): string | null {
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
    return null;
}
function callName(n: ts.CallExpression): string | null {
    const e = n.expression;
    return ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : null;
}
function calls(root: ts.Node, name: string): ts.CallExpression[] {
    const result: ts.CallExpression[] = [];
    const walk = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && callName(n) === name) result.push(n);
        ts.forEachChild(n, walk);
    };
    walk(root);
    return result;
}
function objectArg(call: ts.CallExpression | undefined): ts.ObjectLiteralExpression | null {
    return call?.arguments.find(ts.isObjectLiteralExpression) ?? null;
}
function properties(obj: ts.ObjectLiteralExpression): Map<string, ts.Expression | null> {
    const map = new Map<string, ts.Expression | null>();
    for (const p of obj.properties) {
        if (ts.isPropertyAssignment(p)) map.set(propName(p.name) ?? '', p.initializer);
        else if (ts.isShorthandPropertyAssignment(p)) map.set(p.name.text, p.name);
    }
    return map;
}
function safeRead(root: string, file: string): string | null {
    try {
        return readFileSync(join(root, file), 'utf8');
    } catch {
        return null;
    }
}
function literalsFromArray(source: string, file: string, name: string): string[] {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const stmt of sf.statements)
        if (ts.isVariableStatement(stmt))
            for (const d of stmt.declarationList.declarations) {
                if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer) {
                    let value = d.initializer;
                    while (
                        ts.isAsExpression(value) ||
                        ts.isSatisfiesExpression(value) ||
                        ts.isTypeAssertionExpression(value)
                    )
                        value = value.expression;
                    if (ts.isArrayLiteralExpression(value))
                        return value.elements.filter(ts.isStringLiteral).map((e) => e.text);
                }
            }
    return [];
}
function unwrapLiteral(expr: ts.Expression): ts.Expression {
    while (
        ts.isSatisfiesExpression(expr) ||
        ts.isAsExpression(expr) ||
        ts.isTypeAssertionExpression(expr)
    )
        expr = expr.expression;
    return expr;
}
function runChecks(root: string, files: readonly string[]): Finding[] {
    const findings: Finding[] = [];
    const report = (sf: ts.SourceFile, file: string, rule: string, node: ts.Node, detail: string) =>
        findings.push({
            file,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            rule,
            detail
        });
    const read = (f: string) => readFileSync(join(root, f), 'utf8');
    const reasonsSource = safeRead(root, REASONS_FILE);
    const closeSource = safeRead(root, COURTESY_FILE);
    if (reasonsSource === null)
        findings.push({
            file: REASONS_FILE,
            line: 1,
            rule: '(a)',
            detail: 'reason catalog source is unreadable'
        });
    if (closeSource === null)
        findings.push({
            file: COURTESY_FILE,
            line: 1,
            rule: '(h)',
            detail: 'courtesy close catalog source is unreadable'
        });
    const reasons = literalsFromArray(
        reasonsSource ?? '',
        REASONS_FILE,
        'RECONCILIATION_MARK_REASONS'
    );
    const closeReasons = literalsFromArray(
        closeSource ?? '',
        COURTESY_FILE,
        'COURTESY_CLOSE_REASONS'
    );
    if (reasons.length !== 24)
        findings.push({
            file: REASONS_FILE,
            line: 1,
            rule: '(a)',
            detail: `catalog has ${reasons.length} readable string values; expected 24`
        });
    if (closeReasons.length !== 4)
        findings.push({
            file: COURTESY_FILE,
            line: 1,
            rule: '(h)',
            detail: `catalog has ${closeReasons.length} readable string values; expected 4`
        });
    const asts = new Map<string, ts.SourceFile>();
    for (const f of files)
        asts.set(f, ts.createSourceFile(f, read(f), ts.ScriptTarget.Latest, true));
    const reasonSet = new Set(reasons),
        closeSet = new Set(closeReasons);
    const openCallsByFn = new Map<Fn, Set<string>>();
    for (const [file, sf] of asts) {
        const openCalls = calls(sf, 'openReconciliationMark');
        for (const call of openCalls) {
            const obj = objectArg(call),
                reason = obj && properties(obj).get('reason');
            let literal: string | null = null;
            if (reason && ts.isStringLiteral(unwrapLiteral(reason)))
                literal = (unwrapLiteral(reason) as ts.StringLiteral).text;
            if (
                !reason ||
                (literal !== null && !reasonSet.has(literal)) ||
                (literal === null && !hasTypedReason(reason, owner(call, sf)))
            )
                report(
                    sf,
                    file,
                    '(a)',
                    call,
                    'openReconciliationMark requires a catalog literal or locally typed ReconciliationMarkReason reason'
                );
            const fn = owner(call, sf);
            const set = openCallsByFn.get(fn) ?? new Set<string>();
            if (literal) set.add(literal);
            openCallsByFn.set(fn, set);
        }
        for (const c of calls(sf, 'insertOpen'))
            if (file !== S14_FILE) report(sf, file, '(a)', c, 'insertOpen is only called from S14');
        const liftCalls = calls(sf, 'lift');
        for (const c of liftCalls)
            if (
                ts.isPropertyAccessExpression(c.expression) &&
                c.expression.expression.getText(sf).includes('reconciliationMarkModel')
            ) {
                const obj = objectArg(c),
                    props = obj ? properties(obj) : new Map();
                if (
                    !props.has('markId') ||
                    props.has('subscriptionId') ||
                    props.has('addonInstanceId')
                )
                    report(sf, file, '(b)', c, 'model lift requires markId and no subject-row id');
                if (file !== S15_FILE)
                    report(
                        sf,
                        file,
                        '(b)',
                        c,
                        'reconciliationMarkModel.lift is only called from S15'
                    );
            }
        for (const c of calls(sf, 'liftReconciliationMark')) {
            const obj = objectArg(c),
                props = obj ? properties(obj) : new Map();
            if (!props.has('markId') || props.has('subscriptionId') || props.has('addonInstanceId'))
                report(
                    sf,
                    file,
                    '(b)',
                    c,
                    'liftReconciliationMark requires markId and no subject-row id'
                );
        }
        for (const c of calls(sf, 'set')) {
            const obj = objectArg(c);
            if (!obj) continue;
            const ps = properties(obj);
            if (ps.has('liftedAt') && file !== MARK_MODEL_FILE)
                report(
                    sf,
                    file,
                    '(b)',
                    c,
                    'liftedAt is written only in the reconciliation mark model'
                );
            if (ps.has('balanceClosedAt') || ps.has('closeReason')) {
                const at = ps.get('balanceClosedAt'),
                    reason = ps.get('closeReason');
                if (!ps.has('balanceClosedAt') || !ps.has('closeReason'))
                    report(
                        sf,
                        file,
                        '(h)',
                        c,
                        'balanceClosedAt and closeReason must be written together'
                    );
                else if (
                    at &&
                    at.kind !== ts.SyntaxKind.NullKeyword &&
                    reason &&
                    (ts.isStringLiteral(unwrapLiteral(reason))
                        ? !closeSet.has((unwrapLiteral(reason) as ts.StringLiteral).text)
                        : true)
                )
                    report(
                        sf,
                        file,
                        '(h)',
                        c,
                        'a non-null balanceClosedAt requires a literal closeReason from COURTESY_CLOSE_REASONS'
                    );
                else if (
                    at?.kind === ts.SyntaxKind.NullKeyword &&
                    reason?.kind !== ts.SyntaxKind.NullKeyword
                )
                    report(sf, file, '(h)', c, 'both courtesy close columns must be null together');
            }
        }
        const visitUpdates = (n: ts.Node) => {
            if (
                ts.isCallExpression(n) &&
                callName(n) === 'update' &&
                n.expression.getText(sf).endsWith('.update') &&
                n.arguments.some((a) => a.getText(sf).includes('reconciliationMarks')) &&
                file !== MARK_MODEL_FILE
            )
                report(sf, file, '(b)', n, 'reconciliationMarks update is only in the model');
            if (
                ts.isPropertyAssignment(n) &&
                ['liftedAt', 'lifted_at'].includes(propName(n.name) ?? '') &&
                ts.isCallExpression(n.parent.parent) &&
                callName(n.parent.parent) === 'set' &&
                file !== MARK_MODEL_FILE
            )
                report(
                    sf,
                    file,
                    '(b)',
                    n,
                    'liftedAt is written only in the reconciliation mark model'
                );
            ts.forEachChild(n, visitUpdates);
        };
        visitUpdates(sf);
    }
    for (const [fn, set] of openCallsByFn)
        if (set.has(MOTIVE_14) && set.has(MOTIVE_15)) {
            const sf = fn.getSourceFile();
            report(sf, sf.fileName, '(d)', fn, 'one function opens motives 14 and 15');
        }
    const s14 = asts.get(S14_FILE),
        s15 = asts.get(S15_FILE);
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
    if (!asts.has(MARK_MODEL_FILE))
        findings.push({
            file: MARK_MODEL_FILE,
            line: 1,
            rule: '(b)',
            detail: 'reconciliation mark model source is missing from the scanned tree'
        });
    if (s14) {
        const fn = findNamedFunction(s14, 'openReconciliationMark');
        const inserts = fn ? calls(fn, 'insertOpen') : [],
            finds = fn ? calls(fn, 'findOpen') : [],
            firstInsert = inserts[0];
        if (!fn || !firstInsert || !finds.some((f) => f.getStart(s14) < firstInsert.getStart(s14)))
            report(
                s14,
                S14_FILE,
                '(e)',
                fn ?? s14,
                'S14 must find an open mark before its first insertOpen'
            );
        const hangs = fn ? calls(fn, 'hang') : [];
        if (!fn || !hangs.some((h) => insideIfPayment(h, fn)))
            report(s14, S14_FILE, '(e)', fn ?? s14, 'S14 must call hang inside if (input.payment)');
        for (const [file, sf] of asts)
            if (file !== S14_FILE)
                for (const h of calls(sf, 'hang'))
                    report(sf, file, '(e)', h, 'payment hang is only called from S14');
    }
    if (s15) {
        const fn = findNamedFunction(s15, 'liftReconciliationMark');
        const count = fn ? calls(fn, 'countUnresolved') : [],
            lifts = fn ? calls(fn, 'lift') : [],
            countCall = count[0],
            liftCall = lifts[0];
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
    // S3's current writer is checked by the generic paired-column predicate above.
    return findings;
}
function hasTypedReason(expr: ts.Expression, fn: Fn): boolean {
    const target = ts.isIdentifier(expr)
        ? expr.text
        : ts.isPropertyAccessExpression(expr)
          ? expr.name.text
          : null;
    if (!target) return false;
    const root = fn as ts.Node;
    let ok = false;
    const walk = (n: ts.Node) => {
        if (
            ts.isParameter(n) &&
            ts.isIdentifier(n.name) &&
            n.name.text === target &&
            n.type?.getText().includes('ReconciliationMarkReason')
        )
            ok = true;
        if (
            ts.isVariableDeclaration(n) &&
            ts.isIdentifier(n.name) &&
            n.name.text === target &&
            n.type?.getText().includes('ReconciliationMarkReason')
        )
            ok = true;
        ts.forEachChild(n, walk);
    };
    walk(root);
    return ok;
}
function findNamedFunction(sf: ts.SourceFile, name: string): ts.FunctionLikeDeclaration | null {
    let found: ts.FunctionLikeDeclaration | null = null;
    const walk = (n: ts.Node) => {
        if (found) return;
        if (
            functionLike(n) &&
            ((ts.isFunctionDeclaration(n) && n.name?.text === name) ||
                (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name))
        ) {
            found = n;
            return;
        }
        ts.forEachChild(n, walk);
    };
    walk(sf);
    return found;
}
function insideIfPayment(node: ts.Node, fn: Fn): boolean {
    for (let p = node.parent; p && p !== fn; p = p.parent)
        if (
            ts.isIfStatement(p) &&
            p.expression.getText().replace(/\s/g, '') === 'input.payment' &&
            p.thenStatement.getStart() <= node.getStart() &&
            p.thenStatement.getEnd() >= node.getEnd()
        )
            return true;
    return false;
}
function hasUnresolvedThrow(fn: Fn, count: ts.CallExpression): boolean {
    let valid = false;
    const references = new Set<string>();
    for (let p: ts.Node | undefined = count; p; p = p.parent) {
        if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
            references.add(p.name.text);
            break;
        }
        if (p === fn) break;
    }
    const walk = (n: ts.Node) => {
        if (ts.isIfStatement(n)) {
            const text = n.expression.getText();
            const uses =
                text.includes(count.getText()) ||
                [...references].some((v) => new RegExp(`\\b${v}\\b`).test(text));
            const comparison = /(?:>\s*0|>=\s*1|!==\s*0)/.test(text);
            let neutral = false;
            const findNeutral = (x: ts.Node) => {
                if (
                    ts.isBinaryExpression(x) &&
                    x.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
                    (isConstantTruthy(x.left) || isConstantTruthy(x.right))
                )
                    neutral = true;
                ts.forEachChild(x, findNeutral);
            };
            findNeutral(n.expression);
            let throws = false;
            const findThrow = (x: ts.Node) => {
                if (ts.isThrowStatement(x)) throws = true;
                ts.forEachChild(x, findThrow);
            };
            findThrow(n.thenStatement);
            if (uses && comparison && throws && !neutral) valid = true;
        }
        ts.forEachChild(n, walk);
    };
    walk(fn);
    return valid;
}
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? fileURLToPath(new URL('..', import.meta.url));
    const files = listProductionFiles({ root });
    const min = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < min)
        return {
            exitCode: 1,
            output: `G-R1-F: scanned ${files.length} files; expected at least ${min}`
        };
    const findings = runChecks(root, files);
    if (findings.length)
        return {
            exitCode: 1,
            output: findings
                .map((f) => `G-R1-F ${f.rule}: ${f.file}:${f.line} ${f.detail}`)
                .join('\n')
        };
    const open = files.reduce(
        (n, f) =>
            n +
            calls(
                ts.createSourceFile(
                    f,
                    readFileSync(join(root, f), 'utf8'),
                    ts.ScriptTarget.Latest,
                    true
                ),
                'openReconciliationMark'
            ).length,
        0
    );
    const lifts = files.reduce(
        (n, f) =>
            n +
            calls(
                ts.createSourceFile(
                    f,
                    readFileSync(join(root, f), 'utf8'),
                    ts.ScriptTarget.Latest,
                    true
                ),
                'liftReconciliationMark'
            ).length,
        0
    );
    const closes = files.reduce(
        (n, f) =>
            n +
            calls(
                ts.createSourceFile(
                    f,
                    readFileSync(join(root, f), 'utf8'),
                    ts.ScriptTarget.Latest,
                    true
                ),
                'set'
            ).filter((c) => {
                const o = objectArg(c);
                return (
                    o && (properties(o).has('balanceClosedAt') || properties(o).has('closeReason'))
                );
            }).length,
        0
    );
    return {
        exitCode: 0,
        output: `G-R1-F: OK; ${open} open calls; ${lifts} lift calls; ${closes} saldo closes; ${files.length} production files scanned (c) and (g) are covered by the next run`
    };
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
