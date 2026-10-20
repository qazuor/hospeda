/**
 * @file G-R1-D static guard: nothing reactivates a succession predecessor nor refunds the
 * payment S19 retained before the succession closes.
 * @description GUARD:G-R1-D (HOS-1352 program, built by B7.4b / HOS-1561, AC:B7:17, TEST:B7:11).
 * What it checks, by AST over the production tree (`listProductionFiles` of G-R1-A, with a floor
 * of scanned files):
 *   (g1) `evaluateLatePaymentConditions` decides `retainedForS19` on `isPredecessorInSuccession`
 *        in the FIRST `if` of its body (D-4: "falle la condición que falle");
 *   (g2) `checkLatePaymentConditions` feeds `isPredecessorInSuccession` with
 *        `await isLiveSuccessionPredecessor(…)`;
 *   (g3) every registered reactivator (`REACTIVATORS`: S5 and S7) calls
 *        `checkLatePaymentConditions` and returns from a `'retainedForS19' in <verdict>` branch
 *        BEFORE its status write (or the call to its writer);
 *   (g4) no other production function writes `subscriptions.status` to `ACTIVE` or
 *        `CANCEL_SCHEDULED` under a `where` naming `GRACE_PERIOD` or `SUSPENDED`, and no other
 *        function calls a registered writer (`MP1`/`MP4` of Phase 4 join the registry, H16);
 *   (g5) every production insert into `refunds` lives in a registered refund writer
 *        (`REFUND_WRITERS`: RF1 and RF4) whose entry calls `assertRetainedPaymentRefundable`
 *        before the insert (or the call to its writer).
 * Exit 0 is clean; exit 1 reports findings as `G-R1-D: <rule>: <file>:<line> <path>`.
 * What it does NOT see, so a green run is not read as more: a `where` that names the origin
 * through a variable, a status written through a spread or a helper outside the scanned roots,
 * SQL built at runtime, a registered writer reached through an alias, and whether the gate it
 * finds actually rejects (TEST:B7:10 i and h12 prove that, with a database).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    callsNamed,
    findReactivationWrites,
    findRefundInserts,
    findTopLevel,
    lineOf,
    parse,
    RETAINING_STATUSES,
    type RetentionWrite
} from './succession-retention-scan.js';
import { listProductionFiles } from './succession-writers-scan.js';

const SUBSCRIPTION_DIR = 'packages/service-core/src/services/billing/subscription';
const REFUND_DIR = 'packages/service-core/src/services/billing/refund';

/** Where D-4 and the condition-3 facts live (HOS-1558, `05` §3). */
export const LATE_PAYMENT_FILE = `${SUBSCRIPTION_DIR}/late-payment-conditions.ts`;

/**
 * The reactivators of a row in `GRACE_PERIOD`/`SUSPENDED` (AC:B7:17 names `S5`, `S7`, and the
 * effects of `MP1`/`MP4`, which arrive in Phase 4). `entry` decides; `writer` holds the status
 * write (the same function when the write is inline).
 */
export const REACTIVATORS = [
    {
        // S5 (AC:B7:6, HOS-1558): GRACE_PERIOD → ACTIVE on a credited late payment.
        file: `${SUBSCRIPTION_DIR}/exit-grace.service.ts`,
        entry: 'exitGraceOnCreditedPayment',
        writer: 'reactivateFromGrace'
    },
    {
        // S7 (AC:B7:13, HOS-1560): SUSPENDED → ACTIVE | CANCEL_SCHEDULED on a credited late payment.
        file: `${SUBSCRIPTION_DIR}/reactivate-suspended.service.ts`,
        entry: 'reactivateSuspendedOnCreditedPayment',
        writer: 'reactivateSuspendedOnCreditedPayment'
    }
] as const;

/** The production writers of `refunds` (RF1 and RF4), each behind the S19 gate (HOS-1561 H12). */
export const REFUND_WRITERS = [
    {
        // RF1: the refund request (S36 of HOS-1543 inserts its RF1 through it).
        file: `${REFUND_DIR}/request-refund.service.ts`,
        entry: 'requestRefund',
        writer: 'requestRefund'
    },
    {
        // RF4: the external refund settled by a person (admin action 14).
        file: `${REFUND_DIR}/settle-external-refund.service.ts`,
        entry: 'settleExternalRefund',
        writer: 'writeExecuted'
    }
] as const;

/** The gate every refund writer calls before it inserts (H12). */
export const REFUND_GATE = 'assertRetainedPaymentRefundable';
/** The floor of scanned production files, as G-R1-A. */
export const MIN_SCANNED_FILES = 1000;

