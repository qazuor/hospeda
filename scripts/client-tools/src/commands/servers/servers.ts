import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';

/** Scripts of the worktree skill this command drives. */
const SCRIPTS = {
    up: 'wt-up.sh',
    down: 'wt-down.sh'
} as const;

/** Resolves a worktree-skill script, or `null` when the skill is not installed. */
function scriptPath({ name }: { readonly name: string }): string | null {
    const path = join(homedir(), '.claude', 'skills', 'worktree', 'scripts', name);
    return existsSync(path) ? path : null;
}

/** The help page. */
function renderHelp({ verb }: { readonly verb: 'up' | 'down' }): string {
    const what =
        verb === 'up'
            ? 'Levanta la base y los tres servers de un worktree, con puertos propios.'
            : 'Para los servers de un worktree. La base y el worktree quedan intactos.';
    return `
${pc.bold(`hops servers-${verb}`)} — ${verb === 'up' ? 'levantar' : 'bajar'} el entorno de un worktree

  ${pc.dim(what)}
${
    verb === 'up'
        ? `  ${pc.dim('Es idempotente: si ya están arriba y respondiendo, no hace nada.')}\n`
        : ''
}
${pc.bold('Uso')}

  hops servers-${verb} [--wt <nombre>]

  ${pc.bold('--wt <nombre>')}  Opera sobre otro worktree sin moverte de donde estás.
  ${pc.bold('--help')}         Esta página.

${pc.bold('Dónde actúa')}

  Si estás parado dentro de un worktree, ese. Si estás afuera del repo, te
  pregunta cuál. El nombre siempre se imprime antes de hacer nada.
`;
}

/** Runs one of the worktree-skill scripts against a worktree. */
async function runServerScript({
    verb,
    argv
}: {
    readonly verb: 'up' | 'down';
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp({ verb }));
        return 0;
    }

    const script = scriptPath({ name: SCRIPTS[verb] });
    if (script === null) {
        process.stderr.write(
            `${pc.red('ERROR:')} no encontré ${SCRIPTS[verb]} en ~/.claude/skills/worktree/scripts/.\n` +
                'La skill worktree tiene que estar instalada.\n'
        );
        return 1;
    }

    const { target, rest } = extractTarget({ argv });
    // `--wt` is parsed the same way the dispatcher parsed it, so the worktree
    // this acts on and the one the status bar named are the same by
    // construction. It is also stripped from what gets forwarded to the script,
    // which knows nothing about the flag.
    const { name: worktreeName, rest: passthrough } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const runner = runnerFor({ target });

    let worktree = context.worktree;

    if (worktree === null) {
        // Outside the repository there is nothing to infer: ask, never guess.
        const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;
        if (!interactive) {
            process.stderr.write(
                `${pc.red('Estás fuera de un repositorio y no hay terminal para preguntar.')}\n` +
                    'Pasá --wt <nombre>.\n'
            );
            return 1;
        }
        const picked = await p.select({
            message: '¿Sobre qué worktree?',
            options: context.all.map((candidate) => ({
                value: candidate.path,
                label: candidate.name,
                hint:
                    candidate.servers.length > 0
                        ? `${candidate.servers.length} servers arriba`
                        : 'parado'
            }))
        });
        if (p.isCancel(picked)) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
        worktree = context.all.find((candidate) => candidate.path === String(picked)) ?? null;
        if (worktree === null) return 1;
    }

    // Run FROM the worktree: both scripts resolve their target from the current
    // directory, never from an argument.
    return await runner.exec({
        command: 'bash',
        args: [script, ...passthrough],
        cwd: worktree.path
    });
}

/**
 * Brings a worktree's database and servers up.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export function runServersUp({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    return runServerScript({ verb: 'up', argv });
}

/**
 * Stops a worktree's servers, leaving its database and files alone.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export function runServersDown({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    return runServerScript({ verb: 'down', argv });
}
