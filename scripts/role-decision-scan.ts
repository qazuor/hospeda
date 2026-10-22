/**
 * GUARD:G6 AST predicates. Half (a) finds role constants used in comparisons,
 * membership checks and switch cases (catalog 04-catalogos.md:7689; INV:12).
 * Half (b) finds role reads while building the effective set (INV:13; V5.md:1222-1227).
 *
 * What it does NOT verify: variable-to-variable comparisons, calculated-key
 * role maps, role sets declared in another file, clients in apps/web or
 * apps/admin, or seed data in packages/seed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/** Supported syntax forms for half (a). */
export type RoleForm = 'compare' | 'membership-arg' | 'membership-set' | 'switch-case';
/** One AST match from half (a), with its source location and enclosing symbol. */
export type RoleFinding = {
    readonly file: string;
    readonly line: number;
    readonly form: RoleForm;
    readonly expression: string;
    readonly symbol: string;
};
/** One role read found in an effective-set construction file. */
export type RoleRead = { readonly file: string; readonly line: number; readonly reads: string };

const MEMBER_METHODS = new Set(['includes', 'has', 'indexOf', 'lastIndexOf']);
const SET_METHODS = new Set([...MEMBER_METHODS, 'some', 'every', 'find', 'filter']);
const READ_CALLS = new Set(['getUserRoles', 'getPermissionsForRoles', 'grantRole', 'revokeRole']);
const READ_IDS = new Set(['userRole', 'userRoleAudit', 'rolePermission', 'userPermission']);
const ROLE_TABLES = new Set(['user_role', 'user_role_audit', 'role_permission']);

function parse(file: string, source: string): ts.SourceFile {
    return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

/** Read RoleEnum's initialized string values from its source file. */
export function readRoleValues(args: { readonly root: string }): ReadonlySet<string> {
    const file = 'packages/schemas/src/enums/role.enum.ts';
    const source = readFileSync(join(args.root, file), 'utf8');
    const sf = parse(file, source);
    const values = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isEnumDeclaration(node) && node.name.text === 'RoleEnum') {
            for (const member of node.members) {
                if (member.initializer && ts.isStringLiteral(member.initializer))
                    values.add(member.initializer.text);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    if (values.size < 10) throw new Error(`G6: RoleEnum has only ${values.size} string values`);
    return values;
}

function unwrap(node: ts.Expression): ts.Expression {
    let current = node;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        (ts.isCallExpression(current) &&
            ts.isPropertyAccessExpression(current.expression) &&
            current.expression.expression.getText() === 'Object' &&
            current.expression.name.text === 'freeze')
    ) {
        current = ts.isCallExpression(current) ? current.arguments[0] : current.expression;
    }
    return current;
}

function propName(node: ts.Expression): string | undefined {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (
        ts.isElementAccessExpression(node) &&
        node.argumentExpression &&
        ts.isStringLiteral(node.argumentExpression)
    )
        return node.argumentExpression.text;
    return undefined;
}

function roleish(node: ts.Expression): boolean {
    const name = propName(node);
    return !!name && (name === 'role' || name === 'roles' || /Roles?$/.test(name));
}

function roleMember(node: ts.Expression): boolean {
    return (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'RoleEnum'
    );
}

function roleLiteral(node: ts.Expression, values: ReadonlySet<string>): boolean {
    const value = unwrap(node);
    if (ts.isStringLiteral(value)) return values.has(value.text);
    return ts.isNoSubstitutionTemplateLiteral(value) && values.has(value.text);
}

function memberCall(node: ts.CallExpression, methods: ReadonlySet<string>): boolean {
    return ts.isPropertyAccessExpression(node.expression) && methods.has(node.expression.name.text);
}

function setHasRole(node: ts.Expression): boolean {
    const value = unwrap(node);
    if (ts.isArrayLiteralExpression(value))
        return value.elements.some((e) => ts.isExpression(e) && roleMember(unwrap(e)));
    return (
        ts.isNewExpression(value) &&
        ts.isIdentifier(value.expression) &&
        value.expression.text === 'Set' &&
        !!value.arguments?.[0] &&
        ts.isArrayLiteralExpression(unwrap(value.arguments[0])) &&
        (unwrap(value.arguments[0]) as ts.ArrayLiteralExpression).elements.some(
            (e) => ts.isExpression(e) && roleMember(unwrap(e))
        )
    );
}

function symbolFor(node: ts.Node): string {
    let child: ts.Node = node;
    for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
        if (
            ts.isFunctionDeclaration(parent) ||
            ts.isMethodDeclaration(parent) ||
            ts.isMethodSignature(parent)
        )
            return parent.name?.getText() ?? '<module>';
        if (ts.isPropertyDeclaration(parent)) return parent.name.getText();
        if (
            (ts.isArrowFunction(child) || ts.isFunctionExpression(child)) &&
            ts.isVariableDeclaration(parent)
        )
            return parent.name.getText();
        if (
            ts.isVariableDeclaration(parent) &&
            parent.initializer &&
            (ts.isArrowFunction(parent.initializer) || ts.isFunctionExpression(parent.initializer))
        )
            return parent.name.getText();
    }
    return '<module>';
}

