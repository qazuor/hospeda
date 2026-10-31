/**
 * @file reconciliation-mark-listing-and-inventory.ts
 * @description GUARD:G-R1-F (HOS-1352 program, built by B3 / HOS-1527, AC:B3:26, TEST:B3:27)
 *
 * ## What it checks
 *
 * (c) declarations named ActionableReconciliationMark* expose reason,
 * openedAt, payments, totalAmount, and defaultProposal. (g) files using the
 * recognized open-mark or deferred-courtesy syntax appear in the matching
 * live-term registry, and registered files still use that syntax.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * It recognizes declaration names and member names, calls named listOpen or
 * findOpen on reconciliationMarkModel, property reads of liftedAt, and
 * identifiers balanceMonths or balanceClosedAt. It does not prove runtime
 * values, completeness of a query result, indirect aliases, or semantic use.
 *
 * Exit codes: 0 = no findings; 1 = a listed predicate or registry shape failed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { MARK_MODEL_FILE } from './check-reconciliation-mark-discipline.js';
import { type InventoryEntry, type InventoryKey, validateEntries } from './live-term-inventory.js';
import { CODE_FILE, listProductionFiles, TEST_FILE } from './succession-writers-scan.js';

export const MIN_SCANNED_FILES = 1000;
const LISTING_PREFIX = 'ActionableReconciliationMark';
const LISTING_FIELDS = ['reason', 'openedAt', 'payments', 'totalAmount', 'defaultProposal'];
const MARK_KEY = 'marca_abierta' as const;
const COURTESY_KEY = 'cortesia_diferida' as const;
type Finding = { predicate: string; file: string; line: number; detail: string };
type Consumer = {
    key: typeof MARK_KEY | typeof COURTESY_KEY;
    file: string;
    line: number;
    symbol: string;
};

function line(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}
function declarationName(node: ts.Node): ts.Identifier | null {
    if (
        (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
        ts.isIdentifier(node.name)
    )
        return node.name;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const value = node.initializer;
        if (
            value &&
            (ts.isObjectLiteralExpression(value) ||
                (ts.isCallExpression(value) && value.expression.getText().startsWith('z.')))
        )
            return node.name;
    }
    return null;
}
function memberNames(node: ts.Node): Set<string> {
    const names = new Set<string>();
    const add = (member: ts.Node): void => {
        if (
            (ts.isPropertySignature(member) ||
                ts.isPropertyDeclaration(member) ||
                ts.isPropertyAssignment(member)) &&
            (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))
        )
            names.add(member.name.text);
    };
    if (ts.isInterfaceDeclaration(node)) node.members.forEach(add);
    else if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type))
        node.type.members.forEach(add);
    else if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isObjectLiteralExpression(node.initializer))
            node.initializer.properties.forEach(add);
        else if (ts.isCallExpression(node.initializer)) {
            const shape = node.initializer.arguments[0];
            if (shape && ts.isObjectLiteralExpression(shape)) shape.properties.forEach(add);
        }
    }
    return names;
}
function inventoryConsumers(file: string, sf: ts.SourceFile): Consumer[] {
    if (file === MARK_MODEL_FILE || file.startsWith('packages/db/src/schemas/')) return [];
    const found: Consumer[] = [];
    const add = (key: Consumer['key'], node: ts.Node, symbol: string) =>
        found.push({ key, file, line: line(sf, node), symbol });
    const walk = (node: ts.Node): void => {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            node.expression.expression.text === 'reconciliationMarkModel' &&
            ['listOpen', 'findOpen'].includes(node.expression.name.text)
        )
            add(MARK_KEY, node, node.expression.name.text);
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'liftedAt')
            add(MARK_KEY, node, 'liftedAt');
        if (ts.isIdentifier(node) && ['balanceMonths', 'balanceClosedAt'].includes(node.text))
            add(COURTESY_KEY, node, node.text);
        ts.forEachChild(node, walk);
    };
    walk(sf);
    return found;
}
export function inspect(args: {
    file: string;
    source: string;
    /** Already-parsed tree for `file`; skips the re-parse when the caller holds one. */
    sourceFile?: ts.SourceFile;
}): {
    findings: readonly Finding[];
    consumers: readonly Consumer[];
    listingCount: number;
} {
    const sf =
        args.sourceFile ??
        ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const findings: Finding[] = [];
    let listingCount = 0;
    const walk = (node: ts.Node): void => {
        const name = declarationName(node);
        if (name?.text.startsWith(LISTING_PREFIX)) {
            listingCount++;
            const members = memberNames(node);
            for (const field of LISTING_FIELDS)
                if (!members.has(field))
                    findings.push({
                        predicate: '(c)',
                        file: args.file,
                        line: line(sf, name),
                        detail: `${name.text} declaration is missing ${field}`
                    });
        }
        ts.forEachChild(node, walk);
    };
    walk(sf);
    return { findings, consumers: inventoryConsumers(args.file, sf), listingCount };
}
function entriesFor(
    inventories: Partial<Record<InventoryKey, readonly unknown[]>>,
    key: InventoryKey
): readonly InventoryEntry[] {
    return (inventories[key] ?? []).filter(
        (entry): entry is InventoryEntry => typeof entry === 'object' && entry !== null
    ) as readonly InventoryEntry[];
}
export function run(args: {
    readonly root: string;
    readonly minScannedFiles?: number;
    readonly inventories: Partial<Record<InventoryKey, readonly unknown[]>>;
    /** Pre-parsed trees keyed by file; a file found here is not read or parsed again. */
    readonly sourceFiles?: ReadonlyMap<string, ts.SourceFile>;
}): {
    readonly exitCode: number;
    readonly output: string;
    readonly listingCount: number;
    readonly consumerCount: number;
    readonly filesScanned: number;
} {
    const files = listProductionFiles({ root: args.root }).filter(
        (file) => CODE_FILE.test(file) && !TEST_FILE.test(file)
    );
    const minimum = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < minimum)
        return {
            exitCode: 1,
            output: `G-R1-F: scanned ${files.length} files; expected at least ${minimum}`,
            listingCount: 0,
            consumerCount: 0,
            filesScanned: files.length
        };
    const errors: string[] = [];
    const observed = new Map<InventoryKey, Map<string, Consumer>>([
        [MARK_KEY, new Map()],
        [COURTESY_KEY, new Map()]
    ]);
    let listingCount = 0;
    for (const file of files) {
        const parsed = args.sourceFiles?.get(file);
        const result = parsed
            ? inspect({ file, source: '', sourceFile: parsed })
            : inspect({ file, source: readFileSync(join(args.root, file), 'utf8') });
        listingCount += result.listingCount;
        errors.push(
            ...result.findings.map((f) => `G-R1-F ${f.predicate}: ${f.file}:${f.line} ${f.detail}`)
        );
        for (const consumer of result.consumers) observed.get(consumer.key)?.set(file, consumer);
    }
    for (const key of [MARK_KEY, COURTESY_KEY] as const) {
        const registered = entriesFor(args.inventories, key);
        errors.push(
            ...validateEntries({ key, entries: args.inventories[key] ?? [] }).map(
                (f) => `G-R1-F (g): scripts/guards/live-term-inventories.json:${key} ${f.detail}`
            )
        );
        const consumers = observed.get(key) ?? new Map();
        for (const consumer of consumers.values())
            if (!registered.some((entry) => entry.file === consumer.file))
                errors.push(
                    `G-R1-F (g): ${consumer.file}:${consumer.line} ${key} consumer ${consumer.symbol} is not registered`
                );
        for (const entry of registered)
            if (!consumers.has(entry.file))
                errors.push(`G-R1-F (g): ${entry.file}:1 stale ${key} registry entry`);
    }
    const markConsumers = observed.get(MARK_KEY)?.size ?? 0;
    const courtesyConsumers = observed.get(COURTESY_KEY)?.size ?? 0;
    return {
        exitCode: errors.length ? 1 : 0,
        output: errors.length ? errors.join('\n') : '',
        listingCount,
        consumerCount: markConsumers + courtesyConsumers,
        filesScanned: files.length
    };
}
