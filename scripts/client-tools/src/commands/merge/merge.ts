import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { findPr, type PrLookup } from '../../lib/github.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { evaluateMergeGate, exitCodeForGate, type MergeGateResult } from './gate.ts';

/** How many times a still-computing mergeability is re-asked. */
export const UNKNOWN_RETRIES = 3;
/** Pause between those retries. */
const RETRY_PAUSE_MS = 2_000;

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops merge')} — ¿se puede mergear el PR de esta branch?

  ${pc.dim('Un veredicto, con UNA razón: la primera que bloquea. No una tabla')}
  ${pc.dim('de seis campos para interpretar a mano cada vez.')}

  ${pc.dim('NO mergea. Dictamina. El merge sigue siendo tuyo.')}

${pc.bold('Uso')}

  hops merge [--wt <nombre>]

${pc.bold('Qué mira')}

  ${pc.dim('· Que esté abierto, no sea draft y apunte a staging.')}
  ${pc.dim('· mergeable / mergeStateStatus, reconsultando mientras den UNKNOWN:')}
  ${pc.dim('  GitHub los calcula recién cuando se los pide, y contesta UNKNOWN')}
  ${pc.dim('  en la primera consulta. Leer eso como «se puede» es fail-open.')}
  ${pc.dim('· BEHIND bloquea aunque esté todo verde: esos checks son de otro')}
  ${pc.dim('  merge-base y no dicen nada del código que se mergearía.')}
  ${pc.dim('· Los checks, uno por uno, nunca el agregado.')}

  ${pc.dim('NO mira el título: de eso ya se ocupa el check «Validate PR Title»,')}
  ${pc.dim('y su resultado llega con los demás checks.')}

${pc.bold('Códigos de salida')}

  ${pc.dim('0  LISTO · 1  BLOQUEADO · 3  NO SÉ (GitHub no contestó)')}

  ${pc.bold('--help')}  Esta página.
`;
}

/**
 * Reads the pull request, re-asking while GitHub is still computing.
 *
 * @param input.branch - Branch to look up.
 * @param input.cwd    - Repository directory.
 * @param input.sleep  - Pause between attempts.
 * @returns The last lookup made.
 */
export async function fetchSettledPr({
    branch,
    cwd,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    attempts = UNKNOWN_RETRIES
}: {
    readonly branch: string;
    readonly cwd: string;
    readonly sleep?: (ms: number) => Promise<void>;
    readonly attempts?: number;
}): Promise<PrLookup> {
    let last: PrLookup = { error: 'no se consultó nada' };

    for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
        last = await findPr({ branch, cwd });
        if (typeof last !== 'object' || 'error' in last) return last;
        const stillComputing =
            last.mergeable === 'UNKNOWN' || last.mergeStateStatus === 'UNKNOWN';
        if (!stillComputing) return last;
        if (attempt < attempts - 1) await sleep(RETRY_PAUSE_MS);
    }
    return last;
}

/** Renders the verdict line. */
function renderVerdict({
    result,
    number,
    branch,
    title
}: {
    readonly result: MergeGateResult;
    readonly number: number;
    readonly branch: string;
    readonly title: string;
}): string {
    const where = pc.dim(`PR #${number} · ${branch}`);
    if (result.verdict === 'ready') {
        return (
            `${pc.green('LISTO')}  ${where}\n` +
            `${pc.dim(title)}\n\n` +
            `${pc.dim('Para mergear:')} GITHUB_TOKEN= gh pr merge ${number} --merge\n`
        );
    }
    if (result.verdict === 'unknown') {
        return `${pc.yellow('NO SÉ')}  ${where}\n${pc.yellow(result.reason)}\n`;
    }
    return `${pc.red('BLOQUEADO')}  ${where}\n${pc.yellow(result.reason)}\n`;
}

/**
 * Reports whether the current branch's pull request may be merged.
 *
 * @param input.argv - Arguments after the command name.
 * @returns 0 when ready, 1 when blocked, 3 when GitHub never answered.
 */
export async function runMerge({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const { target, rest } = extractTarget({ argv });
    const { name: worktreeName } = extractWorktreeFlag({ argv: rest });
    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const cwd = context.worktree?.path ?? context.repoRoot;
    const worktree = context.worktree;

    // Same refusal as `ci`: a branch that could not be resolved is not a branch
    // to ask GitHub about.
    if (worktree === null || worktree.detached || worktree.branch === '') {
        process.stderr.write(
            `${pc.red('No pude resolver la branch de este worktree.')}\n` +
                `${pc.dim('Sin branch no hay PR que evaluar.')}\n`
        );
        return 1;
    }
    if (worktree.branch === 'staging' || worktree.branch === 'main') {
        process.stderr.write(
            `${pc.yellow(`Estás en ${worktree.branch}.`)} Esa branch no tiene PR propio.\n`
        );
        return 1;
    }

    const found = await fetchSettledPr({ branch: worktree.branch, cwd });
    if (typeof found === 'object' && 'error' in found) {
        process.stderr.write(
            `${pc.red('No pude consultar GitHub.')} ${pc.dim(found.error.split('\n')[0] ?? '')}\n` +
                `${pc.dim('Si dice 401, un GITHUB_TOKEN vencido le gana a las credenciales de gh.')}\n`
        );
        return 1;
    }
    if (found === 'none') {
        process.stderr.write(`${pc.yellow('No hay PR para')} ${pc.bold(worktree.branch)}.\n`);
        return 1;
    }

    const result = evaluateMergeGate({ pr: found });
    process.stderr.write(
        renderVerdict({
            result,
            number: found.number,
            branch: worktree.branch,
            title: found.title
        })
    );
    return exitCodeForGate({ verdict: result.verdict });
}
