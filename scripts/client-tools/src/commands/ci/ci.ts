import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { run } from '../../lib/exec.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import {
    type Check,
    classifyCheck,
    explainVerdict,
    groupChecks,
    overallVerdict,
    type PrStatus,
    type RawCheck
} from './verdict.ts';

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

  hops ci [--wt <nombre>] [--all]

  ${pc.bold('--all')}   Lista también los checks que pasaron.
  ${pc.bold('--help')}  Esta página.
`;
}

/**
 * Runs `gh` with the ambient token cleared.
 *
 * A stale `GITHUB_TOKEN` in the shell wins over `gh`'s own stored credentials
 * and every call answers 401 — which, read as "no data", becomes a confident
 * "no hay PR" for a branch that has one. Measured: this repo's flows all clear
 * it for the same reason.
 */
async function gh({
    args,
    cwd
}: {
    readonly args: readonly string[];
    readonly cwd: string;
}): Promise<{ readonly ok: boolean; readonly stdout: string; readonly error: string }> {
    return await run({ command: 'gh', args, cwd, timeoutMs: 120_000, env: { GITHUB_TOKEN: '' } });
}

/** Reads the pull request for a branch, if there is one. */
async function findPr({
    branch,
    cwd
}: {
    readonly branch: string;
    readonly cwd: string;
}): Promise<PrStatus | 'none' | { readonly error: string }> {
    const listed = await gh({
        args: [
            'pr',
            'list',
            '--head',
            branch,
            '--state',
            'all',
            '--limit',
            '1',
            '--json',
            'number,state,mergeable,statusCheckRollup'
        ],
        cwd
    });
    // A failed query is NOT "no pull request": saying so would report a branch
    // as PR-less because a credential expired.
    if (!listed.ok) return { error: listed.error };

    let parsed: readonly {
        number?: number;
        state?: string;
        mergeable?: string;
        statusCheckRollup?: readonly RawCheck[] | null;
    }[];
    try {
        parsed = JSON.parse(listed.stdout) as typeof parsed;
    } catch {
        return { error: 'gh devolvió algo que no pude interpretar' };
    }
    const pr = parsed[0];
    if (pr?.number === undefined) return 'none';

    return {
        number: pr.number,
        state: pr.state ?? 'UNKNOWN',
        mergeable: pr.mergeable ?? 'UNKNOWN',
        checks: (pr.statusCheckRollup ?? []).map((raw) => classifyCheck({ raw }))
    };
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
 * Reports whether the current branch's pull request is green.
 *
 * @param input.argv - Arguments after the command name.
 * @returns 0 when green, 1 when red or unknown, 2 when still running.
 */
export async function runCi({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const cwd = context.worktree?.path ?? context.repoRoot;
    const branch = context.worktree?.branch ?? '(desconocida)';

    if (branch === 'staging' || branch === 'main') {
        process.stderr.write(
            `${pc.yellow(`Estás en ${branch}.`)} Esa branch no tiene PR propio.\n`
        );
        return 1;
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
