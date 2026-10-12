/**
 * Shared AST scanner for the sites that exercise a listing domain operation
 * (an operation of `LISTING_OPERATIONS`). Read by GUARD:G-R3-C
 * (`check-step5-declared.ts`) and by GUARD:G2 halves (a) and (b)
 * (`check-vertical-context.ts`).
 *
 * A domain operation is exercised in four site forms:
 * - `route-config`: a `listingAccess: { ... }` property assignment on a route;
 * - `resolver-call`: a call to `resolveListingAccess({ ... })`;
 * - `resource-step-call`: a call to `resolveResourceStep({ ... })`;
 * - `resource-vertical-call`: a call to `resolveResourceVertical({ ... })`.
 *
 * What it does NOT see: shorthand `listingAccess,` properties and type
 * `PropertySignature`s (they declare nothing), test files, and files outside
 * `SCAN_ROOTS`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/** Production roots whose files are scanned for operation sites. */
export const SCAN_ROOTS: readonly RegExp[] = [/^apps\/api\/src\//, /^packages\/[^/]+\/src\//];
/** Source files the scanner parses. */
export const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
/** Test files, which never count as production sites. */
export const TEST_FILE =
    /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;

/** The four syntactic forms in which a domain operation is exercised. */
export type OperationSiteKind =
    | 'route-config'
    | 'resolver-call'
    | 'resource-step-call'
    | 'resource-vertical-call';

/** Why a site's properties cannot be read: a spread or a non-literal expression. */
export type SiteOpacity = 'spread' | 'identifier' | 'expression';

/** One operation site, with its explicitly named properties as AST nodes. */
export type OperationSite = {
    readonly file: string;
    readonly line: number;
    readonly kind: OperationSiteKind;
    /** Non-null when the site's object cannot be read property by property. */
    readonly opaque: SiteOpacity | null;
    /** Properties named explicitly (`name: value` or shorthand `name`). */
    readonly properties: ReadonlyMap<string, ts.Expression>;
    readonly sourceFile: ts.SourceFile;
};

const CALL_KINDS: ReadonlyMap<string, OperationSiteKind> = new Map([
    ['resolveListingAccess', 'resolver-call'],
    ['resolveResourceStep', 'resource-step-call'],
    ['resolveResourceVertical', 'resource-vertical-call']
]);

/**
 * List the production files under `SCAN_ROOTS`, committed or not (untracked
 * files count, which is what lets a mutation add a new file).
 */
export function listProductionFiles(args: { readonly root: string }): readonly string[] {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: args.root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return output
        .split('\0')
        .filter(Boolean)
        .filter((file) => CODE_FILE.test(file) && !TEST_FILE.test(file))
        .filter((file) => SCAN_ROOTS.some((rootPattern) => rootPattern.test(file)))
        .filter((file) => existsSync(join(args.root, file)));
}

/** Strip parentheses, `as`, `satisfies`, `<T>` casts and non-null assertions. */
export function unwrapExpression(args: { readonly expression: ts.Expression }): ts.Expression {
    let current = args.expression;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isNonNullExpression(current)
    ) {
        current = current.expression;
    }
    return current;
}

/** The static name of a property, or null when it is computed. */
export function staticPropertyName(args: { readonly name: ts.PropertyName }): string | null {
    const { name } = args;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    return null;
}

/** The source text of a node, collapsed to one line. */
export function nodeText(args: {
    readonly node: ts.Node;
    readonly sourceFile: ts.SourceFile;
}): string {
    return args.node.getText(args.sourceFile).replace(/\s+/g, ' ');
}

function readObject(object: ts.ObjectLiteralExpression): {
    readonly properties: Map<string, ts.Expression>;
    readonly hasSpread: boolean;
} {
    const properties = new Map<string, ts.Expression>();
    let hasSpread = false;
    for (const property of object.properties) {
        if (ts.isSpreadAssignment(property)) {
            hasSpread = true;
            continue;
        }
        if (ts.isPropertyAssignment(property)) {
            const name = staticPropertyName({ name: property.name });
            if (name) properties.set(name, property.initializer);
            continue;
        }
        if (ts.isShorthandPropertyAssignment(property)) {
            properties.set(property.name.text, property.name);
        }
    }
    return { properties, hasSpread };
}

function opacityOf(expression: ts.Expression | undefined): SiteOpacity {
    return expression && ts.isIdentifier(expression) ? 'identifier' : 'expression';
}

function calleeName(expression: ts.LeftHandSideExpression): string | null {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return null;
}

/** Find every operation site in one source file. */
export function findOperationSites(args: {
    readonly file: string;
    readonly source: string;
}): readonly OperationSite[] {
    const sourceFile = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const sites: OperationSite[] = [];
    const lineOf = (node: ts.Node) =>
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const push = (node: ts.Node, kind: OperationSiteKind, value: ts.Expression | undefined) => {
        const unwrapped = value ? unwrapExpression({ expression: value }) : undefined;
        if (unwrapped && ts.isObjectLiteralExpression(unwrapped)) {
            const { properties, hasSpread } = readObject(unwrapped);
            const opaque = hasSpread && kind === 'route-config' ? 'spread' : null;
            sites.push({
                file: args.file,
                line: lineOf(node),
                kind,
                opaque,
                properties,
                sourceFile
            });
            return;
        }
        sites.push({
            file: args.file,
            line: lineOf(node),
            kind,
            opaque: opacityOf(unwrapped),
            properties: new Map(),
            sourceFile
        });
    };
    function visit(node: ts.Node): void {
        if (
            ts.isPropertyAssignment(node) &&
            staticPropertyName({ name: node.name }) === 'listingAccess'
        ) {
            push(node, 'route-config', node.initializer);
        }
        if (ts.isCallExpression(node)) {
            const name = calleeName(node.expression);
            const kind = name ? CALL_KINDS.get(name) : undefined;
            if (kind) push(node, kind, node.arguments[0]);
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return sites;
}
