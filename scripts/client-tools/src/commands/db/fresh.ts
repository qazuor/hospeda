import * as p from '@clack/prompts';
import pc from 'picocolors';
import { type RunContext, resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { extractTarget } from '../../lib/target.ts';
import { databaseFor, type WorktreeEnv } from '../../lib/worktree.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops db-fresh')} — rehacer una base desde el template

  ${pc.dim('Dropea la base y la vuelve a clonar de hospeda_template. Es instantáneo')}
  ${pc.dim('(createdb -T) y NO toca el volumen de Postgres.')}

  ${pc.red('Nunca corre `docker compose down -v`.')} ${pc.dim('Ese comando borra el volumen')}
  ${pc.dim('entero: hospeda_dev, hospeda_template y las bases de TODOS los')}
  ${pc.dim('worktrees de una. Si alguna vez lo necesitás, es `pnpm db:fresh-dev`')}
  ${pc.dim('a mano y sabiendo lo que hace.')}

${pc.bold('Uso')}

  hops db-fresh [--wt <nombre>] [--pick]

  ${pc.bold('--pick')}         Selector: elegís qué bases rehacer, una por una.
  ${pc.bold('--wt <nombre>')}  La base de otro worktree.
  ${pc.bold('--help')}         Esta página.

${pc.bold('Dónde actúa')}

  Dentro de un worktree, su base. En el clon principal, hospeda_dev.
  Con --pick, las que tildes.
`;
}

/** Runs a psql maintenance statement against the container's postgres database. */
async function psqlAdmin({
    context,
    sql
}: {
    readonly context: RunContext;
    readonly sql: string;
}): Promise<{ readonly ok: boolean; readonly error: string }> {
    if (context.dbConfig === null) return { ok: false, error: 'sin configuración de base' };
    const result = await run({
        command: 'docker',
        args: [
            'exec',
            '-i',
            context.dbConfig.container,
            'psql',
            '-U',
            context.dbConfig.user,
            '-d',
            'postgres',
            '-v',
            'ON_ERROR_STOP=1',
            '-c',
            sql
        ],
        timeoutMs: 120_000
    });
    return { ok: result.ok, error: result.error };
}

/**
 * Recreates one database from the template.
 *
 * @param input.context  - Where the command acts.
 * @param input.database - Database to recreate.
 * @returns Whether it worked, and why not.
 */
export async function recreateFromTemplate({
    context,
    database
}: {
    readonly context: RunContext;
    readonly database: string;
}): Promise<{ readonly ok: boolean; readonly error: string }> {
    const template = context.dbConfig?.templateDb;
    if (template === undefined) return { ok: false, error: 'sin templateDb configurada' };

    // Open connections make DROP fail. Terminating them first is what turns
    // "database is being accessed by other users" into a working command when
    // the worktree's own servers are up.
    await psqlAdmin({
        context,
        sql: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`
    });

    const dropped = await psqlAdmin({ context, sql: `DROP DATABASE IF EXISTS "${database}";` });
    if (!dropped.ok) return dropped;

    return await psqlAdmin({
        context,
        sql: `CREATE DATABASE "${database}" TEMPLATE "${template}";`
    });
}

/** Describes one candidate in the picker. */
function describe({
    worktree,
    database
}: {
    readonly worktree: WorktreeEnv;
    readonly database: string;
}): string {
    const running = worktree.servers.length > 0;
    // Recreating the database under a running app leaves it in a strange state,
    // so whether the servers are up has to be visible BEFORE ticking the box.
    return running
        ? `${database}  ${pc.yellow(`· ${worktree.servers.length} servers arriba`)}`
        : database;
}

/**
 * Recreates one or more databases from the template.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runDbFresh({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;

    if (context.dbConfig === null) {
        process.stderr.write(`${pc.red('ERROR:')} no pude leer la configuración de base.\n`);
        return 1;
    }

    const targets: { worktree: WorktreeEnv; database: string }[] = [];

    if (rest.includes('--pick')) {
        if (!interactive) {
            process.stderr.write(`${pc.red('--pick necesita una terminal.')}\n`);
            return 1;
        }
        const candidates = context.all
            .map((worktree) => ({
                worktree,
                database: databaseFor({ worktree, dbConfig: context.dbConfig })
            }))
            .filter(
                (entry): entry is { worktree: WorktreeEnv; database: string } =>
                    entry.database !== null
            );

        const picked = await p.multiselect<string>({
            message: '¿Qué bases rehago desde el template?',
            options: candidates.map((entry) => ({
                value: entry.database,
                label: entry.worktree.isMain
                    ? `${entry.worktree.name} (principal)`
                    : entry.worktree.name,
                hint: describe(entry)
            })),
            required: false
        });
        if (p.isCancel(picked)) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
        for (const database of picked) {
            const found = candidates.find((entry) => entry.database === database);
            if (found !== undefined) targets.push(found);
        }
    } else {
        if (context.worktree === null || context.database === null) {
            process.stderr.write(
                `${pc.red('No sé sobre qué base actuar.')} Usá --wt <nombre> o --pick.\n`
            );
            return 1;
        }
        targets.push({ worktree: context.worktree, database: context.database });
    }

    if (targets.length === 0) {
        process.stderr.write('No tildaste nada.\n');
        return 0;
    }

    const running = targets.filter((entry) => entry.worktree.servers.length > 0);
    if (running.length > 0 && interactive) {
        p.note(
            running
                .map((entry) => `${pc.bold(entry.worktree.name)}  ${pc.dim(entry.database)}`)
                .join('\n'),
            pc.yellow(`${running.length} tienen la app corriendo`)
        );
    }

    if (interactive) {
        const go = await p.confirm({
            message: `Rehago ${targets.length} base(s) desde ${context.dbConfig.templateDb}. Se pierde todo lo que tengan.`,
            initialValue: false
        });
        if (p.isCancel(go) || !go) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
    }

    let failed = 0;
    for (const entry of targets) {
        process.stderr.write(`${pc.dim('→ ')}${entry.database}\n`);
        const result = await recreateFromTemplate({ context, database: entry.database });
        if (!result.ok) {
            process.stderr.write(`  ${pc.red('falló:')} ${result.error}\n`);
            failed += 1;
        }
    }

    process.stderr.write(
        `\n${pc.green(`${targets.length - failed} rehecha(s)`)}${failed > 0 ? pc.red(`, ${failed} falló(aron)`) : ''}\n`
    );
    return failed > 0 ? 1 : 0;
}
