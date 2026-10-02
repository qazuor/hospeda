import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { loadProjectAdapter } from '../../lib/project-config.ts';
import { runnerFor } from '../../lib/runner.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { type CiStep, groupByJob, planFromWorkflow } from './ci-steps.ts';

/** Workflow file the plan is read from. */
const WORKFLOW = '.github/workflows/ci.yml';

/** Jobs whose steps run here, in the order they should. */
const JOBS = ['lint', 'guards', 'typecheck'] as const;

/** Branch the diff is measured against. */
const FALLBACK_BASE = 'origin/staging';

/** Resolves the configured integration base without fetching or mutating Git. */
async function resolveBaseRef({
    cwd,
    branch
}: {
    readonly cwd: string;
    readonly branch: string;
}): Promise<string> {
    for (const candidate of [`origin/${branch}`, branch]) {
        const result = await run({
            command: 'git',
            args: ['rev-parse', '--verify', candidate],
            cwd
        });
        if (result.ok) return candidate;
    }
    return `origin/${branch}`;
}

/**
 * Resource ceiling applied to every test run.
 *
 * One package at a time (turbo `--concurrency=1`), a bounded number of vitest
 * workers instead of one per core, and a heap cap so a runaway suite kills its
 * own process rather than the session.
 */
const TEST_LIMITS =
    'NODE_OPTIONS=--max-old-space-size=4096 VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1';

/**
 * Codex's workspace sandbox can reject the Unix pipes that tsx creates under
 * /tmp. Keep the normal first attempt unchanged, then retry only that specific
 * failure with a per-run temporary directory inside the writable worktree.
 * The directory is removed before this command returns, so verify keeps its
 * read-only contract for callers.
 */
function isSandboxTsxFailure(stderr: string): boolean {
    return /(?:EPERM|EACCES).*?(?:tsx|pipe)|(?:tsx|pipe).*?(?:EPERM|EACCES)/is.test(stderr);
}

/** Creates a transient retry directory only when the project already has .qz. */
async function createVerifyTmp(cwd: string): Promise<string | undefined> {
    const qzDirectory = join(cwd, '.qz');
    if (!existsSync(qzDirectory)) return undefined;
    try {
        return await mkdtemp(join(qzDirectory, 'verify-tmp-'));
    } catch {
        return undefined;
    }
}

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops verify')} — todo lo que CI va a mirar, antes de subir

  ${pc.dim('Los pasos NO están escritos acá: se leen de')} ${pc.bold(WORKFLOW)}${pc.dim('.')}
  ${pc.dim('Una lista propia se desincroniza de CI, y ahí nace el verde local con')}
  ${pc.dim('rojo remoto. Si CI suma un guard mañana, este comando lo corre.')}

${pc.bold('Uso')}

  hops verify [--changed] [--full] [--only <job>] [--list] [--json]

  ${pc.bold('--changed')}     Corre tests de los paquetes afectados además de lint/guards/typecheck.
  ${pc.bold('--tests')}       Alias explícito de --changed.
  ${pc.bold('--full')}        TODOS los tests, un paquete por vez. ${pc.dim('Son miles: dejalo')}
                ${pc.dim('laburando y andá a hacer otra cosa.')}
  ${pc.bold('--only <job>')}  Sólo un job: ${JOBS.join(', ')}, tests.
    ${pc.bold('--list')}        Muestra el plan y no corre nada.
  ${pc.bold('--json')}        Devuelve un contrato estable para agentes; no mezcla logs de los checks.
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
 * Lists workspace package paths touched since the base branch.
 *
 * @param input.cwd - Directory to run git from.
 * @returns Package directory names, empty when nothing or on failure.
 */
