/**
 * @file check-addon-compatible-verticals.ts
 * @description GUARD:G-R2-C (HOS-1352 program, built by B4 / HOS-1532, AC:B4:8,
 * TEST:B4:8): billing's real `ADDON` coverage source emits an addon instance of
 * scope `USER` or `GLOBAL` only in the verticals its product declares compatible
 * (`addon_product.compatible_verticals`, contract §2.7; DEC-ADDON-007). Twin of
 * G-R2-B: that one watches that a grant never carries another vertical's anchor,
 * this one that a user-wide addon never appears where its product does not reach.
 *
 * ## What the predicate checks
 *
 * The guard parses ONE file, {@link ADDON_SOURCES_FILE}, with the TypeScript
 * parser and requires, inside the function `resolveAddonSources`:
 *
 * - (a) the file and the function exist. A moved or renamed source fails loud:
 *       a missing file is never read as a clean tree;
 * - (b) a call `<expr>.compatibleVerticals.includes(<requested vertical>)`, where
 *       the argument is the vertical the resolver was ASKED about — the
 *       `vertical` field of its first parameter (`args.vertical`, or the local
 *       name of a destructured `vertical`). A constant vertical, another
 *       property, or a `true` in its place is red;
 * - (c) that call decides the emission in the `USER`/`GLOBAL` branch: inside a
 *       `switch` clause group labelled `'USER'`/`'GLOBAL'` (or an `if` whose
 *       condition compares against one of those literals), every emitting
 *       `return`/`.push(...)` sits in the then-branch of an `if` whose condition
 *       carries the call (alone or in an `&&` chain), or after an early
 *       `if (!<call>) return null | return | continue`. A call left loose
 *       elsewhere in the resolver is red.
 *
 * ## Why a parser, not a substring
 *
 * A substring check passes over a filter whose argument was turned into a
 * constant (`includes('accommodation')`), over a filter computed and then
 * ignored, and over a filter moved to a branch that no longer decides the
 * `USER`/`GLOBAL` emission — while the text `compatibleVerticals.includes`
 * still appears.
 *
 * ## What it does NOT prove, so a green run is not read as more
 *
 * It is a static structure check over one file. It does not see the database,
 * does not see a filter done in SQL instead, does not see any source other than
 * the watched one, and does not prove that `compatibleVerticals` holds the
 * product's real column. The behaviour over seeded rows is TEST:B4:7's job.
 * Shapes it does not recognise (e.g. a filter stored in a variable first) are
 * red on purpose: change the guard together with the shape.
 *
 * Exit codes: 0 = clean; 1 = a half is missing, or the file/function is absent.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** The watched file: billing's real `ADDON` coverage source. */
export const ADDON_SOURCES_FILE =
    'packages/service-core/src/services/billing/coverage/addon-sources.ts';

/** The watched function inside {@link ADDON_SOURCES_FILE}. */
export const ADDON_RESOLVER = 'resolveAddonSources';

/** The halves of G-R2-C, each named when absent. */
export type GR2CHalf =
    | 'resolver-present'
    | 'compatible-vertical-filter'
    | 'filter-gates-user-global';

/** The message per half. Each names the watched file and claims only what its predicate verifies. */
export const RULE_MESSAGES: Readonly<Record<GR2CHalf, string>> = {
    'resolver-present': `G-R2-C: ${ADDON_SOURCES_FILE} no longer declares \`${ADDON_RESOLVER}\`, so the ADDON source the guard watches cannot be found.`,
    'compatible-vertical-filter': `G-R2-C: \`${ADDON_RESOLVER}\` in ${ADDON_SOURCES_FILE} has no call \`<expr>.compatibleVerticals.includes(<requested vertical>)\` against the vertical it was asked about, so a USER/GLOBAL addon can be emitted in a vertical its product does not declare compatible.`,
    'filter-gates-user-global': `G-R2-C: \`${ADDON_RESOLVER}\` in ${ADDON_SOURCES_FILE} calls \`compatibleVerticals.includes\` but not in the condition that decides emitting a USER/GLOBAL source, so that emission is not gated by the product's compatible verticals.`
};

/** The literals that name the user-wide scopes. */
const USER_WIDE_SCOPES: ReadonlySet<string> = new Set(['USER', 'GLOBAL']);

/** The dotted name of a property chain, e.g. `args.vertical`; else `null`. */
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

/** Whether `node` is a function-like boundary the emission walk must not cross. */
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

/** Finds a function by name, declared or bound to an arrow/function expression. */
function findFunction(sourceFile: ts.SourceFile, name: string): ts.FunctionLikeDeclaration | null {
    let found: ts.FunctionLikeDeclaration | null = null;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
            found = node;
            return;
        }
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === name &&
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

