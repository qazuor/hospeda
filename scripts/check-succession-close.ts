/**
 * @file G-R1-C static guard for the five writes that close a succession.
 * @description GUARD:G-R1-C (HOS-1352 program, built by B8b.4 / HOS-1579, AC:B8b:21, TEST:B8b:21).
 * Checks registered pointer writers, their paired calls from S18, complement repointing,
 * both courtesy balance writes, the S19 reconciliation mark, and promo immobility.
 * Exit 0 is clean; exit 1 reports `G-R1-C: <rule>: <file>:<line> <detail>`.
 * What it does NOT see:
 * - Properties supplied through spreads.
 * - Runtime-built SQL.
 * - Aliased writers.
 * - Identifiers initialized with a non-literal expression.
 * - Objects mutated after their const declaration.
 * - Objects supplied through function parameters.
 * - Whether a guarded write executes. TEST:B8b:10 checks behavior with a database.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    callsNamed,
    findTopLevel,
    lineOf,
    parse,
    topLevelName
} from './succession-retention-scan.js';
import { listProductionFiles } from './succession-writers-scan.js';

const DIR = 'packages/service-core/src/services/billing/subscription';
/** The S1 opening is owned by G-R1-A, not the S18 close. */
export const OPENERS = [
    { file: `${DIR}/start-succession.service.ts`, name: 'startSuccession' }
] as const;
/** The two S18 pointer writers. */
export const CLOSE_WRITERS = [
    {
        file: `${DIR}/succession-close-writes.ts`,
        name: 'linkClosedPredecessor',
        property: 'succeededById'
    },
    {
        file: `${DIR}/succession-close-writes.ts`,
        name: 'clearSuccessorLink',
        property: 'succeedsId'
    }
] as const;
/** S18 orchestration and the shared write implementations. */
export const CLOSER_FILE = `${DIR}/succession-closer.service.ts`;
export const WRITES_FILE = `${DIR}/succession-close-writes.ts`;
/** The same production-tree floor as G-R1-A. */
export const MIN_SCANNED_FILES = 1000;

