/**
 * `hctl exec <kind> [cmd...]` — run a command inside the running
 * container of the given kind. With no command, opens an interactive
 * shell. With `--env <prefix>`, prints env vars whose name starts with
 * the prefix, values redacted.
 *
 * One command instead of three (api / web / admin variants) because
 * the only thing that varies is the target container, and `<kind>`
 * already disambiguates that.
 */

import * as p from '@clack/prompts';
import { type ContainerKind, findContainer } from '../lib/container-lookup.ts';
import { runInContainer } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';

const KINDS: ReadonlyArray<ContainerKind> = ['api', 'web', 'admin', 'postgres', 'redis'];

const HELP = `
hctl exec <kind> [cmd...]
hctl exec <kind> --shell
hctl exec <kind> --env <prefix>

Kinds:
  api          long-running Hono API container
  web          Astro Node SSR container
  admin        TanStack Start admin container
  postgres     Coolify-managed Postgres
  redis        Coolify-managed Redis

Modes:
  hctl exec api node -v               Run an inline command, capture output.
  hctl exec api -- ls /app            Use '--' to separate hctl flags from cmd.
  hctl exec api --shell               Open an interactive sh inside the container.
  hctl exec api --env HOSPEDA_EMAIL_  Print env vars matching the prefix,
                                       values redacted.

Notes:
  --shell and --env are mutually exclusive with an inline cmd.
  Inline commands run with stdio inherited so their output streams to
  your terminal directly. For interactive tools (psql, vim, ...) use
  --shell.
`.trim();

function isKind(value: string): value is ContainerKind {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

export async function runContainerExec(argv: ReadonlyArray<string>): Promise<void> {
    const args = [...argv];

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const [kindRaw, ...rest] = args;
    if (!kindRaw || !isKind(kindRaw)) {
        die(`Unknown kind '${kindRaw ?? ''}'. Known: ${KINDS.join(', ')}.`);
    }

    const container = await findContainer(kindRaw);

    // --shell (interactive)
    if (rest.includes('--shell')) {
        if (rest.length > 1) {
            die('--shell does not accept additional arguments.');
        }
        log.info(`Opening shell inside ${container}`);
        await runInContainer({ container, argv: ['sh'], tty: true, inherit: true });
        return;
    }

    // --env <prefix>
    const envIdx = rest.indexOf('--env');
    if (envIdx >= 0) {
        const prefix = rest[envIdx + 1];
        if (!prefix) {
            die('--env requires a prefix argument.');
        }
        const result = await runInContainer({
            container,
            argv: [
                'sh',
                '-c',
                `printenv | grep -E '^${escapeForGrep(prefix)}' | sed 's|=.*$|=***REDACTED***|' | sort`
            ]
        });
        if (result.failed) {
            // grep returns 1 when no matches — surface that as a clean
            // empty result instead of a scary error.
            if (result.exitCode === 1 && !result.stderr.trim()) {
                log.warn(`No env vars start with '${prefix}'.`);
                return;
            }
            die(result.stderr.trim() || `exit ${result.exitCode}`);
        }
        process.stdout.write(result.stdout);
        return;
    }

    // Inline command — strip a leading '--' separator if present
    // (keeps the UX consistent with `git`, `npm run`, etc.).
    const cmdArgv = rest[0] === '--' ? rest.slice(1) : rest;
    if (cmdArgv.length === 0) {
        // No command + no flag — fall back to interactive picker.
        const choice = await p.select({
            message: 'How do you want to run something?',
            options: [
                { value: 'shell', label: 'Open interactive shell (--shell)' },
                { value: 'env', label: 'Inspect env vars (--env <prefix>)' }
            ]
        });
        if (p.isCancel(choice)) {
            log.warn('Cancelled.');
            return;
        }
        if (choice === 'shell') {
            await runInContainer({ container, argv: ['sh'], tty: true, inherit: true });
        } else {
            const prefix = await p.text({
                message: 'Env var name prefix',
                placeholder: 'e.g. HOSPEDA_'
            });
            if (p.isCancel(prefix) || !prefix) {
                log.warn('Cancelled.');
                return;
            }
            await runContainerExec([kindRaw, '--env', prefix.trim()]);
        }
        return;
    }

    const result = await runInContainer({ container, argv: cmdArgv, inherit: true });
    if (result.exitCode !== 0) {
        process.exit(result.exitCode);
    }
}

/**
 * Escape a string so it can be safely embedded inside a single-quoted
 * grep ERE pattern. Strips characters that have meaning to ERE so the
 * caller's prefix is treated as a literal string.
 */
function escapeForGrep(prefix: string): string {
    return prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
