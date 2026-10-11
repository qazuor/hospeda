/**
 * @file GUARD:G-R1-E (HOS-1352 program, built by B3 / HOS-1527, AC:B3:25, TEST:B3:26)
 * @description Checks complete live-row predicates, registered live-set consumers, and subject alignment.
 *
 * What it checks: syntactic succeedsId predicates and SQL fragments for same-scope status evidence;
 * LIVE_SUBSCRIPTION_STATUSES expressions and addonInstances' exact live pair against the registry;
 * stale fila_viva entries; and the two specified wrong-subject list shapes.
 *
 * What it does NOT see, so a green run is not read as more: prose in specs, enumerated state literals
 * outside the recognized calls, dynamic predicates, grant/ancla consumers (H-6), or SQL assembled at runtime.
 *
 * Exit codes: 0 means no recognized violation; 1 means a violation or an undersized scan.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    INVENTORY_KEYS,
    type InventoryEntry,
    type InventoryKey,
    loadInventories,
    validateEntries
} from './live-term-inventory.js';
import { CODE_FILE, listProductionFiles, TEST_FILE } from './succession-writers-scan.js';

export const MIN_SCANNED_FILES = 1000;
const DEFINERS = new Set([
    'packages/db/src/schemas/vertical/subscription.dbschema.ts',
    'packages/db/src/schemas/vertical/addon-product.dbschema.ts'
]);
const LIVE_SUBSCRIPTION = 'LIVE_SUBSCRIPTION_STATUSES';
const LIVE_ADDON = 'LIVE_ADDON_INSTANCE_STATUSES';
const INSTANCE_PAIR = ['PENDING_AUTHORIZATION', 'ACTIVE'];
const SUBSCRIPTION_ONLY = ['GRACE_PERIOD', 'PAUSED', 'SUSPENDED', 'CANCEL_SCHEDULED'];
type Finding = {
    readonly file: string;
    readonly line: number;
    readonly predicate: string;
    readonly detail: string;
};

function prop(node: ts.Expression | undefined, name: string): boolean {
    return !!node && ts.isPropertyAccessExpression(node) && node.name.text === name;
}
function receiverName(node: ts.Expression): string | null {
    if (!ts.isPropertyAccessExpression(node)) return null;
    let current: ts.Expression = node.expression;
    while (ts.isPropertyAccessExpression(current)) current = current.expression;
    return ts.isIdentifier(current) ? current.text : null;
}
function callName(node: ts.CallExpression): string | null {
    return ts.isIdentifier(node.expression) ? node.expression.text : null;
}
function namesInArray(node: ts.Expression | undefined): string[] | null {
    if (!node || !ts.isArrayLiteralExpression(node)) return null;
    return node.elements.map((item) => {
        if (ts.isSpreadElement(item) && ts.isIdentifier(item.expression))
            return `...${item.expression.text}`;
        if (ts.isStringLiteral(item) || ts.isIdentifier(item)) return item.text;
        return item.getText();
    });
}
function isStatusCheck(node: ts.Node): boolean {
    if (
        !ts.isCallExpression(node) ||
        !['inArray', 'eq', 'ne', 'notInArray'].includes(callName(node) ?? '')
    )
        return false;
    return prop(node.arguments[0], 'status');
}
function isImportOrExportOrDeclarationName(node: ts.Identifier): boolean {
    const p = node.parent;
    return (
        ts.isImportSpecifier(p) ||
        ts.isExportSpecifier(p) ||
        (ts.isImportClause(p) && p.name === node) ||
        (ts.isNamespaceImport(p) && p.name === node) ||
        (ts.isNamespaceExport(p) && p.name === node) ||
        ((ts.isVariableDeclaration(p) || ts.isParameter(p)) && p.name === node) ||
        (ts.isPropertyAssignment(p) && p.name === node)
    );
}
function scopeFor(node: ts.Node): ts.Node {
    for (let p = node.parent; p; p = p.parent)
        if (ts.isCallExpression(p) && callName(p) === 'and') return p;
    for (let p = node.parent; p; p = p.parent)
        if (ts.isCallExpression(p) && prop(p.expression, 'where')) return p;
    return node.getSourceFile();
}
function containsStatusEvidence(scope: ts.Node, sf: ts.SourceFile): boolean {
    let found = false;
    function visit(node: ts.Node): void {
        if (ts.isIdentifier(node) && node.text === LIVE_SUBSCRIPTION) found = true;
        if (isStatusCheck(node)) found = true;
        if (
            (ts.isStringLiteralLike(node) ||
                ts.isNoSubstitutionTemplateLiteral(node) ||
                ts.isTemplateExpression(node)) &&
            /\bstatus\b/i.test(node.getText(sf))
        )
            found = true;
        if (!found) ts.forEachChild(node, visit);
    }
    visit(scope);
    return found;
}

export function inspectFile(args: { readonly file: string; readonly source: string }): {
    readonly findings: readonly Finding[];
    readonly consumers: readonly {
        readonly file: string;
        readonly subject: 'subscription' | 'addon_instance';
    }[];
} {
    const sf = ts.createSourceFile(args.file, args.source, ts.ScriptTarget.Latest, true);
    const findings: Finding[] = [];
    const consumers: { file: string; subject: 'subscription' | 'addon_instance' }[] = [];
    const report = (node: ts.Node, predicate: string, detail: string) =>
        findings.push({
            file: args.file,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            predicate,
            detail
        });
    const addConsumer = (subject: 'subscription' | 'addon_instance') => {
        if (!consumers.some((c) => c.subject === subject))
            consumers.push({ file: args.file, subject });
    };
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            const name = callName(node);
            const first = node.arguments[0];
            if (
                ['eq', 'ne', 'inArray', 'isNotNull'].includes(name ?? '') &&
                prop(first, 'succeedsId') &&
                name !== 'isNull' &&
                !containsStatusEvidence(scopeFor(node), sf)
            ) {
                report(
                    node,
                    'NO_LIVENESS',
                    `${name} on succeedsId has no live-status evidence in its containing scope`
                );
            }
            if (name === 'inArray' && prop(first, 'status')) {
                const receiver = first ? receiverName(first) : null;
                const list = namesInArray(node.arguments[1]);
                if (
                    receiver === 'subscriptions' &&
                    list?.length === 2 &&
                    [...list].sort().join() === [...INSTANCE_PAIR].sort().join()
                )
                    report(
                        node,
                        'WRONG_SUBJECT',
                        'addon instance live pair is enumerated on subscriptions'
                    );
                if (receiver === 'addonInstances') {
                    if (
                        node.arguments[1] &&
                        ts.isIdentifier(node.arguments[1]) &&
                        node.arguments[1].text === LIVE_SUBSCRIPTION
                    )
                        report(
                            node,
                            'WRONG_SUBJECT',
                            'subscription live set is used on addonInstances'
                        );
                    if (
                        node.arguments[1] &&
                        ts.isArrayLiteralExpression(node.arguments[1]) &&
                        node.arguments[1].elements.some(
                            (el) =>
                                ts.isSpreadElement(el) &&
                                ts.isIdentifier(el.expression) &&
                                el.expression.text === LIVE_SUBSCRIPTION
                        )
                    )
                        report(
                            node,
                            'WRONG_SUBJECT',
                            'subscription live set is spread on addonInstances'
                        );
                    if (
                        list?.some((value) =>
                            SUBSCRIPTION_ONLY.includes(
                                value.replaceAll("'", '').replaceAll('"', '')
                            )
                        )
                    )
                        report(
                            node,
                            'WRONG_SUBJECT',
                            'subscription-only state is listed on addonInstances'
                        );
                    if (
                        list?.length === INSTANCE_PAIR.length &&
                        [...list].sort().join() === [...INSTANCE_PAIR].sort().join()
                    )
                        addConsumer('addon_instance');
                }
            }
        }
        if (
            ts.isIdentifier(node) &&
            node.text === LIVE_SUBSCRIPTION &&
            !isImportOrExportOrDeclarationName(node)
        )
            addConsumer('subscription');
        if (
            ts.isIdentifier(node) &&
            node.text === LIVE_ADDON &&
            !isImportOrExportOrDeclarationName(node)
        )
            addConsumer('addon_instance');
        if (
            ts.isStringLiteralLike(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isTemplateExpression(node)
        ) {
            const text = node.getText(sf).replace(/^['"`]|['"`]$/g, '');
            if (
                /\bsucceeds_id\s+IS\s+NOT\s+NULL\b|\bsucceeds_id\s*=|\bsucceeds_id\s+IN\b/i.test(
                    text
                ) &&
                !/\bstatus\b/i.test(text)
            )
                report(
                    node,
                    'NO_LIVENESS',
                    'SQL succeeds_id predicate has no status evidence in the same string'
                );
        }
        ts.forEachChild(node, visit);
    }
    visit(sf);
    return { findings, consumers };
}

function entriesFor(
    inventories: Partial<Record<InventoryKey, readonly unknown[]>>,
    key: InventoryKey
): readonly InventoryEntry[] {
    return (inventories[key] ?? []).filter(
        (entry): entry is InventoryEntry => typeof entry === 'object' && entry !== null
    ) as readonly InventoryEntry[];
}
export function run(
    args: {
        readonly root?: string;
        readonly minScannedFiles?: number;
        readonly inventories?: Partial<Record<InventoryKey, readonly unknown[]>>;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listProductionFiles({ root }).filter(
        (file) => CODE_FILE.test(file) && !TEST_FILE.test(file)
    );
    const minimum = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < minimum)
        return {
            exitCode: 1,
            output: `G-R1-E: scanned ${files.length} files; expected at least ${minimum}`
        };
    const injectedInventories = args.inventories;
    const loaded = injectedInventories
        ? {
              inventories: injectedInventories,
              findings: INVENTORY_KEYS.flatMap((key) =>
                  key in injectedInventories
                      ? validateEntries({ key, entries: injectedInventories[key] })
                      : [{ key, detail: 'missing top-level key' }]
              )
          }
        : loadInventories({ root });
    const errors: string[] = loaded.findings.map(
        (f) => `G-R1-E (UNLISTED_CONSUMER): ${INVENTORY_PATH_PLACEHOLDER}:${f.key} ${f.detail}`
    );
    const observed = new Map<string, Set<'subscription' | 'addon_instance'>>();
    const countBySubject = { subscription: 0, addon_instance: 0 };
    for (const file of files) {
        const result = inspectFile({ file, source: readFileSync(join(root, file), 'utf8') });
        for (const finding of result.findings)
            errors.push(
                `G-R1-E (${finding.predicate}): ${finding.file}:${finding.line} ${finding.detail}`
            );
        for (const consumer of result.consumers) {
            if (DEFINERS.has(file)) continue;
            const subjects = observed.get(file) ?? new Set();
            subjects.add(consumer.subject);
            observed.set(file, subjects);
        }
    }
    const registered = entriesFor(loaded.inventories, 'fila_viva');
    for (const consumerFile of observed.keys()) {
        const subjects = observed.get(consumerFile);
        if (!subjects) continue;
        for (const subject of subjects) {
            countBySubject[subject]++;
            if (
                !registered.some(
                    (entry) => entry.file === consumerFile && entry.subject === subject
                )
            )
                errors.push(
                    `G-R1-E (UNLISTED_CONSUMER): ${consumerFile}:1 ${subject} live-set consumer is not registered`
                );
        }
    }
    for (const entry of registered) {
        if (!observed.get(entry.file)?.has(entry.subject as 'subscription' | 'addon_instance'))
            errors.push(
                `G-R1-E (UNLISTED_CONSUMER): ${entry.file}:1 stale registry entry for ${entry.subject}`
            );
    }
    return errors.length
        ? { exitCode: 1, output: errors.join('\n') }
        : {
              exitCode: 0,
              output: `G-R1-E: OK; ${countBySubject.subscription + countBySubject.addon_instance} fila_viva consumers registered; ${files.length} production files scanned`
          };
}
const INVENTORY_PATH_PLACEHOLDER = 'scripts/guards/live-term-inventories.json';
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