type Finding = {
    readonly rule: string;
    readonly file: string;
    readonly line: number;
    readonly detail: string;
};
type Write = {
    readonly call: ts.CallExpression;
    readonly object: ts.ObjectLiteralExpression;
    readonly table: string | null;
};
function property(
    object: ts.ObjectLiteralExpression,
    name: string
): ts.ObjectLiteralElementLike | undefined {
    return object.properties.find(
        (p) =>
            (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
            (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
            p.name.text === name
    );
}
function value(object: ts.ObjectLiteralExpression, name: string): ts.Expression | null {
    const p = property(object, name);
    return p && ts.isPropertyAssignment(p) ? p.initializer : null;
}
function isNull(expression: ts.Expression | null): boolean {
    return expression?.kind === ts.SyntaxKind.NullKeyword;
}
function inNonmonthlyElse(node: ts.Node, owner: ts.Node): boolean {
    for (let parent = node.parent; parent && parent !== owner; parent = parent.parent)
        if (
            ts.isIfStatement(parent) &&
            parent.expression.getText().includes("option.cycle === 'monthly'") &&
            parent.elseStatement &&
            node.getStart() >= parent.elseStatement.getStart() &&
            node.getEnd() <= parent.elseStatement.getEnd()
        )
            return true;
    return false;
}
function tableOf(set: ts.CallExpression): string | null {
    let receiver: ts.Expression = set.expression;
    if (!ts.isPropertyAccessExpression(receiver)) return null;
    receiver = receiver.expression;
    while (ts.isCallExpression(receiver) && ts.isPropertyAccessExpression(receiver.expression)) {
        if (receiver.expression.name.text === 'update' && ts.isIdentifier(receiver.arguments[0]))
            return receiver.arguments[0].text;
        receiver = receiver.expression.expression;
    }
    return null;
}
function objectLiteral(argument: ts.Expression | undefined): ts.ObjectLiteralExpression | null {
    if (!argument) return null;
    if (ts.isObjectLiteralExpression(argument)) return argument;
    if (!ts.isIdentifier(argument)) return null;
    for (let scope: ts.Node | undefined = argument.parent; scope; scope = scope.parent) {
        if (
            ts.isFunctionLike(scope) &&
            scope.parameters.some(
                (parameter) =>
                    ts.isIdentifier(parameter.name) && parameter.name.text === argument.text
            )
        )
            return null;
        if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) continue;
        for (const statement of scope.statements) {
            if (!ts.isVariableStatement(statement)) continue;
            const declaration = statement.declarationList.declarations.find(
                (candidate) =>
                    ts.isIdentifier(candidate.name) && candidate.name.text === argument.text
            );
            if (!declaration) continue;
            if (
                statement.getStart() >= argument.getStart() ||
                !(statement.declarationList.flags & ts.NodeFlags.Const) ||
                !declaration.initializer ||
                !ts.isObjectLiteralExpression(declaration.initializer)
            )
                return null;
            return declaration.initializer;
        }
    }
    return null;
}
function sets(node: ts.Node): Write[] {
    return callsNamed(node, 'set').flatMap((call) => {
        const object = objectLiteral(call.arguments[0]);
        return object ? [{ call, object, table: tableOf(call) }] : [];
    });
}
function read(root: string, file: string): ts.SourceFile | null {
    const full = join(root, file);
    return existsSync(full) ? parse({ file, source: readFileSync(full, 'utf8') }) : null;
}
function finding(
    rule: string,
    file: string,
    node: ts.Node | null,
    sf: ts.SourceFile | null,
    detail: string
): Finding {
    return { rule, file, line: node && sf ? lineOf(node, sf) : 1, detail };
}
function anchorChecks(root: string): Finding[] {
    const findings: Finding[] = [];
    const closer = read(root, CLOSER_FILE);
    const entry = closer && findTopLevel(closer, 'closeSuccessionWrites');
    for (const name of [
        ...CLOSE_WRITERS.map((writer) => writer.name),
        'repointComplements',
        'deferOrCloseCourtesy',
        'flagRetainedPayments'
    ]) {
        if (!entry || callsNamed(entry, name).length === 0)
            findings.push(
                finding(
                    CLOSE_WRITERS.some((writer) => writer.name === name)
                        ? 'c2 paired close'
                        : 'c3 close inventory',
                    CLOSER_FILE,
                    entry,
                    closer,
                    `closeSuccessionWrites must call ${name}`
                )
            );
    }
    const writes = read(root, WRITES_FILE);
    if (!writes) {
        findings.push(
            finding('c4 write content', WRITES_FILE, null, null, 'write file is missing')
        );
        return findings;
    }
    for (const writer of CLOSE_WRITERS) {
        const node = findTopLevel(writes, writer.name);
        const matches =
            node &&
            sets(node).filter(
                (set) =>
                    set.table === 'subscriptions' &&
                    property(set.object, writer.property) &&
                    (writer.property === 'succeedsId'
                        ? isNull(value(set.object, writer.property))
                        : !isNull(value(set.object, writer.property)))
            );
        if (!matches?.length)
            findings.push(
                finding(
                    'c2 paired close',
                    WRITES_FILE,
                    node,
                    writes,
                    `${writer.name} must write ${writer.property}`
                )
            );
    }
    const complements = findTopLevel(writes, 'repointComplements');
    if (
        !complements ||
        !sets(complements).some(
            (set) => set.table === 'addonInstances' && property(set.object, 'targetId')
        ) ||
        !Array.from(callsNamed(complements, 'update')).length ||
        !complements.getText(writes).includes("'VERTICAL_SUBSCRIPTION'")
    )
        findings.push(
            finding(
                'c4 complements',
                WRITES_FILE,
                complements,
                writes,
                'repointComplements must update addonInstances.targetId for VERTICAL_SUBSCRIPTION'
            )
        );
    const courtesy = findTopLevel(writes, 'deferOrCloseCourtesy');
    const courtesySets = courtesy
        ? sets(courtesy).filter((set) => set.table === 'courtesyGrants')
        : [];
    if (
        courtesySets.length !== 2 ||
        courtesySets.some((set) => !property(set.object, 'balanceMonths')) ||
        !courtesy ||
        courtesySets.filter((set) => inNonmonthlyElse(set.call, courtesy)).length !== 1 ||
        !courtesySets.some(
            (set) =>
                inNonmonthlyElse(set.call, courtesy) &&
                property(set.object, 'balanceMonths') &&
                property(set.object, 'balanceClosedAt')
        )
    )
        findings.push(
            finding(
                'c4 courtesy balance',
                WRITES_FILE,
                courtesy,
                writes,
                'deferOrCloseCourtesy needs balanceMonths in both courtesyGrants sets and balanceClosedAt in the nonmonthly set'
            )
        );
    const retained = findTopLevel(writes, 'flagRetainedPayments');
    const mark =
        retained &&
        callsNamed(retained, 'openReconciliationMark').find((call) => {
            const arg = call.arguments[0];
            const reason = ts.isObjectLiteralExpression(arg) ? value(arg, 'reason') : null;
            return (
                ts.isObjectLiteralExpression(arg) &&
                ts.isStringLiteral(reason) &&
                reason.text === 'REEMBOLSO_POR_CONFIRMAR' &&
                !!property(arg, 'payment')
            );
        });
    if (!mark)
        findings.push(
            finding(
                'c4 retained payment mark',
                WRITES_FILE,
                retained,
                writes,
                'flagRetainedPayments must call openReconciliationMark with reason REEMBOLSO_POR_CONFIRMAR and payment'
            )
        );
    return findings;
}
/** Run G-R1-C over a production tree; fixtures may lower the scanned-file floor. */
export function run(args: { readonly root?: string; readonly minScannedFiles?: number } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listProductionFiles({ root });
    const min = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (files.length < min)
        return {
            exitCode: 1,
            output: `G-R1-C: scanned ${files.length} files; expected at least ${min}`
        };
    const findings = anchorChecks(root);
    for (const file of files) {
        const source = readFileSync(join(root, file), 'utf8');
        if (
            !/succeededById|succeedsId|linkClosedPredecessor|clearSuccessorLink|promoRedemptions/.test(
                source
            )
        )
            continue;
        const sf = parse({ file, source });
        if (
            source.includes('succeededById') ||
            source.includes('succeedsId') ||
            source.includes('promoRedemptions')
        )
            for (const set of sets(sf)) {
                const successor = property(set.object, 'succeededById');
                const predecessor = value(set.object, 'succeedsId');
                if (
                    (successor &&
                        (!ts.isPropertyAssignment(successor) || !isNull(successor.initializer))) ||
                    isNull(predecessor)
                ) {
                    const owner = topLevelName(set.call);
                    const permitted = [...OPENERS, ...CLOSE_WRITERS].some(
                        (writer) =>
                            writer.file === file &&
                            writer.name === owner &&
                            (owner === 'startSuccession' ||
                                (successor
                                    ? owner === 'linkClosedPredecessor'
                                    : owner === 'clearSuccessorLink'))
                    );
                    if (!permitted)
                        findings.push(
                            finding(
                                'c1 pointer writer',
                                file,
                                set.call,
                                sf,
                                `${owner} writes a succession pointer outside the registered writers`
                            )
                        );
                }
                if (set.table === 'promoRedemptions' && property(set.object, 'subscriptionId'))
                    findings.push(
                        finding(
                            'c5 promo immobility',
                            file,
                            set.call,
                            sf,
                            `${topLevelName(set.call)} repoints promoRedemptions.subscriptionId`
                        )
                    );
            }
        for (const writer of CLOSE_WRITERS) {
            if (!source.includes(writer.name)) continue;
            for (const call of callsNamed(sf, writer.name))
                if (file !== CLOSER_FILE || topLevelName(call) !== 'closeSuccessionWrites')
                    findings.push(
                        finding(
                            'c2 paired close',
                            file,
                            call,
                            sf,
                            `${topLevelName(call)} calls ${writer.name} outside closeSuccessionWrites`
                        )
                    );
        }
    }
    return findings.length
        ? {
              exitCode: 1,
              output: findings
                  .map((f) => `G-R1-C: ${f.rule}: ${f.file}:${f.line} ${f.detail}`)
                  .join('\n')
          }
        : { exitCode: 0, output: `G-R1-C: OK (${files.length} files scanned)` };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = run();
    console.log(result.output);
    process.exitCode = result.exitCode;
}
