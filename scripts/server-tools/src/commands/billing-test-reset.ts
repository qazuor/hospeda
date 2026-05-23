/**
 * `hops billing-test-reset` — wipe ALL billing transactional data linked
 * to a given Hospeda user so a fresh smoke iteration can start without
 * leftovers from previous runs.
 *
 * Preserves seed tables (`billing_plans`, `billing_prices`,
 * `billing_addons`, `billing_entitlements`, `billing_limits`,
 * `billing_promo_codes`, `billing_settings`). Wipes per-customer state:
 * subscriptions, polling jobs, payments, invoices, addon purchases,
 * entitlements, limits, audit log, dunning attempts, idempotency keys,
 * notification log, etc.
 *
 * With `--delete-user` also removes the Better Auth user row (cascades
 * to `accounts` and `sessions` via FK), giving a fully fresh signup
 * surface for the next smoke.
 *
 * Rejected on `--target=prod` outright. There is no legitimate use
 * case for wiping a production customer's billing history via this
 * command; if a real prod cleanup is needed, it goes through SQL +
 * separate ops review.
 *
 * @module commands/billing-test-reset
 */

import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';
import type { Target } from '../lib/target.ts';
import { getDbCredentials } from '../lib/target.ts';

const HELP = `
hops billing-test-reset --email <signup-email>
                        [--delete-user]
                        [--target=staging]
                        [--yes]

Wipe all billing transactional data linked to a Hospeda signup user so
a fresh smoke iteration can start. Preserves seed/config tables.

Required:
  --email <addr>          The user's signup email. The user is resolved
                          via Better Auth; the billing customer via
                          external_id = users.id::text.

Optional:
  --delete-user           Also DELETE the user from Better Auth
                          (cascades to accounts + sessions). Without
                          this flag the user is preserved and you can
                          reuse them for the next signup-less smoke.
  --target=staging        Target (defaults to active target). Production
                          is rejected outright.
  --yes                   Skip confirmation prompts.
  --help, -h              Show this help.

What gets wiped (per linked customer):
  - billing_subscription_polling_jobs
  - billing_subscription_addons
  - billing_subscription_events
  - billing_subscriptions
  - billing_addon_purchases
  - billing_checkouts
  - billing_payments
  - billing_payment_methods
  - billing_refunds
  - billing_invoices (and invoice_lines, invoice_payments)
  - billing_customer_entitlements
  - billing_customer_limits
  - billing_usage_records
  - billing_promo_code_usage
  - billing_dunning_attempts
  - billing_notification_log
  - billing_audit_logs (where customer_id matches)
  - billing_customers (the customer row itself)

What is preserved (seed/config):
  - billing_plans / billing_prices / billing_addons /
    billing_entitlements / billing_limits / billing_promo_codes /
    billing_settings

Safety:
  - Rejected if --target=prod.
  - Shows row counts that will be deleted, asks for confirmation.
  - All deletes happen inside a single transaction.

Examples:
  hops billing-test-reset --email qazuor+billtest@gmail.com
  hops billing-test-reset --email qazuor+billtest@gmail.com --delete-user
  hops billing-test-reset --email qazuor+billtest@gmail.com --yes
`.trim();

interface ParsedArgs {
    readonly email: string;
    readonly deleteUser: boolean;
    readonly target: Target;
    readonly skipConfirm: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs | null {
    let email: string | undefined;
    let deleteUser = false;
    let skipConfirm = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--email') {
            email = argv[++i];
        } else if (arg?.startsWith('--email=')) {
            email = arg.slice('--email='.length);
        } else if (arg === '--delete-user') {
            deleteUser = true;
        } else if (arg === '--yes' || arg === '-y') {
            skipConfirm = true;
        }
    }

    if (!email) {
        return null;
    }
    return {
        email,
        deleteUser,
        target: getActiveTarget(),
        skipConfirm
    };
}

interface DiscoveredEntity {
    readonly userId: string;
    readonly userEmail: string;
    readonly customerId: string | null;
}

