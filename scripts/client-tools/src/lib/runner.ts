import { spawn } from 'node:child_process';
import type { Target } from './target.ts';

/** A command to execute somewhere. */
export interface Job {
    /** Executable. */
    readonly command: string;
    /** Arguments, passed verbatim — no shell, so no quoting needed. */
    readonly args: readonly string[];
    /** Working directory. */
    readonly cwd: string;
    /** Extra environment variables. */
    readonly env?: Readonly<Record<string, string>>;
}

/** Result of a captured child-process execution. */
export interface CapturedJobResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

/**
 * Executes jobs, here or on the VPS.
 *
 * The indirection exists before it is needed on purpose: `hops` is meant to
 * drive the server over SSH later, and if commands call `spawn` directly, every
 * one of them has to be rewritten the day the first remote command lands.
 */
export interface Runner {
    /** Where this runner acts. */
    readonly target: Target;
    /**
     * Runs a job with the terminal attached.
     *
     * @param job - What to run.
     * @returns The exit code.
     */
    exec(job: Job): Promise<number>;
    /** Runs a job without inheriting terminal output. */
    execCapture(job: Job): Promise<CapturedJobResult>;
}

/** Runs jobs on this machine. */
export function localRunner(): Runner {
    return {
        target: 'local',
        exec: (job) =>
            new Promise<number>((resolve) => {
                const child = spawn(job.command, [...job.args], {
                    cwd: job.cwd,
                    stdio: 'inherit',
                    env: job.env === undefined ? process.env : { ...process.env, ...job.env }
                });
                const onInt = (): void => {
                    child.kill('SIGINT');
                };
                const onTerm = (): void => {
                    child.kill('SIGTERM');
                };
                process.on('SIGINT', onInt);
                process.on('SIGTERM', onTerm);

                // Reached through the EventEmitter interface because bun-types
                // narrows `process.off`/`removeListener` to a single event name
                // and rejects the signal names it happily accepts in `on`.
                const emitter: NodeJS.EventEmitter = process;
                const done = (code: number): void => {
                    emitter.removeListener('SIGINT', onInt);
                    emitter.removeListener('SIGTERM', onTerm);
                    resolve(code);
                };
                child.on('error', () => done(1));
                child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
                    if (code !== null) return done(code);
                    done(signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1);
                });
            }),
        execCapture: (job) =>
            new Promise<CapturedJobResult>((resolve) => {
                const child = spawn(job.command, [...job.args], {
                    cwd: job.cwd,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: job.env === undefined ? process.env : { ...process.env, ...job.env }
                });
                let stdout = '';
                let stderr = '';
                child.stdout?.setEncoding('utf8');
                child.stderr?.setEncoding('utf8');
                child.stdout?.on('data', (chunk: string) => {
                    stdout += chunk;
                });
                child.stderr?.on('data', (chunk: string) => {
                    stderr += chunk;
                });
                child.on('error', () => resolve({ code: 1, stdout, stderr }));
                child.on('close', (code, signal) =>
                    resolve({
                        code: code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1),
                        stdout,
                        stderr
                    })
                );
            })
    };
}

/**
 * Resolves the runner for a target.
 *
 * Remote targets are not wired yet, and this refuses loudly rather than falling
 * back to the local runner — silently running a production command against the
 * developer's machine is the failure this whole abstraction exists to prevent.
 *
 * @param input.target - Where the command should act.
 * @returns The runner.
 */
export function runnerFor({ target }: { readonly target: Target }): Runner {
    if (target === 'local') return localRunner();
    throw new Error(
        `El target «${target}» todavía no está implementado en hops cliente.\n` +
            'Por ahora se opera con `hops` del VPS, por SSH.'
    );
}
