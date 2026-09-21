import { fetchIssue } from '../../lib/linear.ts';

export async function runSmokePlan({
    argv
}: {
    readonly argv: readonly string[];
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write('hops smoke-plan HOS-NNN — enumera smoke gates sin mutar Linear.\n');
        return 0;
    }
    const raw = argv.find((arg) => /^[A-Za-z]+-\d+$/.test(arg));
    if (raw === undefined) {
        process.stderr.write('Falta el issue. Uso: hops smoke-plan HOS-NNN\n');
        return 2;
    }
    const issueId = raw.toUpperCase();
    const result = await fetchIssue({ issueId });
    if (!result.ok) {
        process.stderr.write(`Linear: ${result.reason}\n`);
        return 1;
    }
    const gates = result.issue.labels.filter((label) => label.startsWith('status-needs-smoke-'));
    const data = { issue: issueId, state: result.issue.stateName, gates, readOnly: true };
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(data)}\n`);
        return 0;
    }
    process.stdout.write(`issue: ${issueId}\nstate: ${result.issue.stateName}\n`);
    process.stdout.write(
        `smoke gates: ${gates.length ? gates.join(', ') : '(ninguno detectado)'}\n`
    );
    process.stdout.write('acciones: ninguna (read-only)\n');
    return 0;
}
