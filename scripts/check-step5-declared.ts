/**
 * GUARD:G-R3-C: every domain operation declares whether it passes step 5
 * (AC:V5:21, INV:14; catalog 04-catalogos.md GUARD:G-R3-C).
 *
 * The enumeration is `LISTING_OPERATIONS` and the declaration is
 * `OPERATION_PASSES_STEP5`, both in `ENUMERATION_FILE`. The guard fails when:
 * - `undeclared`: a member of the enumeration has no entry in the declaration;
 * - `computed`: an entry is not a literal `true`/`false` (a spread, a computed
 *   name, a method or any computed value);
 * - `unknown`: an entry names something that is not in the enumeration;
 * - `not read`: `resolveListingAccess` in `RESOLVER_FILE` no longer reads
 *   `OPERATION_PASSES_STEP5[...]` (a declaration nobody reads decides nothing);
 * - `site`: a `listingAccess` route config, a `resolveListingAccess` call or a
 *   `resolveResourceStep` call names an operation that is neither a declared
 *   string literal nor the pass-through of an already declared one
 *   (`config.operation`, `args.operation`).
 * It fails closed when a file, the enumeration or the declaration is missing,
 * when the enumeration is empty, and when the scan is suspiciously small.
 *
 * What it does NOT verify:
 * - which routes must run the chain: that is AC:V5:9, the frozen list of
 *   `apps/api/test/routes/coverage-step-coverage.guard.test.ts` (TEST:V5:10);
 * - whether the value declared for each operation is the right one under
 *   V5.md §3.5: the tests of `@repo/verticals` cover that;
 * - the 25 administrative actions (rule 3 of §3.2 is a different question);
 * - operations that do not exist yet as operations of the chain (Partner
 *   presence, addon instance): "the enumeration builds itself as the surfaces
 *   are built" (V5.md:1164-1167), so they enter this guard when a surface makes
 *   them pass through the chain.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    findOperationSites,
    listProductionFiles,
    nodeText,
    staticPropertyName,
    unwrapExpression
} from './listing-operation-sites';

/** File holding `LISTING_OPERATIONS` and `OPERATION_PASSES_STEP5`. */
export const ENUMERATION_FILE = 'packages/verticals/src/authorization/listing-operation.ts';
/** File holding `resolveListingAccess`, which must read the declaration. */
export const RESOLVER_FILE = 'packages/verticals/src/authorization/resolve-listing-access.ts';
/** Fewer operation sites than this means the scan is broken. */
export const MIN_OPERATION_SITES = 100;
/** Fewer production files than this means the file listing is broken. */
export const MIN_SCANNED_FILES = 500;

const PREFIX = 'FAIL GUARD:G-R3-C:';
const NAMED_SITE_KINDS = new Set(['route-config', 'resolver-call', 'resource-step-call']);

/** The enumeration and its step-5 declaration read from `ENUMERATION_FILE`. */
export type Step5Declaration = {
    readonly operations: readonly string[];
    readonly passing: readonly string[];
    readonly problems: readonly string[];
};