async function discoverTarget(params: {
    container: string;
    user: string;
    db: string;
    email: string;
}): Promise<DiscoveredEntity | null> {
    const escapedEmail = params.email.replace(/'/g, "''");
    const query = `
SELECT
    u.id::text       AS user_id,
    u.email          AS user_email,
    bc.id::text      AS customer_id
FROM users u
LEFT JOIN billing_customers bc ON bc.external_id = u.id::text
WHERE u.email = '${escapedEmail}';
`.trim();

    const result = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', params.db, '-t', '-A', '-F', '|', '-c', query]
    });
    if (result.exitCode !== 0) {
        die(result.stderr.trim() || `psql exited ${result.exitCode}`);
        return null;
    }
    const rows = result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (rows.length === 0) {
        return null;
    }
    if (rows.length > 1) {
        die(
            `Found ${rows.length} users with email ${params.email}. Refusing to operate ambiguously.`
        );
        return null;
    }
    const [userId, userEmail, customerId] = rows[0].split('|');
    return { userId, userEmail, customerId: customerId || null };
}

interface RowCount {
    readonly table: string;
    readonly count: number;
}

async function countAffected(params: {
    container: string;
    user: string;
    db: string;
    customerId: string;
}): Promise<RowCount[]> {
    const cid = params.customerId.replace(/'/g, "''");
    const query = `
WITH counts AS (
    SELECT 'billing_subscription_polling_jobs' AS table_name,
           (SELECT count(*) FROM billing_subscription_polling_jobs
            WHERE subscription_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${cid}')) AS row_count
    UNION ALL SELECT 'billing_subscription_addons',
           (SELECT count(*) FROM billing_subscription_addons
            WHERE subscription_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${cid}'))
    UNION ALL SELECT 'billing_subscription_events',
           (SELECT count(*) FROM billing_subscription_events
            WHERE subscription_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${cid}'))
    UNION ALL SELECT 'billing_subscriptions',
           (SELECT count(*) FROM billing_subscriptions WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_addon_purchases',
           (SELECT count(*) FROM billing_addon_purchases WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_checkouts',
           (SELECT count(*) FROM billing_checkouts WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_payments',
           (SELECT count(*) FROM billing_payments WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_payment_methods',
           (SELECT count(*) FROM billing_payment_methods WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_invoices',
           (SELECT count(*) FROM billing_invoices WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_customer_entitlements',
           (SELECT count(*) FROM billing_customer_entitlements WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_customer_limits',
           (SELECT count(*) FROM billing_customer_limits WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_promo_code_usage',
           (SELECT count(*) FROM billing_promo_code_usage WHERE customer_id = '${cid}')
    UNION ALL SELECT 'billing_dunning_attempts',
           (SELECT count(*) FROM billing_dunning_attempts WHERE customer_id = '${cid}')
)
SELECT table_name, row_count FROM counts WHERE row_count > 0 ORDER BY table_name;
`.trim();

    const result = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', params.db, '-t', '-A', '-F', '|', '-c', query]
    });
    if (result.exitCode !== 0) {
        die(result.stderr.trim() || `psql exited ${result.exitCode}`);
        return [];
    }
    return result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
            const [table, count] = line.split('|');
            return { table, count: Number(count) || 0 };
        });
}

/**
 * SQL transaction body. Ordered so children precede parents to keep
 * FK constraints happy even if a particular FK is not declared with
 * ON DELETE CASCADE.
 */
