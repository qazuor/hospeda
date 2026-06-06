/**
 * `hops db-superadmin-pass` — reset the super admin credential-account
 * password after a fresh seed.
 *
 * The seed generates a random password visible only in seed logs. After
 * running `hops db-seed` on a VPS you typically want to set a known,
 * strong password so the super admin can log in. This command does that
 * without requiring Node/pnpm on the operator's laptop — it runs entirely
 * on the VPS through `docker exec psql` (same mechanism as `hops psql`).
 *
 * DB table involved: `account` (Better Auth credential accounts).
 * Column: `password` — bcrypt hash (text). The row must already exist
 * (created by the seed). If the users row is missing the command dies
 * with an actionable message to run the seed first.
 *
 * Security notes:
 *   - The plaintext password is NEVER logged, stored in a file, or
 *     interpolated into a shell command argument.
 *   - SQL is delivered via stdin to `psql` (docker exec -i), not via
 *     the -c flag, so the hash (which contains `$` characters) is never
 *     exposed in the process list.
 *   - `--generate` prints the password exactly ONCE to stdout in a
 *     clearly labelled block. The operator is responsible for storing it.
 *
 * Bcrypt rounds:
 *   The seed uses 10 rounds (bcryptjs default, fast for seeding). This
 *   command uses 12 rounds to match Better Auth's runtime configuration
 *   in `apps/api/src/lib/auth.ts` (BCRYPT_SALT_ROUNDS=12). Operator-set
 *   passwords go through the same hash strength as passwords changed via
 *   the UI — intentional.
 */

import { randomBytes } from 'node:crypto';
import * as p from '@clack/prompts';
import { hash } from 'bcryptjs';
import { findContainer, getActiveTarget } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';
import { getDbCredentials } from '../lib/target.ts';

/**
 * Better Auth uses 12 salt rounds at runtime (apps/api/src/lib/auth.ts).
 * The seed uses 10 rounds for speed. This command matches Better Auth so
 * operator-set passwords are indistinguishable from UI-changed ones.
 */
const BCRYPT_ROUNDS = 12;

/** Minimum password length enforced by this command. */
const MIN_PASSWORD_LENGTH = 12;

const HELP = `
hops db-superadmin-pass [--target=prod|staging]
                        [--email=<email>]
                        [--generate]
                        [--yes]

Reset the super admin credential account password in the target database.

The seed creates the super admin with a random password visible only in
seed logs. Use this command to set a known password afterwards.

Flags:
  --email=<email>    Super admin email (default: superadmin@hospeda.com).
  --generate         Generate a cryptographically strong 24-byte base64url
                     password and print it ONCE to stdout. Use this flag
                     when you want a strong random password but don't want
                     to come up with one yourself.
                     Without --generate, the command prompts for the
                     password interactively with hidden input (asked twice
                     for confirmation) and enforces a minimum of 12 chars.
  --yes              Skip the prod confirmation prompt. Does NOT affect the
                     password input step.
  --help, -h         Show this help.

How it works:
  1. Locate the target Postgres container.
  2. Verify the user row exists in the 'users' table.
  3. Hash the password with bcrypt (12 rounds — matches Better Auth runtime).
  4. UPDATE the 'account' row (provider_id='credential') with the new hash
     via psql fed through stdin (never interpolated into shell args).
     If no credential account row exists, INSERT a new one.
  5. Report success.

Examples:
  hops db-superadmin-pass --target=staging --generate
  hops db-superadmin-pass --target=prod --yes --generate
  hops db-superadmin-pass --target=staging --email=admin@example.com

Required environment variables (in scripts/server-tools/.env.local):
  HOPS_<TARGET>_POSTGRES_UUID    Coolify Postgres service UUID for the target.
`.trim();

/** Default super admin email matching the seed fixture. */
const DEFAULT_EMAIL = 'superadmin@hospeda.com';

export interface ParsedSuperAdminPassArgs {
    readonly email: string;
    readonly generate: boolean;
    readonly skipConfirm: boolean;
}