/**
 * The predicate that recognises the requested vertical: `<param>.vertical` for
 * an identifier first parameter, or the local name of a destructured `vertical`.
 */
function requestedVerticalMatcher(
    resolver: ts.FunctionLikeDeclaration
): ((node: ts.Expression) => boolean) | null {
    const param = resolver.parameters[0];
    if (!param) return null;
    if (ts.isIdentifier(param.name)) {
        const path = `${param.name.text}.vertical`;
        return (node) => dottedName(node) === path;
    }
    if (ts.isObjectBindingPattern(param.name)) {
        for (const element of param.name.elements) {
            const key = element.propertyName ?? element.name;
            if (ts.isIdentifier(key) && key.text === 'vertical' && ts.isIdentifier(element.name)) {
                const local = element.name.text;
                return (node) => ts.isIdentifier(node) && node.text === local;
            }
        }
    }
    return null;
}

/** Whether a node is `<expr>.compatibleVerticals.includes(<requested vertical>)`. */
function isCompatibleFilter(node: ts.Node, isRequested: (node: ts.Expression) => boolean): boolean {
    if (!ts.isCallExpression(node)) return false;
    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'includes') return false;
    const owner = callee.expression;
    if (!ts.isPropertyAccessExpression(owner) || owner.name.text !== 'compatibleVerticals') {
        return false;
    }
    const [argument] = node.arguments;
    return node.arguments.length === 1 && argument !== undefined && isRequested(argument);
}

/** Whether a subtree contains the filter call anywhere. */
function containsFilter(root: ts.Node, isFilter: (node: ts.Node) => boolean): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (isFilter(node)) {
            found = true;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
}

/** Strips parentheses around an expression. */
function unwrap(expression: ts.Expression): ts.Expression {
    let node = expression;
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
}

/** Whether a condition is the filter, or an `&&` chain with the filter as one operand. */
function positivelyRequiresFilter(
    condition: ts.Expression,
    isFilter: (node: ts.Node) => boolean
): boolean {
    const node = unwrap(condition);
    if (isFilter(node)) return true;
    if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
        return (
            positivelyRequiresFilter(node.left, isFilter) ||
            positivelyRequiresFilter(node.right, isFilter)
        );
    }
    return false;
}

/** Whether a condition is `!<filter>`, or an `||` chain with `!<filter>` as one operand. */
function negativelyRequiresFilter(
    condition: ts.Expression,
    isFilter: (node: ts.Node) => boolean
): boolean {
    const node = unwrap(condition);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
        return isFilter(unwrap(node.operand));
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        return (
            negativelyRequiresFilter(node.left, isFilter) ||
            negativelyRequiresFilter(node.right, isFilter)
        );
    }
    return false;
}

/** Whether a statement bails out without emitting: `return`, `return null|undefined` or `continue`. */
function isBailOut(statement: ts.Statement): boolean {
    const single =
        ts.isBlock(statement) && statement.statements.length === 1
            ? statement.statements[0]
            : statement;
    if (!single) return false;
    if (ts.isContinueStatement(single)) return true;
    if (!ts.isReturnStatement(single)) return false;
    return single.expression === undefined || isNullish(single.expression);
}

/** Whether an expression is `null` or `undefined`. */
function isNullish(expression: ts.Expression): boolean {
    const node = unwrap(expression);
    return (
        node.kind === ts.SyntaxKind.NullKeyword ||
        (ts.isIdentifier(node) && node.text === 'undefined')
    );
}

/** Whether a node emits a source: a non-nullish `return`, or a `.push(...)` call. */
function isEmission(node: ts.Node): boolean {
    if (ts.isReturnStatement(node)) {
        return node.expression !== undefined && !isNullish(node.expression);
    }
    return (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'push'
    );
}

/**
 * Whether every emission in `statements` is gated by the filter: nested in the
 * then-branch of an `if` that positively requires it, or after an early
 * `if (!<filter>) <bail out>` at the top of the branch. A branch without any
 * emission is not gated (there is nothing the filter decides).
 */