export async function changedPackages({
    cwd,
    baseRef = FALLBACK_BASE
}: {
    readonly cwd: string;
    readonly baseRef?: string;
}): Promise<readonly string[]> {
    const diff = await run({
        command: 'git',
        args: ['diff', '--name-only', `${baseRef}...HEAD`],
        cwd,
        timeoutMs: 60_000
    });
    if (!diff.ok) return [];
    const dirs = new Set<string>();
    for (const file of diff.stdout.split('\n')) {
        const match = /^(apps|packages)\/([^/]+)\//.exec(file.trim());
        if (match?.[1] !== undefined && match[2] !== undefined) {
            dirs.add(`${match[1]}/${match[2]}`);
        }
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
    // Explicit path filters avoid Turbo's `[ref]` range selector, which can
    // expand to every workspace when the branch diverges or global files
    // changed. Build dependencies are still handled by the task graph.
    const filters = changed.map((path) => `--filter=./${path}`).join(' ');
    return {
        job: 'tests',
        name: `Tests de lo que tocaste (${changed.join(', ')})`,
        run: `${TEST_LIMITS} pnpm exec turbo run test --concurrency=1 ${filters}`
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
    const json = rest.includes('--json');
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const runner = runnerFor({ target });
    const cwd = context.worktree?.path ?? context.repoRoot;
    const adapter = await loadProjectAdapter(context.repoRoot);
    const baseBranch = adapter?.branches?.base ?? 'staging';
    const baseRef = await resolveBaseRef({ cwd, branch: baseBranch });

    const generatedPaths = adapter?.verification?.generatedPaths ?? [];
    const missingGenerated = generatedPaths.filter((path) => !existsSync(join(cwd, path)));
    if (missingGenerated.length > 0) {
        const build = adapter?.verification?.build ?? adapter?.worktree?.build ?? 'pnpm build';
        if (json) {
            process.stdout.write(
                `${JSON.stringify({
                    readOnly: true,
                    status: 'blocked',
                    reason: 'generated_prerequisites_missing',
                    missingGenerated,
                    build,
                    mutations: 'none'
                })}\n`
            );
        } else {
            process.stderr.write(
                `${pc.yellow('verify bloqueado: faltan outputs generados')}\n` +
                    `${missingGenerated.map((path) => `  - ${path}`).join('\n')}\n` +
                    `${pc.dim(`Ejecutá ${build} y repetí qz verify. Este comando no ejecuta builds automáticamente.`)}\n`
            );
        }
        return 2;
    }

    const yaml = readWorkflow({ repoRoot: cwd });
    if (yaml === null) {
        if (json) {
            process.stdout.write(
                `${JSON.stringify({ readOnly: true, status: 'error', error: `workflow_missing:${WORKFLOW}`, mutations: 'none' })}\n`
            );
            return 1;
        }
        process.stderr.write(`${pc.red('ERROR:')} no encontré ${WORKFLOW} en ${cwd}.\n`);
        return 1;
    }

    const only = rest.includes('--only') ? rest[rest.indexOf('--only') + 1] : undefined;
    const jobs = only === undefined ? JOBS : JOBS.filter((job) => job === only);
    const plan = planFromWorkflow({ yaml, jobs: [...jobs] });

    const full = rest.includes('--full');
    const wantsTests =
        rest.includes('--changed') || rest.includes('--tests') || full || only === 'tests';
    const changed = full || !wantsTests ? [] : await changedPackages({ cwd, baseRef });
    const tests =
        only === undefined || only === 'tests'
            ? testStep({ wanted: wantsTests, full, changed })
            : null;

    const groups = groupByJob({ steps: plan.steps });
    const total = plan.steps.length + (tests === null ? 0 : 1);

    const plannedSteps = [
        ...plan.steps.map((step) => ({
            job: step.job,
            name: step.name,
            workingDirectory: step.workingDirectory ?? null
        })),
        ...(tests === null
            ? []
            : [
                  {
                      job: tests.job,
                      name: tests.name,
                      workingDirectory: tests.workingDirectory ?? null
                  }
              ])
    ];

    if (rest.includes('--list')) {
        if (json) {
            process.stdout.write(
                `${JSON.stringify({
                    readOnly: true,
                    status: 'planned',
                    workflow: WORKFLOW,
                    mode: full ? 'full' : wantsTests ? 'changed' : 'guards',
                    base: baseRef,
                    changedPackages: changed,
                    steps: plannedSteps,
                    skipped: plan.skipped.map((step) => ({ name: step.name, reason: step.reason })),
                    total,
                    mutations: 'none'
                })}\n`
            );
            return 0;
        }
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
        if (json) {
            process.stdout.write(
                `${JSON.stringify({ readOnly: true, status: 'error', error: only === undefined ? 'no_steps' : `unknown_job:${only}`, mutations: 'none' })}\n`
            );
            return 1;
        }
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
    const results: { job: string; name: string; code: number; passed: boolean }[] = [];
    let sandboxTmp: string | undefined;
    try {
        for (const step of [...plan.steps, ...(tests === null ? [] : [tests])]) {
            done += 1;
            process.stderr.write(
                `\n${pc.dim(`[${done}/${total}]`)} ${pc.bold(step.job)} ${pc.dim('·')} ${step.name}\n`
            );
            // Through a shell because CI's own steps are shell: several are `if
            // grep ...; then ... fi` one-liners, not single commands.
            const job = {
                command: 'bash',
                args: ['-c', step.run],
                cwd: step.workingDirectory === undefined ? cwd : resolve(cwd, step.workingDirectory),
                // CI injects BASE_SHA for guards that inspect the diff. Local
                // verify has the same contract: use the configured local base so
                // those guards do not fail closed merely because they are outside
                // GitHub Actions.
                env: {
                    BASE_SHA: process.env.BASE_SHA ?? baseRef,
                    ...(sandboxTmp === undefined ? {} : { TMPDIR: sandboxTmp, TMP: sandboxTmp, TEMP: sandboxTmp })
                }
            } as const;
            let captured: Awaited<ReturnType<typeof runner.execCapture>> | null = null;
            let code: number;
            if (json) {
                captured = await runner.execCapture(job);
                code = captured.code;
            } else {
                code = await runner.exec(job);
            }

            // A Codex workspace can write the repository but not create the
            // pipes tsx puts under /tmp. Retry only that known environmental
            // error; ordinary test failures must still fail immediately.
            if (json && code !== 0 && captured !== null && isSandboxTsxFailure(captured.stderr)) {
                sandboxTmp ??= await createVerifyTmp(cwd);
                if (sandboxTmp !== undefined) {
                    const retryJob = {
                        ...job,
                        env: { ...job.env, TMPDIR: sandboxTmp, TMP: sandboxTmp, TEMP: sandboxTmp }
                    } as const;
                    captured = await runner.execCapture(retryJob);
                    code = captured.code;
                }
            }

            results.push({ job: step.job, name: step.name, code, passed: code === 0 });
            if (code !== 0) {
                if (json) {
                    process.stdout.write(
                        `${JSON.stringify({
                            readOnly: true,
                            status: 'failed',
                            workflow: WORKFLOW,
                            mode: full ? 'full' : wantsTests ? 'changed' : 'guards',
                            base: baseRef,
                            changedPackages: changed,
                            steps: results,
                            skipped: plan.skipped.map((item) => ({
                                name: item.name,
                                reason: item.reason
                            })),
                            total,
                            failedStep: step.name,
                            mutations: 'none'
                        })}\n`
                    );
                }
                process.stderr.write(
                    `\n${pc.red(`Falló: ${step.name}`)}\n` +
                        `${pc.dim(`Es el paso ${done} de ${total}. No sigo: lo que rompe primero suele explicar el resto.`)}\n`
                );
                return code;
            }
        }
    } finally {
        if (sandboxTmp !== undefined) await rm(sandboxTmp, { recursive: true, force: true });
    }

    if (json) {
        process.stdout.write(
            `${JSON.stringify({
                readOnly: true,
                status: 'passed',
                workflow: WORKFLOW,
                mode: full ? 'full' : wantsTests ? 'changed' : 'guards',
                base: baseRef,
                changedPackages: changed,
                steps: results,
                skipped: plan.skipped.map((item) => ({ name: item.name, reason: item.reason })),
                total,
                mutations: 'none'
            })}\n`
        );
    }

    if (tests === null && !wantsTests) {
        process.stderr.write(
            `\n${pc.dim('Sin tests. Pedilos con --changed (sólo lo que tocaste) o --full (todo).')}\n`
        );
    } else if (tests === null) {
        process.stderr.write(
            `\n${pc.dim(`Sin tests: no hay cambios en apps/ ni packages/ contra ${baseRef}.`)}\n`
        );
    }
    return 0;
}