/**
 * Parse argv for db-superadmin-pass.
 *
 * @param argv - Command argv with --target already stripped by the top-level dispatcher.
 * @returns Parsed arguments.
 */
export function parseSuperAdminPassArgs(argv: ReadonlyArray<string>): ParsedSuperAdminPassArgs {
    let email = DEFAULT_EMAIL;
    for (const token of argv) {
        if (token.startsWith('--email=')) {
            email = token.slice('--email='.length);
        } else if (token === '--email') {
            // Two-token form is not supported for this flag; require =.
            die('Use --email=<address> (not --email <address>).');
        }
    }
    return {
        email,
        generate: argv.includes('--generate'),
        skipConfirm: argv.includes('--yes')
    };
}

/**
 * Generate a cryptographically strong random password.
 * Uses 24 bytes of crypto.randomBytes encoded as base64url (32 chars, URL-safe).
 *
 * @returns 32-character base64url string.
 */
export function generateRandomPassword(): string {
    return randomBytes(24).toString('base64url');
}

/**
 * Validate a password against the minimum length requirement.
 *
 * @param password - The password to validate.
 * @returns null if valid, or an error message string if not.
 */
export function validatePasswordLength(password: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters (got ${password.length}).`;
    }
    return null;
}

/**
 * Escape a string for use in a SQL single-quoted literal by doubling
 * any single-quote characters. The result is safe to splice into a
 * `WHERE email = '<result>'` clause.
 *
 * @param value - The raw string value.
 * @returns SQL-safe single-quoted literal content (without the outer quotes).
 */
export function escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Prompt for a password twice (hidden input) and return it once confirmed.
 * Loops until both entries match and the length requirement is met.
 *
 * @returns The confirmed password.
 */
async function promptForPassword(): Promise<string> {
    for (;;) {
        const first = await p.password({ message: 'New password (min 12 chars, hidden):' });
        if (p.isCancel(first)) {
            log.warn('Cancelled.');
            process.exit(0);
        }
        const lengthError = validatePasswordLength(first);
        if (lengthError) {
            log.warn(lengthError);
            continue;
        }

        const second = await p.password({ message: 'Confirm password:' });
        if (p.isCancel(second)) {
            log.warn('Cancelled.');
            process.exit(0);
        }
        if (first !== second) {
            log.warn('Passwords do not match. Try again.');
            continue;
        }
        return first;
    }
}

/**
 * Apply the hashed password to the target database via docker exec psql.
 * The SQL is delivered via stdin so the bcrypt hash (which contains `$`)
 * is never exposed in a shell argument or process list.
 *
 * Does a LOOKUP for the user row first; dies with an actionable message
 * if the user is not found (seed has not run yet). Then does an
 * INSERT ... ON CONFLICT DO UPDATE on the account row.
 *
 * @param params - Container, credentials, email, and the bcrypt hash.
 */
async function applyPasswordHash(params: {
    readonly container: string;
    readonly user: string;
    readonly db: string;
    readonly email: string;
    readonly bcryptHash: string;
}): Promise<void> {
    const safeEmail = escapeSqlString(params.email);

    // Step 1: verify the user row exists and get its id.
    // We need the userId to build the account upsert.
    const lookupSql = `SELECT id FROM users WHERE email = '${safeEmail}' AND deleted_at IS NULL LIMIT 1;`;
    const lookupResult = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', params.db, '-t', '-A'],
        input: lookupSql
    });

    if (lookupResult.exitCode !== 0) {
        die(
            `psql lookup failed (exit ${lookupResult.exitCode}): ${lookupResult.stderr.trim() || lookupResult.stdout.trim()}`
        );
    }

    const userId = lookupResult.stdout.trim();
    if (!userId) {
        die(
            `No user found with email '${params.email}' in the '${params.db}' database. Run the seed first (\`hops db-seed\`), then retry.`
        );
    }

    log.info(`Found user ID: ${userId.slice(0, 8)}...`);

    // Step 2: upsert the credential account row.
    // The account table has NO unique constraint on (user_id, provider_id) —
    // only the id PK. We therefore use an INSERT-WHERE-NOT-EXISTS pattern to
    // avoid inserting a duplicate, followed by an UPDATE that covers both the
    // new row and any pre-existing one. Both statements run in the same psql
    // batch and are idempotent together.
    //
    // account_id is set to user_id, mirroring packages/seed/src/utils/superAdminLoader.ts
    // (the seed that creates the row Better Auth logs in against).
    //
    // The bcrypt hash is spliced in as a single-quoted SQL literal. The hash
    // alphabet is base64url + '$', which contains no single-quotes, so
    // escapeSqlString is a no-op here — applied for defense-in-depth.
    const safeUserId = escapeSqlString(userId);
    const safeHash = escapeSqlString(params.bcryptHash);
    const now = new Date().toISOString();

    const upsertSql = [
        'INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)',
        `SELECT gen_random_uuid()::text, '${safeUserId}', 'credential', '${safeUserId}',`,
        `       '${safeHash}', '${now}', '${now}'`,
        'WHERE NOT EXISTS (',
        '  SELECT 1 FROM account',
        `  WHERE user_id = '${safeUserId}' AND provider_id = 'credential'`,
        ');',
        'UPDATE account',
        `SET password = '${safeHash}', updated_at = '${now}'`,
        `WHERE user_id = '${safeUserId}' AND provider_id = 'credential';`
    ].join('\n');

    const upsertResult = await runInContainer({
        container: params.container,
        argv: ['psql', '-U', params.user, '-d', params.db],
        input: upsertSql
    });

    if (upsertResult.exitCode !== 0) {
        die(
            `Password update failed (exit ${upsertResult.exitCode}): ` +
                `${upsertResult.stderr.trim() || upsertResult.stdout.trim()}`
        );
    }

    // psql echoes "INSERT 0 1" or "UPDATE 1" on success. Log the output as hints.
    for (const line of upsertResult.stdout.trim().split('\n')) {
        if (line.trim()) {
            log.hint(line.trim());
        }
    }
}

