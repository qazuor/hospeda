import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { dangerOf, findScripts, type RepoScript, searchScripts } from './scripts.ts';

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops run')} — cualquier script del repo

  ${pc.dim('Busca en TODOS los package.json, incluido el de la raíz — que es donde')}
  ${pc.dim('viven los veinte guards de CI y toda la familia de env, y que el CLI')}
  ${pc.dim('anterior nunca abría.')}

  ${pc.dim('No es para el día a día: para eso están los comandos propios. Es para')}
  ${pc.dim('el día que necesitás posthog:setup y no te acordás dónde vivía.')}

${pc.bold('Uso')}

  hops run                Selector con búsqueda
  hops run <script>       Directo, si el nombre es exacto
  hops run <texto>        Busca y te muestra lo que matchea
  hops run --list         Lista todo

  ${pc.bold('--wt <nombre>')}  Correrlo en otro worktree.
  ${pc.bold('--help')}         Esta página.
`;
}

/** Renders one script as a choice line. */
function label({ script }: { readonly script: RepoScript }): string {
    const danger = dangerOf({ script });
    return `${script.id}${danger === null ? '' : pc.red('  ⚠')}`;
}

/** Renders the hint shown for a script. */
function hint({ script }: { readonly script: RepoScript }): string {
    const danger = dangerOf({ script });
    const where = script.dir === '.' ? 'raíz' : script.dir;
    return danger === null
        ? `${where}  ·  ${script.command.slice(0, 60)}`
        : `${pc.red(danger)}  ·  ${where}`;
}

/**
 * Finds and runs any script in the repository.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runRun({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName, rest: args } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const runner = runnerFor({ target });
    const cwd = context.worktree?.path ?? context.repoRoot;

    const scripts = await findScripts({ repoRoot: cwd });
    if (scripts.length === 0) {
        process.stderr.write(`${pc.red('No encontré ningún package.json con scripts.')}\n`);
        return 1;
    }

    const query = args.find((arg) => !arg.startsWith('-'));
    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;

    if (args.includes('--list')) {
        for (const script of scripts) {
            process.stdout.write(`${script.id.padEnd(34)}${pc.dim(script.command.slice(0, 70))}\n`);
        }
        process.stdout.write(`\n${pc.dim(`${scripts.length} scripts`)}\n`);
        return 0;
    }

    const matches = query === undefined ? scripts : searchScripts({ scripts, query });
    if (matches.length === 0) {
        process.stderr.write(`${pc.red(`Nada matchea «${query}».`)}\n`);
        return 1;
    }

    // An exact id runs straight away; anything else is a search, even when it
    // happens to match one thing — guessing turns a typo into an execution.
    let chosen = query === undefined ? undefined : matches.find((script) => script.id === query);

    if (chosen === undefined) {
        if (!interactive) {
            process.stderr.write(
                `${pc.yellow(`${matches.length} coinciden con «${query ?? ''}»:`)}\n`
            );
            for (const script of matches.slice(0, 20)) {
                process.stderr.write(`  ${script.id}\n`);
            }
            process.stderr.write(`${pc.dim('Sin terminal necesito el nombre exacto.')}\n`);
            return 1;
        }
        const picked = await p.select({
            message: query === undefined ? '¿Qué corro?' : `Coinciden con «${query}»:`,
            options: matches.slice(0, 40).map((script) => ({
                value: script.id,
                label: label({ script }),
                hint: hint({ script })
            }))
        });
        if (p.isCancel(picked)) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
        chosen = matches.find((script) => script.id === String(picked));
    }
    if (chosen === undefined) return 1;

    const danger = dangerOf({ script: chosen });
    if (danger !== null) {
        if (!interactive) {
            process.stderr.write(
                `${pc.red(`«${chosen.id}» ${danger}.`)} Sin terminal no lo corro.\n`
            );
            return 1;
        }
        p.note(`${pc.bold(chosen.command)}\n\n${pc.red(danger)}`, pc.red(chosen.id));
        const go = await p.confirm({ message: '¿Lo corro igual?', initialValue: false });
        if (p.isCancel(go) || !go) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
    }

    process.stderr.write(`${pc.dim('→ ')}${chosen.command}\n`);
    return await runner.exec({
        command: 'pnpm',
        args:
            chosen.dir === '.'
                ? ['run', chosen.script]
                : ['--filter', chosen.packageName, 'run', chosen.script],
        cwd
    });
}
