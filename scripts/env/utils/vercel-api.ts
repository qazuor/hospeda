#!/usr/bin/env tsx
/**
 * Vercel API client for environment variable management.
 *
 * Provides typed wrappers around the Vercel REST API for listing,
 * creating, and updating environment variables on a project.
 * Uses native fetch and VERCEL_TOKEN for authentication.
 *
 * @module scripts/env/utils/vercel-api
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * A Vercel environment variable as returned by the API.
 */
export interface VercelEnvVar {
    /** Unique identifier for this environment variable record. */
    readonly id: string;
    /** Variable name (e.g. `HOSPEDA_API_URL`). */
    readonly key: string;
    /** Variable value. May be empty for encrypted/secret vars. */
    readonly value: string;
    /** Deployment targets this variable applies to. */
    readonly target: readonly ('production' | 'preview' | 'development')[];
    /** Storage type for the variable. */
    readonly type: 'plain' | 'encrypted' | 'secret';
}

/**
 * Project configuration read from `.vercel/project.json`.
 */
export interface VercelProjectConfig {
    /** Vercel project identifier. */
    readonly projectId: string;
    /** Vercel org/team identifier. */
    readonly orgId: string;
}

/**
 * Parameters for listing environment variables.
 */
interface ListEnvVarsParams {
    readonly projectId: string;
    readonly token: string;
}

/**
 * Parameters for creating an environment variable.
 */
interface CreateEnvVarParams {
    readonly projectId: string;
    readonly token: string;
    readonly key: string;
    readonly value: string;
    readonly target: readonly string[];
    readonly type: string;
}

/**
 * Parameters for updating an environment variable.
 */
interface UpdateEnvVarParams {
    readonly projectId: string;
    readonly token: string;
    readonly envId: string;
    readonly value: string;
}

const VERCEL_API_BASE = 'https://api.vercel.com';

/**
 * Retrieves and validates the Vercel API token from the environment.
 *
 * @returns The Vercel API token string.
 * @throws {Error} If VERCEL_TOKEN is not set in the environment.
 *
 * @example
 * ```ts
 * const token = await getVercelToken();
 * ```
 */
export async function getVercelToken(): Promise<string> {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
        throw new Error(
            'VERCEL_TOKEN env var is required. Run `vercel login` or set it manually.\n' +
                'You can generate a token at: https://vercel.com/account/tokens'
        );
    }
    return token;
}

/**
 * Reads the Vercel project configuration from an app's `.vercel/project.json`.
 *
 * @param appDir - Absolute path to the app directory (e.g. `/path/to/apps/api`).
 * @returns The project and org IDs.
 * @throws {Error} If the project.json file is missing or malformed.
 *
 * @example
 * ```ts
 * const config = await readProjectConfig('/projects/hospeda/apps/api');
 * console.log(config.projectId);
 * ```
 */
export async function readProjectConfig(appDir: string): Promise<VercelProjectConfig> {
    const configPath = join(appDir, '.vercel', 'project.json');
    let raw: string;
    try {
        raw = await readFile(configPath, 'utf-8');
    } catch {
        throw new Error(
            `Could not read ${configPath}.\n` +
                `Make sure you have run \`vercel link\` in the app directory: ${appDir}`
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(`Malformed JSON in ${configPath}`);
    }

    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('projectId' in parsed) ||
        !('orgId' in parsed) ||
        typeof (parsed as Record<string, unknown>).projectId !== 'string' ||
        typeof (parsed as Record<string, unknown>).orgId !== 'string'
    ) {
        throw new Error(
            `Invalid project.json at ${configPath}: expected { projectId: string, orgId: string }`
        );
    }

    return {
        projectId: (parsed as Record<string, string>).projectId,
        orgId: (parsed as Record<string, string>).orgId
    };
}

/**
 * Asserts that a Vercel API response is successful, throwing on error.
 *
 * @param response - The fetch Response object.
 * @param context - Human-readable context for the error message.
 * @throws {Error} If the response status indicates failure.
 */
async function assertOk(response: Response, context: string): Promise<void> {
    if (!response.ok) {
        let body = '';
        try {
            const json = (await response.json()) as Record<string, unknown>;
            body = JSON.stringify(json.error ?? json);
        } catch {
            body = await response.text().catch(() => '(no body)');
        }
        throw new Error(`Vercel API error (${context}): HTTP ${response.status} - ${body}`);
    }
}

/**
 * Lists all environment variables for a Vercel project.
 *
 * Fetches from `GET /v9/projects/{projectId}/env` and returns the
 * full list of configured variables.
 *
 * @param params - Project ID and auth token.
 * @returns Array of environment variable records.
 * @throws {Error} If the API request fails.
 *
 * @example
 * ```ts
 * const vars = await listEnvVars({ projectId: 'prj_xxx', token });
 * ```
 */
export async function listEnvVars(params: ListEnvVarsParams): Promise<VercelEnvVar[]> {
    const { projectId, token } = params;
    const url = `${VERCEL_API_BASE}/v9/projects/${encodeURIComponent(projectId)}/env`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    await assertOk(response, 'listEnvVars');

    const data = (await response.json()) as { envs: VercelEnvVar[] };
    return data.envs ?? [];
}

/**
 * Creates a new environment variable on a Vercel project.
 *
 * Calls `POST /v9/projects/{projectId}/env` to add a new variable.
 *
 * @param params - Project ID, token, variable key/value, targets, and type.
 * @throws {Error} If the API request fails.
 *
 * @example
 * ```ts
 * await createEnvVar({
 *   projectId: 'prj_xxx',
 *   token,
 *   key: 'HOSPEDA_API_URL',
 *   value: 'https://api.example.com',
 *   target: ['production'],
 *   type: 'plain',
 * });
 * ```
 */
export async function createEnvVar(params: CreateEnvVarParams): Promise<void> {
    const { projectId, token, key, value, target, type } = params;
    const url = `${VERCEL_API_BASE}/v9/projects/${encodeURIComponent(projectId)}/env`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value, target, type })
    });

    await assertOk(response, `createEnvVar(${key})`);
}

/**
 * Updates an existing environment variable on a Vercel project.
 *
 * Calls `PATCH /v9/projects/{projectId}/env/{envId}` to update the value.
 *
 * @param params - Project ID, token, env record ID, and new value.
 * @throws {Error} If the API request fails.
 *
 * @example
 * ```ts
 * await updateEnvVar({
 *   projectId: 'prj_xxx',
 *   token,
 *   envId: 'env_yyy',
 *   value: 'https://new-api.example.com',
 * });
 * ```
 */
export async function updateEnvVar(params: UpdateEnvVarParams): Promise<void> {
    const { projectId, token, envId, value } = params;
    const url = `${VERCEL_API_BASE}/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`;

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
    });

    await assertOk(response, `updateEnvVar(${envId})`);
}