function findRoleDecisionsInSourceFile(
    args: {
        readonly file: string;
        readonly roleValues: ReadonlySet<string>;
    },
    sf: ts.SourceFile
): readonly RoleFinding[] {
    const findings: RoleFinding[] = [];
    const seen = new Set<string>();
    const report = (node: ts.Node, form: RoleForm): void => {
        const key = `${node.pos}:${node.end}:${form}`;
        if (seen.has(key)) return;
        seen.add(key);
        findings.push({
            file: args.file,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            form,
            expression: node.getText(sf).replace(/\s+/g, ' ').slice(0, 120),
            symbol: symbolFor(node)
        });
    };
    const declarations = new Map<string, ts.Expression>();
    const collect = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && node.initializer)
            declarations.set(node.name.getText(sf), node.initializer);
        if (ts.isPropertyDeclaration(node) && node.initializer)
            declarations.set(node.name.getText(sf), node.initializer);
        ts.forEachChild(node, collect);
    };
    collect(sf);
    const setReceiver = (node: ts.Expression): boolean => {
        const value = unwrap(node);
        if (setHasRole(value)) return true;
        const name = ts.isPropertyAccessExpression(value)
            ? `${value.expression.getText(sf)}.${value.name.text}`
            : value.getText(sf);
        const declaration =
            declarations.get(name) ??
            (ts.isPropertyAccessExpression(value) ? declarations.get(value.name.text) : undefined);
        return !!declaration && setHasRole(declaration);
    };
    const visit = (node: ts.Node): void => {
        if (
            ts.isBinaryExpression(node) &&
            [
                ts.SyntaxKind.EqualsEqualsEqualsToken,
                ts.SyntaxKind.ExclamationEqualsEqualsToken,
                ts.SyntaxKind.EqualsEqualsToken,
                ts.SyntaxKind.ExclamationEqualsToken
            ].includes(node.operatorToken.kind)
        ) {
            const left = unwrap(node.left),
                right = unwrap(node.right);
            const literalComparison =
                (roleLiteral(left, args.roleValues) && roleish(right)) ||
                (roleLiteral(right, args.roleValues) && roleish(left));
            if (roleMember(left) || roleMember(right) || literalComparison) report(node, 'compare');
        }
        if (ts.isCallExpression(node) && memberCall(node, MEMBER_METHODS)) {
            const receiver = (node.expression as ts.PropertyAccessExpression).expression;
            if (
                node.arguments.some(
                    (arg) =>
                        roleMember(unwrap(arg)) ||
                        (roleLiteral(arg, args.roleValues) && roleish(receiver))
                )
            )
                report(node, 'membership-arg');
            if (
                SET_METHODS.has((node.expression as ts.PropertyAccessExpression).name.text) &&
                setReceiver(receiver)
            )
                report(node, 'membership-set');
        }
        if (ts.isSwitchStatement(node) && roleish(node.expression)) {
            for (const clause of node.caseBlock.clauses)
                if (
                    ts.isCaseClause(clause) &&
                    (roleMember(clause.expression) ||
                        roleLiteral(clause.expression, args.roleValues))
                )
                    report(clause, 'switch-case');
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return findings;
}

function findRoleReadsInSourceFile(
    args: {
        readonly file: string;
        readonly roleValues: ReadonlySet<string>;
    },
    sf: ts.SourceFile,
    decisions: readonly RoleFinding[]
): readonly RoleRead[] {
    const reads: RoleRead[] = [];
    const visit = (node: ts.Node): void => {
        let what: string | undefined;
        if (ts.isIdentifier(node) && (node.text === 'RoleEnum' || READ_IDS.has(node.text)))
            what = node.text;
        else if (ts.isPropertyAccessExpression(node) && node.name.text === 'roles') what = '.roles';
        else if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            READ_CALLS.has(node.expression.text)
        )
            what = node.expression.text;
        else if (ts.isStringLiteral(node) && ROLE_TABLES.has(node.text)) what = node.text;
        if (what)
            reads.push({
                file: args.file,
                line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
                reads: what
            });
        ts.forEachChild(node, visit);
    };
    visit(sf);
    for (const finding of decisions)
        if (finding.form === 'compare' || finding.form === 'membership-arg')
            reads.push({ file: args.file, line: finding.line, reads: finding.expression });
    return reads;
}

