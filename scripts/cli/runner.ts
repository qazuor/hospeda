import { spawn } from 'node:child_process';
import type { CliCommand } from './types.js';

/**
 * Arguments to pass to Node's `spawn` call.
 */
export interface SpawnArgs {
    readonly command: string;
    readonly args: readonly string[];
}

/**
 * Derives the spawn command and argument list from a {@link CliCommand} and
 * any additional arguments supplied at runtime.
 *
 * Rules per execution type:
 * - `pnpm-root`   → `pnpm run <script> [-- <extraArgs>]`
 * - `pnpm-filter` → `pnpm --filter <filter> <script> [-- <extraArgs>]`
 * - `shell`       → split `command` by spaces, append `extraArgs` directly
 *
 * @param input.cmd       - The command definition from the registry
 * @param input.extraArgs - Additional arguments forwarded to the spawned process
 * @returns A {@link SpawnArgs} object ready for `spawn`
 *
 * @example
 * ```ts
 * buildSpawnArgs({ cmd: { execution: { type: 'pnpm-root', script: 'test' } }, extraArgs: ['--watch'] })
 * // { command: 'pnpm', args: ['run', 'test', '--', '--watch'] }
 * ```
 */
export function buildSpawnArgs({
    cmd,
    extraArgs = []
}: {
    readonly cmd: CliCommand;
    readonly extraArgs?: readonly string[];
}): SpawnArgs {
    const { execution } = cmd;

    const extraArgsPart: readonly string[] = extraArgs.length > 0 ? ['--', ...extraArgs] : [];

    switch (execution.type) {
        case 'pnpm-root': {
            return {
                command: 'pnpm',
                args: ['run', execution.script, ...extraArgsPart]
            };
        }
        case 'pnpm-filter': {
            return {
                command: 'pnpm',
                args: ['--filter', execution.filter, execution.script, ...extraArgsPart]
            };
        }
        case 'shell': {
            const [shellCmd, ...baseArgs] = execution.command.split(' ');
            // shell type does not use a `--` separator
            return {
                command: shellCmd ?? execution.command,
                args: [...baseArgs, ...extraArgs]
            };
        }
    }
}

/**
 * Spawns a child process for the given command, forwards stdio, and handles
 * SIGINT / SIGTERM by propagating the signal to the child process.
 *
 * The returned promise resolves with the numeric exit code once the child
 * process closes. When the child is killed by a signal the exit code is
 * mapped to the conventional shell value:
 * - SIGINT  → 130
 * - SIGTERM → 143
 * - other   → 1
 *
 * @param input.cmd       - The command definition from the registry
 * @param input.extraArgs - Additional arguments forwarded to the spawned process
 * @returns Promise that resolves with the process exit code
 *
 * @example
 * ```ts
 * const code = await runCommand({ cmd, extraArgs: ['--coverage'] });
 * process.exit(code);
 * ```
 */
export function runCommand({
    cmd,
    extraArgs = []
}: {
    readonly cmd: CliCommand;
    readonly extraArgs?: readonly string[];
}): Promise<number> {
    const { command, args } = buildSpawnArgs({ cmd, extraArgs });

    return new Promise<number>((resolve) => {
        const child = spawn(command, [...args], {
            stdio: 'inherit',
            shell: true
        });

        const forwardSignal = (signal: NodeJS.Signals): void => {
            child.kill(signal);
        };

        const onSigint = (): void => {
            forwardSignal('SIGINT');
        };

        const onSigterm = (): void => {
            forwardSignal('SIGTERM');
        };

        process.on('SIGINT', onSigint);
        process.on('SIGTERM', onSigterm);

        child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
            process.off('SIGINT', onSigint);
            process.off('SIGTERM', onSigterm);

            if (code !== null) {
                resolve(code);
                return;
            }

            // Child was killed by a signal
            if (signal === 'SIGINT') {
                resolve(130);
            } else if (signal === 'SIGTERM') {
                resolve(143);
            } else {
                resolve(1);
            }
        });
    });
}
