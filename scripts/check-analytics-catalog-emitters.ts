/**
 * GUARD:G20: lexically checks that each AnalyticsEvents key has a production mention and a docs row,
 * and (HOS-1883) that each fact kind declared in the fact files has a production producer mention
 * outside the declaring files and the adapter. It does not prove calls are reachable, executed after
 * commits, or carry valid properties; dead code counts, and a kind mentioned only in a comment-free
 * string elsewhere (a log label, a test-like fixture under src) also counts as produced.
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
/** Fact files whose `kind: '<X>'` literals must each have a producer (HOS-1883 §5.4). */
const FACT_FILES = [
    'packages/service-core/src/services/billing/facts/billing-fact-sink.ts',
    'packages/service-core/src/services/billing/facts/addon-fact.ts'
];
/** Families whose catalog events need a docs row, and whose docs rows need a catalog event. */
const DOC_FAMILIES = /^(billing|trial|addon)_/;
/**
 * The spans of `Extract<...>` type arguments in masked code (HOS-1883). A kind named only there
 * is a type-level mention, not a producer, so the producer predicate ignores literals inside.
 */
function extractTypeSpans(code: string): { readonly start: number; readonly end: number }[] {
    const spans: { start: number; end: number }[] = [];
    for (const match of code.matchAll(/\bExtract\s*</g)) {
        const open = (match.index ?? 0) + match[0].length;
        let depth = 1;
        let k = open;
        for (; k < code.length && depth > 0; k += 1) {
            if (code[k] === '<') depth += 1;
            else if (code[k] === '>' && code[k - 1] !== '=') depth -= 1;
        }
        spans.push({ start: open, end: k });
    }
    return spans;
}

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
    const catalogValues = new Set(entries.map((entry) => entry.event));
    for (const item of allowEntries)
        if (item.event && !catalogValues.has(item.event))
            violations.push(`allowlist entry has uncatalogued event ${item.event}`);
    const decoded = files.map((file) => ({
        file,
        source: readFileSync(join(root, file), 'utf8'),
        ...maskSource({ source: readFileSync(join(root, file), 'utf8') })
    }));
    const emitterFiles = decoded.filter(({ file }) => file !== CATALOG);
    for (const entry of entries) {
        const emitters = emitterFiles.filter(
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
    for (const event of catalogValues)
        if (DOC_FAMILIES.test(event) && !docs.includes(`| \`${event}\` |`))
            violations.push(`missing docs row for ${event}`);
    const rows = [
        ...docs.matchAll(/^\| `((?:billing|trial|subscription|addon)_[a-z_]+)` \|/gm)
    ].map((m) => String(m[1]));
    for (const event of rows)
        if (!catalogValues.has(event)) violations.push(`docs row has uncatalogued event ${event}`);
    const factKinds = new Set<string>();
    for (const factFile of FACT_FILES) {
        let source: string;
        try {
            source = readFileSync(join(root, factFile), 'utf8');
        } catch {
            violations.push(`fact file ${factFile} is missing`);
            continue;
        }
        for (const match of source.matchAll(/\bkind: '([A-Z][A-Z0-9_]*)'/g))
            factKinds.add(String(match[1]));
    }
    const producerFiles = decoded.filter(
        ({ file }) =>
            !FACT_FILES.includes(file) &&
            !/\/utils\/analytics\/analytics-facts[^/]*\.ts$/.test(file)
    );
    const producerLiterals = producerFiles.map(({ code, strings }) => {
        const typeSpans = extractTypeSpans(code);
        return strings.filter(
            (literal) =>
                !typeSpans.some((span) => literal.start >= span.start && literal.start < span.end)
        );
    });
    for (const kind of factKinds)
        if (!producerLiterals.some((strings) => strings.some((literal) => literal.value === kind)))
            violations.push(`fact kind ${kind} has no production producer`);
    if (violations.length)
        return {
            exitCode: 1,
            output: `${lines.join('\n')}\nFAIL\n${violations.map((item) => `  ${item}`).join('\n')}`
        };
    return {
        exitCode: 0,
        output: `${lines.join('\n')}\nOK: ${files.length} files, ${entries.length} catalog keys, ${factKinds.size} fact kinds, each has a production mention and docs row.`
    };
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode ? console.error : console.log)(result.output);
    process.exit(result.exitCode);
}
