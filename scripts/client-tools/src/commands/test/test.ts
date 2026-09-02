import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';
import {
    CATEGORIES_FILE,
    filesFor,
    groupByPackage,
    listTestFiles,
    orphanFiles,
    type PackageBatch,
    readCategories,
    type TestCategory
} from '../../lib/test-categories.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';

/**
 * Ceiling applied to every batch.
 *
 * Two vitest workers rather than one per core, and a heap cap. The default fan
 * out is what makes a local run take the whole machine down.
 */
const LIMITS = {
    NODE_OPTIONS: '--max-old-space-size=4096',
    VITEST_MAX_THREADS: '2',
    VITEST_MIN_THREADS: '1'
} as const;

/** Above this many files, ask before starting. */
const CONFIRM_ABOVE = 60;

/** The help page. */
function renderHelp({ categories }: { readonly categories: readonly TestCategory[] }): string {
    const rows =
        categories.length === 0
            ? `  ${pc.dim(`(no encontré ${CATEGORIES_FILE})`)}`
            : categories
                  .map((c) => `  ${pc.bold(c.name.padEnd(16))}${pc.dim(c.description)}`)
                  .join('\n');
    return `
${pc.bold('hops test')} — correr los tests de una categoría

  ${pc.dim('Una categoría junta los tests de un tema sin importar en qué paquete')}
  ${pc.dim('viven. Se corren de a un paquete por vez, y sólo los archivos que')}
  ${pc.dim('matchean — nunca la suite entera de un paquete.')}

${pc.bold('Uso')}

  hops test <categoría> [--list] [--infra]
  hops test --orphans

  ${pc.bold('--list')}     Muestra qué correría y no corre nada.
  ${pc.bold('--infra')}    Incluye e2e e integración, que necesitan base y servers.
  ${pc.bold('--orphans')}  Tests que no caen en ninguna categoría — así ves que el
              mapa quedó viejo, en vez de que un test deje de correrse callado.
  ${pc.bold('--help')}     Esta página.

${pc.bold('Categorías')}

${rows}

  ${pc.dim(`Se editan en ${CATEGORIES_FILE}. Se superponen a propósito: un test de`)}
  ${pc.dim('checkout de gastronomía cae en billing Y en gastronomy.')}
`;
}

/** Renders one batch as a line of the plan. */
function batchLine({ batch }: { readonly batch: PackageBatch }): string {
    return `  ${pc.bold(batch.dir.padEnd(24))}${String(batch.files.length).padStart(4)} archivos`;
}

/**
 * Runs the tests of one category, one package at a time.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runTest({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName, rest: args } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const runner = runnerFor({ target });
    const cwd = context.worktree?.path ?? context.repoRoot;

    const categories = readCategories({ repoRoot: cwd });

    if (args.includes('--help') || args.includes('-h')) {
        process.stdout.write(renderHelp({ categories }));
        return 0;
    }

    const files = await listTestFiles({ repoRoot: cwd });

    if (args.includes('--orphans')) {
        const orphans = orphanFiles({ categories, files });
        if (orphans.length === 0) {
            process.stdout.write(`${pc.green('Todos los tests caen en alguna categoría.')}\n`);
            return 0;
        }
        process.stdout.write(
            `${pc.yellow(`${orphans.length} de ${files.length} tests no caen en ninguna categoría:`)}\n`
        );
        for (const file of orphans) process.stdout.write(`  ${file}\n`);
        process.stdout.write(
            `\n${pc.dim(`Si alguno debería correrse con un tema, sumá su patrón en ${CATEGORIES_FILE}.`)}\n`
        );
        return 0;
    }

    const wanted = args.find((arg) => !arg.startsWith('-'));
    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;

    let category = categories.find((entry) => entry.name === wanted);
    if (category === undefined) {
        if (wanted !== undefined) {
            process.stderr.write(`${pc.red(`No existe la categoría «${wanted}».`)}\n`);
            process.stderr.write(`${pc.dim(categories.map((c) => c.name).join(', '))}\n`);
            return 1;
        }
        if (!interactive) {
            process.stdout.write(renderHelp({ categories }));
            return 1;
        }
        const picked = await p.select({
            message: '¿Qué categoría?',
            options: categories.map((entry) => ({
                value: entry.name,
                label: entry.name,
                hint: entry.description
            }))
        });
        if (p.isCancel(picked)) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
        category = categories.find((entry) => entry.name === String(picked));
    }
    if (category === undefined) return 1;

    const includeInfra = args.includes('--infra');
    const selected = filesFor({ category, files, includeInfra });
    const batches = groupByPackage({ files: selected, repoRoot: cwd });
    const inBatches = batches.reduce((sum, batch) => sum + batch.files.length, 0);

    if (batches.length === 0) {
        process.stderr.write(
            `${pc.yellow(`«${category.name}» no matcheó ningún test.`)} ` +
                `${pc.dim(`Revisá sus patrones en ${CATEGORIES_FILE}.`)}\n`
        );
        return 1;
    }

    process.stderr.write(
        `${pc.bold(category.name)}  ${pc.dim(category.description)}\n` +
            `${inBatches} archivos en ${batches.length} paquetes` +
            `${includeInfra ? '' : pc.dim('  ·  sin e2e ni integración (--infra los suma)')}\n\n`
    );
    for (const batch of batches) process.stderr.write(`${batchLine({ batch })}\n`);

    if (args.includes('--list')) return 0;

    // Big runs get a confirmation. The point is that you see the size BEFORE
    // committing the machine to it, not after it stops responding.
    if (inBatches > CONFIRM_ABOVE && interactive) {
        const go = await p.confirm({
            message: `Son ${inBatches} archivos. Va de a un paquete por vez, pero tarda. ¿Arranco?`,
            initialValue: true
        });
        if (p.isCancel(go) || !go) {
            process.stderr.write('Cancelado.\n');
            return 0;
        }
    }

    let failed = 0;
    let done = 0;
    for (const batch of batches) {
        done += 1;
        process.stderr.write(
            `\n${pc.dim(`[${done}/${batches.length}]`)} ${pc.bold(batch.dir)} ` +
                `${pc.dim(`(${batch.files.length} archivos)`)}\n`
        );
        const code = await runner.exec({
            command: 'pnpm',
            args: ['--filter', batch.packageName, 'exec', 'vitest', 'run', ...batch.files],
            cwd,
            env: { ...LIMITS }
        });
        if (code !== 0) {
            failed += 1;
            // Keep going: one package failing does not make the others'
            // results uninteresting, and re-running the whole category to see
            // them is exactly the expensive thing being avoided.
            process.stderr.write(
                `${pc.red(`Falló ${batch.dir}.`)} ${pc.dim('Sigo con el resto.')}\n`
            );
        }
    }

    process.stderr.write(
        `\n${failed === 0 ? pc.green('Todo verde') : pc.red(`${failed} de ${batches.length} paquetes en rojo`)}\n`
    );
    return failed > 0 ? 1 : 0;
}
