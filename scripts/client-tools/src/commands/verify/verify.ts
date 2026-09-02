import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { type CiStep, groupByJob, planFromWorkflow } from './ci-steps.ts';

/** Workflow file the plan is read from. */
const WORKFLOW = '.github/workflows/ci.yml';

/** Jobs whose steps run here, in the order they should. */
const JOBS = ['lint', 'guards', 'typecheck'] as const;

/** Branch the diff is measured against. */
const BASE = 'origin/staging';

/**
 * Resource ceiling applied to every test run.
 *
 * One package at a time (turbo `--concurrency=1`), a bounded number of vitest
 * workers instead of one per core, and a heap cap so a runaway suite kills its
 * own process rather than the session.
 */
const TEST_LIMITS =
    'NODE_OPTIONS=--max-old-space-size=4096 VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1';

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops verify')} — todo lo que CI va a mirar, antes de subir

  ${pc.dim('Los pasos NO están escritos acá: se leen de')} ${pc.bold(WORKFLOW)}${pc.dim('.')}
  ${pc.dim('Una lista propia se desincroniza de CI, y ahí nace el verde local con')}
  ${pc.dim('rojo remoto. Si CI suma un guard mañana, este comando lo corre.')}

${pc.bold('Uso')}

  hops verify [--full] [--only <job>] [--list]

  ${pc.bold('--tests')}       Suma los tests de los paquetes que tocaste. ${pc.dim('No van por default.')}
  ${pc.bold('--full')}        TODOS los tests, un paquete por vez. ${pc.dim('Son miles: dejalo')}
                ${pc.dim('laburando y andá a hacer otra cosa.')}
  ${pc.bold('--only <job>')}  Sólo un job: ${JOBS.join(', ')}, tests.
  ${pc.bold('--list')}        Muestra el plan y no corre nada.
  ${pc.bold('--help')}        Esta página.

${pc.bold('Los tests no corren por default')}

  ${pc.dim('Y no es prudencia de más: la primera versión filtraba con `...[ref]`,')}
  ${pc.dim('cuyos tres puntos significan «los paquetes que tocaste Y TODO lo que')}
  ${pc.dim('dependa de ellos». Tocar @repo/schemas arrastraba el monorepo entero')}
  ${pc.dim('y tumbaba la máquina. Ahora: un paquete por vez, workers acotados.')}

${pc.bold('Orden')}

  De barato a caro — ${JOBS.join(' → ')} → tests — y frena en el primero
  que rompe. Lo que falla primero suele ser lo que explica el resto.
