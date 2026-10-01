import { loadApiKeys } from './linear-auth.ts';
import { loadProjectAdapter } from './project-config.ts';

const API = 'https://api.linear.app/graphql';

export interface BacklogDraft {
    readonly projectId: string;
    readonly teamKey: string;
    readonly stateName: string;
    readonly title: string;
    readonly description: string;
    readonly priority: number;
    readonly labels: readonly string[];
    readonly kind?: string;
}

interface TeamData {
    readonly id: string;
    readonly key: string;
    readonly name: string;
    readonly states: { readonly nodes: readonly { readonly id: string; readonly name: string }[] };
    readonly labels: { readonly nodes: readonly { readonly id: string; readonly name: string }[] };
}

interface GraphqlBody<T> {
    readonly data?: T;
    readonly errors?: readonly { readonly message: string }[];
}

const TEAM_QUERY = `query($key:String!){
  teams(filter:{key:{eq:$key}}){
    nodes{id key name states{nodes{id name}} labels{nodes{id name}}}
  }
}`;

const CREATE_MUTATION = `mutation($input:IssueCreateInput!){
  issueCreate(input:$input){success issue{identifier url title state{name}}
  }
}`;

function argValue(argv: readonly string[], name: string): string | undefined {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
}

function allArgValues(argv: readonly string[], name: string): string[] {
    const values: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index + 1];
        if (argv[index] === name && value !== undefined) values.push(value);
    }
    return values;
}

export function parseBacklogDraft(
    argv: readonly string[],
    projectId: string,
    config: NonNullable<Awaited<ReturnType<typeof loadProjectAdapter>>>
) {
    const title = argValue(argv, '--title')?.trim();
    const description = argValue(argv, '--description')?.trim();
    const teamKey = config.issues?.teamKey;
    const stateName = config.issues?.backlogState ?? config.issues?.states?.backlog ?? 'Backlog';
    if (!title || !description) {
        return { ok: false as const, reason: 'se requieren --title y --description' };
    }
    if (!teamKey) return { ok: false as const, reason: 'el adapter no declara issues.teamKey' };
    const priorityRaw = argValue(argv, '--priority');
    const priority =
        priorityRaw === undefined ? (config.issues?.defaultPriority ?? 4) : Number(priorityRaw);
    if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
        return { ok: false as const, reason: '--priority debe ser un entero entre 0 y 4' };
    }
    const kind = argValue(argv, '--kind');
    if (kind !== undefined && !['bug', 'feature', 'improvement'].includes(kind)) {
        return { ok: false as const, reason: '--kind debe ser bug, feature o improvement' };
    }
    const configured = [
        ...(config.issues?.defaultLabels ?? []),
        ...(config.issues?.commandLabel ? [config.issues.commandLabel] : [])
    ];
    const kindLabel =
        kind === 'bug'
            ? 'Bug'
            : kind === 'feature'
              ? 'Feature'
              : kind === 'improvement'
                ? 'Improvement'
                : undefined;
    const labels = [
        ...new Set([
            ...configured,
            ...(kindLabel ? [kindLabel] : []),
            ...allArgValues(argv, '--label')
        ])
    ];
    return {
        ok: true as const,
        draft: {
            projectId,
            teamKey,
            stateName,
            title,
            description,
            priority,
            labels,
            ...(kind ? { kind } : {})
        } satisfies BacklogDraft
    };
}

async function request<T>(
    key: string,
    query: string,
    variables: Record<string, unknown>
): Promise<T> {
    const response = await fetch(API, {
        method: 'POST',
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000)
    });
    const body = (await response.json()) as GraphqlBody<T>;
    const error = body.errors?.[0]?.message;
    if (error) throw new Error(error);
    if (!body.data) throw new Error('Linear devolvió una respuesta sin datos');
    return body.data;
}

