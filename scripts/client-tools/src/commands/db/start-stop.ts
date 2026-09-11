import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveRunContext, worktreesWithServers } from '../../lib/context.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';

/** Containers the compose file exposes for local development. */
const SERVICES = ['postgres', 'redis'] as const;

/** Help shown by both commands. */
function renderHelp({ verb }: { readonly verb: 'start' | 'stop' }): string {
    const action = verb === 'start' ? 'Levanta' : 'Baja';
    return `
${pc.bold(`hops db-${verb}`)} — ${action.toLowerCase()} Postgres y Redis

  ${pc.dim(`${action} los contenedores ${SERVICES.join(' y ')} del entorno de desarrollo.`)}

  ${pc.yellow('Son COMPARTIDOS')}${pc.dim(': hay un solo contenedor de Postgres para todos los')}
  ${pc.dim('worktrees, y cada uno tiene su base adentro. Esto no es por worktree.')}

${pc.bold('Uso')}

  hops db-${verb} [--yes]

  ${pc.bold('--yes')}    ${verb === 'stop' ? 'No pregunta aunque haya servers levantados.' : 'Sin efecto acá.'}
  ${pc.bold('--help')}   Esta página.
`;
}

/**
 * Brings the shared Postgres and Redis containers up.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runDbStart({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp({ verb: 'start' }));
        return 0;
    }
    const { target } = extractTarget({ argv });
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    const runner = runnerFor({ target });

    // The status bar is drawn by the dispatcher, not here: one place, so no
    // command can ship without it.
    const prepared = await runner.exec({
        command: 'bash',
        args: ['scripts/ensure-docker-env.sh'],
        cwd: context.repoRoot
    });
    if (prepared !== 0) return prepared;

    return await runner.exec({
        command: 'docker',
        args: ['compose', '--env-file', 'docker/.env', 'up', '-d', ...SERVICES],
        cwd: context.repoRoot
    });
}

/**
 * Takes the shared Postgres and Redis containers down.
 *
 * Stopping them takes every worktree's application with them, so the ones with
 * servers running are named before anything happens — `pnpm db:stop` does this
 * silently today, and the first sign is an app failing somewhere else.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runDbStop({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp({ verb: 'stop' }));
        return 0;
    }
    const { target, rest } = extractTarget({ argv });
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    const runner = runnerFor({ target });
    const affected = worktreesWithServers({ context });
    const skipPrompt = rest.includes('--yes') || rest.includes('-y');
    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;

    if (affected.length > 0 && !skipPrompt) {
        const detail = affected
            .map(
                (worktree) =>
                    `${pc.bold(worktree.name)}  ${pc.dim(
                        worktree.servers.map((s) => `${s.name}:${s.port}`).join('  ')
                    )}`
            )
            .join('\n');
        if (!interactive) {
            process.stderr.write(
                `${pc.yellow(`${affected.length} worktree(s) tienen servers levantados:`)}\n${detail}\n` +
                    'Sin terminal no puedo preguntar. Volvé a correrlo con --yes si estás seguro.\n'
            );
            return 1;
        }
        p.note(detail, pc.yellow(`Bajar Postgres corta ${affected.length} worktree(s)`));
        const go = await p.confirm({ message: '¿Los bajo igual?', initialValue: false });
        if (p.isCancel(go) || !go) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
    }

    return await runner.exec({
        command: 'docker',
        args: ['compose', '--env-file', 'docker/.env', 'stop', ...SERVICES],
        cwd: context.repoRoot
    });
}
