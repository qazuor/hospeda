import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { findPr } from '../../lib/github.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { type Check, explainVerdict, groupChecks, overallVerdict } from './verdict.ts';
import {
    exitCodeFor,
    explainWaitOutcome,
    parseWaitOptions,
    renderWaitHeadline,
    waitForVerdict
} from './wait.ts';

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops ci')} — ¿está verde el PR de esta branch?

  ${pc.dim('Respuesta binaria, no una tabla para interpretar. Resuelve las tres')}
  ${pc.dim('trampas conocidas:')}

  ${pc.dim('· Un check pendiente devuelve conclusion VACÍA, no null — un `// null`')}
  ${pc.dim('  en jq lo deja pasar como verde.')}
  ${pc.dim('· «CI Pass = SUCCESS» ya convivió con «E2E P0 = FAILURE»: se miran')}
  ${pc.dim('  todos los checks, no el agregado.')}
  ${pc.dim('· Un PR en conflicto NO dispara los workflows: cero checks no es')}
  ${pc.dim('  que esté todo bien, es que no corrió nada.')}

${pc.bold('Uso')}

  hops ci [--wt <nombre>] [--all] [--wait [--timeout=<min>]]

  ${pc.bold('--all')}      Lista también los checks que pasaron.
  ${pc.bold('--wait')}     Bloquea hasta que CI cierre y devuelve UNA línea.
  ${pc.bold('--timeout')}  Techo de la espera en minutos (default 30).
  ${pc.bold('--help')}     Esta página.

${pc.bold('Códigos de salida con --wait')}

  ${pc.dim('0  verde · 1  rojo, conflicto, sin PR o error de consulta')}
  ${pc.dim('3  SIN ARRANCAR: cero checks en toda la espera, no corrió nada')}
  ${pc.dim('4  TIMEOUT: seguían corriendo. NO es rojo — no se supo el resultado')}
`;
}

/** Renders one check line. */
function checkLine({ check }: { readonly check: Check }): string {
    const mark =
        check.outcome === 'failed'
            ? pc.red('✗')
            : check.outcome === 'pending'
              ? pc.yellow('◔')
              : pc.green('✓');
    return `  ${mark} ${check.name}  ${pc.dim(check.detail)}`;
}

/**
 * Blocks until the pull request's checks settle, then prints one line.
 *
 * @param input.branch    - The branch being waited on.
 * @param input.cwd       - Where to run `gh`.
 * @param input.timeoutMs - Ceiling for the whole wait.
 * @returns The process exit code.
 */
async function runWait({
    branch,
    cwd,
    timeoutMs
}: {
    readonly branch: string;
    readonly cwd: string;
    readonly timeoutMs: number;
}): Promise<number> {
    const outcome = await waitForVerdict({
        poll: () => findPr({ branch, cwd }),
        sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
        timeoutMs
    });

    process.stderr.write(`${renderWaitHeadline({ outcome, branch })}\n`);

    // Only the checks that explain the headline. A green run prints nothing
    // else: the line IS the answer.
    if (outcome.status !== null && outcome.kind !== 'green') {
        const { failed, pending } = groupChecks({ checks: outcome.status.checks });
        for (const check of failed) process.stderr.write(`${checkLine({ check })}\n`);
        for (const check of pending) process.stderr.write(`${checkLine({ check })}\n`);
    }

    const explanation = explainWaitOutcome({ outcome });
    if (explanation !== null) process.stderr.write(`\n${pc.yellow(explanation)}\n`);

    return exitCodeFor({ kind: outcome.kind });
}

/**
 * Reports whether the current branch's pull request is green.
 *
 * Without `--wait`: 0 green, 1 red or unknown, 2 still running. With `--wait`
 * it blocks until CI settles and uses the codes in {@link exitCodeFor}, where 3
 * and 4 keep "nothing ran" and "still running" distinguishable from a failure.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runCi({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    // Parsed before anything is queried: a bad flag should fail on the spot,
    // not after a thirty-minute wait it was meant to configure.
    const options = parseWaitOptions({ argv });
    if ('error' in options) {
        process.stderr.write(`${pc.red(options.error)}\n`);
        return 1;
    }

    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const cwd = context.worktree?.path ?? context.repoRoot;

    // A branch that could not be resolved is NOT a branch to ask GitHub about.
    // Querying `--head '(desconocida)'` returns zero rows, and zero rows read
    // as "no hay PR" — a confident answer to a question that was never asked.
    const worktree = context.worktree;
    if (worktree === null) {
        process.stderr.write(
            `${pc.red('No pude resolver en qué worktree estoy.')}\n` +
                `${pc.dim('Sin branch no hay PR que consultar: corré esto desde adentro del repo.')}\n`
        );
        return 1;
    }
    if (worktree.detached || worktree.branch === '') {
        process.stderr.write(
            `${pc.red('Este worktree no está en una branch.')} ${pc.dim(worktree.detached ? '(HEAD detached)' : '')}\n` +
                `${pc.dim('No hay branch contra la cual buscar un PR.')}\n`
        );
        return 1;
    }
    const branch = worktree.branch;

    if (branch === 'staging' || branch === 'main') {
        process.stderr.write(
            `${pc.yellow(`Estás en ${branch}.`)} Esa branch no tiene PR propio.\n`
        );
        return 1;
    }

    if (options.wait) {
        return await runWait({ branch, cwd, timeoutMs: options.timeoutMs });
    }

    const found = await findPr({ branch, cwd });
    if (typeof found === 'object' && 'error' in found) {
        process.stderr.write(
            `${pc.red('No pude consultar GitHub.')} ${pc.dim(found.error.split('\n')[0] ?? '')}\n` +
                `${pc.dim('Si dice 401, revisá `gh auth status`: un GITHUB_TOKEN vencido en el')}\n` +
                `${pc.dim('entorno le gana a las credenciales guardadas de gh.')}\n`
        );
        return 1;
    }
    if (found === 'none') {
        process.stderr.write(
            `${pc.yellow('No hay PR para')} ${pc.bold(branch)}.\n` +
                `${pc.dim('Si lo abriste recién, puede tardar un momento en aparecer.')}\n`
        );
        return 1;
    }
    const pr = found;

    const verdict = overallVerdict({ status: pr });
    const { failed, pending, passed } = groupChecks({ checks: pr.checks });

    const headline =
        verdict === 'green'
            ? pc.green('VERDE')
            : verdict === 'red'
              ? pc.red('ROJO')
              : verdict === 'pending'
                ? pc.yellow('TODAVÍA CORRIENDO')
                : verdict === 'conflict'
                  ? pc.red('EN CONFLICTO')
                  : pc.yellow('SIN CHECKS');

    process.stderr.write(
        `${headline}  ${pc.dim(`PR #${pr.number} · ${branch}`)}\n` +
            `${pc.dim(`${passed.length} ok · ${failed.length} fallando · ${pending.length} pendientes`)}\n`
    );

    for (const check of failed) process.stderr.write(`${checkLine({ check })}\n`);
    for (const check of pending) process.stderr.write(`${checkLine({ check })}\n`);
    if (rest.includes('--all')) {
        for (const check of passed) process.stderr.write(`${checkLine({ check })}\n`);
    }

    const explanation = explainVerdict({ status: pr });
    if (explanation !== null) process.stderr.write(`\n${pc.yellow(explanation)}\n`);

    if (verdict === 'green') return 0;
    // Pending is its own exit code: a script that gates on this needs to tell
    // "not finished" apart from "finished badly".
    return verdict === 'pending' ? 2 : 1;
}
