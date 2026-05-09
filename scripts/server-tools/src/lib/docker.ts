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
 */
async function dockerPrefix(): Promise<ReadonlyArray<string>> {
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
 * Run `docker logs` with the given options. Streams stdout when
 * `inherit: true` (used by follow mode); otherwise captures.
 */
export async function dockerLogs(params: {
    readonly container: string;
    readonly tail?: number;
    readonly since?: string;
    readonly follow?: boolean;
    readonly inherit?: boolean;
}): ReturnType<typeof runner.run> {
    const args = ['logs'];
    if (params.follow) args.push('-f');
    if (params.since) args.push('--since', params.since);
    else if (params.tail !== undefined) args.push('--tail', String(params.tail));
    args.push(params.container);
    return docker(args, { inherit: params.inherit });
}
