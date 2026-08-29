/**
 * Thin wrapper over `docker` CLI calls. Auto-detects whether the current
 * shell user has access to the docker socket and prepends `sudo` when
 * needed. All other tools in the toolkit go through this module instead
 * of calling the runner directly so the sudo handling lives in one place.
 */

import { runner } from './runner.ts';

let cachedSudoPrefix: ReadonlyArray<string> | null = null;

/**
 * Returns the prefix array to prepend to every docker invocation:
 * - `[]` when the user can talk to the docker socket directly.
 * - `['sudo']` when the user is not in the `docker` group.
 *
 * Result is cached for the lifetime of the process — docker group
 * membership doesn't change mid-run.
 *
 * Exported so commands that need to call `docker` outside the runner
 * abstraction (notably the streaming pipeline in `logs`, which uses
 * raw `child_process.spawn` to keep the log flow line-by-line) can
 * still respect the sudo decision the rest of the toolkit made.
 */
export async function dockerPrefix(): Promise<ReadonlyArray<string>> {
    if (cachedSudoPrefix !== null) {
        return cachedSudoPrefix;
    }
    const probe = await runner.run(['docker', 'info']);
    cachedSudoPrefix = probe.exitCode === 0 ? [] : ['sudo'];
    return cachedSudoPrefix;
}

/**
 * Run a docker subcommand and return the raw RunResult. Use this for
 * one-off command shapes that don't fit the typed helpers below.
 */
export async function docker(
    args: ReadonlyArray<string>,
    options: Parameters<typeof runner.run>[1] = {}
): ReturnType<typeof runner.run> {
    const prefix = await dockerPrefix();
    return runner.run([...prefix, 'docker', ...args], options);
}

/**
 * Run `docker ps --format <fmt> [--filter <filter>...]` and return the
 * tab-separated rows. Empty result is `[]`, never null.
 */
export async function dockerPs(params: {
    readonly format: string;
    readonly filters?: ReadonlyArray<string>;
}): Promise<ReadonlyArray<string>> {
    const args = ['ps', '--format', params.format];
    for (const f of params.filters ?? []) {
        args.push('--filter', f);
    }
    const result = await docker(args);
    if (result.exitCode !== 0) {
        throw new Error(`docker ps failed: ${result.stderr.trim() || result.stdout.trim()}`);
    }
    return result.stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);
}

/**
 * Inspect a single container by name and return the parsed JSON config
 * labels. Throws if the container does not exist or has no labels.
 */
export async function dockerInspectLabels(
    container: string
): Promise<Readonly<Record<string, string>>> {
    const result = await docker(['inspect', container, '--format', '{{json .Config.Labels}}']);
    if (result.exitCode !== 0) {
        throw new Error(`docker inspect ${container} failed: ${result.stderr.trim()}`);
    }
    const trimmed = result.stdout.trim();
    if (!trimmed || trimmed === 'null') {
        return {};
    }
    return JSON.parse(trimmed) as Readonly<Record<string, string>>;
}

/**
 * Run `docker exec` against a container with the given argv. Defaults
 * to `inherit: false` so callers get back stdout to inspect.
 */
export async function runInContainer(params: {
    readonly container: string;
    readonly argv: ReadonlyArray<string>;
    readonly tty?: boolean;
    readonly inherit?: boolean;
    readonly input?: string;
}): ReturnType<typeof runner.run> {
    const args = ['exec'];
    if (params.tty) {
        args.push('-it');
    } else if (params.input !== undefined) {
        args.push('-i');
    }
    args.push(params.container, ...params.argv);
    return docker(args, { inherit: params.inherit, input: params.input });
}

/**
 * Build the argv for a `docker logs` invocation that merges the
 * container's stderr into its stdout via a `sh -c 'exec docker "$@" 2>&1'`
 * wrapper, instead of running `docker <args>` directly.
 *
 * Why: the API logger sends WARN/ERROR to `console.warn`/`console.error`,
 * which land on the container's stderr. `docker logs` (and this toolkit,
 * before this fix) exposes stdout and stderr as two separate streams —
 * fine for an interactive terminal (both render), but any redirection
 * (`> file`, `| grep`) or non-TTY capture keeps only stdout, silently
 * dropping every WARN/ERROR. Measured on prod: `> file` captured 39,707
 * lines with 0 ERROR/0 WARN; `2>&1 > file` captured 42,931 lines with 3
 * ERROR/3,196 WARN — 3,224 records lost, and the empty-error result reads
 * as "nothing failed" instead of "half the stream was discarded".
 *
 * Concatenating captured stdout + stderr after the fact does not fix
 * this: it would put all of stderr after all of stdout, destroying
 * chronological order. Instead, `2>&1` runs INSIDE the child shell
 * before either stream reaches Node, so the kernel/pipe layer merges
 * them in true write order. `exec` replaces the shell with `docker`,
 * so the wrapper's own exit code IS docker's exit code — no separate
 * propagation logic needed.
 *
 * Security: user-controlled values (container name, `--since` duration,
 * `--tail` count) are passed as trailing positional arguments consumed
 * by the script via `"$@"`, never interpolated into the `-c` string
 * itself. execa/child_process runs `sh` with an explicit argv (no shell
 * parsing on the parent side), so a value like `since: '5m; rm -rf /'`
 * is handed to `docker logs --since` as one opaque argument, not
 * re-parsed as shell source.
 */
export function buildDockerLogsInvocation(params: {
    readonly prefix: ReadonlyArray<string>;
    readonly container: string;
    readonly tail?: number;
    readonly since?: string;
    readonly follow?: boolean;
}): ReadonlyArray<string> {
    const dockerArgs: string[] = ['logs'];
    if (params.follow) dockerArgs.push('-f');
    if (params.since) dockerArgs.push('--since', params.since);
    else if (params.tail !== undefined) dockerArgs.push('--tail', String(params.tail));
    dockerArgs.push(params.container);

    // `sh` after the script string is the $0 sentinel; everything past
    // it becomes "$@" inside the script, per POSIX `sh -c script $0 args...`.
    return [...params.prefix, 'sh', '-c', 'exec docker "$@" 2>&1', 'sh', ...dockerArgs];
}

/**
 * Run `docker logs` with the given options. Streams stdout when
 * `inherit: true` (used by follow mode); otherwise captures. Merges the
 * container's stderr into stdout (see `buildDockerLogsInvocation`) so
 * captured output never silently drops WARN/ERROR lines.
 */
export async function dockerLogs(params: {
    readonly container: string;
    readonly tail?: number;
    readonly since?: string;
    readonly follow?: boolean;
    readonly inherit?: boolean;
}): ReturnType<typeof runner.run> {
    const prefix = await dockerPrefix();
    const argv = buildDockerLogsInvocation({
        prefix,
        container: params.container,
        tail: params.tail,
        since: params.since,
        follow: params.follow
    });
    return runner.run(argv, { inherit: params.inherit });
}
