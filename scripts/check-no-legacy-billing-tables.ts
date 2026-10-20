/**
 * @file check-no-legacy-billing-tables.ts
 * @description HOS-1638 (B13a.10): code in apps/api, apps/admin, packages/db
 * (no migrations) must not reference tables dropped by U1 billing cleanup.
 *
 * Scans production .ts/.tsx for whole-word table name matches, skipping
 * comments (line and block style). One hit per code line per table.
 *
 * Does not scan migrations (DROP TABLE source of truth), tests, or
 * fixture files under test/ and __tests__/.
 *
 * Guard script at scripts/__tests__/check-no-legacy-billing-tables.test.ts.
 *
 * Exit 0 = clean, exit 1 = violation or scan broken.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 41 tables dropped in
 * packages/db/src/migrations/0125_robust_cassandra_nova.sql
 * sorted alphabetically.
 *
 * NOT legacy: billing_option, billing_deadline_version (survive),
 * billing_notification_log (renamed to notification_log),
 * accommodations.billing_unpublished_at, subscription.billing_option_id,
 * ck_billing_* and uq_billing_* constraints and
 * fk_subscription_billing_option_version constraint.
 */
export const LEGACY_BILLING_TABLES: readonly string[] = [
    'billing_addon_purchases',
    'billing_addons',
    'billing_audit_logs',
    'billing_checkouts',
    'billing_customer_entitlements',
    'billing_customer_limits',
    'billing_customers',
    'billing_dunning_attempts',
    'billing_entitlements',
    'billing_idempotency_keys',
    'billing_invoice_lines',
    'billing_invoice_payments',
    'billing_invoices',
    'billing_limits',
    'billing_mp_addon_plans',
    'billing_mp_plans',
    'billing_orphan_payments',
    'billing_payment_methods',
    'billing_payments',
    'billing_pending_checkouts',
    'billing_plan_price_change_notices',
    'billing_plan_price_change_targets',
    'billing_plan_price_changes',
    'billing_plans',
    'billing_prices',
    'billing_promo_code_usage',
    'billing_promo_codes',
    'billing_refunds',
    'billing_settings',
    'billing_subscription_addons',
    'billing_subscription_events',
    'billing_subscription_polling_jobs',
    'billing_subscriptions',
    'billing_usage_records',
    'billing_vendor_payouts',
    'billing_vendors',
    'billing_webhook_dead_letter',
    'billing_webhook_events',
    'entity_subscriptions',
    'featured_listing_addon_grants',
    'partner_subscriptions'
] as const;

/** A code line that names a legacy table. */
export interface LegacyTableReference {
    readonly file: string;
    readonly line: number;
    readonly table: string;
}

/**
 * Strips comment content so line numbers stay accurate.
 * Does NOT preserve string literals — table names inside
 * template literals are a tiny corner case worth the
 * simplicity gain (no mis-matched quote breaks on JSDoc).
 *
 * Also strips JSDoc continuation lines (lines whose first
 * non-whitespace character is `*`) because those are
 * functionally comments, not code.
 */
function stripComments(source: string): string {
    // First pass: remove block and line comments, preserving newlines
    const result: string[] = [];
    let i = 0;
    let inBlockComment = false;

    while (i < source.length) {
        // End of block comment
        if (inBlockComment && source[i] === '*' && source[i + 1] === '/') {
            inBlockComment = false;
            i += 2;
            continue;
        }

        // Inside block comment — replace with spaces, preserve newlines
        if (inBlockComment) {
            if (source[i] === '\n') {
                result.push('\n');
            } else {
                result.push(' ');
            }
            i += 1;
            continue;
        }

        // Start of block comment
        if (source[i] === '/' && source[i + 1] === '*') {
            inBlockComment = true;
            i += 2;
            continue;
        }

        // Line comment // — skip to end of line
        if (source[i] === '/' && source[i + 1] === '/') {
            while (i < source.length && source[i] !== '\n') {
                i += 1;
            }
            continue;
        }

        result.push(source[i]);
        i += 1;
    }

    // Second pass: remove JSDoc continuation lines (first non-whitespace = *)
    const cleaned = result.join('');
    const lines = cleaned.split('\n');

    return lines
        .filter((line) => line.trimStart().length === 0 || line.trimStart()[0] !== '*')
        .join('\n');
}

