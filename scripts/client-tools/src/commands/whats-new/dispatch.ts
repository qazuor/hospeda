import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { resolveRunContext } from '../../lib/context.ts';
import { extractTarget } from '../../lib/target.ts';
import { extractWorktreeFlag } from '../../lib/wt-flag.ts';
import { renderHelp, runWhatsNewAudit } from './audit.ts';
import { CATALOG_FILE_PATH, hasEntriesArray, parseCatalog } from './catalog.ts';
import { runWhatsNewDrop } from './drop.ts';
import { renderPendingEntries } from './pending.ts';

/** The subcommands `hops whats-new` accepts. */
const SUBCOMMANDS = ['audit', 'pending', 'drop'] as const;

/**
 * Runs `hops whats-new <subcommand>`.
 *
 * Owns the flags every command in this CLI shares (`--target`, `--wt`,
 * `--help`) and the one context resolution all three subcommands need, so a
 * subcommand receives a resolved repo root and cwd instead of re-deriving
 * them.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The process exit code.
 */
export async function runWhatsNew({ argv }: { readonly argv: readonly string[] }): Promise<number> {
    const { target, rest: afterTarget } = extractTarget({ argv });
    const { name: worktreeName, rest: afterWt } = extractWorktreeFlag({ argv: afterTarget });

    if (afterWt.includes('--help') || afterWt.includes('-h') || afterWt.length === 0) {
        process.stdout.write(renderHelp());
        return 0;
    }

    const [subcommand, ...subArgv] = afterWt;
    if (
        subcommand === undefined ||
        !SUBCOMMANDS.includes(subcommand as (typeof SUBCOMMANDS)[number])
    ) {
        process.stderr.write(
            `${pc.red('Subcomando desconocido:')} ${pc.bold(`hops whats-new ${subcommand ?? ''}`.trim())}\n` +
                `${pc.dim(`Hay tres: ${SUBCOMMANDS.join(', ')}.`)}\n\n`
        );
        process.stdout.write(renderHelp());
        return 1;
    }

    const context = await resolveRunContext({ cwd: process.cwd(), target, worktreeName });
    const cwd = context.worktree?.path ?? context.repoRoot;

    if (subcommand === 'audit') {
        return await runWhatsNewAudit({ argv: subArgv, repoRoot: context.repoRoot, cwd });
    }
    if (subcommand === 'drop') {
        return await runWhatsNewDrop({ ids: subArgv, repoRoot: context.repoRoot, cwd });
    }
    return runWhatsNewPending({ repoRoot: context.repoRoot });
}

/**
 * Runs `hops whats-new pending` — prints every entry awaiting review, in full.
 *
 * Reports an UNREADABLE catalog as exit `3` rather than as "nothing pending":
 * a renamed declaration and an empty queue look identical from the outside,
 * and only one of them means the review is done.
 *
 * @param input.repoRoot - Repository root.
 * @returns `0` when the catalog was read, `3` when it could not be.
 */
export function runWhatsNewPending({ repoRoot }: { readonly repoRoot: string }): number {
    let content: string;
    try {
        content = readFileSync(join(repoRoot, CATALOG_FILE_PATH), 'utf8');
    } catch (error) {
        process.stderr.write(
            `${pc.yellow('NO SÉ')}  No pude leer ${CATALOG_FILE_PATH}: ${String(error)}\n`
        );
        return 3;
    }

    if (!hasEntriesArray({ content })) {
        process.stderr.write(
            `${pc.yellow('NO SÉ')}  No encontré \`export const whatsNewEntries\` en ` +
                `${CATALOG_FILE_PATH}. ¿Se renombró la declaración?\n`
        );
        return 3;
    }

    process.stdout.write(`${renderPendingEntries({ entries: parseCatalog({ content }) })}\n`);
    return 0;
}
