import type {
    InsightDefinition,
    Json,
    PostHogAnnotation,
    PostHogCohort,
    PostHogDashboard,
    PostHogInsight,
    SetupResourceDefinition
} from './definitions.js';
import { buildPlaceholderCohortFilters } from './definitions.js';

export interface PostHogSetupConfig {
    readonly apiKey: string;
    readonly host: string;
    readonly dryRun: boolean;
    readonly projectId: string;
}

let dryRunNextId = 1;
const dryRunDashboards: PostHogDashboard[] = [];
const dryRunInsights: PostHogInsight[] = [];
const dryRunCohorts: PostHogCohort[] = [];
const dryRunAnnotations: PostHogAnnotation[] = [];

function isDryRun(): boolean {
    return process.env.POSTHOG_DRY_RUN === 'true';
}

export function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function resolveConfig(): PostHogSetupConfig {
    const host = (process.env.POSTHOG_HOST ?? 'https://us.posthog.com').replace(/\/$/, '');
    const dryRun = isDryRun();
    const projectId = dryRun
        ? (process.env.POSTHOG_PROJECT_ID?.trim() ?? 'dry-run-project')
        : getRequiredEnv('POSTHOG_PROJECT_ID');
    const apiKey = dryRun
        ? (process.env.POSTHOG_PERSONAL_API_KEY?.trim() ?? 'dry-run-key')
        : getRequiredEnv('POSTHOG_PERSONAL_API_KEY');
    return { apiKey, host, dryRun, projectId };
}

export function buildAnnotationContent(): string | null {
    const explicit = process.env.POSTHOG_ANNOTATION_CONTENT?.trim();
    if (explicit) {
        return explicit;
    }

    const release = process.env.POSTHOG_RELEASE?.trim();
    const sha = process.env.POSTHOG_DEPLOY_SHA?.trim();

    if (!release && !sha) {
        return null;
    }

    return ['Hospeda deploy', release ? `release=${release}` : null, sha ? `sha=${sha}` : null]
        .filter(Boolean)
        .join(' · ');
}

export async function posthogRequest<T>(input: {
    body?: Json;
    method?: 'GET' | 'POST' | 'PATCH';
    path: string;
}): Promise<T> {
    const { apiKey, dryRun, host } = resolveConfig();

    if (dryRun) {
        console.log(`[dry-run] ${input.method ?? 'GET'} ${input.path}`);

        const method = input.method ?? 'GET';
        const body = (input.body ?? {}) as Record<string, Json>;

        if (input.path.includes('/dashboards/?') && method === 'GET') {
            return { results: dryRunDashboards } as T;
        }
        if (input.path.includes('/insights/?') && method === 'GET') {
            return { results: dryRunInsights } as T;
        }
        if (input.path.includes('/cohorts/?') && method === 'GET') {
            return { results: dryRunCohorts } as T;
        }
        if (input.path.includes('/annotations/?') && method === 'GET') {
            return { results: dryRunAnnotations } as T;
        }

        if (input.path.includes('/dashboards/') && method === 'POST') {
            const created: PostHogDashboard = {
                id: dryRunNextId++,
                name: String(body.name ?? 'unnamed-dashboard'),
                description: typeof body.description === 'string' ? body.description : null,
                tags: Array.isArray(body.tags) ? (body.tags as string[]) : []
            };
            dryRunDashboards.push(created);
            return created as T;
        }
        if (/\/dashboards\/\d+\/$/.test(input.path) && method === 'PATCH') {
            const dashboardId = Number(input.path.match(/\/dashboards\/(\d+)\/$/)?.[1] ?? '0');
            const existing = dryRunDashboards.find((item) => item.id === dashboardId);
            if (!existing) {
                throw new Error(`[dry-run] dashboard not found: ${dashboardId}`);
            }
            Object.assign(existing, {
                name: String(body.name ?? existing.name),
                description:
                    typeof body.description === 'string' ? body.description : existing.description,
                tags: Array.isArray(body.tags) ? (body.tags as string[]) : existing.tags
            });
            return existing as T;
        }

        if (input.path.includes('/insights/') && method === 'POST') {
            const created: PostHogInsight = {
                dashboards: Array.isArray(body.dashboards)
                    ? (body.dashboards as number[])
                    : undefined,
                id: dryRunNextId++,
                name: typeof body.name === 'string' ? body.name : null,
                derived_name: typeof body.name === 'string' ? body.name : null
            };
            dryRunInsights.push(created);
            return created as T;
        }
        if (/\/insights\/\d+\/$/.test(input.path) && method === 'PATCH') {
            const insightId = Number(input.path.match(/\/insights\/(\d+)\/$/)?.[1] ?? '0');
            const existing = dryRunInsights.find((item) => item.id === insightId);
            if (!existing) {
                throw new Error(`[dry-run] insight not found: ${insightId}`);
            }
            Object.assign(existing, {
                dashboards: Array.isArray(body.dashboards)
                    ? (body.dashboards as number[])
                    : existing.dashboards,
                name: typeof body.name === 'string' ? body.name : existing.name,
                derived_name: typeof body.name === 'string' ? body.name : existing.derived_name
            });
            return existing as T;
        }

        if (input.path.includes('/cohorts/') && method === 'POST') {
            const created: PostHogCohort = {
                id: dryRunNextId++,
                name: String(body.name ?? 'unnamed-cohort'),
                description: typeof body.description === 'string' ? body.description : null,
                filters: body.filters ?? null
            };
            dryRunCohorts.push(created);
            return created as T;
        }
        if (/\/cohorts\/\d+\/$/.test(input.path) && method === 'PATCH') {
            const cohortId = Number(input.path.match(/\/cohorts\/(\d+)\/$/)?.[1] ?? '0');
            const existing = dryRunCohorts.find((item) => item.id === cohortId);
            if (!existing) {
                throw new Error(`[dry-run] cohort not found: ${cohortId}`);
            }
            Object.assign(existing, {
                name: String(body.name ?? existing.name),
                description:
                    typeof body.description === 'string' ? body.description : existing.description,
                filters: body.filters ?? existing.filters
            });
            return existing as T;
        }

        if (input.path.includes('/annotations/') && method === 'POST') {
            const created: PostHogAnnotation = {
                id: dryRunNextId++,
                content: String(body.content ?? 'annotation'),
                date_marker: typeof body.date_marker === 'string' ? body.date_marker : null
            };
            dryRunAnnotations.push(created);
            return created as T;
        }

        throw new Error(`[dry-run] unsupported request shape: ${method} ${input.path}`);
    }

    const response = await fetch(`${host}${input.path}`, {
        method: input.method ?? 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
            `PostHog API ${input.method ?? 'GET'} ${input.path} failed: ${response.status}${errorText ? `\n${errorText}` : ''}`
        );
    }

    return (await response.json()) as T;
}

