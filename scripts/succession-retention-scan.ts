/**
 * @file AST helpers of GUARD:G-R1-D (HOS-1561, AC:B7:17).
 * @description Finds, per source file, the two kinds of write `G-R1-D` keeps behind the S19
 * retention: a `subscriptions.status` write to `ACTIVE`/`CANCEL_SCHEDULED` whose `where`
 * names `GRACE_PERIOD` or `SUSPENDED` (a reactivation), and an insert into `refunds`. Each
 * hit carries the TOP-LEVEL declaration it lives in (a function declaration or a `const`),
 * which is the name the guard's registries use. The rule logic lives in
 * `scripts/check-succession-retention.ts`.
 */
import ts from 'typescript';

/** The statuses that put a row back to emitting source (a reactivation, AC:B7:17). */
export const REACTIVATED_STATUSES = ['ACTIVE', 'CANCEL_SCHEDULED'] as const;
/** The states a reactivation leaves: the predecessor waits in one of them (AC:B7:16). */
export const RETAINING_STATUSES = ['GRACE_PERIOD', 'SUSPENDED'] as const;

/** One write found in a file, located by line and by its top-level declaration. */
export type RetentionWrite = {
    readonly file: string;
    readonly line: number;
    readonly fnName: string;
    readonly node: ts.Node;
};

/** Parses a file with parent pointers (the helpers walk up). */
export function parse({ file, source }: { readonly file: string; readonly source: string }) {
    return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

/** The 1-based line of a node. */
export function lineOf(node: ts.Node, sf: ts.SourceFile): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/**
 * The name of the top-level declaration that holds a node: a function declaration, or the
 * first binding of a `const`/`let` statement. `<module>` for code outside any declaration.
 */
export function topLevelName(node: ts.Node): string {
    let current: ts.Node = node;
    while (current.parent && !ts.isSourceFile(current.parent)) current = current.parent;
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isVariableStatement(current)) {
        const [first] = current.declarationList.declarations;
        if (first && ts.isIdentifier(first.name)) return first.name.text;
    }
    return '<module>';
}

/** The top-level function declaration (or `const` arrow/function) with that name, if any. */
export function findTopLevel(sf: ts.SourceFile, name: string): ts.Node | null {
    for (const statement of sf.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement;
        if (ts.isVariableStatement(statement))
            for (const d of statement.declarationList.declarations)
                if (ts.isIdentifier(d.name) && d.name.text === name) return statement;
    }
    return null;
}

/** Every string literal text under a node. */
export function literalsUnder(node: ts.Node): Set<string> {
    const found = new Set<string>();
    const visit = (n: ts.Node): void => {
        if (ts.isStringLiteralLike(n)) found.add(n.text);
        ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
}

/** Calls under a node whose callee is the identifier (or a property) with that name. */
export function callsNamed(node: ts.Node, name: string): ts.CallExpression[] {
    const found: ts.CallExpression[] = [];
    const visit = (n: ts.Node): void => {
        if (ts.isCallExpression(n)) {
            const callee = n.expression;
            if (
                (ts.isIdentifier(callee) && callee.text === name) ||
                (ts.isPropertyAccessExpression(callee) && callee.name.text === name)
            )
                found.push(n);
        }
        ts.forEachChild(n, visit);
    };
    visit(node);
    return found;
}

/** `<receiver>.<method>(…)`: the call's method name and receiver, or null. */
function methodCall(node: ts.Expression): {
    readonly method: string;
    readonly call: ts.CallExpression;
    readonly receiver: ts.Expression;
} | null {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
    return { method: node.expression.name.text, call: node, receiver: node.expression.expression };
}

/** Whether a `status:` value may be a reactivated status (a literal of one, or not a literal). */
function mayReactivate(value: ts.Expression): boolean {
    if (ts.isStringLiteralLike(value))
        return (REACTIVATED_STATUSES as readonly string[]).includes(value.text);
    const literals = literalsUnder(value);
    if (literals.size === 0) return true;
    return REACTIVATED_STATUSES.some((status) => literals.has(status));
}

/**
 * Drizzle reactivations: `.update(subscriptions).set({ status: … }).where(…)` with a status that
 * may be `ACTIVE`/`CANCEL_SCHEDULED` and a `where` naming `GRACE_PERIOD` or `SUSPENDED`; plus raw
 * SQL `UPDATE subscription … SET status = 'ACTIVE'|'CANCEL_SCHEDULED' … 'GRACE_PERIOD'|'SUSPENDED'`.
 */
export function findReactivationWrites({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly RetentionWrite[] {
    const sf = parse({ file, source });
    const found: RetentionWrite[] = [];
    const rawUpdate =
        /\bupdate\s+"?subscription"?\s+set\b[\s\S]*\bstatus\s*=\s*'(?:ACTIVE|CANCEL_SCHEDULED)'/i;
    const rawOrigin = /'(?:GRACE_PERIOD|SUSPENDED)'/;
    const visit = (node: ts.Node): void => {
        const where = ts.isCallExpression(node) ? methodCall(node) : null;
        if (where?.method === 'where') {
            const set = methodCall(where.receiver);
            const update = set?.method === 'set' ? methodCall(set.receiver) : null;
            const table = update?.call.arguments[0];
            const values = set?.call.arguments[0];
            if (
                update?.method === 'update' &&
                table &&
                ts.isIdentifier(table) &&
                table.text === 'subscriptions' &&
                values &&
                ts.isObjectLiteralExpression(values)
            ) {
                const status = values.properties.find(
                    (p): p is ts.PropertyAssignment =>
                        ts.isPropertyAssignment(p) &&
                        (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
                        p.name.text === 'status'
                );
                const origins = literalsUnder(where.call);
                if (
                    status &&
                    mayReactivate(status.initializer) &&
                    RETAINING_STATUSES.some((s) => origins.has(s))
                )
                    found.push({
                        file,
                        line: lineOf(status, sf),
                        fnName: topLevelName(node),
                        node
                    });
            }
        }
        if (
            (ts.isStringLiteral(node) ||
                ts.isNoSubstitutionTemplateLiteral(node) ||
                ts.isTemplateExpression(node)) &&
            rawUpdate.test(node.getText(sf)) &&
            rawOrigin.test(node.getText(sf))
        )
            found.push({ file, line: lineOf(node, sf), fnName: topLevelName(node), node });
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
}

/** Inserts into `refunds`: Drizzle `.insert(refunds)` and raw `INSERT INTO refund`. */
export function findRefundInserts({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly RetentionWrite[] {
    const sf = parse({ file, source });
    const found: RetentionWrite[] = [];
    const raw = /\binsert\s+into\s+"?refund"?\s*[(\s]/i;
    const visit = (node: ts.Node): void => {
        const call = ts.isCallExpression(node) ? methodCall(node) : null;
        const table = call?.call.arguments[0];
        if (
            call?.method === 'insert' &&
            table &&
            ts.isIdentifier(table) &&
            table.text === 'refunds'
        )
            found.push({ file, line: lineOf(node, sf), fnName: topLevelName(node), node });
        if (
            (ts.isStringLiteral(node) ||
                ts.isNoSubstitutionTemplateLiteral(node) ||
                ts.isTemplateExpression(node)) &&
            raw.test(node.getText(sf))
        )
            found.push({ file, line: lineOf(node, sf), fnName: topLevelName(node), node });
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return found;
}
