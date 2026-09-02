import { execFile } from 'node:child_process';

/** Result of running a child process to completion, capturing its output. */
export interface CommandOutput {
    /** Whether the process exited with code 0. */
    readonly ok: boolean;
    /** Captured stdout (empty string on failure). */
    readonly stdout: string;
    /** Error message when the process failed or timed out. */
    readonly error: string;
}

/** Default ceiling for a single git invocation. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Runs a command and captures its stdout, never throwing.
 *
 * Every caller here treats a failure as "this piece of information is
 * unavailable" rather than as a fatal error, so failures are returned as data.
 * The command is executed WITHOUT a shell, so arguments need no quoting and
 * cannot be interpreted as shell syntax.
 *
 * @param input.command   - Executable to run.
 * @param input.args      - Argument list, passed verbatim.
 * @param input.cwd       - Working directory for the child process.
 * @param input.timeoutMs - Ceiling before the child is killed.
 * @returns A {@link CommandOutput} describing the run.
 *
 * @example
 * ```ts
 * const head = await run({ command: 'git', args: ['rev-parse', 'HEAD'], cwd: repo });
 * if (head.ok) console.log(head.stdout.trim());
 * ```
 */
export function run({
    command,
    args,
    cwd,
    env,
    timeoutMs = DEFAULT_TIMEOUT_MS
}: {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    /**
     * Variables merged over the ambient environment.
     *
     * An empty string CLEARS a variable, which is the point: a stale token
     * inherited from the shell can outrank a tool's own stored credentials.
     */
    readonly env?: Readonly<Record<string, string>>;
    readonly timeoutMs?: number;
}): Promise<CommandOutput> {
    return new Promise<CommandOutput>((resolve) => {
        execFile(
            command,
            [...args],
            {
                cwd,
                timeout: timeoutMs,
                maxBuffer: 8 * 1024 * 1024,
                env: env === undefined ? process.env : { ...process.env, ...env }
            },
            (error, stdout) => {
                if (error) {
                    resolve({ ok: false, stdout: '', error: error.message });
                    return;
                }
                resolve({ ok: true, stdout, error: '' });
            }
        );
    });
}
