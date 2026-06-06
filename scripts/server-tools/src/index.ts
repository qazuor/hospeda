/**
 * `hops` entrypoint. Either dispatches a sub-command from argv or, when
 * called with no arguments, opens the interactive @clack menu so the
 * operator can pick a command, fill in any required parameters, and
 * execute — without memorising tool names.
 *
 * Sub-command implementations live in `src/commands/*.ts` and export a
 * uniform shape: `{ name, summary, run(argv): Promise<void> }`. The
 * registry below is the single source of truth for which commands are
 * shipped — adding a new command is one import + one entry.
 *
 * ## Target policy
 *
 * Every command declares a `targetPolicy` that controls how the global
 * `--target=<env>` flag (and `HOPS_DEFAULT_TARGET` env var) are enforced:
 *
 *   - `'none'`             The command has no prod/staging concept (e.g.
 *                          `update`, `free-mem`). A `--target` flag on the
 *                          command line is still stripped, but no target is
 *                          required and none is set.
 *
 *   - `'default-ok'`       Read-only or low-risk commands. The target may
 *                          come from `--target=`, `HOPS_DEFAULT_TARGET`, or
 *                          an interactive prompt. When `HOPS_DEFAULT_TARGET`
 *                          decides the target it is logged loudly so the
 *                          operator always knows which environment they hit.
 *
 *   - `'explicit-required'` Destructive/write commands. The `--target=` flag
 *                          is MANDATORY; `HOPS_DEFAULT_TARGET` is deliberately
 *                          ignored. Missing flag → die() with an actionable
 *                          message.
 */

import * as p from '@clack/prompts';
import { appRestart } from './commands/app-restart.ts';
import { billingTestLink } from './commands/billing-test-link.ts';
import { billingTestReset } from './commands/billing-test-reset.ts';
import { runContainerExec } from './commands/container-exec.ts';
import { cronList } from './commands/cron-list.ts';
import { cronTrigger } from './commands/cron-trigger.ts';
import { dbBackupNow } from './commands/db-backup-now.ts';
import { dbCounts } from './commands/db-counts.ts';
import { dbMigrateTest } from './commands/db-migrate-test.ts';
import { dbMigrate } from './commands/db-migrate.ts';
import { dbRestore } from './commands/db-restore.ts';
import { dbSeed } from './commands/db-seed.ts';
import { dbSuperAdminPass } from './commands/db-superadmin-pass.ts';
import { dockerByName } from './commands/docker-by-name.ts';
import { envDelete } from './commands/env-delete.ts';
import { envList } from './commands/env-list.ts';
import { envPull } from './commands/env-pull.ts';
import { envSet } from './commands/env-set.ts';
import { findCommand } from './commands/find.ts';
import { freeMem } from './commands/free-mem.ts';
import { health } from './commands/health.ts';
import { logs } from './commands/logs.ts';
import { prune } from './commands/prune.ts';
import { psql } from './commands/psql.ts';
import { r2Lifecycle } from './commands/r2-lifecycle.ts';
import { redeploy } from './commands/redeploy.ts';
import { update } from './commands/update.ts';
import { setActiveTarget } from './lib/container-lookup.ts';
import { die, log } from './lib/log.ts';
import { evaluateTargetPolicy } from './lib/target-policy.ts';
import { type Target, type TargetPolicy, type TargetSource, resolveTarget } from './lib/target.ts';

/**
 * Toolkit version. MUST stay in sync with `scripts/server-tools/package.json`
 * `version` field — they are bumped together. We do not import from
 * package.json at runtime because `bun build --compile` produces a standalone
 * binary and JSON imports add a bundler-specific code path; hardcoding the
 * string is the simpler contract.
 */
const VERSION = '1.1.0';

interface Command {
    /** kebab-case name; matches the CLI invocation. */
    readonly name: string;
    /** One-line summary shown in the interactive menu. */
    readonly summary: string;
    /**
     * Target policy for this command. Controls whether `--target=` is
     * required, optional, or irrelevant. See module-level JSDoc for details.
     */
    readonly targetPolicy: TargetPolicy;
    /**
     * Run the command. Receives argv WITHOUT the command name (so a
     * call `hops docker-by-name j4luw` arrives here as `['j4luw']`).
     */
    run(argv: ReadonlyArray<string>): Promise<void>;
}

