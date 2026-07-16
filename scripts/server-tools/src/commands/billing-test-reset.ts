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
 * notification log, commerce-listing subscription links, featured-listing
 * addon grants, etc. Also resets the entitlement-driven `isFeatured` /
 * `featuredByEntitlement` flags on any accommodation the user owns.
 *
 * With `--delete-user` also removes the Better Auth user row (cascades
 * to `accounts` and `sessions` via FK), giving a fully fresh signup
 * surface for the next smoke.
 *
 * Safety model (all targets, including prod):
 *   - **Dry-run by default.** Without `--execute` the command only
 *     discovers the user/customer and prints the row counts that WOULD
 *     be deleted/updated. Nothing is written.
 *   - `--execute` is required to actually run the destructive
 *     transaction, on every target.
 *   - On staging/local, `--execute` asks for a normal yes/no
 *     confirmation (skippable with `--yes`/`-y`, same as before).
 *   - On prod, `--execute` requires the operator to re-type the
 *     resolved customer's exact signup email, and `--yes`/`-y` is
 *     rejected outright — there is no way to skip confirmation in prod.
 *     The operation is always scoped to the single customer resolved by
 *     `--email`.
 *
 * @module commands/billing-test-reset
 */

import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { confirm, promptText } from '../lib/prompt.ts';
import type { Target } from '../lib/target.ts';
import { getDbCredentials } from '../lib/target.ts';
import {
    buildResetTransaction,
    countAffected,
    countFeaturedAccommodations,
    discoverTarget,
    type RowCount
} from './billing-test-reset-queries.ts';

const HELP = `
hops billing-test-reset --email <signup-email>
                        [--delete-user]
                        [--target=staging|prod]
                        [--execute]
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
  --target=staging|prod   Target. Always explicit — never inferred from
                          HOPS_DEFAULT_TARGET.
  --execute               Actually run the destructive transaction.
                          Without this flag the command is a DRY RUN:
                          it only discovers the user/customer and prints
                          row counts, nothing is written, on ANY target.
  --yes                   Skip the confirmation prompt. REJECTED when
                          combined with --target=prod --execute — prod
                          confirmation can never be skipped.
  --help, -h              Show this help.

What gets wiped (per linked customer):
  - billing_subscription_polling_jobs
  - billing_subscription_addons
  - billing_subscription_events
  - commerce_listing_subscriptions (link table, by subscription)
  - billing_subscriptions
  - featured_listing_addon_grants (link table, by addon purchase)
  - billing_addon_purchases
  - billing_checkouts
  - billing_payments
  - billing_payment_methods
  - billing_refunds
  - billing_invoices (and invoice_lines, invoice_payments)
  - billing_customer_entitlements
  - billing_customer_limits
  - billing_usage_records (removed automatically via ON DELETE cascade
    when its parent billing_subscriptions rows are deleted)
  - billing_promo_code_usage
  - billing_dunning_attempts
  - billing_notification_log
  - billing_audit_logs (polymorphic entity_type/entity_id rows for the
    customer itself and for its subscriptions, payments and invoices)
  - billing_customers (the customer row itself)

Also reset (independent of the customer row — scoped by accommodation
ownership, so it applies even when there is no linked billing customer):
  - accommodations: featured_by_entitlement = false, is_featured = false
    for every accommodation owned by this user.

What is preserved (seed/config):
  - billing_plans / billing_prices / billing_addons /
    billing_entitlements / billing_limits / billing_promo_codes /
    billing_settings

Safety:
  - Dry run by default on every target — pass --execute to write.
  - On staging: --execute asks for confirmation (skip with --yes).
  - On prod: --execute requires re-typing the customer's exact email;
    --yes is rejected outright.
  - Shows row counts that will be deleted/updated before executing.
  - All deletes/updates happen inside a single transaction.

Examples:
  hops billing-test-reset --target=staging --email qazuor+billtest@gmail.com
  hops billing-test-reset --target=staging --email qazuor+billtest@gmail.com --execute --yes
  hops billing-test-reset --target=staging --email qazuor+billtest@gmail.com --execute --delete-user
  hops billing-test-reset --target=prod --email real.customer@example.com          # dry run only
  hops billing-test-reset --target=prod --email real.customer@example.com --execute # asks to re-type the email
`.trim();

export interface ParsedBillingTestResetArgs {
    readonly email: string;
    readonly deleteUser: boolean;
    readonly target: Target;
    readonly skipConfirm: boolean;
    readonly execute: boolean;
}

/**
 * Parses `billing-test-reset` argv into a typed, validated shape. Pure
 * function — no I/O, no `getActiveTarget()` call — so it is unit
 * testable without a live target/container. The command entry point
 * calls `getActiveTarget()` separately and merges it in.
 */
