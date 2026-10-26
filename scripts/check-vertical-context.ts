/**
 * GUARD:G2 halves (a) and (b): the vertical context of a domain operation is
 * declared, and an operation on a resource that stores its vertical takes the
 * context from the resource, never from the request (AC:V5:22, INV:10; catalog
 * 04-catalogos.md GUARD:G2; V5.md §2.2-§2.3).
 *
 * Half (a), "a domain operation does not declare its vertical context":
 * - (a1) the signature: `ListingAccessConfig.vertical` (`CONFIG_TYPE_FILE`) and
 *   the `vertical` of `resolveListingAccess`'s argument (`RESOLVER_FILE`) are
 *   mandatory, not optional ("mandatory in the signature, not an optional
 *   parameter", V5.md:762-763);
 * - (a2) the sites: every `listingAccess` route config and every
 *   `resolveListingAccess` call names its `vertical`; a spread or an identifier
 *   that hides it fails too.
 * Half (b), "an operation on a resource that stores its vertical takes it from
 * the request":
 * - (b1) every route config names `VerticalEnum.<ACCOMMODATION|VENUE|EXPERIENCE>`,
 *   and a route under `routes/<accommodation|venue|experience>/` names the
 *   vertical of its folder, which is the table it reads its resource from;
 * - (b2) the `vertical` of every `resolveListingAccess` call and the
 *   `resourceVertical` of every `resolveResourceVertical` call contain none of
 *   the request names of `REQUEST_NAMES`;
 * - (b3) the media upload of the listings (`UPLOAD_ENTITY_FILE`) runs the chain
 *   with the vertical of the resource: the file declares one `listingAccess`
 *   site per listing vertical, each naming its `VerticalEnum` member (rules (a)
 *   and (b1) apply to them like to any route config), and calls
 *   `enforceListingAccess` (HOS-1682).
 * It fails closed when a signature file, type or function is missing, when the
 * listing media upload file is missing, and when the scan is suspiciously small
 * or finds no `resolveListingAccess` call.
 *
 * What it does NOT verify:
 * - half (c), an existing listing's vertical is not writable: that is
 *   `check-vertical-immutable.ts` (`pnpm check:vertical-immutable`);
 * - Partner presence and the addon instance while they are not operations of
 *   the chain;
 * - that the upload's branch picks the config of the vertical its service reads:
 *   (b3) checks that every vertical is named and the call exists, not the
 *   switch that pairs them;
 * - `resolveResourceStep` calls: they run only step 4, on a row read from the
 *   table of their own vertical, where the table IS the vertical;
 * - data flow: `REQUEST_NAMES` is a closed list of names looked up in the
 *   expression, not an analysis of where a value comes from.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    findOperationSites,
    listProductionFiles,
    nodeText,
    type OperationSite,
    staticPropertyName,
    unwrapExpression
} from './listing-operation-sites';

/** File holding the route-level `ListingAccessConfig` type. */
export const CONFIG_TYPE_FILE = 'apps/api/src/types/authorization.ts';
/** File holding `resolveListingAccess`. */
export const RESOLVER_FILE = 'packages/verticals/src/authorization/resolve-listing-access.ts';
/** `VerticalEnum` members that own listings. */
export const LISTING_VERTICAL_MEMBERS = ['ACCOMMODATION', 'VENUE', 'EXPERIENCE'] as const;
/** Names that mean "read from the request" inside a vertical expression. */
export const REQUEST_NAMES = ['body', 'params', 'query', 'headers', 'request', 'req'] as const;
/** The media upload of the listings, which must run the chain per vertical (HOS-1682). */
export const UPLOAD_ENTITY_FILE = 'apps/api/src/routes/media/protected/upload-entity.ts';
/** Fewer `listingAccess` route configs than this means the scan is broken. */
export const MIN_ROUTE_CONFIGS = 100;
/**
 * Minimum listing route configs per route folder. Measured on 2026-10-26:
 * accommodation 45, venue 42, experience 37; each floor is 50%, rounded down.
 */
export const MIN_ROUTE_CONFIGS_BY_VERTICAL = {
    accommodation: 22,
    venue: 21,
    experience: 18
} as const;
/** Fewer production files than this means the file listing is broken. */
export const MIN_SCANNED_FILES = 500;

const ROUTE_FOLDER = /^apps\/api\/src\/routes\/(accommodation|venue|experience)\//;
const MEMBERS: ReadonlySet<string> = new Set(LISTING_VERTICAL_MEMBERS);
const REQUEST: ReadonlySet<string> = new Set(REQUEST_NAMES);

type Members = ts.NodeArray<ts.TypeElement>;