const COMMANDS: ReadonlyArray<Command> = [
    {
        name: 'docker-by-name',
        summary: 'Find a running container by name prefix.',
        // Searches by name prefix — no prod/staging discrimination needed.
        targetPolicy: 'none',
        run: dockerByName
    },
    {
        name: 'find',
        summary: 'Resolve a container by kind (api / web / admin / postgres / redis).',
        // Read-only lookup; safe with env default.
        targetPolicy: 'default-ok',
        run: findCommand
    },
    {
        name: 'redeploy',
        summary: 'Trigger a Coolify redeploy of api / web / admin.',
        // Triggers a production build+deploy pipeline — write operation.
        targetPolicy: 'explicit-required',
        run: redeploy
    },
    {
        name: 'env-list',
        summary: 'List Coolify env vars for an app (redacted by default).',
        // Read-only; safe with env default.
        targetPolicy: 'default-ok',
        run: envList
    },
    {
        name: 'exec',
        summary: 'Run a command (or open a shell) inside an app/postgres/redis container.',
        // Could run arbitrary commands; treated as explicit-required because the
        // operator must know which environment they are exec-ing into.
        targetPolicy: 'explicit-required',
        run: runContainerExec
    },
    {
        name: 'logs',
        summary: 'Tail / follow / grep app logs (api / web / admin).',
        // Read-only log streaming; safe with env default.
        targetPolicy: 'default-ok',
        run: logs
    },
    {
        name: 'psql',
        summary: 'Run SQL against the Postgres container (inline / -f / --stdin / interactive).',
        // Can issue any SQL including writes. Operator sees the exact
        // connection details they are connecting to before acting.
        targetPolicy: 'explicit-required',
        run: psql
    },
    {
        name: 'db-counts',
        summary: 'Approximate row counts for every user table in the Postgres DB.',
        // Pure SELECT; safe with env default.
        targetPolicy: 'default-ok',
        run: dbCounts
    },
    {
        name: 'billing-test-link',
        summary:
            'Map a Hospeda signup user to a MercadoPago test buyer email so the smoke checkout can proceed (staging only).',
        // Updates billing_customers — write operation.
        targetPolicy: 'explicit-required',
        run: billingTestLink
    },
    {
        name: 'billing-test-reset',
        summary:
            'Wipe billing transactional data for a user so a fresh smoke iteration can start (staging only).',
        // Deletes rows across many billing tables — write/destroy operation.
        targetPolicy: 'explicit-required',
        run: billingTestReset
    },
    {
        name: 'db-backup-now',
        summary: 'Trigger a Postgres backup outside the daily cron and upload to R2.',
        // Creates a backup; read-only on the DB, writes to R2. Safe with env default.
        targetPolicy: 'default-ok',
        run: dbBackupNow
    },
    {
        name: 'db-restore',
        summary: 'Pick an R2 backup and restore it into the Postgres container (destructive).',
        // Replaces every object in the target database — most destructive op.
        targetPolicy: 'explicit-required',
        run: dbRestore
    },
    {
        name: 'db-migrate',
        summary:
            'Apply versioned Drizzle migrations (drizzle-kit migrate) + extras against the target DB.',
        // Modifies the database schema — write/destructive operation.
        targetPolicy: 'explicit-required',
        run: dbMigrate
    },
    {
        name: 'db-migrate-test',
        summary:
            'Rehearse pending migrations against a scratch clone of the target DB (non-destructive).',
        // Creates a temporary scratch DB from a dump then drops it.
        // Only reads the live DB; safe with env default.
        targetPolicy: 'default-ok',
        run: dbMigrateTest
    },
    {
        name: 'db-seed',
        summary:
            'Run @repo/seed against the target DB (reset+required+example by default; destructive).',
        // Wipes and repopulates the target DB — highly destructive.
        targetPolicy: 'explicit-required',
        run: dbSeed
    },
    {
        name: 'db-superadmin-pass',
        summary: 'Reset the super admin credential-account password after a fresh seed.',
        // Updates bcrypt password hash in the account table — write operation.
        targetPolicy: 'explicit-required',
        run: dbSuperAdminPass
    },
    {
        name: 'app-restart',
        summary: 'docker restart an app container without going through Coolify redeploy.',
        // Interrupts a running production/staging service.
        targetPolicy: 'explicit-required',
        run: appRestart
    },
    {
        // Convenience alias for `app-restart`. Operators reach for `restart`
        // by muscle memory; advertising both names in the menu avoids the
        // 'why does my command not exist' moment.
        name: 'restart',
        summary: 'Alias for `app-restart` — restart an app container in place.',
        targetPolicy: 'explicit-required',
        run: appRestart
    },
    {
        name: 'prune',
        summary: 'docker system prune -f — free build cache + dangling images on demand.',
        // Operates on the local docker daemon — no prod/staging concept.
        targetPolicy: 'none',
        run: prune
    },
    {
        name: 'r2-lifecycle',
        summary:
            "Manage the R2 bucket's lifecycle rule (delete manual/* after N days). Target-aware.",
        // `set` mutates the bucket lifecycle config — treat the whole command as
        // explicit-required since both subcommands depend on a target.
        targetPolicy: 'explicit-required',
        run: r2Lifecycle
    },
    {
        name: 'free-mem',
        summary: 'Host RAM (free -m) + per-container CPU / memory snapshot.',
        // Host-level snapshot; no prod/staging concept.
        targetPolicy: 'none',
        run: freeMem
    },
    {
        name: 'health',
        summary: 'Run scripts/smoke-test.sh against prod or staging.',
        // Takes prod|staging as its OWN positional argument, not via --target.
        // The global flag is irrelevant here.
        targetPolicy: 'none',
        run: health
    },
    {
        name: 'env-set',
        summary: 'Upsert a Coolify env var.',
        // Creates or updates env vars in Coolify — write operation.
        targetPolicy: 'explicit-required',
        run: envSet
    },
    {
        name: 'env-delete',
        summary: 'Delete one or more Coolify env vars by key.',
        // Permanently removes env var entries in Coolify — write/destroy operation.
        targetPolicy: 'explicit-required',
        run: envDelete
    },
    {
        name: 'env-pull',
        summary: 'Dump Coolify env vars to a local dotenv file (mode 0600).',
        // Read-only from Coolify; writes a local file only. Safe with env default.
        targetPolicy: 'default-ok',
        run: envPull
    },
    {
        name: 'update',
        summary: 'git pull the repo and reinstall the hops binary in one step.',
        // Local git + installer operation; no prod/staging concept.
        targetPolicy: 'none',
        run: update
    },
    {
        name: 'cron-list',
        summary: 'Numbered list of node-cron jobs registered in the running API process.',
        // Read-only HTTP GET against the admin API; safe with env default.
        targetPolicy: 'default-ok',
        run: cronList
    },
    {
        name: 'cron-trigger',
        summary: 'Trigger a registered cron job by index, name, or interactive picker.',
        // Fires a real job on the API (may write data, send emails, etc.).
        targetPolicy: 'explicit-required',
        run: cronTrigger
    }
];

