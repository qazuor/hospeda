/**
 * @file bootstrap-feedback.ts
 * @description One-shot setup script for the Linear workspace used by the
 * @repo/feedback widget. Configures team prefix/name, workflow states,
 * report-type labels, source labels, environment label, and a starter project.
 *
 * Idempotent: re-running skips items that already exist by name.
 *
 * Run: HOSPEDA_LINEAR_API_KEY=lin_api_... pnpm --filter=hospeda-api exec \
 *      tsx ../../scripts/linear/bootstrap-feedback.ts
 */

import { LinearClient } from '@linear/sdk';

type LabelSpec = { readonly name: string; readonly color: string };
type StateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
type StateSpec = {
    readonly name: string;
    readonly type: StateType;
    readonly color: string;
    readonly position: number;
};

const TARGET_TEAM_NAME = 'Beta Feedback';
const TARGET_TEAM_KEY = 'BETA';
const TARGET_PROJECT_NAME = 'Beta v1';

// Linear does not support a 'triage' state type; we use 'unstarted' for Triage
// and convey the workflow via naming + default-state. State names match
// Linear's defaults (US spelling for "Canceled") so existing default states
// are reused instead of duplicated.
const STATES: ReadonlyArray<StateSpec> = [
    { name: 'Triage', type: 'unstarted', color: '#F2994A', position: 0 },
    { name: 'Backlog', type: 'backlog', color: '#BEC2C8', position: 1 },
    { name: 'In Progress', type: 'started', color: '#5E6AD2', position: 2 },
    { name: 'Done', type: 'completed', color: '#1F883D', position: 3 },
    { name: 'Canceled', type: 'canceled', color: '#95A5A6', position: 4 }
];

// State names that come pre-created by Linear but we don't want in this team.
const STATES_TO_REMOVE = new Set(['Todo', 'In Review']);

const REPORT_TYPE_LABELS: ReadonlyArray<LabelSpec> = [
    { name: 'bug-js', color: '#EF4444' },
    { name: 'bug-ui-ux', color: '#F59E0B' },
    { name: 'bug-content', color: '#EAB308' },
    { name: 'feature-request', color: '#3B82F6' },
    { name: 'improvement', color: '#10B981' },
    { name: 'other', color: '#9CA3AF' }
];

const SOURCE_LABELS: ReadonlyArray<LabelSpec> = [
    { name: 'source-web', color: '#8B5CF6' },
    { name: 'source-admin', color: '#EC4899' },
    { name: 'source-standalone', color: '#06B6D4' }
];

const ENV_LABELS: ReadonlyArray<LabelSpec> = [{ name: 'env-beta', color: '#DC2626' }];

const log = (msg: string): void => {
    console.log(msg);
};