function parse(file: string, source: string): ts.SourceFile {
    return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function findNode<T extends ts.Node>(
    sourceFile: ts.SourceFile,
    predicate: (node: ts.Node) => node is T
): T | null {
    let found: T | null = null;
    function visit(node: ts.Node): void {
        if (found) return;
        if (predicate(node)) {
            found = node;
            return;
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return found;
}

function verticalIsMandatory(members: Members | null): boolean {
    const vertical = members?.find(
        (member): member is ts.PropertySignature =>
            ts.isPropertySignature(member) &&
            staticPropertyName({ name: member.name }) === 'vertical'
    );
    return Boolean(vertical && !vertical.questionToken);
}

function checkConfigType(source: string): string | null {
    const sourceFile = parse(CONFIG_TYPE_FILE, source);
    const declaration = findNode(
        sourceFile,
        (node): node is ts.TypeAliasDeclaration | ts.InterfaceDeclaration =>
            (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
            node.name.text === 'ListingAccessConfig'
    );
    if (!declaration) return `G2 (a): ${CONFIG_TYPE_FILE} does not declare ListingAccessConfig`;
    const members = ts.isInterfaceDeclaration(declaration)
        ? declaration.members
        : ts.isTypeLiteralNode(declaration.type)
          ? declaration.type.members
          : null;
    if (verticalIsMandatory(members)) return null;
    return `G2 (a): ${CONFIG_TYPE_FILE}:${lineOf(sourceFile, declaration)} the signature of ListingAccessConfig does not make the vertical context mandatory`;
}

function checkResolverSignature(source: string): string | null {
    const sourceFile = parse(RESOLVER_FILE, source);
    const declaration = findNode(
        sourceFile,
        (node): node is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(node) && node.name?.text === 'resolveListingAccess'
    );
    if (!declaration) return `G2 (a): ${RESOLVER_FILE} does not declare resolveListingAccess`;
    const type = declaration.parameters[0]?.type;
    const members = type && ts.isTypeLiteralNode(type) ? type.members : null;
    if (verticalIsMandatory(members)) return null;
    return `G2 (a): ${RESOLVER_FILE}:${lineOf(sourceFile, declaration)} the signature of resolveListingAccess does not make the vertical context mandatory`;
}

function readsRequest(expression: ts.Expression): boolean {
    let found = false;
    function visit(node: ts.Node): void {
        if (found) return;
        if (ts.isIdentifier(node) && REQUEST.has(node.text)) {
            found = true;
            return;
        }
        ts.forEachChild(node, visit);
    }
    visit(expression);
    return found;
}

/** The listing `VerticalEnum` member a route config names, or `null`. */
function namedMember(vertical: ts.Expression): string | null {
    const named = unwrapExpression({ expression: vertical });
    return ts.isPropertyAccessExpression(named) &&
        ts.isIdentifier(named.expression) &&
        named.expression.text === 'VerticalEnum' &&
        MEMBERS.has(named.name.text)
        ? named.name.text
        : null;
}

function checkRouteConfig(site: OperationSite, where: string): readonly string[] {
    if (site.opaque)
        return [`G2 (a): ${where} listingAccess hides its vertical behind ${site.opaque}`];
    const vertical = site.properties.get('vertical');
    if (!vertical) return [`G2 (a): ${where} route-config does not declare its vertical context`];
    const member = namedMember(vertical);
    if (!member) {
        const text = nodeText({ node: vertical, sourceFile: site.sourceFile });
        return [
            `G2 (b): ${where} listingAccess computes its vertical (${text}) instead of naming the resource's`
        ];
    }
    const folder = ROUTE_FOLDER.exec(site.file)?.[1];
    const folderMember = folder?.toUpperCase();
    if (folderMember && folderMember !== member) {
        return [
            `G2 (b): ${where} route under routes/${folder} declares vertical ${member}: the context must be the vertical of the resource it serves`
        ];
    }
    return [];
}

function checkCall(site: OperationSite, where: string): readonly string[] {
    const isResolver = site.kind === 'resolver-call';
    const callee = isResolver ? 'resolveListingAccess' : 'resolveResourceVertical';
    if (site.opaque) {
        return [
            isResolver
                ? `G2 (a): ${where} resolveListingAccess hides its vertical behind ${site.opaque}`
                : `G2 (b): ${where} resolveResourceVertical hides its resource vertical behind ${site.opaque}`
        ];
    }
    const vertical = site.properties.get(isResolver ? 'vertical' : 'resourceVertical');
    if (!vertical) {
        return isResolver
            ? [`G2 (a): ${where} resolver-call does not declare its vertical context`]
            : [];
    }
    if (!readsRequest(vertical)) return [];
    const text = nodeText({ node: vertical, sourceFile: site.sourceFile });
    return [
        `G2 (b): ${where} ${callee} takes its vertical from the request (${text}): the context must be read from the resource`
    ];
}

/**
 * (b3): the listing media upload declares a `listingAccess` site naming each
 * listing vertical and calls `enforceListingAccess` (HOS-1682).
 */
function checkUploadEntity(
    source: string | null,
    sites: readonly OperationSite[]
): readonly string[] {
    if (source === null)
        return [
            `G2 (b): cannot read ${UPLOAD_ENTITY_FILE}: the listing media upload must run the chain`
        ];
    const named = new Set<string>();
    for (const site of sites) {
        if (site.file !== UPLOAD_ENTITY_FILE || site.kind !== 'route-config') continue;
        const vertical = site.properties.get('vertical');
        const member = vertical ? namedMember(vertical) : null;
        if (member) named.add(member);
    }
    const problems: string[] = LISTING_VERTICAL_MEMBERS.filter((member) => !named.has(member)).map(
        (member) =>
            `G2 (b): ${UPLOAD_ENTITY_FILE} declares no listingAccess site for VerticalEnum.${member}: the listing media upload must run the chain with the vertical of the resource`
    );
    const call = findNode(
        parse(UPLOAD_ENTITY_FILE, source),
        (node): node is ts.CallExpression =>
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'enforceListingAccess'
    );
    if (!call)
        problems.push(
            `G2 (b): ${UPLOAD_ENTITY_FILE} does not call enforceListingAccess: the listing media upload must run the chain`
        );
    return problems;
}

function readFile(root: string, file: string): string | null {
    const path = join(root, file);
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

/** Run GUARD:G2 halves (a) and (b) over a repository root. */
export function run(
    args: {
        readonly root?: string;
        readonly minRouteConfigs?: number;
        readonly minRouteConfigsByVertical?: Readonly<
            Record<keyof typeof MIN_ROUTE_CONFIGS_BY_VERTICAL, number>
        >;
        readonly minScannedFiles?: number;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const minRouteConfigs = args.minRouteConfigs ?? MIN_ROUTE_CONFIGS;
    const minRouteConfigsByVertical =
        args.minRouteConfigsByVertical ?? MIN_ROUTE_CONFIGS_BY_VERTICAL;
    const minScannedFiles = args.minScannedFiles ?? MIN_SCANNED_FILES;
    const problems: string[] = [];

    const configSource = readFile(root, CONFIG_TYPE_FILE);
    const configProblem = configSource
        ? checkConfigType(configSource)
        : `G2 (a): cannot read ${CONFIG_TYPE_FILE}`;
    if (configProblem) problems.push(configProblem);
    const resolverSource = readFile(root, RESOLVER_FILE);
    const resolverProblem = resolverSource
        ? checkResolverSignature(resolverSource)
        : `G2 (a): cannot read ${RESOLVER_FILE}`;
    if (resolverProblem) problems.push(resolverProblem);

    const files = listProductionFiles({ root });
    if (files.length < minScannedFiles)
        problems.push(
            `G2 (a, b): scanned ${files.length} production files; expected at least ${minScannedFiles}`
        );
    const sites = files.flatMap((file) =>
        findOperationSites({ file, source: readFileSync(join(root, file), 'utf8') })
    );
    let routeConfigs = 0;
    const routeConfigsByVertical: Record<keyof typeof MIN_ROUTE_CONFIGS_BY_VERTICAL, number> = {
        accommodation: 0,
        venue: 0,
        experience: 0
    };
    let resolverCalls = 0;
    for (const site of sites) {
        const where = `${site.file}:${site.line}`;
        if (site.kind === 'route-config') {
            routeConfigs += 1;
            const folder = ROUTE_FOLDER.exec(site.file)?.[1];
            if (folder && folder in routeConfigsByVertical)
                routeConfigsByVertical[folder as keyof typeof routeConfigsByVertical] += 1;
            problems.push(...checkRouteConfig(site, where));
        }
        if (site.kind === 'resolver-call') resolverCalls += 1;
        if (site.kind === 'resolver-call' || site.kind === 'resource-vertical-call')
            problems.push(...checkCall(site, where));
    }
    if (routeConfigs < minRouteConfigs)
        problems.push(
            `G2 (a, b): found ${routeConfigs} listingAccess route configs; expected at least ${minRouteConfigs}`
        );
    for (const [vertical, minimum] of Object.entries(minRouteConfigsByVertical) as [
        keyof typeof MIN_ROUTE_CONFIGS_BY_VERTICAL,
        number
    ][]) {
        const found = routeConfigsByVertical[vertical];
        if (found < minimum)
            problems.push(
                `G2 (a, b): found ${found} listingAccess route configs under routes/${vertical}/; expected at least ${minimum}`
            );
    }
    if (resolverCalls === 0)
        problems.push('G2 (a, b): found no resolveListingAccess call in production code');
    problems.push(...checkUploadEntity(readFile(root, UPLOAD_ENTITY_FILE), sites));

    if (problems.length > 0) {
        return {
            exitCode: 1,
            output: [`FAIL GUARD:G2 (a, b): ${problems.length} problems`, ...problems].join('\n')
        };
    }
    return {
        exitCode: 0,
        output: `OK GUARD:G2 (a, b): ${routeConfigs} listingAccess routes and ${resolverCalls} resolver calls declare their vertical, every route's vertical is the one of the resource it serves, none reads it from the request, and the listing media upload runs the chain for every listing vertical (${files.length} production files scanned)`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