`;
}

/** Reads the workflow, returning null when it cannot be found. */
function readWorkflow({ repoRoot }: { readonly repoRoot: string }): string | null {
    try {
        return readFileSync(join(repoRoot, WORKFLOW), 'utf8');
    } catch {
        return null;
    }
}

/**
 * Lists the workspace packages touched since the base branch.
 *
 * @param input.cwd - Directory to run git from.
 * @returns Package directory names, empty when nothing or on failure.
 */
export async function changedPackages({
    cwd
}: {
    readonly cwd: string;
}): Promise<readonly string[]> {
    const diff = await run({
        command: 'git',
        args: ['diff', '--name-only', `${BASE}...HEAD`],
        cwd,
        timeoutMs: 60_000
    });
    if (!diff.ok) return [];
    const dirs = new Set<string>();
    for (const file of diff.stdout.split('\n')) {
        const match = /^(apps|packages)\/([^/]+)\//.exec(file.trim());
        if (match?.[2] !== undefined) dirs.add(match[2]);
    }
    return [...dirs].sort();
}

/**
 * Builds the test step for this run, or `null` when tests were not asked for.
 *
 * Tests are OPT-IN, and this is not caution for its own sake: the first version
 * of this command filtered with `...[ref]`, whose leading dots mean "the
 * changed packages AND everything that depends on them". Touching
 * `@repo/schemas` therefore pulled in the entire monorepo — 4.000 test files,
 * turbo running four packages at once, each vitest spawning a worker per core.
 * It took the machine down hard enough to need a reboot.
 *
 * So: no leading dots, one package at a time, and a worker ceiling.
 *
 * @param input.wanted  - Whether `--tests` was passed.
 * @param input.full    - Whether to ignore the diff and run everything.
 * @param input.changed - Packages touched since the base branch.
 * @returns The step, or `null`.
 */
function testStep({
    wanted,
    full,
    changed
}: {
    readonly wanted: boolean;
    readonly full: boolean;
    readonly changed: readonly string[];
}): CiStep | null {
    if (!wanted) return null;
    if (full) {
        return {
            job: 'tests',
            name: 'TODOS los tests (secuencial)',
            run: `${TEST_LIMITS} pnpm exec turbo run test --concurrency=1`
        };
    }
    if (changed.length === 0) return null;
    // `[ref]` without the leading dots: only what changed, never its dependents.
    return {
        job: 'tests',
        name: `Tests de lo que tocaste (${changed.join(', ')})`,
        run: `${TEST_LIMITS} pnpm exec turbo run test --concurrency=1 --filter='[${BASE}]'`
    };
}

/**
 * Runs everything CI checks, in CI's own order, stopping at the first failure.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runVerify({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const runner = runnerFor({ target });
    const cwd = context.worktree?.path ?? context.repoRoot;

    const yaml = readWorkflow({ repoRoot: cwd });
    if (yaml === null) {
        process.stderr.write(`${pc.red('ERROR:')} no encontré ${WORKFLOW} en ${cwd}.\n`);
        return 1;
    }

    const only = rest.includes('--only') ? rest[rest.indexOf('--only') + 1] : undefined;
    const jobs = only === undefined ? JOBS : JOBS.filter((job) => job === only);
    const plan = planFromWorkflow({ yaml, jobs: [...jobs] });

    const full = rest.includes('--full');
    const wantsTests = rest.includes('--tests') || full || only === 'tests';
    const changed = full || !wantsTests ? [] : await changedPackages({ cwd });
    const tests =
        only === undefined || only === 'tests'
            ? testStep({ wanted: wantsTests, full, changed })
            : null;

    const groups = groupByJob({ steps: plan.steps });
    const total = plan.steps.length + (tests === null ? 0 : 1);

    if (rest.includes('--list')) {
        for (const group of groups) {
            process.stdout.write(`\n${pc.bold(group.job)}  ${pc.dim(`(${group.steps.length})`)}\n`);
            for (const step of group.steps) process.stdout.write(`  ${step.name}\n`);
        }
        if (tests !== null) process.stdout.write(`\n${pc.bold('tests')}\n  ${tests.name}\n`);
        if (plan.skipped.length > 0) {
            process.stdout.write(`\n${pc.dim('No corren acá:')}\n`);
            for (const s of plan.skipped) {
                process.stdout.write(`  ${pc.dim(`${s.name} — ${s.reason}`)}\n`);
            }
        }
        return 0;
    }

    if (total === 0) {
        process.stderr.write(
            only === undefined
                ? `${pc.yellow('El workflow no tiene pasos ejecutables acá.')}\n`
                : `${pc.red(`«${only}» no es uno de los jobs.`)} Probá: ${[...JOBS, 'tests'].join(', ')}\n`
        );
        return only === undefined ? 1 : 1;
    }

    process.stderr.write(
        `${pc.dim(`${total} pasos, leídos de ${WORKFLOW}`)}` +
            `${plan.skipped.length > 0 ? pc.dim(`  ·  ${plan.skipped.length} no aplican acá`) : ''}\n`
    );

    let done = 0;
    for (const step of [...plan.steps, ...(tests === null ? [] : [tests])]) {
        done += 1;
        process.stderr.write(
            `\n${pc.dim(`[${done}/${total}]`)} ${pc.bold(step.job)} ${pc.dim('·')} ${step.name}\n`
        );
        // Through a shell because CI's own steps are shell: several are `if
        // grep ...; then ... fi` one-liners, not single commands.
        const code = await runner.exec({
            command: 'bash',
            args: ['-c', step.run],
            cwd
        });
        if (code !== 0) {
            process.stderr.write(
                `\n${pc.red(`Falló: ${step.name}`)}\n` +
                    `${pc.dim(`Es el paso ${done} de ${total}. No sigo: lo que rompe primero suele explicar el resto.`)}\n`
            );
            return code;
        }
    }

    if (tests === null && !wantsTests) {
        process.stderr.write(
            `\n${pc.dim('Sin tests. Pedilos con --tests (sólo lo que tocaste) o --full (todo).')}\n`
        );
    } else if (tests === null) {
        process.stderr.write(
            `\n${pc.dim(`Sin tests: no hay cambios en apps/ ni packages/ contra ${BASE}.`)}\n`
        );
    }
    return 0;
}
