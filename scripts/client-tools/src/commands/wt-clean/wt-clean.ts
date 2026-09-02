import * as p from '@clack/prompts';
import pc from 'picocolors';
import { parseArgs } from './args.ts';
import { freedMb, readFree } from './disk.ts';
import {
    formatInventoryNote,
    formatRiskWarning,
    formatSummary,
    formatWorktreeHint,
    formatWorktreeLabel,
    renderHelp
} from './format.ts';
import { collectWorktrees, isRisky, resolveCurrentWorktree } from './inventory.ts';
import {
    orderForRemoval,
    pruneMissingWorktrees,
    removeWorktree,
    resolveRemoveScript
} from './remove.ts';
import { buildOptions, CONFIRM_WORD, isConfirmed, partitionSelection } from './selection.ts';
import type { WorktreeInfo } from './types.ts';

/** Prints the inventory as plain lines, for a pipe or a context with no TTY. */
function printPlainInventory(worktrees: readonly WorktreeInfo[]): void {
    for (const worktree of worktrees) {
        // The label already carries the branch/age line; the hint (the commit
        // subject) is appended here because in a plain listing there is no
        // "highlighted row" for Clack to reveal it on.
        process.stdout.write(`${formatWorktreeLabel({ worktree })}\n`);
        process.stdout.write(`${pc.dim(`          ${formatWorktreeHint({ worktree })}`)}\n`);
    }
}

/**
 * Offers to prune worktrees git still lists but whose directories are gone.
 *
 * These cannot go through `wt-remove.sh` (it aborts on a missing path), so the
 * only cleanup left for them is `git worktree prune`.
 *
 * @param input.missing - The stale registrations.
 * @param input.cwd     - Directory to prune from.
 */
async function handleMissing({
    missing,
    cwd
}: {
    readonly missing: readonly WorktreeInfo[];
    readonly cwd: string;
}): Promise<void> {
    p.note(
        missing.map((worktree) => worktree.path).join('\n'),
        `${missing.length} registro(s) fantasma en git`
    );
    const answer = await p.confirm({
        message: '¿Corro `git worktree prune` para darlos de baja?',
        initialValue: true
    });
    if (p.isCancel(answer) || !answer) return;
    await pruneMissingWorktrees({ cwd });
}

/**
 * Runs the interactive worktree cleanup: list, select, confirm, remove.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code: 0 on success, 1 when any removal failed.
 */
export async function runWtClean({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    const opts = parseArgs({ argv, cwd: process.cwd() });

    if (opts.help) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const scriptPath = resolveRemoveScript();
    if (scriptPath === null) {
        process.stderr.write(
            'ERROR: no encontré wt-remove.sh en ~/.claude/skills/worktree/scripts/.\n' +
                'La skill worktree tiene que estar instalada para que esto funcione.\n'
        );
        return 1;
    }

    const currentPath = await resolveCurrentWorktree({ cwd: opts.repoPath });
    const interactive = process.stdout.isTTY === true && process.stdin.isTTY === true;

    if (interactive) p.intro(pc.bgCyan(pc.black(' hops-wt-clean ')));

    // Clack's spinner writes cursor and redraw escapes unconditionally. Piped
    // into a file or another program those become line noise around the data.
    const spin = interactive
        ? p.spinner()
        : { start: (): void => {}, message: (): void => {}, stop: (): void => {} };

    spin.start(opts.measureDisk ? 'Midiendo worktrees…' : 'Leyendo worktrees…');
    const worktrees = await collectWorktrees({
        repoRoot: opts.repoPath,
        currentPath,
        measureDisk: opts.measureDisk
    });
    spin.stop(`${worktrees.length} worktrees`);

    if (worktrees.length === 0) {
        process.stderr.write(`ERROR: no pude listar worktrees en ${opts.repoPath}.\n`);
        return 1;
    }

    const mainPath = worktrees.find((worktree) => worktree.isMain)?.path ?? opts.repoPath;
    const missing = worktrees.filter((worktree) => worktree.state === 'missing');
    const choices = buildOptions({ worktrees });

    if (!interactive) {
        // No terminal means nothing can be selected, so the useful thing left
        // to do is report. Never fall through to a prompt: that is how a tool
        // hangs forever in a pipe or a cron.
        printPlainInventory(worktrees);
        process.stdout.write(
            `\n${choices.length} borrables. Sin terminal no puedo abrir el selector: corré \`hops-wt-clean\` en tu shell.\n`
        );
        return 0;
    }

    p.note(formatInventoryNote({ worktrees }), 'Inventario');

    if (choices.length === 0) {
        if (missing.length > 0) await handleMissing({ missing, cwd: mainPath });
        p.outro('Nada para limpiar.');
        return 0;
    }

    const picked = await p.multiselect<string>({
        message: '¿Cuáles borro? (espacio para tildar, enter para confirmar)',
        options: [...choices],
        required: false
    });

    if (p.isCancel(picked)) {
        p.cancel('Cancelado. No se borró nada.');
        return 0;
    }

    const selected = worktrees.filter((worktree) => picked.includes(worktree.path));
    if (selected.length === 0) {
        if (missing.length > 0) await handleMissing({ missing, cwd: mainPath });
        p.outro('No tildaste nada.');
        return 0;
    }

    const { risky } = partitionSelection({ selected });
    if (risky.length > 0) {
        p.note(formatRiskWarning({ risky }), pc.red('Trabajo en riesgo'));
        const answer = await p.text({
            message: `Escribí «${CONFIRM_WORD}» para destruirlos. Cualquier otra cosa cancela:`,
            defaultValue: ''
        });
        if (p.isCancel(answer) || !isConfirmed({ answer })) {
            p.cancel('Cancelado. No se borró nada.');
            return 0;
        }
    }

    // Spawn from the main clone: it is the one directory guaranteed to still
    // exist after every removal, including the current worktree's own.
    process.chdir(mainPath);

    const removed: WorktreeInfo[] = [];
    const failed: WorktreeInfo[] = [];

    // Read free space BEFORE anything is unlinked. This, and not the sum of
    // per-worktree `du`, is what the summary reports: see freedMb() for why the
    // arithmetic version cannot be right.
    const freeBefore = await readFree({ paths: selected.map((worktree) => worktree.path) });

    p.log.step(`Borrando ${selected.length} worktree(s)…`);
    for (const worktree of orderForRemoval({ worktrees: selected })) {
        process.stdout.write('\n');
        const result = await removeWorktree({
            scriptPath,
            worktree,
            force: isRisky({ worktree }),
            cwd: mainPath
        });
        if (result.exitCode === 0) removed.push(worktree);
        else failed.push(worktree);
    }

    // Re-read the same filesystems by their mount points; the worktree paths
    // themselves are gone.
    const freeAfter = await readFree({ paths: [...freeBefore.keys()] });

    p.note(
        formatSummary({
            removed,
            failed,
            freedMb: freedMb({ before: freeBefore, after: freeAfter })
        }),
        'Resultado'
    );

    if (missing.length > 0) await handleMissing({ missing, cwd: mainPath });

    if (removed.some((worktree) => worktree.isCurrent)) {
        p.outro(
            pc.yellow(`Tu shell quedó en un directorio que ya no existe. Corré:  cd ${mainPath}`)
        );
    } else {
        p.outro('Listo.');
    }

    return failed.length > 0 ? 1 : 0;
}