function buildResetTransaction(params: {
    customerId: string | null;
    userId: string;
    deleteUser: boolean;
}): string {
    const cid = params.customerId?.replace(/'/g, "''");
    const uid = params.userId.replace(/'/g, "''");
    const lines: string[] = ['BEGIN;'];

    if (cid) {
        lines.push(
            `DELETE FROM billing_subscription_polling_jobs WHERE subscription_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${cid}');`,
            `DELETE FROM billing_subscription_addons WHERE subscription_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${cid}');`,
            `DELETE FROM billing_subscription_events WHERE subscription_id IN (SELECT id FROM billing_subscriptions WHERE customer_id = '${cid}');`,
            `DELETE FROM billing_dunning_attempts WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_invoice_payments WHERE invoice_id IN (SELECT id FROM billing_invoices WHERE customer_id = '${cid}');`,
            `DELETE FROM billing_invoice_lines WHERE invoice_id IN (SELECT id FROM billing_invoices WHERE customer_id = '${cid}');`,
            `DELETE FROM billing_invoices WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_refunds WHERE payment_id IN (SELECT id FROM billing_payments WHERE customer_id = '${cid}');`,
            `DELETE FROM billing_payments WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_payment_methods WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_subscriptions WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_addon_purchases WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_checkouts WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_customer_entitlements WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_customer_limits WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_usage_records WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_promo_code_usage WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_notification_log WHERE customer_id = '${cid}';`,
            `DELETE FROM billing_audit_logs WHERE entity_id = '${cid}';`,
            `DELETE FROM billing_customers WHERE id = '${cid}';`
        );
    }

    if (params.deleteUser) {
        lines.push(`DELETE FROM users WHERE id = '${uid}';`);
    }

    lines.push('COMMIT;');
    return lines.join('\n');
}

export async function billingTestReset(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseArgs(argv);
    if (!parsed) {
        die('Missing required --email. Run with --help for usage.');
        return;
    }

    if (parsed.target === 'prod') {
        die(
            'billing-test-reset is disabled for --target=prod. There is no legitimate test-reset operation against a production customer; production cleanups go through reviewed SQL, not this command.'
        );
        return;
    }

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(parsed.target);
    const dbUser = credentials.user;
    const db = credentials.database;

    // Step 1 — discover the user + customer.
    const discovered = await discoverTarget({
        container,
        user: dbUser,
        db,
        email: parsed.email
    });
    if (!discovered) {
        die(`No user found with email ${parsed.email}.`);
        return;
    }

    log.info(`Resolved user ${discovered.userId} (${discovered.userEmail}).`);
    if (discovered.customerId) {
        log.info(`Linked billing customer: ${discovered.customerId}.`);
    } else {
        log.info('No linked billing_customers row — only the user row will be reset if requested.');
    }

    // Step 2 — count affected rows so the operator sees what will go.
    let counts: RowCount[] = [];
    if (discovered.customerId) {
        counts = await countAffected({
            container,
            user: dbUser,
            db,
            customerId: discovered.customerId
        });
    }

    process.stdout.write(`\nTarget:    ${parsed.target}\n`);
    process.stdout.write(`User:      ${discovered.userId} (${discovered.userEmail})\n`);
    process.stdout.write(`Customer:  ${discovered.customerId ?? '<none>'}\n`);
    process.stdout.write('\nRows that will be deleted:\n');
    if (counts.length === 0) {
        process.stdout.write('  (no transactional rows linked to this customer)\n');
    } else {
        for (const row of counts) {
            process.stdout.write(`  ${row.table.padEnd(40)} ${row.count}\n`);
        }
    }
    if (discovered.customerId) {
        process.stdout.write(`  ${'billing_customers'.padEnd(40)} 1\n`);
    }
    if (parsed.deleteUser) {
        process.stdout.write(`  ${'users'.padEnd(40)} 1 (cascades to accounts + sessions)\n`);
    }
    process.stdout.write('\n');

    // Step 3 — confirm before destructive op.
    if (!parsed.skipConfirm) {
        const ok = await confirm('Proceed with the reset?', { defaultValue: false });
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    // Step 4 — execute the transaction.
    const sql = buildResetTransaction({
        customerId: discovered.customerId,
        userId: discovered.userId,
        deleteUser: parsed.deleteUser
    });

    const result = await runInContainer({
        container,
        argv: ['psql', '-U', dbUser, '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql]
    });
    if (result.exitCode !== 0) {
        die(result.stderr.trim() || `psql exited ${result.exitCode}`);
        return;
    }

    if (result.stdout.trim().length > 0) {
        process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
    }
    log.info('Reset complete.');
}
