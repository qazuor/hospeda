import pc from 'picocolors';
import { type AuditResult, blocksPromotion } from './audit-core.ts';
import { CUTOFF_FILE_PATH, GATE_WORKFLOW_PATH } from './cutoff.ts';
import { RANGE } from './range.ts';

/**
 * One line saying which cutoff was applied and where it came from (D-6).
 *
 * Always printed on a clean report, never conditionally: "3 pre-cutoff" is
 * only meaningful next to the commit that defined "pre". A cutoff that is
 * silently correct still reads as a bug the day someone wonders why an old PR
 * was named.
 *
 * @param input.result - The audit's classified result.
 * @returns The rendered line.
 */
function renderCutoffLine({ result }: { readonly result: AuditResult }): string {
    if (result.cutoff === null) {
        return 'Cutoff: none applied — no PR was exempted by age.';
    }
    const short = result.cutoff.sha.slice(0, 9);
    return result.cutoff.source === 'derived'
        ? `Cutoff: ${short} — derived from the commit that added ${GATE_WORKFLOW_PATH}.`
        : `Cutoff: ${short} — pinned by hand in ${CUTOFF_FILE_PATH} (override).`;
}

/**
 * Renders the audit's report.
 *
 * A blocked report NAMES the PRs (HOS-1214 §6.2) — it never says "something is
 * missing" — and always ends with the one-command remedy. A clean report says
 * so plainly and always states which cutoff it applied and where that came
 * from (see {@link renderCutoffLine}).
 *
 * @param input.result - The audit's classified result.
 * @returns The full report, without a trailing newline.
 */
export function renderAuditReport({ result }: { readonly result: AuditResult }): string {
    const lines: string[] = [];

    if (blocksPromotion({ result })) {
        const blocking =
            result.unlabeled.length + result.conflicting.length + result.unresolvedCommits.length;
        lines.push(
            pc.red(
                `Promotion blocked: ${blocking} item(s) in ${RANGE} were never evaluated for What's New.`
            )
        );
        lines.push('');

        if (result.unlabeled.length > 0) {
            lines.push(pc.bold('Never evaluated (no decision label):'));
            for (const item of result.unlabeled) {
                lines.push(`  #${item.pr.number}  ${item.pr.title}`);
            }
            lines.push('');
        }

        if (result.conflicting.length > 0) {
            lines.push(pc.bold('Carrying BOTH labels at once (mutually exclusive — remove one):'));
            for (const item of result.conflicting) {
                lines.push(`  #${item.pr.number}  ${item.pr.title}`);
            }
            lines.push('');
        }

        if (result.unresolvedCommits.length > 0) {
            lines.push(pc.bold('Direct pushes to staging (no pull request resolves this commit):'));
            for (const commit of result.unresolvedCommits) {
                lines.push(`  ${commit.sha}  ${commit.subject}`);
            }
            lines.push('');
        }

        lines.push('Decide each one, then re-run this check:');
        lines.push('  hops whats-new audit --fix');
        lines.push('');
        lines.push('Applying `whats-new-none` records "evaluated, not a novelty" and is a');
        lines.push('complete answer.');
    } else {
        lines.push(pc.green(`OK — every PR in ${RANGE} carries a novelty decision.`));
        lines.push(
            pc.dim(
                `${result.evaluated.length} evaluated · ${result.botExempt.length} bot-exempt · ` +
                    `${result.preCutoff.length} pre-cutoff`
            )
        );
        lines.push(pc.dim(renderCutoffLine({ result })));
    }

    if (result.mismatches.length > 0) {
        lines.push('');
        lines.push(
            pc.yellow('Note — merge-subject / GitHub API disagreement (reported, not resolved):')
        );
        for (const mismatch of result.mismatches) {
            lines.push(
                `  ${mismatch.sha}  API says #${mismatch.apiNumber}, merge subject says #${mismatch.subjectNumber}`
            );
        }
    }

    return lines.join('\n');
}