export async function listDashboards(): Promise<readonly PostHogDashboard[]> {
    const { projectId } = resolveConfig();
    const response = await posthogRequest<{ results: PostHogDashboard[] }>({
        path: `/api/projects/${projectId}/dashboards/?limit=100`
    });
    return response.results;
}

export async function ensureDashboard(
    definition: SetupResourceDefinition
): Promise<PostHogDashboard> {
    const { projectId } = resolveConfig();
    const dashboards = await listDashboards();
    const existing = dashboards.find((dashboard) => dashboard.name === definition.name);

    if (existing) {
        return await posthogRequest<PostHogDashboard>({
            method: 'PATCH',
            path: `/api/projects/${projectId}/dashboards/${existing.id}/`,
            body: {
                name: definition.name,
                description: definition.description,
                tags: definition.tags ?? ['hospeda', 'managed-by-script']
            }
        });
    }

    return await posthogRequest<PostHogDashboard>({
        method: 'POST',
        path: `/api/projects/${projectId}/dashboards/`,
        body: {
            name: definition.name,
            description: definition.description,
            tags: definition.tags ?? ['hospeda', 'managed-by-script']
        }
    });
}

export async function listInsights(): Promise<readonly PostHogInsight[]> {
    const { projectId } = resolveConfig();
    const response = await posthogRequest<{ results: PostHogInsight[] }>({
        path: `/api/projects/${projectId}/insights/?limit=200`
    });
    return response.results;
}

export async function ensureInsight(input: {
    dashboardId: number;
    definition: InsightDefinition;
}): Promise<PostHogInsight> {
    const { projectId } = resolveConfig();
    const insights = await listInsights();
    const candidateNames = new Set([
        input.definition.name,
        ...(input.definition.legacyNames ?? [])
    ]);
    const existing = insights.find(
        (insight) =>
            candidateNames.has(insight.name ?? insight.derived_name ?? '') &&
            insight.dashboards?.includes(input.dashboardId)
    );

    const body = {
        name: input.definition.name,
        description: input.definition.description,
        dashboards: [input.dashboardId],
        tags: input.definition.tags ?? ['hospeda', 'managed-by-script'],
        query: input.definition.query
    };

    if (existing) {
        return await posthogRequest<PostHogInsight>({
            method: 'PATCH',
            path: `/api/projects/${projectId}/insights/${existing.id}/`,
            body
        });
    }

    return await posthogRequest<PostHogInsight>({
        method: 'POST',
        path: `/api/projects/${projectId}/insights/`,
        body
    });
}

export async function listCohorts(): Promise<readonly PostHogCohort[]> {
    const { projectId } = resolveConfig();
    const response = await posthogRequest<{ results: PostHogCohort[] }>({
        path: `/api/projects/${projectId}/cohorts/?limit=100`
    });
    return response.results;
}

export async function ensureCohort(
    definition: Omit<SetupResourceDefinition, 'tags'>
): Promise<PostHogCohort> {
    const { projectId } = resolveConfig();
    const cohorts = await listCohorts();
    const existing = cohorts.find((cohort) => cohort.name === definition.name);
    const body = {
        name: definition.name,
        description: definition.description,
        filters: buildPlaceholderCohortFilters(definition.name)
    };

    if (existing) {
        return await posthogRequest<PostHogCohort>({
            method: 'PATCH',
            path: `/api/projects/${projectId}/cohorts/${existing.id}/`,
            body
        });
    }

    return await posthogRequest<PostHogCohort>({
        method: 'POST',
        path: `/api/projects/${projectId}/cohorts/`,
        body
    });
}

export async function listAnnotations(): Promise<readonly PostHogAnnotation[]> {
    const { projectId } = resolveConfig();
    const response = await posthogRequest<{ results: PostHogAnnotation[] }>({
        path: `/api/projects/${projectId}/annotations/?limit=100`
    });
    return response.results;
}

export async function ensureAnnotation(): Promise<PostHogAnnotation | null> {
    const { projectId } = resolveConfig();
    const content = buildAnnotationContent();
    if (!content) {
        return null;
    }

    const dateMarker = process.env.POSTHOG_ANNOTATION_DATE?.trim() ?? new Date().toISOString();
    const annotations = await listAnnotations();
    const existing = annotations.find(
        (annotation) => annotation.content === content && annotation.date_marker === dateMarker
    );

    if (existing) {
        return existing;
    }

    return await posthogRequest<PostHogAnnotation>({
        method: 'POST',
        path: `/api/projects/${projectId}/annotations/`,
        body: {
            content,
            date_marker: dateMarker,
            creation_type: 'USR'
        }
    });
}