function branchIsGated(
    statements: readonly ts.Statement[],
    isFilter: (node: ts.Node) => boolean
): boolean {
    let emissions = 0;
    let ungated = 0;
    let earlyGuard = false;
    const visit = (node: ts.Node, gated: boolean): void => {
        if (isFunctionLikeNode(node)) return;
        if (isEmission(node)) {
            emissions += 1;
            if (!gated) ungated += 1;
        }
        if (ts.isIfStatement(node)) {
            visit(node.expression, gated);
            visit(node.thenStatement, gated || positivelyRequiresFilter(node.expression, isFilter));
            if (node.elseStatement) visit(node.elseStatement, gated);
            return;
        }
        ts.forEachChild(node, (child) => visit(child, gated));
    };
    for (const statement of statements) {
        if (
            ts.isIfStatement(statement) &&
            !statement.elseStatement &&
            negativelyRequiresFilter(statement.expression, isFilter) &&
            isBailOut(statement.thenStatement)
        ) {
            earlyGuard = true;
            continue;
        }
        visit(statement, earlyGuard);
    }
    return emissions > 0 && ungated === 0;
}

/** Flattens a single block statement into its statements. */
function flatten(statements: readonly ts.Statement[]): readonly ts.Statement[] {
    const [only] = statements;
    if (statements.length === 1 && only && ts.isBlock(only)) return only.statements;
    return statements;
}

/** Whether a condition compares something against `'USER'` or `'GLOBAL'`. */
function comparesToUserWideScope(condition: ts.Expression): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (
            ts.isBinaryExpression(node) &&
            (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken)
        ) {
            const literal = (side: ts.Node): boolean =>
                ts.isStringLiteral(side) && USER_WIDE_SCOPES.has(side.text);
            if (literal(node.left) || literal(node.right)) {
                found = true;
                return;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(condition);
    return found;
}

/**
 * The branches of the resolver that decide a `USER`/`GLOBAL` emission: every
 * `switch` clause group with one of those labels, and the then-branch of every
 * `if` that compares against one of them.
 */
function userWideBranches(body: ts.Node): readonly (readonly ts.Statement[])[] {
    const branches: (readonly ts.Statement[])[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isSwitchStatement(node)) {
            let labelsUserWide = false;
            for (const clause of node.caseBlock.clauses) {
                if (
                    ts.isCaseClause(clause) &&
                    ts.isStringLiteral(clause.expression) &&
                    USER_WIDE_SCOPES.has(clause.expression.text)
                ) {
                    labelsUserWide = true;
                }
                if (clause.statements.length > 0) {
                    if (labelsUserWide) branches.push(flatten(clause.statements));
                    labelsUserWide = false;
                }
            }
        }
        if (ts.isIfStatement(node) && comparesToUserWideScope(node.expression)) {
            branches.push(flatten([node.thenStatement]));
        }
        ts.forEachChild(node, visit);
    };
    visit(body);
    return branches;
}

/**
 * The halves of G-R2-C over the watched file's text.
 *
 * @param args.source - The text of {@link ADDON_SOURCES_FILE}.
 * @returns One entry per half that is missing.
 */
export function findMissingHalves({ source }: { readonly source: string }): readonly GR2CHalf[] {
    const sourceFile = ts.createSourceFile(
        ADDON_SOURCES_FILE,
        source,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TS
    );
    const resolver = findFunction(sourceFile, ADDON_RESOLVER);
    const body = (resolver as { readonly body?: ts.Node } | null)?.body;
    if (!resolver || !body) return ['resolver-present'];

    const isRequested = requestedVerticalMatcher(resolver);
    if (!isRequested) return ['compatible-vertical-filter'];
    const isFilter = (node: ts.Node): boolean => isCompatibleFilter(node, isRequested);
    if (!containsFilter(body, isFilter)) return ['compatible-vertical-filter'];

    const branches = userWideBranches(body);
    if (branches.length === 0 || !branches.every((branch) => branchIsGated(branch, isFilter))) {
        return ['filter-gates-user-global'];
    }
    return [];
}

/**
 * Runs GUARD:G-R2-C.
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
        '=== GUARD:G-R2-C - a USER/GLOBAL addon source is emitted only in its compatible verticals ==='
    ];

    const file = join(root, ADDON_SOURCES_FILE);
    if (!existsSync(file)) {
        lines.push(
            '',
            `FAIL G-R2-C: ${ADDON_SOURCES_FILE} does not exist. A moved source fails loud: move the guard with it.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }

    const missing = findMissingHalves({ source: readFileSync(file, 'utf8') });
    if (missing.length > 0) {
        for (const half of missing) lines.push('', `FAIL ${RULE_MESSAGES[half]}`);
        return { exitCode: 1, output: lines.join('\n') };
    }

    lines.push(
        `OK: ${ADDON_SOURCES_FILE} gates every USER/GLOBAL emission of \`${ADDON_RESOLVER}\` on \`compatibleVerticals.includes(<requested vertical>)\`.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
