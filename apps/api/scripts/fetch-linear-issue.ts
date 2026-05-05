/**
 * @file fetch-linear-issue.ts
 * @description Quick verification script: fetches a Linear issue by
 * identifier and prints its title, body, labels and priority. Used to
 * confirm that the feedback widget delivers data to Linear with the
 * expected markdown formatting.
 *
 * Run: HOSPEDA_LINEAR_API_KEY=lin_api_... pnpm --filter=hospeda-api exec \
 *      tsx scripts/fetch-linear-issue.ts BETA-8
 */

import { LinearClient } from '@linear/sdk';

async function main(): Promise<void> {
    const identifier = process.argv[2];
    if (!identifier) {
        throw new Error('Usage: tsx fetch-linear-issue.ts <ISSUE-IDENTIFIER>');
    }

    const apiKey = process.env.HOSPEDA_LINEAR_API_KEY;
    if (!apiKey) throw new Error('HOSPEDA_LINEAR_API_KEY is not set');

    const client = new LinearClient({ apiKey });

    const issues = await client.issues({
        filter: { number: { eq: Number.parseInt(identifier.split('-')[1] ?? '0', 10) } },
        first: 5
    });
    const issue = issues.nodes.find((i) => i.identifier === identifier);
    if (!issue) {
        throw new Error(`Issue ${identifier} not found`);
    }

    const labels = await issue.labels();
    const state = await issue.state;
    const priority = issue.priority;

    console.log('========================================');
    console.log(`  ${issue.identifier} — ${issue.title}`);
    console.log('========================================');
    console.log(`URL:      ${issue.url}`);
    console.log(`State:    ${state?.name}`);
    console.log(`Priority: ${priority} (1=Urgent, 2=High, 3=Med, 4=Low)`);
    console.log(`Labels:   ${labels.nodes.map((l) => l.name).join(', ')}`);
    console.log('----------------------------------------');
    console.log('BODY:');
    console.log('----------------------------------------');
    console.log(issue.description ?? '(no description)');
    console.log('========================================');
}

void main().catch((err) => {
    console.error('Error:', err.message ?? err);
    process.exit(1);
});
