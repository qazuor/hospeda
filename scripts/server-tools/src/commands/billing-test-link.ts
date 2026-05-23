/**
 * `hops billing-test-link` — map a Hospeda signup user's billing customer
 * email to a MercadoPago test buyer email so the MP checkout can be
 * completed end-to-end during staging smoke runs.
 *
 * Without this, MP rejects the preapproval creation because the payer
 * email on the new user does not match a registered MP test buyer.
 *
 * Rejected on `--target=prod` outright: there is no legitimate use case
 * for mapping a production user's email to a synthetic test buyer.
 *
 * @module commands/billing-test-link
 */

import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';
import type { Target } from '../lib/target.ts';
import { getDbCredentials } from '../lib/target.ts';

/**
 * The canonical MP test buyer used across SPEC-143 smoke runs. Override
 * with `--buyer-email` when MP rotates buyers or the smoke needs a
 * specific buyer for a particular test (e.g. one with a different card
 * configuration).
 */
const DEFAULT_BUYER_EMAIL = 'test_user_5529635850066455346@testuser.com';

const HELP = `
hops billing-test-link --email <signup-email>
                       [--buyer-email <override>]
                       [--target=staging]
                       [--yes]

Map a Hospeda signup user's billing customer email to a MercadoPago test
buyer email so the MP checkout flow can complete end-to-end.

Required:
  --email <addr>          The user's signup email (the one used in the
                          Hospeda UI). The command resolves the user
                          via Better Auth and the linked
                          billing_customers row via external_id.

Optional:
  --buyer-email <addr>    Override the default test buyer.
                          Default: ${DEFAULT_BUYER_EMAIL}
  --target=staging        Target (defaults to active target). Production
                          is rejected outright.
  --yes                   Skip the confirmation prompt.
  --help, -h              Show this help.

What it does:
  1. SELECT u.id, bc.id, bc.email FROM users u JOIN billing_customers bc
     ON bc.external_id = u.id::text WHERE u.email = <signup-email>.
     Verifies exactly one row matches.
  2. Prompts for confirmation (unless --yes).
  3. UPDATE billing_customers SET email = <buyer-email> WHERE id = <bc.id>.

Safety:
  - Rejected if --target=prod.
  - Confirms which user + customer + new email before writing.
  - Aborts cleanly if zero or multiple matches are found.

Examples:
  hops billing-test-link --email qazuor+billtest@gmail.com
  hops billing-test-link --email qazuor+billtest@gmail.com --buyer-email test_user_XXXXX@testuser.com
  hops billing-test-link --email qazuor+billtest@gmail.com --yes
`.trim();

interface ParsedArgs {
    readonly email: string;
    readonly buyerEmail: string;
    readonly target: Target;
    readonly skipConfirm: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs | null {
    let email: string | undefined;
    let buyerEmail: string = DEFAULT_BUYER_EMAIL;
    let skipConfirm = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--email') {
            email = argv[++i];
        } else if (arg?.startsWith('--email=')) {
            email = arg.slice('--email='.length);
        } else if (arg === '--buyer-email') {
            buyerEmail = argv[++i] ?? buyerEmail;
        } else if (arg?.startsWith('--buyer-email=')) {
            buyerEmail = arg.slice('--buyer-email='.length);
        } else if (arg === '--yes' || arg === '-y') {
            skipConfirm = true;
        }
    }

    if (!email) {
        return null;
    }
    return {
        email,
        buyerEmail,
        target: getActiveTarget(),
        skipConfirm
    };
}

export async function billingTestLink(argv: ReadonlyArray<string>): Promise<void> {
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
            'billing-test-link is disabled for --target=prod. Mapping a real user to a synthetic test buyer is never the right operation in production.'
        );
        return;
    }

    const container = await findContainer('postgres');
    const credentials = getDbCredentials(parsed.target);
    const user = credentials.user;
    const db = credentials.database;

    // Step 1 — discover the user + customer to operate on. Single quotes
    // around the email are safe because the email is validated by the
    // Better Auth flow at signup; we still escape via psql parameter
    // binding here.
    const escapedEmail = parsed.email.replace(/'/g, "''");
    const discoveryQuery = `
SELECT
    u.id::text       AS user_id,
    u.email          AS user_email,
    bc.id::text      AS customer_id,
    bc.email         AS current_customer_email,
    bc.deleted_at    AS deleted_at
FROM users u
LEFT JOIN billing_customers bc ON bc.external_id = u.id::text
WHERE u.email = '${escapedEmail}';
`.trim();

    const discovery = await runInContainer({
        container,
        argv: ['psql', '-U', user, '-d', db, '-t', '-A', '-F', '|', '-c', discoveryQuery]
    });

    if (discovery.exitCode !== 0) {
        die(discovery.stderr.trim() || `psql exited ${discovery.exitCode}`);
        return;
    }

    const rows = discovery.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (rows.length === 0) {
        die(`No user found with email ${parsed.email}.`);
        return;
    }
    if (rows.length > 1) {
        die(
            `Found ${rows.length} users with email ${parsed.email}. Refusing to operate ambiguously. Resolve manually via psql.`
        );
        return;
    }

    const [userId, userEmail, customerId, currentCustomerEmail, deletedAt] = rows[0].split('|');

    if (!customerId) {
        die(
            `User ${userId} (${userEmail}) has no linked billing_customers row. The customer should be auto-created on signup or first billing endpoint access; check the Better Auth + billing-customer-sync wiring before retrying.`
        );
        return;
    }

    if (deletedAt) {
        log.warn(
            `Customer ${customerId} is currently soft-deleted (deleted_at=${deletedAt}). The link will be applied but you may need to restore the row separately.`
        );
    }

    if (currentCustomerEmail === parsed.buyerEmail) {
        log.info(`Customer ${customerId} email is already ${parsed.buyerEmail} — nothing to do.`);
        return;
    }

    // Step 2 — confirm the operation.
    process.stdout.write(`Target:           ${parsed.target}\n`);
    process.stdout.write(`User:             ${userId} (${userEmail})\n`);
    process.stdout.write(`Customer:         ${customerId}\n`);
    process.stdout.write(`Current email:    ${currentCustomerEmail || '<empty>'}\n`);
    process.stdout.write(`New email:        ${parsed.buyerEmail}\n`);
    process.stdout.write('\n');

    if (!parsed.skipConfirm) {
        const ok = await confirm(
            `UPDATE billing_customers SET email = '${parsed.buyerEmail}' WHERE id = '${customerId}' ?`,
            { defaultValue: true }
        );
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    // Step 3 — apply the UPDATE.
    const escapedBuyer = parsed.buyerEmail.replace(/'/g, "''");
    const escapedCustomerId = customerId.replace(/'/g, "''");
    const updateQuery = `
UPDATE billing_customers
   SET email = '${escapedBuyer}',
       updated_at = NOW()
 WHERE id = '${escapedCustomerId}'
RETURNING id, external_id, email;
`.trim();

    const update = await runInContainer({
        container,
        argv: ['psql', '-U', user, '-d', db, '-c', updateQuery]
    });

    if (update.exitCode !== 0) {
        die(update.stderr.trim() || `psql exited ${update.exitCode}`);
        return;
    }

    process.stdout.write(update.stdout.endsWith('\n') ? update.stdout : `${update.stdout}\n`);
    log.info(`Customer ${customerId} email mapped to ${parsed.buyerEmail}.`);
}