const TOP_LEVEL_HELP = `
hops — Hospeda server-tools CLI.

Usage:
  hops                       Open the interactive command picker.
  hops <command> [args]      Run a command directly.
  hops <command> --help      Help for a single command.
  hops --help, -h            Show this help.
  hops --version, -v         Print version and exit.

Global flags (apply to every command):
  --target=<prod|staging>    Pick the target environment. Required for all
                             write/destructive commands (explicit-required
                             policy). Optional for read-only commands —
                             falls back to HOPS_DEFAULT_TARGET in .env.local,
                             then prompts interactively if neither is set.
                             Has no effect on commands with no target concept.

Available commands:
${COMMANDS.map((c) => `  ${c.name.padEnd(20)} ${c.summary}`).join('\n')}
`.trim();

/**
 * Prompt the operator to choose a target interactively.
 * Used when a command needs a target but neither `--target` nor
 * `HOPS_DEFAULT_TARGET` was provided.
 *
 * @returns The chosen target, or exits the process if the operator cancels.
 */
async function promptForTarget(): Promise<Target> {
    const choice = await p.select({
        message: 'Pick a target environment',
        options: [
            { value: 'staging', label: 'staging', hint: 'hospeda-*-staging containers' },
            { value: 'prod', label: 'prod', hint: 'hospeda-*-prod containers (production)' }
        ]
    });
    if (p.isCancel(choice)) {
        p.cancel('Cancelled.');
        process.exit(0);
    }
    return choice as Target;
}

