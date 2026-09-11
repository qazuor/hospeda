import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { dbJob, explainMissingDb } from './target-db.ts';

/**
 * The three migration lanes, in the order a live environment needs them.
 *
 * Schema first, then the objects Drizzle cannot see (triggers, CHECK
 * constraints, materialised views), then seed data-migrations. Running them out
 * of order is how a data-migration reads a column that does not exist yet.
 */
const MIGRATION_LANES = [
    { script: 'db:migrate', label: 'esquema (drizzle)' },
    { script: 'db:apply-extras', label: 'extras (triggers, constraints, vistas)' },
    { script: 'db:seed:migrate', label: 'data-migrations del seed' }
] as const;

/** Seed sets offered by `db-seed`. */
const SEED_SETS = [
    { script: 'db:seed', label: 'completo', hint: 'reset + required + example + POIs' },
    { script: 'db:seed:test-users', label: 'test-users', hint: 'los 18 usuarios de prueba' },
    { script: 'db:seed:migrate', label: 'data-migrations', hint: 'sólo los deltas pendientes' }
] as const;

/** Resolves the context both flags describe, shared by these three commands. */
async function contextFor({ argv }: { readonly argv: readonly string[] }) {
    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    return {
        target,
        context: await resolveRunContext({ cwd: process.cwd(), target, worktreeName }),
        runner: runnerFor({ target })
    };
}

/** Shared help footer. */
function whereBlock(): string {
    return `
${pc.bold('Dónde actúa')}

  Sobre la base del worktree donde estés parado, o la del clon principal.
  Con ${pc.bold('--wt <nombre>')} apuntás a otro sin moverte. El nombre real de la base
  se imprime arriba antes de hacer nada.
`;
}

/**
 * Brings a database up to date across the three migration lanes.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runDbMigrate({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`
${pc.bold('hops db-migrate')} — poner la base al día

  ${pc.dim('Corre los tres carriles de migración en orden:')}

${MIGRATION_LANES.map((lane) => `    ${pc.bold(lane.script.padEnd(18))}${pc.dim(lane.label)}`).join('\n')}

  ${pc.dim('Frena en el primero que falle.')}

${pc.bold('Uso')}

  hops db-migrate [--wt <nombre>] [--only <script>]
${whereBlock()}`);
        return 0;
    }

    const { context, runner } = await contextFor({ argv });
    const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : undefined;
    const lanes =
        only === undefined ? MIGRATION_LANES : MIGRATION_LANES.filter((l) => l.script === only);

    if (lanes.length === 0) {
        process.stderr.write(`${pc.red(`«${only}» no es uno de los carriles.`)}\n`);
        return 1;
    }

    for (const lane of lanes) {
        const job = dbJob({ context, script: lane.script });
        if (job === null) {
            process.stderr.write(`${pc.red('ERROR:')} ${explainMissingDb({ context })}\n`);
            return 1;
        }
        process.stderr.write(`\n${pc.bold(`→ ${lane.script}`)}  ${pc.dim(lane.label)}\n`);
        const code = await runner.exec(job);
        if (code !== 0) {
            process.stderr.write(`${pc.red(`Falló ${lane.script}.`)} No sigo con el resto.\n`);
            return code;
        }
    }
    return 0;
}

/**
 * Seeds a database, asking which set when not told.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runDbSeed({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`
${pc.bold('hops db-seed')} — cargar datos en la base

${SEED_SETS.map((set) => `    ${pc.bold(set.label.padEnd(18))}${pc.dim(set.hint)}`).join('\n')}

${pc.bold('Uso')}

  hops db-seed [--wt <nombre>] [--set <completo|test-users|data-migrations>]

  ${pc.dim('Sin --set te pregunta cuál.')}
${whereBlock()}`);
        return 0;
    }

    const { context, runner } = await contextFor({ argv });
    const asked = argv.includes('--set') ? argv[argv.indexOf('--set') + 1] : undefined;
    let chosen = SEED_SETS.find((set) => set.label === asked);

    if (chosen === undefined) {
        if (asked !== undefined) {
            process.stderr.write(`${pc.red(`«${asked}» no es un set válido.`)}\n`);
            return 1;
        }
        const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;
        if (!interactive) {
            process.stderr.write(
                `${pc.red('Sin terminal no puedo preguntar.')} Pasá --set <nombre>.\n`
            );
            return 1;
        }
        const picked = await p.select({
            message: '¿Qué seedeo?',
            options: SEED_SETS.map((set) => ({
                value: set.label,
                label: set.label,
                hint: set.hint
            }))
        });
        if (p.isCancel(picked)) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
        chosen = SEED_SETS.find((set) => set.label === String(picked));
    }
    if (chosen === undefined) return 1;

    const job = dbJob({ context, script: chosen.script });
    if (job === null) {
        process.stderr.write(`${pc.red('ERROR:')} ${explainMissingDb({ context })}\n`);
        return 1;
    }
    return await runner.exec(job);
}

/**
 * Opens Drizzle Studio pointed at the context's database.
 *
 * Studio reads its connection from the environment, so opening it from a
 * worktree without setting one shows the database of whatever `.env.local`
 * happens to name — and it looks perfectly correct while doing it.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runDbStudio({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`
${pc.bold('hops db-studio')} — abrir Drizzle Studio

  ${pc.dim('Apuntado a la base del target, no a la que diga el .env.local del')}
  ${pc.dim('directorio. Studio lee la conexión del entorno y no avisa cuál abrió.')}
${whereBlock()}`);
        return 0;
    }

    const { context, runner } = await contextFor({ argv });
    const job = dbJob({ context, script: 'db:studio' });
    if (job === null) {
        process.stderr.write(`${pc.red('ERROR:')} ${explainMissingDb({ context })}\n`);
        return 1;
    }
    return await runner.exec(job);
}