type Finding = {
    readonly rule: string;
    readonly file: string;
    readonly line: number;
    readonly path: string;
};

function read(root: string, file: string): { sf: ts.SourceFile; source: string } | null {
    const full = join(root, file);
    if (!existsSync(full)) return null;
    const source = readFileSync(full, 'utf8');
    return { sf: parse({ file, source }), source };
}

/** (g1) and (g2) over `late-payment-conditions.ts`. */
function anchorChecks(root: string): Finding[] {
    const parsed = read(root, LATE_PAYMENT_FILE);
    if (!parsed)
        return [{ rule: 'g1 anchor', file: LATE_PAYMENT_FILE, line: 1, path: 'file is missing' }];
    const { sf } = parsed;
    const findings: Finding[] = [];
    const evaluate = findTopLevel(sf, 'evaluateLatePaymentConditions');
    const body =
        evaluate && ts.isFunctionDeclaration(evaluate) ? (evaluate.body?.statements ?? []) : [];
    const firstIf = body.find(ts.isIfStatement);
    const decidesFirst =
        firstIf !== undefined &&
        ts.isPropertyAccessExpression(firstIf.expression) &&
        firstIf.expression.name.text === 'isPredecessorInSuccession' &&
        firstIf.thenStatement.getText(sf).includes('retainedForS19: true');
    if (!decidesFirst)
        findings.push({
            rule: 'g1 retention first',
            file: LATE_PAYMENT_FILE,
            line: evaluate ? lineOf(evaluate, sf) : 1,
            path: 'evaluateLatePaymentConditions does not decide retainedForS19 on isPredecessorInSuccession before any other condition'
        });
    const check = findTopLevel(sf, 'checkLatePaymentConditions');
    let fed = false;
    if (check)
        for (const call of callsNamed(check, 'isLiveSuccessionPredecessor')) {
            const awaited = call.parent;
            const assigned = awaited?.parent;
            if (
                ts.isAwaitExpression(awaited) &&
                assigned &&
                ts.isPropertyAssignment(assigned) &&
                ts.isIdentifier(assigned.name) &&
                assigned.name.text === 'isPredecessorInSuccession'
            )
                fed = true;
        }
    if (!fed)
        findings.push({
            rule: 'g2 predecessor read',
            file: LATE_PAYMENT_FILE,
            line: check ? lineOf(check, sf) : 1,
            path: 'checkLatePaymentConditions does not feed isPredecessorInSuccession with await isLiveSuccessionPredecessor(…)'
        });
    return findings;
}

/** The positions in `entry` the gate must precede: inline writes, or the calls to `writer`. */
function guardedPositions(
    entry: ts.Node,
    writer: string,
    entryName: string,
    inline: readonly RetentionWrite[]
): number[] {
    if (writer === entryName)
        return inline.filter((w) => w.fnName === entryName).map((w) => w.node.getStart());
    return callsNamed(entry, writer).map((c) => c.getStart());
}

/** (g3) for one reactivator. */
function reactivatorChecks(root: string, r: (typeof REACTIVATORS)[number]): Finding[] {
    const parsed = read(root, r.file);
    const entry = parsed ? findTopLevel(parsed.sf, r.entry) : null;
    if (!parsed || !entry)
        return [{ rule: 'g3 registry', file: r.file, line: 1, path: `${r.entry} is missing` }];
    const { sf, source } = parsed;
    const verdicts = new Set<string>();
    for (const call of callsNamed(entry, 'checkLatePaymentConditions')) {
        const decl = call.parent?.parent;
        if (
            ts.isAwaitExpression(call.parent) &&
            decl &&
            ts.isVariableDeclaration(decl) &&
            ts.isIdentifier(decl.name)
        )
            verdicts.add(decl.name.text);
    }
    let exit: ts.IfStatement | null = null;
    const visit = (n: ts.Node): void => {
        if (
            !exit &&
            ts.isIfStatement(n) &&
            ts.isBinaryExpression(n.expression) &&
            n.expression.operatorToken.kind === ts.SyntaxKind.InKeyword &&
            ts.isStringLiteralLike(n.expression.left) &&
            n.expression.left.text === 'retainedForS19' &&
            ts.isIdentifier(n.expression.right) &&
            verdicts.has(n.expression.right.text) &&
            /\breturn\b/.test(n.thenStatement.getText(sf))
        )
            exit = n;
        ts.forEachChild(n, visit);
    };
    visit(entry);
    const writes = guardedPositions(
        entry,
        r.writer,
        r.entry,
        findReactivationWrites({ file: r.file, source })
    );
    const exitAt = (exit as ts.IfStatement | null)?.getStart() ?? Number.POSITIVE_INFINITY;
    if (
        verdicts.size === 0 ||
        exit === null ||
        writes.length === 0 ||
        writes.some((at) => at < exitAt)
    )
        return [
            {
                rule: 'g3 reactivator exits on retention',
                file: r.file,
                line: lineOf(entry, sf),
                path: `${r.entry} → ${r.writer}: no 'retainedForS19' in <checkLatePaymentConditions verdict> return before the status write`
            }
        ];
    return [];
}

