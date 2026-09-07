import pc from 'picocolors';
import { type AuditResult, blocksPromotion } from './audit-core.ts';
import { RANGE } from './range.ts';

/**
 * Renders the audit's report.
 *
 * A blocked report NAMES the PRs (HOS-1214 §6.2) — it never says "something is
 * missing" — and always ends with the one-command remedy. A clean report says
 * so plainly and, when the cutoff is not configured, says THAT plainly too:
 * an unconfigured cutoff silently exempting nothing is correct, but silent
 * correctness reads as a bug the day someone wonders why old PRs are named.
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
        if (!result.cutoffConfigured) {
            lines.push(
                pc.yellow(
                    'Cutoff not configured (scripts/whats-new-gate-cutoff.txt): no PR was exempted by age.'
                )
            );
        }
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