/** Combined pure result for one source file. */
export type RoleFileAnalysis = {
    readonly decisions: readonly RoleFinding[];
    readonly reads: readonly RoleRead[];
    readonly declaresResolveEffectiveSet: boolean;
    readonly callsEffectiveSet: boolean;
};

/** Analyze role decisions, role reads, and effective-set scope anchors in one AST parse. */
export function analyzeRoleFile(args: {
    readonly file: string;
    readonly source: string;
    readonly roleValues: ReadonlySet<string>;
}): RoleFileAnalysis {
    const sf = parse(args.file, args.source);
    const decisions = findRoleDecisionsInSourceFile(args, sf);
    const reads = findRoleReadsInSourceFile(args, sf, decisions);
    const declaresResolveEffectiveSet = sf.statements.some(
        (statement) =>
            ts.isFunctionDeclaration(statement) &&
            statement.name?.text === 'resolveEffectiveSet' &&
            statement.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
            ) === true &&
            statement.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    );
    let callsEffectiveSet = false;
    const visit = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            ((ts.isIdentifier(node.expression) && node.expression.text === 'resolveEffectiveSet') ||
                (ts.isPropertyAccessExpression(node.expression) &&
                    node.expression.name.text === 'effectiveSet'))
        )
            callsEffectiveSet = true;
        if (!callsEffectiveSet) ts.forEachChild(node, visit);
    };
    visit(sf);
    return { decisions, reads, declaresResolveEffectiveSet, callsEffectiveSet };
}

/** Find the four supported role-constant decision forms without reading files. */
export function findRoleDecisions(args: {
    readonly file: string;
    readonly source: string;
    readonly roleValues: ReadonlySet<string>;
}): readonly RoleFinding[] {
    return analyzeRoleFile(args).decisions;
}

/** Find any configured role read in one effective-set construction file. */
export function findRoleReads(args: {
    readonly file: string;
    readonly source: string;
    readonly roleValues: ReadonlySet<string>;
}): readonly RoleRead[] {
    return analyzeRoleFile(args).reads;
}

/** Check whether source declares the exported asynchronous effective-set anchor. */
export function declaresResolveEffectiveSet(args: {
    readonly file: string;
    readonly source: string;
    readonly roleValues: ReadonlySet<string>;
}): boolean {
    return analyzeRoleFile(args).declaresResolveEffectiveSet;
}

/** Find calls that make a file a consumer of the effective-set construction. */
export function callsEffectiveSet(args: {
    readonly file: string;
    readonly source: string;
    readonly roleValues: ReadonlySet<string>;
}): boolean {
    return analyzeRoleFile(args).callsEffectiveSet;
}
