/**
 * @file G-R1-A static guard for succession predecessor admission.
 * @description GUARD:G-R1-A (HOS-1352 program, built by B3 / HOS-1527, AC:B3:23, TEST:B3:24)
 * What it checks: non-null succession writers use the canonical gate result; SQL writes are absent;
 * the gate file contains the exact admitted statuses, card re-read literals, predecessor-chain check,
 * and assertFreshForAct. Exit 0 is clean; exit 1 reports findings or an undersized scan.
 * What it does NOT see, so a green run is not read as more: values arriving through variables bound
 * outside the writer function, runtime-built SQL, or whether gate literals actually control its logic.
 * B3.10 integration tests establish that behavior and that the gate compares the real row state.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    findRawSqlSuccessionWrites,
    findSuccessionWrites,
    listProductionFiles
} from './succession-writers-scan.js';
export const ADMITTED_STATUSES = ['ACTIVE', 'CANCEL_SCHEDULED', 'SUSPENDED'] as const;
export const REFUSED_STATUSES = [
    'PENDING_AUTHORIZATION',
    'ABANDONED',
    'GRACE_PERIOD',
    'PAUSED',
    'CANCELLED',
    'CHARGE_DECLINED'
] as const;
export const GATE_NAME = 'admitSuccessionPredecessor';
export const GATE_FILE =
    'packages/service-core/src/services/billing/subscription/admit-succession-predecessor.ts';
export const MIN_SCANNED_FILES = 1000;
type Finding = { file: string; line: number; rule: string; detail: string };
function literals(sf: ts.SourceFile): Set<string> {
    const found = new Set<string>();
    function visit(n: ts.Node): void {
        if (ts.isStringLiteralLike(n)) found.add(n.text);
        ts.forEachChild(n, visit);
    }
    visit(sf);
    return found;
}
function gateChecks(root: string): Finding[] {
    const file = join(root, GATE_FILE);
    if (!existsSync(file)) return [];
    const source = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(GATE_FILE, source, ts.ScriptTarget.Latest, true);
    const ls = literals(sf);
    const findings: Finding[] = [];
    const add = (name: string, detail: string) =>
        findings.push({
            file: GATE_FILE,
            line: 1,
            rule: 'GATE_BODY',
            detail: `${name}: ${detail}`
        });
    for (const status of ADMITTED_STATUSES)
        if (!ls.has(status)) add('d1', `missing admitted status ${status}`);
    for (const status of REFUSED_STATUSES)
        if (ls.has(status)) add('d1', `refused status ${status} appears in gate`);
    if (!ls.has('authorized') || !ls.has('CARD'))
        add('d2', "requires literals 'authorized' and 'CARD'");
    if (!ls.has('cancelled')) add('d3', "requires literal 'cancelled'");
    let succeeds = false,
        fresh = false;
    function visit(n: ts.Node): void {
        if (ts.isPropertyAccessExpression(n) && n.name.text === 'succeedsId') succeeds = true;
        if (
            ts.isCallExpression(n) &&
            ts.isIdentifier(n.expression) &&
            n.expression.text === 'assertFreshForAct'
        )
            fresh = true;
        ts.forEachChild(n, visit);
    }
    visit(sf);
    if (!succeeds) add('d4', 'missing .succeedsId predecessor-chain read');
    if (!fresh) add('d5', 'missing assertFreshForAct call');
    return findings;
}
function sourceOf(n: ts.Node): string {
    return n.getText(n.getSourceFile());
}
function gateDerived(write: ReturnType<typeof findSuccessionWrites>[number]): boolean {
    const fn = write.fn;
    if (ts.isSourceFile(fn)) return false;
    const start = fn.getStart(write.sourceFile),
        end = write.property.getStart(write.sourceFile);
    const before = write.sourceFile.text.slice(start, end);
    const calls = [
        ...before.matchAll(
            new RegExp(`\\b(?:const|let)\\s+(\\w+)\\s*=\\s*await\\s+${GATE_NAME}\\s*\\(`, 'g')
        )
    ];
    const ids = new Set(calls.map((m) => m[1]));
    if (ids.size === 0) return false;
    const val = ts.isPropertyAssignment(write.property)
        ? sourceOf(write.property.initializer)
        : write.property.name.text;
    return [...ids].some((id) => val === id || new RegExp(`\\b${id}\\s*\\.`).test(val));
}
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
            output: `G-R1-A: scanned ${files.length} files; expected at least ${min}`
        };
    const findings: Finding[] = [];
    let writers = 0;
    for (const file of files) {
        const source = readFileSync(join(root, file), 'utf8');
        const writes = findSuccessionWrites({ file, source });
        writers += writes.length;
        for (const w of writes)
            if (!gateDerived(w))
                findings.push({
                    file,
                    line: w.line,
                    rule: 'UNGATED_WRITER',
                    detail: `succession value is not visibly derived from ${GATE_NAME}(…) before write`
                });
        for (const w of findRawSqlSuccessionWrites({ file, source }))
            findings.push({
                file,
                line: w.line,
                rule: 'RAW_SQL_WRITE',
                detail: 'raw SQL writes succeeds_id'
            });
    }
    if (writers > 0 && !existsSync(join(root, GATE_FILE)))
        findings.push({
            file: GATE_FILE,
            line: 1,
            rule: 'GATE_MISSING',
            detail: 'succession writer exists but canonical gate file is absent'
        });
    findings.push(...gateChecks(root));
    return findings.length
        ? {
              exitCode: 1,
              output: findings
                  .map((f) => `G-R1-A (${f.rule}): ${f.file}:${f.line} ${f.detail}`)
                  .join('\n')
          }
        : {
              exitCode: 0,
              output: `G-R1-A: OK; ${writers} succession writers; gate ${existsSync(join(root, GATE_FILE)) ? 'present' : 'absent'}; ${files.length} production files scanned`
          };
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
