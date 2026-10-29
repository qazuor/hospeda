import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import type { ReadOnlyClient } from './known-ids.ts';
import { openStagingCopy, VAR_STAGING_DB } from './rehearsal-copy-db.ts';
import type { EmailRewriteReport } from './rehearsal-email-rewrite.ts';
import { EmailRewriteError, runEmailRewrite } from './rehearsal-email-rewrite.ts';
import { assertStagingTarget, EnvironmentRefusal } from './staging-sandbox-guards.ts';

/** Exit codes: 0 clean (`ok` or `dry-run`), 1 failure (nothing written), 2 usage error or refusal. */
const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_REFUSED = 2;

const USAGE = 'usage: cli-rehearsal-emails.ts --target=staging [--confirm]';

/** Everything the CLI touches outside itself, injected so the wiring is testable without a database. */
export interface RehearsalEmailsCliDeps {
    readonly args: readonly string[];
    readonly session: Readonly<Record<string, string | undefined>>;
    /** Opens a WRITABLE session (`connectWritable` in production). */
    readonly connectDb: (input: { readonly connectionString: string }) => Promise<ReadOnlyClient>;
    /** Per-run salt of the hash. Defaults to 32 random bytes. */
    readonly salt?: () => string;
    readonly out: (line: string) => void;
    readonly err: (line: string) => void;
}

/** Prints the count report: counts and column names, never an address. */
function printReport({
    report,
    out
}: {
    readonly report: EmailRewriteReport;
    readonly out: (line: string) => void;
}): void {
    out(
        `${report.mode}: outcome=${report.outcome} columnsScanned=${report.columnsScanned} columnsWithEmails=${report.columns.length} rows=${report.totals.rows} whole=${report.totals.whole} embedded=${report.totals.embedded} remaining=${report.remainingRows}`
    );
    for (const c of report.columns) out(`  ${c.column}: whole=${c.whole} embedded=${c.embedded}`);
}

/**
 * Entry logic of `cli-rehearsal-emails.ts` (G2 of HOS-1957): rewrites every email of the rehearsal
 * copy to the reserved `example.invalid` domain (`REHEARSAL_DOMAIN`).
 *
 * Order, fail-closed and before any write: `--target=staging`, the database session variable, the
 * database answers as staging's (`current_database()` and `current_user`). A dry run unless
 * `--confirm` is given.
 *
 * @param deps - arguments, session and injected dependencies
 * @returns the process exit code
 */
export async function runRehearsalEmailsCli(deps: RehearsalEmailsCliDeps): Promise<number> {
    const { err, out } = deps;
    let values: { readonly target?: string; readonly confirm?: boolean };
    try {
        values = parseArgs({
            args: [...deps.args],
            options: { target: { type: 'string' }, confirm: { type: 'boolean' } },
            strict: true,
            allowPositionals: false
        }).values;
    } catch {
        err(USAGE);
        return EXIT_REFUSED;
    }

    let client: ReadOnlyClient;
    try {
        assertStagingTarget({ target: values.target });
        const connectionString = deps.session[VAR_STAGING_DB];
        if (!connectionString) {
            throw new EnvironmentRefusal({
                message: `${VAR_STAGING_DB} must be set in the session; refusing to run`
            });
        }
        client = await openStagingCopy({ connectionString, connectDb: deps.connectDb });
    } catch (error) {
        err(
            error instanceof EnvironmentRefusal
                ? error.message
                : 'could not prove the target; refusing to run'
        );
        return EXIT_REFUSED;
    }

    try {
        const report = await runEmailRewrite({
            mode: values.confirm === true ? 'confirm' : 'dry-run',
            client,
            salt: (deps.salt ?? (() => randomBytes(32).toString('hex')))()
        });
        printReport({ report, out });
        return EXIT_OK;
    } catch (error) {
        err(
            error instanceof EmailRewriteError
                ? error.message
                : `run failed (${error instanceof Error ? error.name : 'unknown'}); nothing was written`
        );
        return EXIT_FAILED;
    } finally {
        await client.end().catch(() => undefined);
    }
}