async function resolveTeam(key: string): Promise<TeamData> {
    const keys = await loadApiKeys();
    if (keys.length === 0) throw new Error('no hay ninguna LINEAR_API_KEY configurada');
    let last = 'Linear rechazó todas las claves';
    for (const candidate of keys) {
        try {
            const data = await request<{ teams: { nodes: readonly TeamData[] } }>(
                candidate.key,
                TEAM_QUERY,
                { key }
            );
            const team = data.teams.nodes[0];
            if (team) return team;
            throw new Error(`Linear no conoce el team ${key}`);
        } catch (error) {
            last = `${candidate.origin}: ${(error as Error).message}`;
        }
    }
    throw new Error(last);
}

export async function createBacklogIssue({ draft }: { readonly draft: BacklogDraft }): Promise<{
    readonly identifier: string;
    readonly url: string;
    readonly title: string;
    readonly state: string;
}> {
    const team = await resolveTeam(draft.teamKey);
    const state = team.states.nodes.find(
        (item) => item.name.toLowerCase() === draft.stateName.toLowerCase()
    );
    if (!state)
        throw new Error(`Linear no tiene el estado «${draft.stateName}» en ${draft.teamKey}`);
    const availableLabels = new Map(
        team.labels.nodes.map((label) => [label.name.toLowerCase(), label])
    );
    const labelIds: string[] = [];
    for (const name of draft.labels) {
        const label = availableLabels.get(name.toLowerCase());
        if (label) labelIds.push(label.id);
    }
    const keys = await loadApiKeys();
    let last = 'Linear rechazó todas las claves';
    for (const candidate of keys) {
        try {
            const data = await request<{
                issueCreate: {
                    success: boolean;
                    issue: {
                        identifier: string;
                        url: string;
                        title: string;
                        state: { name: string };
                    } | null;
                };
            }>(candidate.key, CREATE_MUTATION, {
                input: {
                    teamId: team.id,
                    stateId: state.id,
                    title: draft.title,
                    description: draft.description,
                    priority: draft.priority,
                    labelIds
                }
            });
            if (!data.issueCreate.success || !data.issueCreate.issue)
                throw new Error('Linear no creó el issue');
            return {
                identifier: data.issueCreate.issue.identifier,
                url: data.issueCreate.issue.url,
                title: data.issueCreate.issue.title,
                state: data.issueCreate.issue.state.name
            };
        } catch (error) {
            last = `${candidate.origin}: ${(error as Error).message}`;
        }
    }
    throw new Error(last);
}

export async function runLinearBacklog({
    argv,
    repoRoot
}: {
    readonly argv: readonly string[];
    readonly repoRoot: string;
}): Promise<number> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'hops linear-backlog --title "..." --description "..." [--kind bug|feature|improvement] [--label X] [--priority 0-4] [--json] [--yes]\n'
        );
        return 0;
    }
    const config = await loadProjectAdapter(repoRoot);
    if (!config) {
        process.stderr.write('No encontré .qz/project.json.\n');
        return 2;
    }
    const parsed = parseBacklogDraft(argv, config.projectId ?? 'unknown', config);
    if (!parsed.ok) {
        process.stderr.write(`No se puede preparar el backlog: ${parsed.reason}\n`);
        return 2;
    }
    const json = argv.includes('--json');
    const plan = {
        draft: parsed.draft,
        readOnly: !argv.includes('--yes'),
        mutation: argv.includes('--yes') ? 'issueCreate' : null
    };
    if (!argv.includes('--yes')) {
        process.stdout.write(
            json
                ? `${JSON.stringify(plan)}\n`
                : `Borrador Linear (${parsed.draft.teamKey}/${parsed.draft.stateName})\nTítulo: ${parsed.draft.title}\nDescripción: ${parsed.draft.description}\nPrioridad: ${parsed.draft.priority}\nLabels: ${parsed.draft.labels.join(', ') || '(ninguna)'}\n\nNo se escribió nada. Repetí con --yes tras confirmar.\n`
        );
        return 0;
    }
    try {
        const created = await createBacklogIssue({ draft: parsed.draft });
        process.stdout.write(
            json
                ? `${JSON.stringify({ ...created, readOnly: false })}\n`
                : `Creado ${created.identifier}: ${created.url}\n`
        );
        return 0;
    } catch (error) {
        process.stderr.write(`No se pudo crear el issue: ${(error as Error).message}\n`);
        return 1;
    }
}
