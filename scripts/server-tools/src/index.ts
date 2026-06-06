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
import { dbMigrate } from './commands/db-migrate.ts';
import { dbMigrateTest } from './commands/db-migrate-test.ts';
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
import { log } from './lib/log.ts';
import { resolveTarget } from './lib/target.ts';

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
     * Run the command. Receives argv WITHOUT the command name (so a
     * call `hops docker-by-name j4luw` arrives here as `['j4luw']`).
     */
    run(argv: ReadonlyArray<string>): Promise<void>;
}

const COMMANDS: ReadonlyArray<Command> = [
    {
        name: 'docker-by-name',
        summary: 'Find a running container by name prefix.',
        run: dockerByName
    },
    {
        name: 'find',
        summary: 'Resolve a container by kind (api / web / admin / postgres / redis).',
        run: findCommand
    },
    {
        name: 'redeploy',
        summary: 'Trigger a Coolify redeploy of api / web / admin.',
        run: redeploy
    },
    {
        name: 'env-list',
        summary: 'List Coolify env vars for an app (redacted by default).',
        run: envList
    },
    {
        name: 'exec',
        summary: 'Run a command (or open a shell) inside an app/postgres/redis container.',
        run: runContainerExec
    },
    {
        name: 'logs',
        summary: 'Tail / follow / grep app logs (api / web / admin).',
        run: logs
    },
    {
        name: 'psql',
        summary: 'Run SQL against the Postgres container (inline / -f / --stdin / interactive).',
        run: psql
    },
    {
        name: 'db-counts',
        summary: 'Approximate row counts for every user table in the Postgres DB.',
        run: dbCounts
    },
    {
        name: 'billing-test-link',
        summary:
            'Map a Hospeda signup user to a MercadoPago test buyer email so the smoke checkout can proceed (staging only).',
        run: billingTestLink
    },
    {
        name: 'billing-test-reset',
        summary:
            'Wipe billing transactional data for a user so a fresh smoke iteration can start (staging only).',
        run: billingTestReset
    },
    {
        name: 'db-backup-now',
        summary: 'Trigger a Postgres backup outside the daily cron and upload to R2.',
        run: dbBackupNow
    },
    {
        name: 'db-restore',
        summary: 'Pick an R2 backup and restore it into the Postgres container (destructive).',
        run: dbRestore
    },
    {
        name: 'db-migrate',
        summary:
            'Apply versioned Drizzle migrations (drizzle-kit migrate) + extras against the target DB.',
        run: dbMigrate
    },
    {
        name: 'db-migrate-test',
        summary:
            'Rehearse pending migrations against a scratch clone of the target DB (non-destructive).',
        run: dbMigrateTest
    },
    {
        name: 'db-seed',
        summary:
            'Run @repo/seed against the target DB (reset+required+example by default; destructive).',
        run: dbSeed
    },
    {
        name: 'db-superadmin-pass',
        summary: 'Reset the super admin credential-account password after a fresh seed.',
        run: dbSuperAdminPass
    },
    {
        name: 'app-restart',
        summary: 'docker restart an app container without going through Coolify redeploy.',
        run: appRestart
    },
    {
        // Convenience alias for `app-restart`. Operators reach for `restart`
        // by muscle memory; advertising both names in the menu avoids the
        // 'why does my command not exist' moment.
        name: 'restart',
        summary: 'Alias for `app-restart` — restart an app container in place.',
        run: appRestart
    },
    {
        name: 'prune',
        summary: 'docker system prune -f — free build cache + dangling images on demand.',
        run: prune
    },
    {
        name: 'r2-lifecycle',
        summary:
            "Manage the R2 bucket's lifecycle rule (delete manual/* after N days). Target-aware.",
        run: r2Lifecycle
    },
    {
        name: 'free-mem',
        summary: 'Host RAM (free -m) + per-container CPU / memory snapshot.',
        run: freeMem
    },
    {
        name: 'health',
        summary: 'Run scripts/smoke-test.sh against prod or staging.',
        run: health
    },
    {
        name: 'env-set',
        summary: 'Upsert a Coolify env var (creates or updates; production by default).',
        run: envSet
    },
    {
        name: 'env-delete',
        summary: 'Delete one or more Coolify env vars by key.',
        run: envDelete
    },
    {
        name: 'env-pull',
        summary: 'Dump Coolify env vars to a local dotenv file (mode 0600).',
        run: envPull
    },
    {
        name: 'update',
        summary: 'git pull the repo and reinstall the hops binary in one step.',
        run: update
    },
    {
        name: 'cron-list',
        summary: 'Numbered list of node-cron jobs registered in the running API process.',
        run: cronList
    },
    {
        name: 'cron-trigger',
        summary: 'Trigger a registered cron job by index, name, or interactive picker.',
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
  --target=<prod|staging>    Pick the target environment for container
                             lookup. Defaults to HOPS_TARGET in .env.local,
                             then 'prod' if neither is set.

Available commands:
${COMMANDS.map((c) => `  ${c.name.padEnd(20)} ${c.summary}`).join('\n')}
`.trim();

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
    const target = COMMANDS.find((c) => c.name === choice);
    if (!target) {
        log.error(`Unknown command: ${String(choice)}`);
        process.exit(1);
    }
    p.outro(`Running ${target.name}…`);
    await target.run([]);
}

async function main(): Promise<void> {
    // Parse the global --target=<env> flag first so every downstream
    // container lookup honours it. The flag is stripped from argv before
    // the command-level parsing sees it.
    const { target, remainingArgv } = resolveTarget(process.argv.slice(2));
    setActiveTarget(target);

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
    await command.run(rest);
}

main().catch((err: unknown) => {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
