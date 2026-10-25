/**
 * GUARD:G20: lexically checks that each AnalyticsEvents key has a production mention and a docs row.
 * It does not prove calls are reachable, executed after commits, or carry valid properties; dead code counts.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listProductionFiles, maskSource } from './payments-guard-scan.js';

const RETIRED = [
    'subscription_checkout_started',
    'subscription_created',
    'subscription_payment_succeeded',
    'subscription_payment_failed',
    'trial_converted_to_paid',
    'subscriptionCheckoutStarted',
    'subscriptionCreated',
    'subscriptionPaymentSucceeded',
    'subscriptionPaymentFailed',
    'trialConvertedToPaid'
];
const MIN_SCANNED_FILES = 1000;
const MIN_CATALOG_KEYS = 40;
const CATALOG = 'packages/analytics/src/catalog.ts';
const DOC = 'docs/analytics/event-catalog.md';
export function run(
    args: { root?: string; minScannedFiles?: number; minCatalogKeys?: number } = {}
): { exitCode: 0 | 1; output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const files = listProductionFiles({ root, excludePrefixes: [] });
    const lines = [
        '=== GUARD:G20 — every analytics catalog event has a production emitter mention ===',
        'Blind spots: lexical mentions only; dead code counts; this does not prove runtime flow, post-commit timing, or event payload validity.'
    ];
    if (files.length < (args.minScannedFiles ?? MIN_SCANNED_FILES))
        return {
            exitCode: 1,
            output: `${lines.join('\n')}\nFAIL: only ${files.length} production file(s) scanned.`
        };
    const catalog = readFileSync(join(root, CATALOG), 'utf8');
    const entries = [...catalog.matchAll(/^\s{4}(\w+): '(\w+)'[,]?$/gm)].map((m) => ({
        key: String(m[1]),
        event: String(m[2])
    }));
    if (entries.length < (args.minCatalogKeys ?? MIN_CATALOG_KEYS))
        return {
            exitCode: 1,
            output: `${lines.join('\n')}\nFAIL: only ${entries.length} catalog keys found.`
        };
    // The initial allowlist is intentionally empty: the new adapter mentions every new event, so a waiver is stale immediately.
    const allowlist: unknown = JSON.parse(
        readFileSync(join(root, 'scripts/analytics-emitter-allowlist.json'), 'utf8')
    );
    const violations: string[] = [];
    const allowEntries = Array.isArray(allowlist)
        ? (allowlist as { event?: string; reason?: string; issue?: string }[])
        : [];
    if (
        !Array.isArray(allowlist) ||
        allowEntries.some((item) => !item.event || !item.reason || !item.issue)
    )
        violations.push('allowlist entries require event, reason, and issue');
    const sourceFiles = files.filter((file) => file !== CATALOG);
    const decoded = sourceFiles.map((file) => ({
        file,
        source: readFileSync(join(root, file), 'utf8'),
        ...maskSource({ source: readFileSync(join(root, file), 'utf8') })
    }));
    for (const entry of entries) {
        const emitters = decoded.filter(
            ({ code, strings }) =>
                new RegExp(`\\bAnalyticsEvents\\.${entry.key}\\b`).test(code) ||
                strings.some((literal) => literal.value === entry.event)
        );
        const waived = allowEntries.some(
            (item) => item.event === entry.event && item.reason && item.issue
        );
        if (!emitters.length && !waived)
            violations.push(`missing production mention for ${entry.event}`);
        if (waived && emitters.length) violations.push(`stale allowlist entry for ${entry.event}`);
    }
    const docs = readFileSync(join(root, DOC), 'utf8');
    for (const old of RETIRED) {
        for (const { file, source } of decoded)
            if (/^(apps|packages)\/.+\/src\//.test(file) && source.includes(old))
                violations.push(`retired event ${old} remains in ${file}`);
        if (docs.includes(old)) violations.push(`retired event ${old} remains in ${DOC}`);
    }
    const catalogValues = new Set(entries.map((entry) => entry.event));
    for (const event of catalogValues)
        if (/^(billing|trial)_/.test(event) && !docs.includes(`| \`${event}\` |`))
            violations.push(`missing docs row for ${event}`);
    const rows = [...docs.matchAll(/^\| `((?:billing|trial|subscription)_[a-z_]+)` \|/gm)].map(
        (m) => String(m[1])
    );
    for (const event of rows)
        if (!catalogValues.has(event)) violations.push(`docs row has uncatalogued event ${event}`);
    if (violations.length)
        return {
            exitCode: 1,
            output: `${lines.join('\n')}\nFAIL\n${violations.map((item) => `  ${item}`).join('\n')}`
        };
    return {
        exitCode: 0,
        output: `${lines.join('\n')}\nOK: ${files.length} files, ${entries.length} catalog keys, each has a production mention and docs row.`
    };
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode ? console.error : console.log)(result.output);
    process.exit(result.exitCode);
}