/**
 * Apply the target policy for the dispatched command and return the
 * resolved target, or `undefined` for commands with `policy === 'none'`.
 *
 * Uses {@link evaluateTargetPolicy} to produce a decision object, then
 * executes the appropriate side effect (die, prompt, warn+run, or skip).
 *
 * @param command     The command whose policy to enforce.
 * @param resolved    The target resolved from argv/env (may be `undefined`).
 * @param source      Where the target value came from.
 * @param interactive Whether the CLI is in interactive (menu) mode.
 */
async function applyTargetPolicy(
    command: Command,
    resolved: Target | undefined,
    source: TargetSource,
    interactive: boolean
): Promise<Target | undefined> {
    const decision = evaluateTargetPolicy({
        policy: command.targetPolicy,
        commandName: command.name,
        target: resolved,
        source,
        interactive
    });

    switch (decision.action) {
        case 'skip':
            return undefined;

        case 'run':
            if (decision.warn) {
                log.warn(`target: ${decision.target} (from HOPS_DEFAULT_TARGET)`);
            }
            return decision.target;

        case 'prompt':
            return await promptForTarget();

        case 'die':
            die(decision.message);
    }
}

async function interactivePicker(): Promise<void> {
    p.intro('Hospeda server-tools');
    const choice = await p.select({
        message: 'Choose a command',
        options: COMMANDS.map((c) => ({ value: c.name, label: c.name, hint: c.summary }))
    });
    if (p.isCancel(choice)) {
        p.cancel('Cancelled.');
        process.exit(0);
    }
    const command = COMMANDS.find((c) => c.name === choice);
    if (!command) {
        log.error(`Unknown command: ${String(choice)}`);
        process.exit(1);
    }
    p.outro(`Running ${command.name}…`);

    // In the interactive picker the operator has already made an explicit
    // human choice of which command to run. Passing interactive=true allows
    // applyTargetPolicy to prompt for the target rather than dying, which
    // is correct: a human pick in a menu session counts as explicit intent.
    const activeTarget = await applyTargetPolicy(command, undefined, 'none', true);
    if (activeTarget !== undefined) {
        setActiveTarget(activeTarget);
    }

    await command.run([]);
}

async function main(): Promise<void> {
    // Parse the global --target=<env> flag first so every downstream
    // container lookup honours it. The flag is stripped from argv before
    // the command-level parsing sees it.
    const { target, source, remainingArgv } = resolveTarget(process.argv.slice(2));

    const [first, ...rest] = remainingArgv;

    if (!first) {
        await interactivePicker();
        return;
    }

    if (first === '--help' || first === '-h') {
        process.stdout.write(`${TOP_LEVEL_HELP}\n`);
        return;
    }

    if (first === '--version' || first === '-v') {
        process.stdout.write(`${VERSION}\n`);
        return;
    }

    const command = COMMANDS.find((c) => c.name === first);
    if (!command) {
        log.error(`Unknown command: ${first}`);
        process.stderr.write(`\n${TOP_LEVEL_HELP}\n`);
        process.exit(1);
    }

    // Enforce the target policy BEFORE running the command.
    // interactive=false: argv dispatch is non-interactive; die on missing target.
    const activeTarget = await applyTargetPolicy(command, target, source, false);
    if (activeTarget !== undefined) {
        setActiveTarget(activeTarget);
    }

    await command.run(rest);
}

main().catch((err: unknown) => {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
