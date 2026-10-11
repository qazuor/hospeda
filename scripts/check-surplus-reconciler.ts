/** GUARD:G5 — coverage sources that turn off must reach surplus reconciliation. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const MIN_SCANNED_FILES = 1000;
export const PENDING_CEILING = 7;
const TABLES = new Set(['trials', 'subscriptions', 'courtesyGrants', 'addonInstances']);
const CODE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|\/)(?:test|tests|__tests__|e2e)\//;
type Entry = {
    file: string;
    symbol: string;
    table: string;
    effect: string;
    via: string | null;
    reason: string;
    owner?: string;
};

function files(root: string): string[] {
    return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    })
        .split('\0')
        .filter(Boolean)
        .filter((f) => CODE.test(f) && !TEST.test(f))
        .filter((f) => /^(apps|packages)\/[^/]+\/src\//.test(f) && existsSync(join(root, f)));
}
function writerSites(file: string, source: string) {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const sites: { table: string; line: number; symbol: string; calls: Set<string> }[] = [];
    function visit(n: ts.Node, scope: string): void {
        let next = scope;
        if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n))
            next = n.name?.getText(sf) ?? scope;
        if (ts.isCallExpression(n)) {
            const method = ts.isPropertyAccessExpression(n.expression)
                ? n.expression.name.text
                : ts.isIdentifier(n.expression)
                  ? n.expression.text
                  : '';
            const arg = n.arguments[0];
            if (
                (method === 'update' || method === 'delete') &&
                arg &&
                ts.isIdentifier(arg) &&
                TABLES.has(arg.text)
            )
                sites.push({
                    table: arg.text,
                    line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
                    symbol: next,
                    calls: new Set()
                });
            if (['emitCoverageChanged', 'runAfterCommit', 'recalculateCoverage'].includes(method))
                for (const site of sites) site.calls.add(method);
        }
        ts.forEachChild(n, (c) => visit(c, next));
    }
    visit(sf, '<module>');
    // Calls may precede writes in source; presence is evaluated per file by design.
    const calls = new Set<string>();
    function scan(n: ts.Node): void {
        if (ts.isCallExpression(n)) {
            if (ts.isPropertyAccessExpression(n.expression)) calls.add(n.expression.name.text);
            if (ts.isIdentifier(n.expression)) calls.add(n.expression.text);
        }
        ts.forEachChild(n, scan);
    }
    scan(sf);
    return sites.map((s) => ({ ...s, calls }));
}
export function run(
    args: { root?: string; minScannedFiles?: number; inventory?: readonly Entry[] } = {}
) {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const scanned = files(root);
    const minimum = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (scanned.length < minimum)
        return {
            exitCode: 1,
            output: `G5: scanned ${scanned.length} files; expected at least ${minimum}`
        };
    const inventory =
        args.inventory ??
        (JSON.parse(
            readFileSync(join(root, 'scripts/guards/source-off-writers.json'), 'utf8')
        ) as Entry[]);
    const observed = scanned.flatMap((file) =>
        writerSites(file, readFileSync(join(root, file), 'utf8')).map((site) => ({ ...site, file }))
    );
    const errors: string[] = [];
    const key = (e: { file: string; symbol: string; table: string }) =>
        `${e.file}|${e.symbol}|${e.table}`;
    for (const site of observed) {
        const entry = inventory.find((e) => key(e) === key(site));
        if (!entry) {
            errors.push(`G5: ${site.file}:${site.line} source write is not inventoried`);
            continue;
        }
        if (
            entry.effect === 'turns-off' &&
            entry.via === 'notice' &&
            !['emitCoverageChanged', 'runAfterCommit', 'recalculateCoverage'].some((name) =>
                site.calls.has(name)
            )
        )
            errors.push(
                `G5: ${site.file}:${site.line} ${site.table} turns off without surplus reconciler notice`
            );
        if (entry.effect === 'turns-off' && entry.via === 'pending' && !entry.owner)
            errors.push(`G5: ${site.file}:${site.line} pending source writer has no owner`);
        if (entry.effect === 'turns-off' && !entry.via)
            errors.push(`G5: ${site.file}:${site.line} turns-off writer has no via`);
    }
    for (const entry of inventory)
        if (!observed.some((site) => key(site) === key(entry)))
            errors.push(
                `G5: ${entry.file}:1 stale inventory entry for ${entry.symbol}/${entry.table}`
            );
    const pending = inventory.filter((e) => e.effect === 'turns-off' && e.via === 'pending');
    if (pending.length > PENDING_CEILING)
        errors.push(
            `G5: scripts/guards/source-off-writers.json:1 pending writers ${pending.length} exceed ceiling ${PENDING_CEILING}`
        );
    const index = readFileSync(join(root, 'apps/api/src/index.ts'), 'utf8');
    const listener = readFileSync(
        join(root, 'apps/api/src/utils/listing-publication/coverage-listener.ts'),
        'utf8'
    );
    if (!index.includes('subscribeListingCoverageRecalculation'))
        errors.push('G5: apps/api/src/index.ts:1 coverage recalculation listener is not wired');
    if (!listener.includes('recalculateCoverage'))
        errors.push(
            'G5: apps/api/src/utils/listing-publication/coverage-listener.ts:1 listener does not call recalculateCoverage'
        );
    return errors.length
        ? { exitCode: 1, output: errors.join('\n') }
        : {
              exitCode: 0,
              output: `G5: OK; ${scanned.length} production files scanned; ${pending.length} pending writers`
          };
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
