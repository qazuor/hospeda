import * as p from '@clack/prompts';
import pc from 'picocolors';
import { gh } from '../../lib/github.ts';
import type { AuditedPr } from './audit-core.ts';
import { WHATS_NEW_DONE_LABEL, WHATS_NEW_NONE_LABEL } from './labels.ts';

/**
 * Applies one decision label to a PR.
 *
 * @param input.number - PR number.
 * @param input.label  - The label to add.
 * @param input.cwd    - Repository directory to run `gh` from.
 * @returns Whether the write succeeded, with the raw error on failure.
 */
export async function applyLabel({
    number,
    label,
    cwd
}: {
    readonly number: number;
    readonly label: string;
    readonly cwd: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
    const result = await gh({
        args: ['pr', 'edit', String(number), '--add-label', label],
        cwd
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Walks every unlabelled PR, asks D-3's novelty question, and applies the
 * chosen label (AC-12).
 *
 * Scoped to `unlabeled` ONLY — a `conflict` (both labels) or an
 * `unresolvedCommits` entry (direct push) needs a human decision this prompt
 * cannot make on its own (which label to remove; why a push bypassed review),
 * so those still block after `--fix` runs and are left for the report to
 * name.
 *
 * A label write failure STOPS the flow immediately (HOS-1214 §6.1's "mirrors
 * I3"): it is never queued for later, because a queued write is exactly how
 * 309 findings went missing in this repo's history. The operator sees which
 * PR failed and can re-run once the underlying problem (usually an expired
 * token) is fixed.
 *
 * @param input.unlabeled - PRs with neither decision label.
 * @param input.cwd       - Repository directory to run `gh` from.
 * @returns `true` when every PR was labelled (or the operator answered "yes,
 *          and the catalog entry already exists/is being written"); `false`
 *          on a write failure or an explicit cancel.
 */
export async function fixUnlabeledPrs({
    unlabeled,
    cwd
}: {
    readonly unlabeled: readonly AuditedPr[];
    readonly cwd: string;
}): Promise<boolean> {
    if (unlabeled.length === 0) return true;

    p.intro(pc.bgCyan(pc.black(' hops whats-new audit --fix ')));

    for (const item of unlabeled) {
        p.note(`#${item.pr.number}  ${item.pr.title}`, 'PR sin decisión de novedad');

        const isNovelty = await p.confirm({
            message: '¿Es novedad para un usuario final?',
            initialValue: false
        });
        if (p.isCancel(isNovelty)) {
            p.cancel('Cancelado. No se etiquetó nada más.');
            return false;
        }

        if (!isNovelty) {
            const applied = await applyLabel({
                number: item.pr.number,
                label: WHATS_NEW_NONE_LABEL,
                cwd
            });
            if (!applied.ok) {
                p.cancel(`No pude etiquetar #${item.pr.number}: ${applied.error.split('\n')[0]}`);
                return false;
            }
            p.log.success(`#${item.pr.number} → ${WHATS_NEW_NONE_LABEL}`);
            continue;
        }

        // "Novelty" is not a complete answer here (D-3, NG-2): this command
        // audits decisions, it does not draft catalog entries — that is the
        // smoke sign-off flow's job (§6.1). Asking this second question is
        // what keeps `whats-new-done` honest: the label means "an entry
        // exists", not "somebody said yes".
        const entryExists = await p.confirm({
            message:
                '¿Ya existe (o vas a escribir ahora) la entrada del catálogo en whatsNewEntries?',
            initialValue: false
        });
        if (p.isCancel(entryExists)) {
            p.cancel('Cancelado. No se etiquetó nada más.');
            return false;
        }
        if (!entryExists) {
            p.log.warn(`#${item.pr.number} queda sin etiquetar hasta que la entrada exista.`);
            continue;
        }

        const applied = await applyLabel({
            number: item.pr.number,
            label: WHATS_NEW_DONE_LABEL,
            cwd
        });
        if (!applied.ok) {
            p.cancel(`No pude etiquetar #${item.pr.number}: ${applied.error.split('\n')[0]}`);
            return false;
        }
        p.log.success(`#${item.pr.number} → ${WHATS_NEW_DONE_LABEL}`);
    }

    p.outro('Listo.');
    return true;
}