/** (g5) for one refund writer: the gate is called in `entry` before the insert. */
function refundWriterChecks(root: string, w: (typeof REFUND_WRITERS)[number]): Finding[] {
    const parsed = read(root, w.file);
    const entry = parsed ? findTopLevel(parsed.sf, w.entry) : null;
    if (!parsed || !entry)
        return [{ rule: 'g5 registry', file: w.file, line: 1, path: `${w.entry} is missing` }];
    const inserts = guardedPositions(
        entry,
        w.writer,
        w.entry,
        findRefundInserts({ file: w.file, source: parsed.source })
    );
    const gates = callsNamed(entry, REFUND_GATE).map((c) => c.getStart());
    const firstGate = gates.length ? Math.min(...gates) : Number.POSITIVE_INFINITY;
    if (inserts.length === 0 || inserts.some((at) => at < firstGate))
        return [
            {
                rule: 'g5 refund behind the S19 gate',
                file: w.file,
                line: lineOf(entry, parsed.sf),
                path: `${w.entry} → ${w.writer}: inserts into refunds without ${REFUND_GATE} first`
            }
        ];
    return [];
}

/**
 * Runs G-R1-D over a tree.
 *
 * @param args.root - The repo root (default: this checkout)
 * @param args.minScannedFiles - The floor of production files (default `MIN_SCANNED_FILES`)
 * @returns The exit code and the report
 */
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
            output: `G-R1-D: scanned ${files.length} files; expected at least ${min}`
        };
    const findings: Finding[] = [...anchorChecks(root)];
    const writers = [
        ...REACTIVATORS.map((r) => ({ ...r, rule: 'g4 unregistered reactivation' })),
        ...REFUND_WRITERS.map((w) => ({ ...w, rule: 'g5 unregistered refund writer' }))
    ];
    let reactivations = 0;
    let refundInserts = 0;
    for (const file of files) {
        const source = readFileSync(join(root, file), 'utf8');
        if (source.includes('subscription') && RETAINING_STATUSES.some((s) => source.includes(s)))
            for (const w of findReactivationWrites({ file, source })) {
                reactivations += 1;
                if (!REACTIVATORS.some((r) => r.file === file && r.writer === w.fnName))
                    findings.push({
                        rule: 'g4 unregistered reactivation',
                        file,
                        line: w.line,
                        path: `${w.fnName} writes ACTIVE/CANCEL_SCHEDULED over GRACE_PERIOD/SUSPENDED outside the S19 registry`
                    });
            }
        if (/refund/i.test(source))
            for (const w of findRefundInserts({ file, source })) {
                refundInserts += 1;
                if (!REFUND_WRITERS.some((r) => r.file === file && r.writer === w.fnName))
                    findings.push({
                        rule: 'g5 unregistered refund writer',
                        file,
                        line: w.line,
                        path: `${w.fnName} inserts into refunds outside the S19 gate registry`
                    });
            }
        for (const r of writers) {
            if (r.writer === r.entry || !source.includes(r.writer)) continue;
            const sf = parse({ file, source });
            for (const call of callsNamed(sf, r.writer)) {
                const caller = (() => {
                    let n: ts.Node = call;
                    while (n.parent && !ts.isSourceFile(n.parent)) n = n.parent;
                    return n;
                })();
                const inEntry = file === r.file && findTopLevel(sf, r.entry) === caller;
                if (!inEntry)
                    findings.push({
                        rule: r.rule,
                        file,
                        line: lineOf(call, sf),
                        path: `calls ${r.writer} outside ${r.entry}`
                    });
            }
        }
    }
    for (const r of REACTIVATORS) findings.push(...reactivatorChecks(root, r));
    for (const w of REFUND_WRITERS) findings.push(...refundWriterChecks(root, w));
    return findings.length
        ? {
              exitCode: 1,
              output: findings
                  .map((f) => `G-R1-D: ${f.rule}: ${f.file}:${f.line} ${f.path}`)
                  .join('\n')
          }
        : {
              exitCode: 0,
              output: `G-R1-D: OK; ${reactivations} reactivation writes and ${refundInserts} refund inserts, all registered; ${files.length} production files scanned`
          };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
