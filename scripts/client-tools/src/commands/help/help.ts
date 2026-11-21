import { isAbsolute, resolve } from 'node:path';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { localRunner, type Runner } from '../../lib/runner.ts';
import { extractTarget, type Target } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';

/** The subcommands `hops help` accepts. */
const SUBCOMMANDS = ['export'] as const;

/** The help page. */
export function renderHelp(): string {
    return `
${pc.bold('hops help')} — el centro de ayuda para dueños (HOS-2410)

${pc.bold('Uso')}

  hops help export --audience <a> --site-url <url> [--out <archivo>]

  ${pc.dim('Arma UN documento Markdown con las guías de una audiencia, para folletos:')}
  ${pc.dim('las cinco secciones y los relacionados de cada guía, links absolutos bajo')}
  ${pc.dim('--site-url y cada tope de plan escrito como «según tu plan».')}

  ${pc.bold('--audience')}   host, venue, experience, provider, partner o all.
  ${pc.bold('--site-url')}   La base de los links, por ejemplo https://hospeda.com.ar
  ${pc.bold('--out')}        Escribe a un archivo (entero o nada) en vez de stdout.
  ${pc.bold('--wt <nombre>')} Correrlo en otro worktree.

  ${pc.dim('Corre pnpm --filter @repo/help export: los argumentos y el exit code son los de')}
  ${pc.dim('ese script. Sin --out, stdout tiene sólo el documento.')}
`;
}

/**
 * The export's own arguments, with a relative `--out` made absolute against the
 * directory hops was run from. pnpm runs the script from the repo root, so a
 * relative path forwarded as-is would land somewhere the user did not mean.
 *
 * @param input.argv - Arguments after `hops help export`.
 * @param input.cwd - The directory hops was run from.
 * @returns The arguments to forward.
 */
export function exportArgs({
    argv,
    cwd
}: {
    readonly argv: readonly string[];
    readonly cwd: string;
}): string[] {
    const absolute = (path: string) => (isAbsolute(path) ? path : resolve(cwd, path));
    const out: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] ?? '';
        const next = argv[index + 1];
        if (arg === '--out' && next !== undefined) {
            out.push(arg, absolute(next));
            index += 1;
        } else if (arg.startsWith('--out=')) {
            out.push(`--out=${absolute(arg.slice('--out='.length))}`);
        } else {
            out.push(arg);
        }
    }
    return out;
}

/** What {@link runHelp} needs from its surroundings. Injected by tests. */
export interface RunHelpDeps {
    /** Runs the export with the terminal attached. */
    readonly runner: Runner;
    /** Resolves the directory the export runs in. */
    readonly resolveCwd: (input: {
        readonly target: Target;
        readonly worktreeName: string | null;
    }) => Promise<string>;
    /** The directory hops was run from. */
    readonly cwd: string;
}

/** The real surroundings: this machine, the resolved worktree or repo root. */
function defaultDeps(): RunHelpDeps {
    return {
        runner: localRunner(),
        resolveCwd: async ({ target, worktreeName }) => {
            const context = await resolveRunContext({
                cwd: process.cwd(),
                target,
                worktreeName
            });
            return context.worktree?.path ?? context.repoRoot;
        },
        cwd: process.cwd()
    };
}

/**
 * Runs `hops help <subcommand>`.
 *
 * `export` spawns `pnpm --silent --filter @repo/help export` with the terminal
 * attached and returns its exit code. `--silent` keeps pnpm's banner out of
 * stdout, so the Markdown can be piped or redirected as is.
 *
 * @param input.argv - Arguments after the command name.
 * @param input.deps - Surroundings; the real ones when omitted.
 * @returns The process exit code.
 */
export async function runHelp({
    argv,
    deps = defaultDeps()
}: {
    readonly argv: readonly string[];
    readonly deps?: RunHelpDeps;
}): Promise<number> {
    const { target, rest: afterTarget } = extractTarget({ argv });
    const { name: worktreeName, rest } = extractWorktreeFlag({ argv: afterTarget });
    const [subcommand, ...subArgv] = rest;

    if (subcommand === undefined || subcommand === '--help' || subcommand === '-h') {
        process.stdout.write(renderHelp());
        return subcommand === undefined ? 1 : 0;
    }
    if (!SUBCOMMANDS.includes(subcommand as (typeof SUBCOMMANDS)[number])) {
        process.stderr.write(
            `${pc.red('Subcomando desconocido:')} ${pc.bold(`hops help ${subcommand}`)}\n` +
                `${pc.dim(`Hay uno: ${SUBCOMMANDS.join(', ')}.`)}\n`
        );
        return 1;
    }
    if (subArgv.includes('--help') || subArgv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const cwd = await deps.resolveCwd({ target, worktreeName });
    return await deps.runner.exec({
        command: 'pnpm',
        args: [
            '--silent',
            '--filter',
            '@repo/help',
            'export',
            ...exportArgs({ argv: subArgv, cwd: deps.cwd })
        ],
        cwd
    });
}
