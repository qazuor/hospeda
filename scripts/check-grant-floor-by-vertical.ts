/**
 * @file check-grant-floor-by-vertical.ts
 * @description GUARD:G-R2-B (HOS-1352 program, built by V3 / HOS-1440, AC:V3:5,
 * TEST:V3:7): the resolution of a `user + vertical` takes the GRANT source of
 * that vertical and no other, with the floor read from the source's `floor`
 * field, and compares the plan of the source's reference against the vertical
 * of the source (`V/15` §2.5, `12-contrato…` §2; DEC-GRANT-005).
 *
 * ## What the predicate checks
 *
 * The resolution lives in one directory (`V/17` §1.3 forbids resolving the
 * steps per call site), so the guard reads that directory's production files and
 * requires two halves to still be wired:
 *
 * - (a) the resolution calls `coverage` with its requested `userId` and
 *       `vertical`, selects from that response's sources, and filters on
 *       `'GRANT'`, and
 * - (b) the resolution reads the floor from the selected source
 *       (`grant.floor`, never a billing table), reads the floor VERSION's
 *       summary FROM that `grant.floor`, and compares BOTH the referenced plan
 *       version's `vertical` AND the floor version's `vertical` against the
 *       resolved one. Requiring the floor version's own summary (bound from
 *       `grant.floor`) and its `.vertical` comparison is what detects a real
 *       cross read: a resolution that checks only the reference and reads the
 *       floor from another vertical is red.
 *
 * ## Why a parser, not a substring
 *
 * A presence check passes over a selector whose filter was NEUTRALISED
 * (`args.sources[0]`, a constant) while the name `'GRANT'` still appears, and
 * over a comparison turned into a constant while `.vertical` still appears. So
 * (a) parses the selector and requires a `.find`/`.filter` predicate that
 * compares against the string `'GRANT'`, and (b) parses the files and requires a
 * real property read of `floor` and a binary comparison of a `vertical`
 * property.
 *
 * ## What it does NOT prove, so a green run is not read as more
 *
 * It is a static structure check over one directory: it proves the requested
 * identity is passed to coverage and its sources reach the selector, but does
 * not prove the implementation of billing or how the anchor is stored.
 *
 * Exit codes: 0 = clean; 1 = a half is missing, or the resolution is absent.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Where the resolution lives; the guard reads every production file in it. */
export const RESOLUTION_DIR = 'packages/verticals/src/effective-set';

/** The two halves of the by-vertical grant floor, each named when absent. */
export type GR2BHalf =
    | 'grant-source-by-type'
    | 'grant-floor-by-vertical'
    | 'grant-coverage-identity';

/** The message per half. Each claims only what its predicate verifies. */
export const RULE_MESSAGES: Readonly<Record<GR2BHalf, string>> = {
    'grant-source-by-type':
        'G-R2-B: the resolution no longer selects the GRANT source through a filter on ' +
        "`'GRANT'`, so a source of another type (or a non-grant) can be resolved as the grant.",
    'grant-floor-by-vertical':
        'G-R2-B: the resolution does not compare the referenced plan version vertical AND the ' +
        "floor version vertical (read from the GRANT source's `grant.floor`) against the " +
        'resolved vertical, so a grant can be compared against a plan or a floor of another ' +
        'vertical.',
    'grant-coverage-identity':
        'G-R2-B: the GRANT source is not selected from coverage(userId, vertical) of the requested identity.'
};

/** Whether a property access has the exact AST path requested. */
function hasPath(node: ts.Node, path: string): boolean {
    return ts.isExpression(node) && dottedName(node) === path;
}

