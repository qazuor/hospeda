/**
 * Command runner abstraction.
 *
 * V1 ships a `LocalRunner` that exec's commands directly on the host
 * the toolkit was launched on (the VPS). V2 will add an `SshRunner`
 * that proxies the same calls over SSH from a laptop, without any
 * change to the command implementations that consume this interface.
 *
 * Implementations MUST never throw on non-zero exit codes by default —
 * callers receive the full result object and decide whether the exit
 * code is fatal. This matches the docker / psql / curl semantics where
 * non-zero is meaningful but recoverable.
 */

import { execa } from 'execa';

/**
 * Result of a command run. Mirrors execa's shape but pinned to the
 * fields the toolkit actually inspects, so a future SshRunner does not
 * have to fake the rest of execa's API.
 */
export interface RunResult {
    /** Process exit code (0 on success). */
    readonly exitCode: number;
    /** Captured stdout (utf-8). Empty string when streaming was on. */
    readonly stdout: string;
    /** Captured stderr (utf-8). Empty string when streaming was on. */
    readonly stderr: string;
    /** True when the command completed but the exit code was non-zero. */
    readonly failed: boolean;
}

/**
 * Options accepted by `run`. All optional — the defaults are tuned for
 * the most common case (capture stdout + stderr, no shell, no env
 * inheritance beyond what's already in process.env).
 */
export interface RunOptions {
    /**
     * Stream the child's stdio to the parent terminal instead of capturing
     * it. Useful for interactive commands like `psql` or `docker exec -it`.
     * When true, `stdout`/`stderr` in the result come back as empty strings.
     */
    readonly inherit?: boolean;
    /**
     * Pipe a string into the child's stdin. Mutually exclusive with
     * `inherit: true` (when stdio is inherited the parent's stdin is
     * already connected and stdin can't be set programmatically).
     */
    readonly input?: string;
    /**
     * Override / extend env vars for the child process. Merged on top of
     * `process.env`.
     */
    readonly env?: Readonly<Record<string, string>>;
    /**
     * Working directory for the child. Defaults to the toolkit's cwd.
     */
    readonly cwd?: string;
}

/**
 * Runner contract. Implementations must execute the given argv (without
 * shell expansion) and return a normalised RunResult.
 */
export interface Runner {
    run(argv: ReadonlyArray<string>, options?: RunOptions): Promise<RunResult>;
}

/**
 * Local runner — exec on the same host hops is running on. This is the
 * default for V1 since the toolkit is launched on the VPS via SSH.
 */
export class LocalRunner implements Runner {
    async run(argv: ReadonlyArray<string>, options: RunOptions = {}): Promise<RunResult> {
        const [command, ...args] = argv;
        if (!command) {
            throw new Error('LocalRunner.run: argv must include at least the command');
        }

        const result = await execa(command, args, {
            stdio: options.inherit ? 'inherit' : 'pipe',
            input: options.input,
            env: options.env ? { ...process.env, ...options.env } : process.env,
            cwd: options.cwd,
            reject: false
        });

        return {
            exitCode: result.exitCode ?? 1,
            stdout: typeof result.stdout === 'string' ? result.stdout : '',
            stderr: typeof result.stderr === 'string' ? result.stderr : '',
            failed: result.failed || (result.exitCode ?? 0) !== 0
        };
    }
}

/**
 * Default runner singleton. Commands import this when they don't need
 * to swap implementations (which is most of the time).
 */
export const runner: Runner = new LocalRunner();
