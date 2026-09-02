import pc from 'picocolors';
import { isProtectedBranch } from './selection.ts';
import type { WorktreeInfo, WorktreeState } from './types.ts';

/** Short label shown next to each worktree, per state. */
const STATE_LABEL: Record<WorktreeState, string> = {
    merged: pc.green('terminado'),
    unmerged: pc.yellow('sin mergear'),
    uncommitted: pc.red('sin commitear'),
    missing: pc.dim('fantasma')
};

/** Width the directory name is padded to so the marks line up. */
const NAME_PAD = 42;

/**
 * Renders a size in MB as a human-readable string.
 *
 * @param input.mb - Size in megabytes; 0 renders as a dash.
 * @returns e.g. `1.2 GB`, `820 MB`, or `—`.
 */
export function formatSize({ mb }: { readonly mb: number }): string {
    if (mb <= 0) return '—';
    if (mb < 1024) return `${mb} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
}

/**
 * Builds the risk marks shown after a worktree's name.
 *
 * Each mark names a distinct thing that would be lost, so a reader can tell
 * "3 archivos sin commitear" apart from "nunca pusheado" without opening the
 * worktree.
 *
 * @param input.worktree - The worktree to describe.
 * @returns Zero or more coloured marks.
 */
export function formatMarks({ worktree }: { readonly worktree: WorktreeInfo }): readonly string[] {
    const marks: string[] = [];
    if (worktree.dirty > 0) marks.push(pc.red(`${worktree.dirty} sin commitear`));
    if (worktree.ahead > 0) marks.push(pc.yellow(`${worktree.ahead} commits`));
    if (worktree.unpushed === null && worktree.ahead > 0) marks.push(pc.red('nunca pusheado'));
    else if (worktree.unpushed !== null && worktree.unpushed > 0) {
        marks.push(pc.yellow(`${worktree.unpushed} sin pushear`));
    }
    if (worktree.isMain) marks.push(pc.cyan('[clon principal]'));
    if (worktree.branch === 'staging') marks.push(pc.cyan('[hogar de hops]'));
    if (worktree.isCurrent) marks.push(pc.cyan('[estás acá]'));
    return marks;
}

/** Indent of the second label line, aligning it under the worktree name. */
const DETAIL_INDENT = ' '.repeat(10);

/**
 * Formats the first line of an option: size, name, state and risk marks.
 *
 * @param input.worktree - The worktree to render.
 * @returns A single line.
 */
export function formatWorktreeHeadline({ worktree }: { readonly worktree: WorktreeInfo }): string {
    const size = formatSize({ mb: worktree.mb }).padStart(8);
    const name = worktree.name.slice(0, NAME_PAD).padEnd(NAME_PAD + 1);
    const marks = formatMarks({ worktree });
    const suffix = marks.length > 0 ? `  ${marks.join('  ')}` : '';
    return `${size}  ${pc.bold(name)}${STATE_LABEL[worktree.state]}${suffix}`;
}

/**
 * Formats the branch and age line, shown under every option.
 *
 * This is part of the LABEL, not Clack's `hint`, because a hint is only drawn
 * for the highlighted option — and the branch is exactly what you need to see
 * across the whole list at once to decide what to delete.
 *
 * A recycled worktree keeps the directory name of whatever it was created for,
 * so when the name and the branch disagree the branch is the truth and the
 * mismatch is called out rather than left for the reader to spot.
 *
 * @param input.worktree - The worktree to describe.
 * @returns A single dim line: branch, optional mismatch warning, and age.
 */
export function formatWorktreeDetail({ worktree }: { readonly worktree: WorktreeInfo }): string {
    const nameId = /\b([a-z]+-\d+)\b/i.exec(worktree.name)?.[1]?.toUpperCase();
    const branchId = /\b([a-z]+-\d+)\b/i.exec(worktree.branch)?.[1]?.toUpperCase();
    const mismatch = nameId !== undefined && branchId !== undefined && nameId !== branchId;
    const warning = mismatch ? pc.yellow(`  (el directorio dice ${nameId})`) : '';
    return `${pc.cyan(worktree.branch)}${warning}${pc.dim(`  ·  ${worktree.lastRelative}`)}`;
}

/**
 * Formats one worktree as the two-line label of a multiselect option.
 *
 * @param input.worktree - The worktree to render.
 * @returns Two lines: the headline, and the indented branch/age detail.
 */
export function formatWorktreeLabel({ worktree }: { readonly worktree: WorktreeInfo }): string {
    return `${formatWorktreeHeadline({ worktree })}\n${DETAIL_INDENT}${formatWorktreeDetail({ worktree })}`;
}

/**
 * Formats the hint of an option: the last commit's subject.
 *
 * The subject is the one field that genuinely belongs in a hint — it is long,
 * it is prose, and you only care about it for the row you are looking at.
 *
 * @param input.worktree - The worktree to describe.
 * @returns The commit subject.
 */
export function formatWorktreeHint({ worktree }: { readonly worktree: WorktreeInfo }): string {
    return worktree.lastSubject;
}

/**
 * Renders the inventory summary shown before the picker.
 *
 * A missing worktree is a stale git registration, not a directory that can be
 * torn down, so counting it as removable would promise a cleanup this tool
 * cannot deliver: `git worktree prune` is what handles those.
 *
 * @param input.worktrees - The full inventory.
 * @returns A multi-line note body.
 */
export function formatInventoryNote({
    worktrees
}: {
    readonly worktrees: readonly WorktreeInfo[];
}): string {
    const removable = worktrees.filter(
        (w) => !w.isMain && w.state !== 'missing' && !isProtectedBranch({ branch: w.branch })
    );
    const missing = worktrees.filter((w) => w.state === 'missing');
    const reclaimable = removable
        .filter((w) => w.state === 'merged')
        .reduce((sum, w) => sum + w.mb, 0);
    const total = removable.reduce((sum, w) => sum + w.mb, 0);

    const lines = [
        `${worktrees.length} worktrees · ${removable.length} borrables · ${formatSize({ mb: total })} ocupados`,
        `${pc.green(formatSize({ mb: reclaimable }))} en worktrees terminados`,
        pc.dim('«terminado» = sin commits propios sobre la base y sin cambios locales.'),
        pc.dim('Se decide con estado LOCAL: no se consulta el estado del PR.')
    ];
    if (missing.length > 0) {
        lines.push(
            pc.dim(`${missing.length} registro(s) fantasma — se limpian con prune al final.`)
        );
    }
    return lines.join('\n');
}

/**
 * Renders the block warning about worktrees that hold work at risk.
 *
 * @param input.risky - The selected worktrees that need `--force`.
 * @returns A multi-line warning listing exactly what each one would lose.
 */
export function formatRiskWarning({ risky }: { readonly risky: readonly WorktreeInfo[] }): string {
    const lines = [
        pc.red(pc.bold(`${risky.length} de los seleccionados tienen trabajo sin mergear.`)),
        pc.dim('Borrarlos exige --force y DESTRUYE lo que sigue:'),
        ''
    ];
    for (const worktree of risky) {
        lines.push(`${pc.bold(worktree.name)}  ${pc.dim(`(${worktree.branch})`)}`);
        if (worktree.dirty > 0) {
            lines.push(
                pc.red(
                    `  ${worktree.dirty} archivo(s) sin commitear — no existen en ningún otro lado`
                )
            );
        }
        if (worktree.ahead > 0) {
            const where =
                worktree.unpushed === null
                    ? pc.red('nunca pusheados — no existen en ningún otro lado')
                    : worktree.unpushed > 0
                      ? pc.yellow(`${worktree.unpushed} sin pushear`)
                      : pc.green('todos pusheados a su upstream');
            lines.push(`  ${pc.yellow(`${worktree.ahead} commit(s) sobre la base`)} · ${where}`);
        }
    }
    return lines.join('\n');
}

/**
 * Renders the final summary after removals ran.
 *
 * @param input.removed - Worktrees removed successfully.
 * @param input.failed  - Worktrees whose removal exited non-zero.
 * @param input.freedMb - Disk space attributable to the removed worktrees.
 * @returns A multi-line summary.
 */
export function formatSummary({
    removed,
    failed,
    freedMb
}: {
    readonly removed: readonly WorktreeInfo[];
    readonly failed: readonly WorktreeInfo[];
    readonly freedMb: number;
}): string {
    const lines = [
        `${pc.green('borrados:')} ${removed.length}  ${pc.dim(`(${formatSize({ mb: freedMb })} liberados)`)}`
    ];
    if (failed.length > 0) {
        lines.push(`${pc.red('fallaron:')} ${failed.length}`);
        for (const worktree of failed) lines.push(pc.dim(`  ${worktree.path}`));
    }
    return lines.join('\n');
}

/** The help page, printed for `--help`. */
export function renderHelp(): string {
    return `
${pc.bold('hops-wt-clean')} — borrado interactivo de worktrees

  ${pc.dim('Lista los worktrees del repo, te deja tildar cuáles borrar, y los da de baja')}
  ${pc.dim('COMPLETOS vía wt-remove.sh: servers + base de datos + worktree + branch local.')}

${pc.bold('Uso')}

  hops-wt-clean [--no-disk] [ruta-del-repo]

  ${pc.bold('--no-disk')}   No mide el tamaño en disco. El ${pc.dim('du')} sobre cada worktree es lo
              más lento de todo (~20s con 38 worktrees); sin él arranca al toque,
              pero la lista no te dice cuánto espacio recuperás.
  ${pc.bold('--help')}      Esta página.

  Sin ruta usa el repo donde estés parado.

${pc.bold('Estados')}

  ${pc.green('terminado')}      Sin commits propios sobre la base y sin cambios locales.
                 Lo que había ya está mergeado. Se borra sin ceremonia.
  ${pc.yellow('sin mergear')}    Tiene commits que la base no tiene.
  ${pc.red('sin commitear')}  Tiene cambios que nunca se commitearon.
  ${pc.dim('fantasma')}       Registrado en git pero el directorio no existe. No se puede
                 borrar con wt-remove: se limpia con ${pc.dim('git worktree prune')}.

${pc.bold('Qué NO prueba esta lista')}

  El estado sale de git LOCAL, no de GitHub. «terminado» significa que este
  worktree no tiene nada único, no que su PR se haya mergeado. Si tu base local
  está desactualizada, un worktree cuyo PR sigue abierto puede figurar terminado.
  Corré ${pc.dim('git fetch')} antes si te importa la diferencia.

${pc.bold('Salvaguardas')}

  · El clon principal nunca se ofrece.
  · No viene nada pre-tildado.
  · Los que tienen trabajo en riesgo te muestran QUÉ se pierde y te piden
    escribir «borrar» antes de ir con --force.
  · El worktree donde estás parado se borra último, y te avisa a dónde volver.
`;
}
