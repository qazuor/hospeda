import { resolveRunContext } from '../../lib/context.ts';
import { fetchIssue } from '../../lib/linear.ts';
import { extractTarget } from '../../lib/target.ts';

export async function runIssuePreflight({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'hops issue-preflight HOS-NNN [--json] — consulta read-only de Linear y worktrees.\n'
        );
        return 0;
    }
    const raw = argv.find((arg) => /^[A-Za-z]+-\d+$/.test(arg));
    if (raw === undefined) {
        process.stderr.write('Falta el issue. Uso: hops issue-preflight HOS-NNN\n');
        return 2;
    }
    const issueId = raw.toUpperCase();
    const json = argv.includes('--json');
    const { target } = extractTarget({ argv });
    const context = await resolveRunContext({ cwd: process.cwd(), target });
    const issue = await fetchIssue({ issueId });
    const matches = context.all.filter((wt) => wt.branch.toUpperCase().includes(issueId));
    if (json) {
        if (!issue.ok) {
            process.stdout.write(
                `${JSON.stringify({ issue: issueId, error: issue.reason, readOnly: true })}\n`
            );
            return 1;
        }
        process.stdout.write(
            `${JSON.stringify({
                issue: {
                    identifier: issue.issue.identifier,
                    title: issue.issue.title,
                    state: { name: issue.issue.stateName, type: issue.issue.stateType },
                    labels: issue.issue.labels,
                    url: issue.issue.url
                },
                worktrees: matches.map((wt) => ({ name: wt.name, branch: wt.branch })),
                pullRequestAndCi: 'consultar con hops ci/merge desde el worktree correspondiente',
                actions: [],
                readOnly: true
            })}\n`
        );
        return 0;
    }
    process.stdout.write(`issue: ${issueId}\n`);
    if (!issue.ok) {
        process.stdout.write(`linear: error — ${issue.reason}\n`);
        return 1;
    }
    process.stdout.write(`title: ${issue.issue.title}\n`);
    process.stdout.write(`state: ${issue.issue.stateName} (${issue.issue.stateType})\n`);
    process.stdout.write(`labels: ${issue.issue.labels.join(', ') || '(ninguno)'}\n`);
    process.stdout.write(
        `worktrees: ${matches.length ? matches.map((wt) => `${wt.name} [${wt.branch}]`).join(', ') : '(ninguno)'}\n`
    );
    process.stdout.write('pr/ci: consultar con hops ci/merge desde el worktree correspondiente\n');
    process.stdout.write('acciones: ninguna (read-only)\n');
    return 0;
}
