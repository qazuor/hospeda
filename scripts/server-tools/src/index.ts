/**
 * `hctl` entrypoint. Either dispatches a sub-command from argv or, when
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
import { runContainerExec } from './commands/container-exec.ts';
import { dockerByName } from './commands/docker-by-name.ts';
import { envList } from './commands/env-list.ts';
import { findCommand } from './commands/find.ts';
import { logs } from './commands/logs.ts';
import { psql } from './commands/psql.ts';
import { redeploy } from './commands/redeploy.ts';
import { log } from './lib/log.ts';

interface Command {
    /** kebab-case name; matches the CLI invocation. */
    readonly name: string;
    /** One-line summary shown in the interactive menu. */
    readonly summary: string;
    /**
     * Run the command. Receives argv WITHOUT the command name (so a
     * call `hctl docker-by-name j4luw` arrives here as `['j4luw']`).
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
    }
];

const TOP_LEVEL_HELP = `
hctl — Hospeda server-tools CLI.

Usage:
  hctl                       Open the interactive command picker.
  hctl <command> [args]      Run a command directly.
  hctl <command> --help      Help for a single command.
  hctl --help, -h            Show this help.

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
    const [first, ...rest] = process.argv.slice(2);

    if (!first) {
        await interactivePicker();
        return;
    }

    if (first === '--help' || first === '-h') {
        process.stdout.write(`${TOP_LEVEL_HELP}\n`);
        return;
    }

    const target = COMMANDS.find((c) => c.name === first);
    if (!target) {
        log.error(`Unknown command: ${first}`);
        process.stderr.write(`\n${TOP_LEVEL_HELP}\n`);
        process.exit(1);
    }
    await target.run(rest);
}

main().catch((err: unknown) => {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