function findInitializer(sourceFile: ts.SourceFile, name: string): ts.Expression | null {
    let found: ts.Expression | null = null;
    function visit(node: ts.Node): void {
        if (found) return;
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === name &&
            node.initializer
        ) {
            found = unwrapExpression({ expression: node.initializer });
            return;
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return found;
}

function readEnumeration(sourceFile: ts.SourceFile): readonly string[] | string {
    const initializer = findInitializer(sourceFile, 'LISTING_OPERATIONS');
    if (!initializer) return `LISTING_OPERATIONS not found in ${ENUMERATION_FILE}`;
    if (!ts.isArrayLiteralExpression(initializer))
        return `LISTING_OPERATIONS in ${ENUMERATION_FILE} is not an array literal`;
    const operations: string[] = [];
    for (const element of initializer.elements) {
        if (!ts.isStringLiteral(element))
            return `LISTING_OPERATIONS in ${ENUMERATION_FILE} has a member that is not a string literal (${nodeText({ node: element, sourceFile })})`;
        operations.push(element.text);
    }
    if (operations.length === 0) return `LISTING_OPERATIONS in ${ENUMERATION_FILE} is empty`;
    return operations;
}

/** Read the enumeration and `OPERATION_PASSES_STEP5` from the enumeration file's source. */
export function readDeclaration(args: { readonly source: string }): Step5Declaration {
    const sourceFile = ts.createSourceFile(
        ENUMERATION_FILE,
        args.source,
        ts.ScriptTarget.Latest,
        true
    );
    const enumeration = readEnumeration(sourceFile);
    if (typeof enumeration === 'string')
        return { operations: [], passing: [], problems: [`${PREFIX} ${enumeration}`] };
    const declaration = findInitializer(sourceFile, 'OPERATION_PASSES_STEP5');
    if (!declaration || !ts.isObjectLiteralExpression(declaration)) {
        const problem = declaration
            ? `OPERATION_PASSES_STEP5 in ${ENUMERATION_FILE} is not an object literal`
            : `OPERATION_PASSES_STEP5 not found in ${ENUMERATION_FILE}`;
        return { operations: enumeration, passing: [], problems: [`${PREFIX} ${problem}`] };
    }
    const problems: string[] = [];
    const declared = new Set<string>();
    const passing: string[] = [];
    const known = new Set(enumeration);
    for (const property of declaration.properties) {
        const name =
            property.name && !ts.isSpreadAssignment(property)
                ? staticPropertyName({ name: property.name })
                : null;
        const label = name ?? nodeText({ node: property, sourceFile });
        const value = ts.isPropertyAssignment(property) ? property.initializer : null;
        const literal =
            value &&
            (value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword);
        if (!name || !literal) {
            problems.push(
                `${PREFIX} computed: ${label} declares step 5 with a computed value, not a declaration`
            );
            if (name) declared.add(name);
            continue;
        }
        if (!known.has(name)) {
            problems.push(
                `${PREFIX} unknown: ${name} is declared in OPERATION_PASSES_STEP5 but is not a domain operation of LISTING_OPERATIONS`
            );
            continue;
        }
        declared.add(name);
        if (value?.kind === ts.SyntaxKind.TrueKeyword) passing.push(name);
    }
    for (const operation of enumeration) {
        if (!declared.has(operation)) {
            problems.push(
                `${PREFIX} undeclared: domain operation ${operation} does not declare whether it passes step 5 (OPERATION_PASSES_STEP5 in ${ENUMERATION_FILE})`
            );
        }
    }
    return { operations: enumeration, passing, problems };
}

function resolverReadsDeclaration(source: string): string | null {
    const sourceFile = ts.createSourceFile(RESOLVER_FILE, source, ts.ScriptTarget.Latest, true);
    let body: ts.Node | null = null;
    function find(node: ts.Node): void {
        if (body) return;
        if (ts.isFunctionDeclaration(node) && node.name?.text === 'resolveListingAccess') {
            body = node.body ?? null;
            return;
        }
        if (
            ts.isVariableDeclaration(node) &&
            ts.isIdentifier(node.name) &&
            node.name.text === 'resolveListingAccess' &&
            node.initializer
        ) {
            body = node.initializer;
            return;
        }
        ts.forEachChild(node, find);
    }
    find(sourceFile);
    if (!body) return `${PREFIX} resolveListingAccess not found in ${RESOLVER_FILE}`;
    let reads = false;
    function visit(node: ts.Node): void {
        if (reads) return;
        if (
            ts.isElementAccessExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'OPERATION_PASSES_STEP5'
        ) {
            reads = true;
            return;
        }
        ts.forEachChild(node, visit);
    }
    visit(body);
    return reads
        ? null
        : `${PREFIX} not read: resolveListingAccess in ${RESOLVER_FILE} does not read OPERATION_PASSES_STEP5[...], so the declaration decides nothing`;
}

function readFile(root: string, file: string): string | null {
    const path = join(root, file);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** Run GUARD:G-R3-C over a repository root. */
export function run(
    args: {
        readonly root?: string;
        readonly minOperationSites?: number;
        readonly minScannedFiles?: number;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minOperationSites = args.minOperationSites ?? MIN_OPERATION_SITES;
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const fail = (problems: readonly string[]) => ({ exitCode: 1, output: problems.join('\n') });

    const enumerationSource = readFile(root, ENUMERATION_FILE);
    if (enumerationSource === null) return fail([`${PREFIX} cannot read ${ENUMERATION_FILE}`]);
    const resolverSource = readFile(root, RESOLVER_FILE);
    if (resolverSource === null) return fail([`${PREFIX} cannot read ${RESOLVER_FILE}`]);

    const declaration = readDeclaration({ source: enumerationSource });
    const problems = [...declaration.problems];
    const notRead = resolverReadsDeclaration(resolverSource);
    if (notRead) problems.push(notRead);

    const files = listProductionFiles({ root });
    if (files.length < minScannedFiles)
        problems.push(
            `${PREFIX} scanned ${files.length} production files; expected at least ${minScannedFiles}`
        );
    const known = new Set(declaration.operations);
    const sites = files
        .flatMap((file) =>
            findOperationSites({ file, source: readFileSync(join(root, file), 'utf8') })
        )
        .filter((site) => NAMED_SITE_KINDS.has(site.kind));
    if (sites.length < minOperationSites)
        problems.push(
            `${PREFIX} found ${sites.length} operation sites; expected at least ${minOperationSites}`
        );
    for (const site of sites) {
        const where = `${site.file}:${site.line}`;
        const operation = site.opaque ? undefined : site.properties.get('operation');
        if (!operation) {
            problems.push(`${PREFIX} site: ${where} does not name its operation`);
            continue;
        }
        const unwrapped = unwrapExpression({ expression: operation });
        const isDeclaredLiteral = ts.isStringLiteralLike(unwrapped) && known.has(unwrapped.text);
        const isPassThrough =
            ts.isPropertyAccessExpression(unwrapped) && unwrapped.name.text === 'operation';
        if (!isDeclaredLiteral && !isPassThrough) {
            const text = ts.isStringLiteralLike(unwrapped)
                ? unwrapped.text
                : nodeText({ node: unwrapped, sourceFile: site.sourceFile });
            problems.push(
                `${PREFIX} site: ${where} names operation ${text}, which is not a declared domain operation`
            );
        }
    }
    if (problems.length > 0) return fail(problems);
    const total = declaration.operations.length;
    const pass = declaration.passing.length;
    return {
        exitCode: 0,
        output: `OK GUARD:G-R3-C: ${total} domain operations each declare whether they pass step 5 (${pass} pass, ${total - pass} do not), the resolver reads that declaration, and ${sites.length} operation sites name a declared operation (${files.length} production files scanned)`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