export async function dbSuperAdminPass(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseSuperAdminPassArgs(argv);
    const target = getActiveTarget();

    log.info(`Target  : ${target}`);
    log.info(`Email   : ${parsed.email}`);
    log.info(`Mode    : ${parsed.generate ? 'generate (random password)' : 'interactive prompt'}`);

    // Prod safety gate.
    if (target === 'prod' && !parsed.skipConfirm) {
        const ok = await confirm('Update super admin password on PRODUCTION?', {
            defaultValue: false
        });
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    // Resolve or prompt for the password.
    let plainPassword: string;
    if (parsed.generate) {
        plainPassword = generateRandomPassword();
        // Print ONCE to stdout (not stderr) so it can be captured if needed.
        // All other output goes to stderr via log.*.
        process.stdout.write(`\n  Generated password: ${plainPassword}\n\n`);
        log.warn('Save this password now — it will NOT be shown again.');
    } else {
        p.intro('Set super admin password');
        plainPassword = await promptForPassword();
    }

    // Hash the password at Better Auth's strength (12 rounds).
    log.info(`Hashing password (bcrypt, ${BCRYPT_ROUNDS} rounds)...`);
    const bcryptHash = await hash(plainPassword, BCRYPT_ROUNDS);
    log.ok('Password hashed.');

    // Locate the container and apply the hash.
    const container = await findContainer('postgres');
    const credentials = getDbCredentials(target);

    log.info(`Container: ${container}`);
    log.info(`DB       : ${credentials.user}@${credentials.database}`);

    await applyPasswordHash({
        container,
        user: credentials.user,
        db: credentials.database,
        email: parsed.email,
        bcryptHash
    });

    log.ok(`Super admin password updated for '${parsed.email}' on ${target}.`);
    log.hint('The new password is effective immediately — no container restart needed.');
}
