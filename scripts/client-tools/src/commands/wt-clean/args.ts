import type { CliOptions } from './types.ts';

/**
 * Parses the command line into options.
 *
 * The repository path is positional and FIRST-wins. The `hops-wt-clean` fish
 * function appends the resolved repo AFTER the user's own arguments
 * (`hops-wt-clean $argv $repo`), so when someone types an explicit path there
 * are two positionals and the wrapper's is the second one. Taking the first is
 * what lets `hops-wt-clean /otro/repo` actually target another repository
 * instead of being silently overridden by the wrapper's default.
 *
 * @param input.argv - Arguments after the node executable and script.
 * @param input.cwd  - Fallback repository path when no positional is given.
 * @returns The parsed {@link CliOptions}.
 *
 * @example
 * ```ts
 * parseArgs({ argv: ['/explicit', '/from-wrapper'], cwd: '/somewhere' });
 * // { repoPath: '/explicit', measureDisk: true, help: false }
 * ```
 */
export function parseArgs({
    argv,
    cwd
}: {
    readonly argv: readonly string[];
    readonly cwd: string;
}): CliOptions {
    const positionals = argv.filter((arg) => !arg.startsWith('-'));
    return {
        repoPath: positionals.at(0) ?? cwd,
        measureDisk: !argv.includes('--no-disk'),
        help: argv.includes('--help') || argv.includes('-h')
    };
}