export function parseBillingTestResetArgs(
    argv: ReadonlyArray<string>
): Omit<ParsedBillingTestResetArgs, 'target'> | null {
    let email: string | undefined;
    let deleteUser = false;
    let skipConfirm = false;
    let execute = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--email') {
            email = argv[++i];
        } else if (arg?.startsWith('--email=')) {
            email = arg.slice('--email='.length);
        } else if (arg === '--delete-user') {
            deleteUser = true;
        } else if (arg === '--execute') {
            execute = true;
        } else if (arg === '--yes' || arg === '-y') {
            skipConfirm = true;
        }
    }

    if (!email) {
        return null;
    }
    return { email, deleteUser, skipConfirm, execute };
}

/**
 * Resolves whether this run is a dry-run preview or a real destructive
 * execution. Trivial by itself, but kept as a named pure function so the
 * decision point is explicit and unit-testable rather than an inline
 * boolean check scattered through the command body.
 */
export function resolveResetMode(execute: boolean): 'preview' | 'execute' {
    return execute ? 'execute' : 'preview';
}

export interface ExecuteGuardInput {
    readonly target: Target;
    readonly execute: boolean;
    readonly skipConfirm: boolean;
}

export interface ExecuteGuardResult {
    readonly ok: boolean;
    readonly message?: string;
}

/**
 * Enforces the one hard prod safety rule: `--yes`/`-y` can never skip
 * confirmation for a real (`--execute`) run against `--target=prod`.
 * Pure function, no I/O — the caller (`billingTestReset`) `die()`s using
 * the returned message when `ok` is `false`.
 *
 * @param input - Resolved target, execute flag, and skip-confirm flag.
 * @returns `{ ok: true }` when the combination is allowed, otherwise
 *   `{ ok: false, message }` describing why it was rejected.
 */
export function validateExecuteGuard(input: ExecuteGuardInput): ExecuteGuardResult {
    if (input.target === 'prod' && input.execute && input.skipConfirm) {
        return {
            ok: false,
            message:
                'Refusing --yes/-y with --target=prod --execute: confirmation cannot be skipped in prod. Remove --yes/-y and re-type the customer email when prompted.'
        };
    }
    return { ok: true };
}

export async function billingTestReset(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsedArgs = parseBillingTestResetArgs(argv);
    if (!parsedArgs) {
        die('Missing required --email. Run with --help for usage.');
        return;
    }
    const parsed: ParsedBillingTestResetArgs = { ...parsedArgs, target: getActiveTarget() };

    const guard = validateExecuteGuard(parsed);
    if (!guard.ok) {
        die(guard.message ?? 'Refusing to proceed.');
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
        log.info('No linked billing_customers row — only owner-scoped state will be reset.');
    }

    // Step 2 — count affected rows so the operator sees what will go,
    // on EVERY run (preview or execute).
    let counts: RowCount[] = [];
    if (discovered.customerId) {
        counts = await countAffected({
            container,
            user: dbUser,
            db,
            customerId: discovered.customerId
        });
    }
    const featuredAccommodationsCount = await countFeaturedAccommodations({
        container,
        user: dbUser,
        db,
        userId: discovered.userId
    });

    const mode = resolveResetMode(parsed.execute);
    process.stdout.write(`\nMode:      ${mode === 'preview' ? 'DRY RUN (pass --execute to write)' : 'EXECUTE'}\n`);
    process.stdout.write(`Target:    ${parsed.target}\n`);
    process.stdout.write(`User:      ${discovered.userId} (${discovered.userEmail})\n`);
    process.stdout.write(`Customer:  ${discovered.customerId ?? '<none>'}\n`);
    process.stdout.write(`\nRows that will be deleted${mode === 'preview' ? ' (preview)' : ''}:\n`);
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
    process.stdout.write(
        `\nAccommodations to reset (featured_by_entitlement/is_featured → false): ${featuredAccommodationsCount}\n\n`
    );

    if (mode === 'preview') {
        log.info('Dry run complete. No changes were made. Pass --execute to run the reset for real.');
        return;
    }

    // Step 3 — confirm before the destructive op.
    if (parsed.target === 'prod') {
        log.warn('This is a PRODUCTION delete. It cannot be undone.');
        const typed = await promptText({
            message: `Type the customer's exact email to confirm (${discovered.userEmail}):`
        });
        if (typed !== discovered.userEmail) {
            log.warn('Typed email did not match. Aborted.');
            return;
        }
    } else if (!parsed.skipConfirm) {
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
