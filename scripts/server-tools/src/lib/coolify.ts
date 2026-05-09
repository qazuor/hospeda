/**
 * Thin REST client for the Coolify v4 API.
 *
 * Only models the endpoints `hops` actually calls — list applications,
 * trigger redeploy, list / patch / create env vars. Everything else is
 * intentionally absent so the surface area we have to keep in sync
 * with Coolify version drift stays small.
 *
 * Auth: Bearer token via the `COOLIFY_API_TOKEN` env var. The token
 * needs `read`, `read:sensitive`, `write`, and `deploy` scopes — see
 * `.env.local.example` and the Coolify Security → API Tokens UI.
 */

import { get, required } from './env.ts';

/**
 * Subset of the Coolify Application object we care about. Coolify
 * returns more fields; ignore them so a server-side schema change does
 * not break the client unless we actively consume the new field.
 */
export interface CoolifyApplication {
    readonly uuid: string;
    readonly name: string;
    readonly fqdn?: string;
    readonly status?: string;
    readonly project_uuid?: string;
    readonly environment_name?: string;
}

/**
 * Subset of the Coolify env-var record. `value` is null when the token
 * does not have `read:sensitive` scope or the field is empty.
 */
export interface CoolifyEnvVar {
    readonly uuid: string;
    readonly key: string;
    readonly value?: string | null;
    readonly is_preview?: boolean;
    readonly is_build_time?: boolean;
    readonly is_literal?: boolean;
}

/**
 * Convenience error thrown when the Coolify API replies with a non-2xx
 * status. Carries the status code + parsed body so commands can render
 * "401 Unauthorized" / "403 missing deploy scope" / etc. cleanly.
 */
export class CoolifyApiError extends Error {
    readonly status: number;
    readonly body: unknown;

    constructor(message: string, status: number, body: unknown) {
        super(message);
        this.name = 'CoolifyApiError';
        this.status = status;
        this.body = body;
    }
}

interface CoolifyClientOptions {
    /** Override base URL (defaults to env COOLIFY_API_URL). */
    readonly baseUrl?: string;
    /** Override token (defaults to env COOLIFY_API_TOKEN). */
    readonly token?: string;
}

/**
 * Build a typed Coolify client. The factory is exported instead of a
 * singleton so commands can pass an alternative base URL during tests.
 */
export function createCoolifyClient(options: CoolifyClientOptions = {}): CoolifyClient {
    const baseUrl = options.baseUrl ?? get('COOLIFY_API_URL') ?? 'https://coolify.hospeda.com.ar';
    const token = options.token ?? required('COOLIFY_API_TOKEN');
    return new CoolifyClient(baseUrl.replace(/\/$/, ''), token);
}

class CoolifyClient {
    constructor(
        private readonly baseUrl: string,
        private readonly token: string
    ) {}

    private async request<T>(
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
        path: string,
        init: { body?: unknown; query?: Record<string, string> } = {}
    ): Promise<T> {
        const url = new URL(`${this.baseUrl}${path}`);
        for (const [k, v] of Object.entries(init.query ?? {})) {
            url.searchParams.set(k, v);
        }
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/json',
                ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {})
            },
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined
        });

        const text = await response.text();
        const parsed = text ? safeJsonParse(text) : undefined;

        if (!response.ok) {
            throw new CoolifyApiError(
                `Coolify API ${method} ${path} → ${response.status} ${response.statusText}`,
                response.status,
                parsed ?? text
            );
        }

        return parsed as T;
    }

    /** List all applications visible to the token's team. */
    listApplications(): Promise<ReadonlyArray<CoolifyApplication>> {
        return this.request<ReadonlyArray<CoolifyApplication>>('GET', '/api/v1/applications');
    }

    /** Get a single application by UUID. */
    getApplication(uuid: string): Promise<CoolifyApplication> {
        return this.request<CoolifyApplication>('GET', `/api/v1/applications/${uuid}`);
    }

    /**
     * Trigger a redeploy of the given application UUID. Coolify's
     * deploy endpoint is global (`/api/v1/deploy`) and takes the UUID
     * as a query parameter; the response is a deployment summary.
     */
    deploy(uuid: string): Promise<{
        readonly deployments: ReadonlyArray<{
            readonly resource_uuid: string;
            readonly deployment_uuid: string;
        }>;
    }> {
        return this.request('POST', '/api/v1/deploy', { query: { uuid } });
    }

    /** List env vars on an application. Values are null without read:sensitive scope. */
    listEnvVars(applicationUuid: string): Promise<ReadonlyArray<CoolifyEnvVar>> {
        return this.request<ReadonlyArray<CoolifyEnvVar>>(
            'GET',
            `/api/v1/applications/${applicationUuid}/envs`
        );
    }

    /** Update one env var by its UUID; pass only the fields you want to change. */
    updateEnvVar(
        applicationUuid: string,
        envVarUuid: string,
        patch: Partial<Pick<CoolifyEnvVar, 'value' | 'is_preview' | 'is_build_time' | 'is_literal'>>
    ): Promise<CoolifyEnvVar> {
        return this.request<CoolifyEnvVar>(
            'PATCH',
            `/api/v1/applications/${applicationUuid}/envs/${envVarUuid}`,
            { body: patch }
        );
    }

    /** Create a new env var on an application. */
    createEnvVar(
        applicationUuid: string,
        body: Pick<CoolifyEnvVar, 'key'> &
            Partial<Pick<CoolifyEnvVar, 'value' | 'is_preview' | 'is_build_time' | 'is_literal'>>
    ): Promise<CoolifyEnvVar> {
        return this.request<CoolifyEnvVar>('POST', `/api/v1/applications/${applicationUuid}/envs`, {
            body
        });
    }
}

export type { CoolifyClient };

function safeJsonParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