async function main(): Promise<void> {
    const apiKey = process.env.HOSPEDA_LINEAR_API_KEY;
    if (!apiKey) {
        throw new Error('HOSPEDA_LINEAR_API_KEY is not set');
    }

    const client = new LinearClient({ apiKey });

    // 1. Identify workspace + viewer
    log('=== Connecting to Linear ===');
    const viewer = await client.viewer;
    const org = await client.organization;
    log(`Logged in as: ${viewer.name} <${viewer.email}>`);
    log(`Workspace:    ${org.name} (urlKey: ${org.urlKey})`);

    if (org.urlKey !== 'hospeda-beta') {
        log(`\n!!! WARNING: connected workspace is "${org.urlKey}", expected "hospeda-beta". !!!`);
        log('!!! Aborting to prevent setup in the wrong workspace. !!!');
        process.exit(1);
    }

    // 2. Find or rename the default team
    log('\n=== Team setup ===');
    const teams = await client.teams();
    log(`Found ${teams.nodes.length} team(s) in workspace.`);

    let team = teams.nodes.find((t) => t.name === TARGET_TEAM_NAME);
    if (team) {
        log(`Team "${TARGET_TEAM_NAME}" already exists (key: ${team.key}).`);
    } else if (teams.nodes.length === 1) {
        // Adopt the auto-created default team
        const existing = teams.nodes[0];
        if (!existing) throw new Error('Unexpected: nodes[0] missing');
        log(
            `Renaming team "${existing.name}" (key: ${existing.key}) -> "${TARGET_TEAM_NAME}" (key: ${TARGET_TEAM_KEY})`
        );
        const updated = await client.updateTeam(existing.id, {
            name: TARGET_TEAM_NAME,
            key: TARGET_TEAM_KEY
        });
        const fetchedTeam = await updated.team;
        if (!fetchedTeam) throw new Error('updateTeam returned no team');
        team = fetchedTeam;
    } else {
        log(`Creating new team "${TARGET_TEAM_NAME}" (key: ${TARGET_TEAM_KEY})`);
        const created = await client.createTeam({
            name: TARGET_TEAM_NAME,
            key: TARGET_TEAM_KEY
        });
        const fetchedTeam = await created.team;
        if (!fetchedTeam) throw new Error('createTeam returned no team');
        team = fetchedTeam;
    }
    log(`Team ID: ${team.id}`);

    // 3. Configure workflow states
    log('\n=== Workflow states ===');
    const existingStates = await team.states();

    const stateIds: Record<string, string> = {};
    for (const spec of STATES) {
        const existing = existingStates.nodes.find((s) => s.name === spec.name);
        if (existing) {
            log(`State "${spec.name}" already exists (id: ${existing.id}).`);
            stateIds[spec.name] = existing.id;
            continue;
        }
        log(`Creating state "${spec.name}" (type: ${spec.type})`);
        const result = await client.createWorkflowState({
            teamId: team.id,
            name: spec.name,
            type: spec.type,
            color: spec.color,
            position: spec.position
        });
        const state = await result.workflowState;
        if (!state) throw new Error(`createWorkflowState returned no state for ${spec.name}`);
        stateIds[spec.name] = state.id;
    }

    // Set default state for new issues = Triage
    const triageStateId = stateIds.Triage;
    if (triageStateId) {
        log(`Setting "Triage" as default state (id: ${triageStateId})`);
        await client.updateTeam(team.id, { defaultIssueStateId: triageStateId });
    }

    // 4. Archive Linear's default states that we don't want.
    const orphanStates = existingStates.nodes.filter((s) => STATES_TO_REMOVE.has(s.name));
    if (orphanStates.length > 0) {
        log(`\n=== Archiving ${orphanStates.length} unwanted default state(s) ===`);
        for (const s of orphanStates) {
            try {
                log(`Archiving state "${s.name}" (id: ${s.id})`);
                await client.archiveWorkflowState(s.id);
            } catch (err) {
                log(`  -> could not archive "${s.name}": ${(err as Error).message}`);
            }
        }
    }

    // 5. Create labels (idempotent, case-insensitive across team + workspace scopes)
    log('\n=== Labels ===');
    const allLabels = [...REPORT_TYPE_LABELS, ...SOURCE_LABELS, ...ENV_LABELS];

    // Fetch ALL labels visible to this account (workspace + team labels).
    // Linear treats label names as unique within a workspace (case-insensitive).
    const allExistingLabels = await client.issueLabels({ first: 250 });
    const labelByLowerName = new Map<string, { id: string; name: string; teamId?: string }>();
    for (const l of allExistingLabels.nodes) {
        const teamRef = await l.team;
        labelByLowerName.set(l.name.toLowerCase(), {
            id: l.id,
            name: l.name,
            teamId: teamRef?.id
        });
    }

    const labelIds: Record<string, string> = {};

    for (const spec of allLabels) {
        const existing = labelByLowerName.get(spec.name.toLowerCase());
        if (existing) {
            const scope = existing.teamId === team.id ? 'team' : 'workspace';
            log(
                `Label "${spec.name}" already exists as "${existing.name}" (${scope}, id: ${existing.id}). Reusing.`
            );
            labelIds[spec.name] = existing.id;
            continue;
        }
        log(`Creating label "${spec.name}" (color: ${spec.color})`);
        const result = await client.createIssueLabel({
            teamId: team.id,
            name: spec.name,
            color: spec.color
        });
        const label = await result.issueLabel;
        if (!label) throw new Error(`createIssueLabel returned no label for ${spec.name}`);
        labelIds[spec.name] = label.id;
    }

    // 6. Create starter project
    log('\n=== Project ===');
    const existingProjects = await team.projects();
    let projectId: string | undefined = existingProjects.nodes.find(
        (p) => p.name === TARGET_PROJECT_NAME
    )?.id;

    if (projectId) {
        log(`Project "${TARGET_PROJECT_NAME}" already exists (id: ${projectId}).`);
    } else {
        log(`Creating project "${TARGET_PROJECT_NAME}"`);
        const result = await client.createProject({
            name: TARGET_PROJECT_NAME,
            description: 'Bug reports, feedback, and feature requests from the public beta.',
            teamIds: [team.id]
        });
        const project = await result.project;
        if (!project) throw new Error('createProject returned no project');
        projectId = project.id;
        log(`Project created (id: ${projectId}).`);
    }

    // 7. Print summary block ready to paste into feedback.config.ts
    log('\n=================================================');
    log('  SETUP COMPLETE - copy values into feedback.config.ts');
    log('=================================================\n');

    const summary = {
        teamId: team.id,
        teamKey: team.key,
        projectId: projectId,
        defaultStateId: triageStateId,
        labels: {
            bugJs: labelIds['bug-js'],
            bugUiUx: labelIds['bug-ui-ux'],
            bugContent: labelIds['bug-content'],
            featureRequest: labelIds['feature-request'],
            improvement: labelIds.improvement,
            other: labelIds.other,
            sourceWeb: labelIds['source-web'],
            sourceAdmin: labelIds['source-admin'],
            sourceStandalone: labelIds['source-standalone'],
            envBeta: labelIds['env-beta']
        }
    };

    console.log(JSON.stringify(summary, null, 2));

    log('\nDone.');
}

void main().catch((err) => {
    console.error('\n!!! Bootstrap failed:', err);
    process.exit(1);
});