/** Checks the coverage call and the selected sources within resolveGrantSet. */
function fileBindsCoverageToIdentity(file: ResolutionFile): boolean {
    const sourceFile = ts.createSourceFile(
        file.name,
        file.source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
    const resolver = findFunction(sourceFile, 'resolveGrantSet');
    if (!resolver?.body) return false;
    const coverageNames = new Set<string>();
    let selectsCoverage = false;
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            const init = ts.isAwaitExpression(node.initializer)
                ? node.initializer.expression
                : node.initializer;
            if (ts.isCallExpression(init) && hasPath(init.expression, 'args.billing.coverage')) {
                const first = init.arguments[0];
                if (first && ts.isObjectLiteralExpression(first)) {
                    const fields = new Map(
                        first.properties
                            .filter(ts.isPropertyAssignment)
                            .map((property) => [
                                property.name.getText(sourceFile),
                                property.initializer
                            ])
                    );
                    if (
                        hasPath(fields.get('userId') ?? sourceFile, 'args.userId') &&
                        hasPath(fields.get('vertical') ?? sourceFile, 'args.vertical')
                    )
                        coverageNames.add(node.name.text);
                }
            }
            if (ts.isCallExpression(init) && hasPath(init.expression, 'selectGrantForVertical')) {
                const first = init.arguments[0];
                if (first && ts.isObjectLiteralExpression(first)) {
                    const sources = first.properties.find(
                        (property) =>
                            ts.isPropertyAssignment(property) &&
                            property.name.getText(sourceFile) === 'sources'
                    );
                    if (
                        sources &&
                        ts.isPropertyAssignment(sources) &&
                        ts.isPropertyAccessExpression(sources.initializer) &&
                        sources.initializer.name.text === 'sources' &&
                        ts.isIdentifier(sources.initializer.expression) &&
                        coverageNames.has(sources.initializer.expression.text)
                    )
                        selectsCoverage = true;
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(resolver.body);
    return selectsCoverage;
}

const TEST_FILE = /\.(?:test|spec)\.[cm]?tsx?$/;

/** One production file of the resolution directory, with its text. */
interface ResolutionFile {
    readonly name: string;
    readonly source: string;
}

/** The dotted name of a callee chain, e.g. `selectGrantForVertical`; else `null`. */
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

/** Whether `node` is any function-like boundary the walks must not cross. */
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

/** The expressions the function returns, without descending into nested functions. */
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

/** Every `.find(...)`/`.filter(...)` call inside one expression. */
function collectSelectorCalls(root: ts.Node): readonly ts.CallExpression[] {
    const found: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            (node.expression.name.text === 'find' || node.expression.name.text === 'filter')
        ) {
            found.push(node);
        }
        ts.forEachChild(node, visit);
    };
    visit(root);
    return found;
}

/** The expression a `.find(callback)`/`.filter(callback)` callback returns, or `null`. */
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

/** Whether the predicate compares something against the string `'GRANT'`. */
function comparesToGrant(predicate: ts.Expression): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (
            ts.isBinaryExpression(node) &&
            (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken ||
                node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
        ) {
            const literal = (side: ts.Node): boolean =>
                ts.isStringLiteral(side) && side.text === 'GRANT';
            if (literal(node.left) || literal(node.right)) {
                found = true;
                return;
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(predicate);
    return found;
}

/** Whether the selector really filters on `'GRANT'`. */
function selectorGrantsByType(files: readonly ResolutionFile[]): boolean {
    for (const file of files) {
        const sourceFile = ts.createSourceFile(
            file.name,
            file.source,
            ts.ScriptTarget.Latest,
            /* setParentNodes */ true,
            ts.ScriptKind.TS
        );
        const selector = findFunction(sourceFile, 'selectGrantForVertical');
        if (!selector) continue;
        for (const expression of collectReturnExpressions(selector)) {
            for (const call of collectSelectorCalls(expression)) {
                const predicate = callbackPredicate(call);
                if (predicate && comparesToGrant(predicate)) return true;
            }
        }
        return false;
    }
    return false;
}

/** The names bound from a `selectGrantForVertical(...)` call in one file. */
function grantBindingNames(sourceFile: ts.SourceFile): ReadonlySet<string> {
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            let initializer: ts.Expression = node.initializer;
            if (ts.isAwaitExpression(initializer)) initializer = initializer.expression;
            if (
                ts.isCallExpression(initializer) &&
                dottedName(initializer.expression) === 'selectGrantForVertical'
            ) {
                names.add(node.name.text);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return names;
}

/** Whether an expression tree contains `<grant>.floor` for any grant binding. */
function referencesSelectedFloor(expression: ts.Expression, grants: ReadonlySet<string>): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            grants.has(node.expression.text) &&
            node.name.text === 'floor'
        ) {
            found = true;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(expression);
    return found;
}

/** Whether a file reads `<grant>.floor` for a grant bound from the selector. */
function fileReadsSelectedFloor(sourceFile: ts.SourceFile, grants: ReadonlySet<string>): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (
            ts.isPropertyAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            grants.has(node.expression.text) &&
            node.name.text === 'floor'
        ) {
            found = true;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found;
}

/**
 * The names bound from a call whose arguments reference `<grant>.floor`: the
 * floor version's summary (and any read taken from that same floor value).
 */
function floorDerivedBindingNames(
    sourceFile: ts.SourceFile,
    grants: ReadonlySet<string>
): ReadonlySet<string> {
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            let initializer: ts.Expression = node.initializer;
            if (ts.isAwaitExpression(initializer)) initializer = initializer.expression;
            if (
                ts.isCallExpression(initializer) &&
                initializer.arguments.some((argument) => referencesSelectedFloor(argument, grants))
            ) {
                names.add(node.name.text);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return names;
}

/** Whether a node is a binary comparison over a `.vertical` property. */
function isVerticalComparison(node: ts.Node): node is ts.BinaryExpression {
    return (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken ||
            node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken ||
            node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
        (isVerticalProperty(node.left) || isVerticalProperty(node.right))
    );
}

/** Whether a comparison compares the `.vertical` of a value in `bindings`. */
function comparesVerticalOfBinding(
    node: ts.BinaryExpression,
    bindings: ReadonlySet<string>
): boolean {
    const isBoundVertical = (side: ts.Node): boolean =>
        ts.isPropertyAccessExpression(side) &&
        side.name.text === 'vertical' &&
        ts.isIdentifier(side.expression) &&
        bindings.has(side.expression.text);
    return isBoundVertical(node.left) || isBoundVertical(node.right);
}

/**
 * Whether ONE file both reads the floor FROM THE SELECTED GRANT
 * (`<grant>.floor`, where `<grant>` is bound from `selectGrantForVertical`),
 * takes the floor version's summary from that floor, and compares BOTH a
 * non-floor `.vertical` (the reference) AND a floor-derived `.vertical` against
 * the resolved vertical. Requiring the floor's own comparison is what makes a
 * real cross read red instead of merely checking the reference.
 */
function fileReadsFloorAndComparesVertical(file: ResolutionFile): boolean {
    const sourceFile = ts.createSourceFile(
        file.name,
        file.source,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
        ts.ScriptKind.TS
    );
    const grants = grantBindingNames(sourceFile);
    if (grants.size === 0) return false;
    if (!fileReadsSelectedFloor(sourceFile, grants)) return false;

    const floorBindings = floorDerivedBindingNames(sourceFile, grants);
    if (floorBindings.size === 0) return false;

    let comparesFloorVertical = false;
    let comparesReferenceVertical = false;
    const visit = (node: ts.Node): void => {
        if (isVerticalComparison(node)) {
            if (comparesVerticalOfBinding(node, floorBindings)) comparesFloorVertical = true;
            else comparesReferenceVertical = true;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return comparesFloorVertical && comparesReferenceVertical;
}

/** Whether some resolution file reads the floor and compares the vertical. */
function readsFloorAndComparesVertical(files: readonly ResolutionFile[]): boolean {
    return files.some((file) => fileReadsFloorAndComparesVertical(file));
}

/** Whether a node is a property access ending in `.vertical`. */
function isVerticalProperty(node: ts.Node): boolean {
    return ts.isPropertyAccessExpression(node) && node.name.text === 'vertical';
}

/**
 * The two halves over the resolution's files.
 *
 * @param args.files - The resolution's production files.
 * @returns One entry per half that is missing.
 */
export function findMissingHalves({
    files
}: {
    readonly files: readonly ResolutionFile[];
}): readonly GR2BHalf[] {
    const missing: GR2BHalf[] = [];
    if (!selectorGrantsByType(files)) missing.push('grant-source-by-type');
    if (!readsFloorAndComparesVertical(files)) missing.push('grant-floor-by-vertical');
    if (!files.some(fileBindsCoverageToIdentity)) missing.push('grant-coverage-identity');
    return missing;
}

/** Production files of the resolution directory, or `null` when absent. */
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
 * Runs GUARD:G-R2-B.
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
    const lines = ['=== GUARD:G-R2-B - the grant floor is read by vertical from the source ==='];

    const files = readResolutionFiles({ root });
    if (files === null) {
        lines.push(
            '',
            `FAIL G-R2-B: the resolution under ${RESOLUTION_DIR} has no production file.`
        );
        return { exitCode: 1, output: lines.join('\n') };
    }

    const missing = findMissingHalves({ files });
    if (missing.length > 0) {
        for (const half of missing) lines.push('', `FAIL ${RULE_MESSAGES[half]}`);
        return { exitCode: 1, output: lines.join('\n') };
    }

    lines.push(
        `OK: ${RESOLUTION_DIR} selects the GRANT source from coverage(userId, vertical) by type, and compares both the referenced plan version vertical and the floor version vertical (read from the source's floor) against the resolved one.`
    );
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
