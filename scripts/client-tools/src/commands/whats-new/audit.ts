import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { computeAudit, exitCodeForOutcome } from './compute.ts';
import { fixUnlabeledPrs } from './fix.ts';
import { RANGE } from './range.ts';
import { renderAuditReport } from './report.ts';

/** The help page. */
function renderHelp(): string {
    return `
${pc.bold('hops whats-new audit')} — ¿tiene cada PR de la promoción una decisión de novedad?

  ${pc.dim('Enumera los PRs mergeados en')} ${pc.bold(RANGE)} ${pc.dim('y falla si alguno')}
  ${pc.dim('no tiene EXACTAMENTE una de las dos etiquetas de decisión:')}

  ${pc.dim('· whats-new-none  — evaluado, no es novedad para un usuario')}
  ${pc.dim('· whats-new-done  — evaluado, produjo (o extendió) una entrada del catálogo')}

  ${pc.dim('Nunca falla por falta de novedad. Sólo por falta de DECISIÓN (HOS-1214 D-2).')}

${pc.bold('Uso')}

  hops whats-new audit
  hops whats-new audit --fix

  ${pc.bold('--fix')}    Recorre los PRs sin decisión, pregunta uno por uno, etiqueta.
  ${pc.bold('--help')}   Esta página.

${pc.bold('Qué exime')}

  ${pc.dim('· Autor dependabot[bot] / github-actions[bot] — nunca puede decidir.')}
  ${pc.dim('· Merge commit anterior al cutoff configurado en')}
  ${pc.dim('  scripts/whats-new-gate-cutoff.txt (fuente única, compartida con el')}
  ${pc.dim('  workflow de CI que audita la promoción).')}

${pc.bold('Códigos de salida')}

  ${pc.dim('0  limpio · 1  bloqueado · 3  NO SÉ (no pude leer el rango o la API de GitHub)')}

  ${pc.dim('3 nunca es 1: una caída de GitHub no es un PR sin evaluar, y reportarla')}
  ${pc.dim('así manda a etiquetar PRs que ya estaban bien.')}
`;
}

/**
 * Runs `hops whats-new audit`.
 *
 * @param input.argv - Arguments after the command name (includes the `audit`
 *                      subcommand token itself, plus `--target`/`--wt`, which
 *                      are stripped here the same way every other command
 *                      strips them).
 * @returns The process exit code: `0` clean, `1` blocked, `3` could not
 *          determine (AC-13, via {@link exitCodeForOutcome}).
 */
export async function runWhatsNewAudit({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    const { target, rest: afterTarget } = extractTarget({ argv });
    const { name: worktreeName, rest: afterWt } = extractWorktreeFlag({ argv: afterTarget });

    if (afterWt.includes('--help') || afterWt.includes('-h')) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const [subcommand, ...subArgv] = afterWt;
    if (subcommand !== 'audit') {
        process.stderr.write(
            `${pc.red('Subcomando desconocido:')} ${pc.bold(`hops whats-new ${subcommand ?? ''}`.trim())}\n` +
                `${pc.dim('El único subcomando hoy es `audit`.')}\n\n`
        );
        process.stdout.write(renderHelp());
        return 1;
    }
    const fix = subArgv.includes('--fix');

    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const cwd = context.worktree?.path ?? context.repoRoot;

    const outcome = await computeAudit({ repoRoot: context.repoRoot, cwd });
    if (!outcome.ok) {
        process.stderr.write(`${pc.yellow('NO SÉ')}  ${outcome.reason}\n`);
        return exitCodeForOutcome({ outcome });
    }

    if (!fix) {
        process.stdout.write(`${renderAuditReport({ result: outcome.result })}\n`);
        return exitCodeForOutcome({ outcome });
    }

    if (outcome.result.unlabeled.length === 0) {
        process.stdout.write(
            `${pc.dim('Nada sin etiquetar.')}\n${renderAuditReport({ result: outcome.result })}\n`
        );
        return exitCodeForOutcome({ outcome });
    }

    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;
    if (!interactive) {
        process.stderr.write(
            `${pc.yellow('Sin terminal, no puedo preguntar.')} ` +
                `Corré \`hops whats-new audit --fix\` en tu shell.\n\n`
        );
        process.stdout.write(`${renderAuditReport({ result: outcome.result })}\n`);
        return exitCodeForOutcome({ outcome });
    }

    const fixed = await fixUnlabeledPrs({ unlabeled: outcome.result.unlabeled, cwd });
    if (!fixed) return 1;

    // Re-computed from scratch, not patched locally: trusting our own writes
    // instead of re-reading GitHub is exactly the "the same system that did
    // the work reports success" trap. A stray `conflict` or a direct push
    // left over from before `--fix` ran must still show up in the exit code.
    const rechecked = await computeAudit({ repoRoot: context.repoRoot, cwd });
    if (!rechecked.ok) {
        process.stderr.write(`${pc.yellow('NO SÉ')}  ${rechecked.reason}\n`);
        return exitCodeForOutcome({ outcome: rechecked });
    }
    process.stdout.write(`${renderAuditReport({ result: rechecked.result })}\n`);
    return exitCodeForOutcome({ outcome: rechecked });
}