/**
 * Finds every legacy table reference in a single file.
 *
 * @param input - Scan input.
 * @param input.file - Repo-relative path, for the report.
 * @param input.source - The file raw text.
 * @returns One hit per code line per table.
 */
export function findLegacyTableReferences({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly LegacyTableReference[] {
    const cleaned = stripComments(source);
    const lines = cleaned.split('\n');
    const hits: LegacyTableReference[] = [];

    // Build regex: word-boundary (table1|table2|...) word-boundary
    const pattern = new RegExp(`\\b(${LEGACY_BILLING_TABLES.join('|')})\\b`, 'g');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        for (const match of line.matchAll(pattern)) {
            hits.push({
                file,
                line: lineIdx + 1,
                table: match[1]
            });
        }
    }

    return hits;
}

/** Production code files the guard reads, from git ls-files. */
function listScannedFiles({ root }: { readonly root: string }): readonly string[] {
    const out = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
    });
    return (
        out
            .split('\0')
            .filter(Boolean)
            .filter((file) => /^(?:apps|packages)\//.test(file))
            .filter((file) => /\.(?:ts|tsx)$/.test(file))
            // Exclusions: migrations, test dirs, test/spec files, e2e, fixtures.
            .filter((file) => !file.startsWith('packages/db/src/migrations/'))
            .filter((file) => !file.includes('/test/') && !file.includes('/__tests__/'))
            .filter(
                (file) =>
                    !file.endsWith('.test.ts') &&
                    !file.endsWith('.test.tsx') &&
                    !file.endsWith('.spec.ts') &&
                    !file.endsWith('.spec.tsx')
            )
            .filter((file) => !file.startsWith('apps/e2e/'))
            .filter((file) => !file.endsWith('.fixture.ts') && !file.endsWith('.fixture.tsx'))
    );
}

/**
 * Runs the legacy-tables guard.
 *
 * @param args - Run input.
 * @param args.root - Repository root. Defaults to this repo.
 * @returns The exit code and the report.
 */
export function run(args: { readonly root?: string } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const lines = ['=== HOS-1638 (B13a.10): no legacy billing table references in code ==='];

    const files = listScannedFiles({ root });

    if (files.length === 0) {
        lines.push('', 'ERROR: scanned 0 files. The root is wrong or the scan is broken.');
        return { exitCode: 1, output: lines.join('\n') };
    }

    const allHits = files.flatMap((file) =>
        findLegacyTableReferences({
            file,
            source: readFileSync(join(root, file), 'utf8')
        })
    );

    if (allHits.length > 0) {
        lines.push(
            '',
            `FAIL: ${allHits.length} reference(s) to a table the old billing dropped:`,
            `tables checked: ${LEGACY_BILLING_TABLES.length}, files scanned: ${files.length}`
        );
        // Deduplicate (same file + line + table)
        const seen = new Set<string>();
        for (const h of allHits) {
            const key = `${h.file}:${h.line} ${h.table}`;
            if (seen.has(key)) continue;
            seen.add(key);
            lines.push(`  ${h.file}:${h.line} — ${h.table}`);
        }
        return { exitCode: 1, output: lines.join('\n') };
    }

    lines.push('', `OK: no legacy billing table references found across ${files.length} file(s).`);
    return { exitCode: 0, output: lines.join('\n') };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const { exitCode, output } = run();
    (exitCode === 0 ? console.log : console.error)(output);
    process.exit(exitCode);
}
