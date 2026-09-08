import pc from 'picocolors';
import { computeAudit, exitCodeForOutcome } from './compute.ts';
import { fixUnlabeledPrs } from './fix.ts';
import { RANGE } from './range.ts';
import { renderAuditReport } from './report.ts';

/** The help page for the whole `hops whats-new` command. */
export function renderHelp(): string {
    return `
${pc.bold('hops whats-new')} — la novedad se escribe sola; vos revisás y tachás.

${pc.bold('hops whats-new audit')} — ¿tiene cada PR de la promoción una decisión de novedad?

  ${pc.dim('Enumera los PRs mergeados en')} ${pc.bold(RANGE)} ${pc.dim('y falla si alguno')}
  ${pc.dim('no tiene EXACTAMENTE una de las dos etiquetas de decisión:')}

  ${pc.dim('· whats-new-none  — evaluado, no es novedad para un usuario')}
  ${pc.dim('· whats-new-done  — evaluado, produjo (o extendió) una entrada del catálogo')}

  ${pc.dim('Nunca falla por falta de novedad. Sólo por falta de DECISIÓN (HOS-1214 D-2).')}

${pc.bold('Uso')}

  hops whats-new audit
  hops whats-new audit --fix
  hops whats-new pending
  hops whats-new drop <id> [<id>...]

  ${pc.bold('audit')}     Audita el rango de la promoción.
  ${pc.bold('--fix')}     Recorre los PRs sin decisión, pregunta uno por uno, etiqueta.
  ${pc.bold('pending')}   Muestra ENTERAS las entradas que esperan tu revisión
            (las que todavía dicen publishedAt: 'on-promotion').
  ${pc.bold('drop')}      Retira las entradas que nombres: branch, PR y etiquetas.
            Sólo entradas nunca publicadas; no toca RETIRED_WHATS_NEW_IDS.
  ${pc.bold('--help')}    Esta página.

${pc.bold('Qué exime')}

  ${pc.dim('· Autor dependabot[bot] / github-actions[bot] — nunca puede decidir.')}
  ${pc.dim('· Merge commit anterior al cutoff, que se DERIVA: es el commit que')}
  ${pc.dim('  agregó .github/workflows/whats-new-gate.yml («desde que la regla')}
  ${pc.dim('  existe»). Sin configuración. scripts/whats-new-gate-cutoff.txt es')}
  ${pc.dim('  un override opcional: si trae un SHA, gana.')}
  ${pc.dim('  Si la derivación no encuentra nada (¿se renombró el workflow?), no')}
  ${pc.dim('  hay fallback silencioso: sale 3 y lo dice.')}

${pc.bold('Códigos de salida')}

  ${pc.dim('0  limpio · 1  bloqueado · 3  NO SÉ (no pude leer el rango o la API de GitHub)')}

  ${pc.dim('3 nunca es 1: una caída de GitHub no es un PR sin evaluar, y reportarla')}
  ${pc.dim('así manda a etiquetar PRs que ya estaban bien.')}
`;
}

/**
 * Runs `hops whats-new audit`.
 *
 * @param input.argv     - Arguments after the `audit` subcommand token.
 * @param input.repoRoot - Repository root.
 * @param input.cwd      - Directory to run `git`/`gh` from (may be a worktree).
 * @returns The process exit code: `0` clean, `1` blocked, `3` could not
 *          determine (AC-13, via {@link exitCodeForOutcome}).
 */
export async function runWhatsNewAudit({
    argv,
    repoRoot,
    cwd
}: {
    readonly argv: readonly string[];
    readonly repoRoot: string;
    readonly cwd: string;
}): Promise<number> {
    const fix = argv.includes('--fix');

    const outcome = await computeAudit({ repoRoot, cwd });
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
    const rechecked = await computeAudit({ repoRoot, cwd });
    if (!rechecked.ok) {
        process.stderr.write(`${pc.yellow('NO SÉ')}  ${rechecked.reason}\n`);
        return exitCodeForOutcome({ outcome: rechecked });
    }
    process.stdout.write(`${renderAuditReport({ result: rechecked.result })}\n`);
    return exitCodeForOutcome({ outcome: rechecked });
}
