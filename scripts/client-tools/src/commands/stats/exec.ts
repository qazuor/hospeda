import { execFile } from 'node:child_process';

/**
 * Result of running an external command.
 *
 * `ok` is false when the command could not be run, exited non-zero in a way the
 * caller did not whitelist, or timed out. Callers must branch on it: the whole
 * point of this module is that a failed command never silently becomes an empty
 * string that a later parser turns into a zero.
 */
export type ExecResult =
    | { ok: true; stdout: string; stderr: string; code: number }
    | { ok: false; error: string; stdout: string; code: number | null };

export type RunOptions = {
    /** Working directory for the command. */
    readonly cwd?: string;
    /** Milliseconds before the command is killed. Defaults to 60_000. */
    readonly timeoutMs?: number;
    /** Exit codes to treat as success besides 0. `rg` and `grep` use 1 for "no matches". */
    readonly okCodes?: readonly number[];
    /** Bytes of stdout to buffer. Defaults to 64 MB, enough for a full file listing. */
    readonly maxBuffer?: number;
    /** Extra environment variables merged over the current process env. */
    readonly env?: Readonly<Record<string, string>>;
};

/**
 * Run a command with its arguments passed as an array.
 *
 * There is deliberately no shell involved. Every quoting bug this tool used to
 * have — a delimiter colliding inside a `sed` expression, nested quotes inside
 * an embedded script, a glob expanding in the wrong place — came from building
 * a command as a string. An argv array cannot have those.
 *
 * @param file - Executable name, resolved through PATH.
 * @param args - Arguments, each passed verbatim without shell interpretation.
 * @param options - Working directory, timeout and accepted exit codes.
 * @returns A discriminated result; never throws for a non-zero exit.
 */
export async function run(
    file: string,
    args: readonly string[],
    options: RunOptions = {}
): Promise<ExecResult> {
    const { cwd, timeoutMs = 60_000, okCodes = [], maxBuffer = 64 * 1024 * 1024, env } = options;

    return new Promise<ExecResult>((resolve) => {
        execFile(
            file,
            [...args],
            {
                ...(cwd === undefined ? {} : { cwd }),
                timeout: timeoutMs,
                maxBuffer,
                encoding: 'utf8',
                env: env === undefined ? process.env : { ...process.env, ...env }
            },
            (error, stdout, stderr) => {
                if (error === null) {
                    resolve({ ok: true, stdout, stderr, code: 0 });
                    return;
                }
                const code = typeof error.code === 'number' ? error.code : null;
                if (code !== null && okCodes.includes(code)) {
                    resolve({ ok: true, stdout, stderr, code });
                    return;
                }
                resolve({
                    ok: false,
                    error: error.killed === true ? `timed out after ${timeoutMs}ms` : error.message,
                    stdout,
                    code
                });
            }
        );
    });
}

/**
 * Run a command and return its stdout lines, dropping empties.
 *
 * @returns The lines on success, or `null` when the command failed. `null` is
 *          not an empty list: callers must not treat a failure as "no results".
 */
export async function runLines(
    file: string,
    args: readonly string[],
    options: RunOptions = {}
): Promise<string[] | null> {
    const result = await run(file, args, options);
    if (!result.ok) return null;
    return result.stdout.split('\n').filter((line) => line.length > 0);
}

/**
 * Run a command and parse its stdout as JSON.
 *
 * @returns The parsed value, or `null` when the command failed or the output
 *          was not valid JSON.
 */
export async function runJson<T>(
    file: string,
    args: readonly string[],
    options: RunOptions = {}
): Promise<T | null> {
    const result = await run(file, args, options);
    if (!result.ok || result.stdout.trim().length === 0) return null;
    try {
        return JSON.parse(result.stdout) as T;
    } catch {
        return null;
    }
}
