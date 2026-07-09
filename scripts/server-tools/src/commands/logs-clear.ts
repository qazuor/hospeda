/**
 * `hops logs-clear <kind> [--yes]` — empty the Docker json-log for an app
 * container so an operator can start a clean log capture for testing,
 * without old/unrelated lines mixed in.
 *
 * How it works: Docker's default `json-file` driver appends every stdout
 * line to a host file (the container's `LogPath`). There is no native
 * `docker logs --clear`, so the only way to empty what `hops logs` tails
 * is to truncate that file in place. The container keeps running and
 * writing; only the historical buffer is dropped.
 *
 * Kept as its OWN command rather than a `--clear` flag on `hops logs`
 * deliberately: it is a destructive action and must be impossible to
 * trigger by accident while tailing (e.g. a stray flag on a follow
 * command). Same reasoning as `prune` / `db-restore` living on their own.
 */

import { type ContainerKind, findContainer } from '../lib/container-lookup.ts';
import { docker } from '../lib/docker.ts';
import { die, log } from '../lib/log.ts';
import { confirm } from '../lib/prompt.ts';
import { runner } from '../lib/runner.ts';

/** Only the app containers produce the request/service logs worth wiping. */
const KINDS: ReadonlyArray<ContainerKind> = ['api', 'web', 'admin'];

const HELP = `
hops logs-clear <kind> [--yes]

Empty the Docker json-log for an app container so the next capture starts
clean. Truncates the container's LogPath in place — the container keeps
running; only the historical log buffer is dropped.

Kinds:
  api      long-running Hono API container
  web      Astro Node SSR container
  admin    TanStack Start admin container

Flags:
  --yes         Skip the confirmation prompt (for automation).
  --help, -h    Show this help.

Examples:
  hops --target=staging logs-clear api
  hops --target=staging logs-clear api --yes

Notes:
  - Destructive: the dropped lines are gone (not recoverable). Anything
    already forwarded to Sentry / the app_log_entries DB table is
    unaffected — this only clears the raw container stdout buffer.
  - The LogPath is root-owned (/var/lib/docker/...), so truncation runs
    via sudo unless hops is already running as root.
`.trim();

function isKind(value: string): value is ContainerKind {
    return (KINDS as ReadonlyArray<string>).includes(value);
}

/**
 * Parsed result of the `logs-clear` argv. Pure (no I/O, no process.exit)
 * so it can be unit-tested; `logsClear` turns `showHelp`/`error` into the
 * appropriate side effect.
 */
export interface ParsedLogsClearArgs {
    /** Print help and return (no args, or `--help`/`-h`). */
    readonly showHelp: boolean;
    /** A validation message when the argv is invalid; `undefined` when OK. */
    readonly error?: string;
    /** Resolved container kind when valid. */
    readonly kind?: ContainerKind;
    /** Whether the confirmation prompt should be skipped (`--yes`). */
    readonly skipConfirm: boolean;
}

/**
 * Parse the `logs-clear` argv into a validated, side-effect-free result.
 *
 * @param argv - Arguments WITHOUT the command name.
 * @returns The parsed arguments; `error` is set (rather than thrown) for
 * an unknown kind or flag so the caller controls how to report it.
 */
export function parseLogsClearArgs(argv: ReadonlyArray<string>): ParsedLogsClearArgs {
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
        return { showHelp: true, skipConfirm: false };
    }

    const kindRaw = argv[0];
    if (!kindRaw || !isKind(kindRaw)) {
        return {
            showHelp: false,
            skipConfirm: false,
            error: `Unknown kind '${kindRaw ?? ''}'. Known: ${KINDS.join(', ')}.`
        };
    }

    let skipConfirm = false;
    for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--yes') {
            skipConfirm = true;
        } else {
            return {
                showHelp: false,
                skipConfirm: false,
                error: `Unknown argument: ${a} (try --help)`
            };
        }
    }

    return { showHelp: false, skipConfirm, kind: kindRaw };
}

export async function logsClear(argv: ReadonlyArray<string>): Promise<void> {
    const parsed = parseLogsClearArgs(argv);

    if (parsed.showHelp) {
        process.stdout.write(`${HELP}\n`);
        return;
    }
    if (parsed.error !== undefined || parsed.kind === undefined) {
        die(parsed.error ?? 'Invalid arguments (try --help).');
    }

    const kind = parsed.kind;
    const skipConfirm = parsed.skipConfirm;
    const container = await findContainer(kind);

    // Resolve the host path Docker appends this container's stdout to.
    const inspect = await docker(['inspect', container, '--format', '{{.LogPath}}']);
    if (inspect.exitCode !== 0) {
        die(
            `docker inspect ${container} failed: ${inspect.stderr.trim() || `exit ${inspect.exitCode}`}`
        );
    }
    const logPath = inspect.stdout.trim();
    if (!logPath || logPath === '<no value>') {
        die(
            `Could not resolve a LogPath for '${container}'. Its logging driver is probably not 'json-file' (e.g. journald/local), which this command cannot truncate.`
        );
    }

    log.info(`Container: ${container}`);
    log.info(`LogPath:   ${logPath}`);

    if (!skipConfirm) {
        const ok = await confirm(`Empty the log buffer for '${container}'? This cannot be undone.`);
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    // The json-log is root:root — truncation needs root. Reuse sudo unless
    // we are already uid 0. inherit:true so sudo can prompt for a password
    // on the operator's terminal if the host requires one.
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const truncateArgv = isRoot
        ? ['truncate', '-s', '0', logPath]
        : ['sudo', 'truncate', '-s', '0', logPath];

    const result = await runner.run(truncateArgv, { inherit: true });
    if (result.exitCode !== 0) {
        die(`Failed to truncate ${logPath}: exit ${result.exitCode}`);
    }

    log.ok(`Cleared logs for '${container}'. Start a fresh capture with: hops logs ${kind} -f`);
}
