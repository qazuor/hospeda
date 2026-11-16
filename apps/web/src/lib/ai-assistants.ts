/**
 * @file ai-assistants.ts
 * @description Pure helpers for the "Asistentes de IA" account panel
 * (HOS-2184 T-028). Client-safe: no env access and no network.
 *
 * The panel lists the OAuth clients (AI assistants) a user connected to the MCP
 * server. `name`, `uri` and `logoUri` are declared by the client itself and are
 * untrusted: the helpers here only ever yield plain text or an https URL.
 */

import type { AiConnection } from '@repo/schemas';
import { AiConnectionListSchema } from '@repo/schemas';

/** Path of the protected AI connections collection. */
export const AI_CONNECTIONS_API_PATH = '/api/v1/protected/ai-connections';

/** Capabilities a connection grants, shared with the consent screen copy. */
export const AI_CAPABILITY_KEYS = ['read', 'edit', 'pause', 'reply'] as const;

/** Spanish fallbacks for the capabilities (the locale files are the source). */
export const AI_CAPABILITY_FALLBACKS: Readonly<
    Record<(typeof AI_CAPABILITY_KEYS)[number], string>
> = {
    read: 'Ver tus publicaciones y sus estadísticas',
    edit: 'Editar datos básicos (descripción, contacto, horarios, servicios)',
    pause: 'Pausar o reanudar tus publicaciones',
    reply: 'Responder consultas de tus alojamientos'
};

/** Input of {@link buildAiConnectionsUrl}. */
export interface BuildAiConnectionsUrlParams {
    /** API base URL (trailing slash tolerated). */
    readonly apiUrl: string;
    /** When set, targets one connection as `?clientId=` (percent-encoded: ids may be URLs). */
    readonly clientId?: string;
}

/**
 * Builds the URL of the connections collection, or of one connection.
 *
 * @param params - API base and optional client id.
 * @returns The absolute URL.
 *
 * @example
 * ```ts
 * buildAiConnectionsUrl({ apiUrl: 'https://api.x', clientId: 'https://c.io/m.json' });
 * // 'https://api.x/api/v1/protected/ai-connections?clientId=https%3A%2F%2Fc.io%2Fm.json'
 * ```
 */
export function buildAiConnectionsUrl({ apiUrl, clientId }: BuildAiConnectionsUrlParams): string {
    const base = `${apiUrl.replace(/\/$/, '')}${AI_CONNECTIONS_API_PATH}`;
    return clientId === undefined ? base : `${base}?clientId=${encodeURIComponent(clientId)}`;
}

/** Result of {@link parseAiConnections}. */
export type ParseAiConnectionsResult =
    | { readonly ok: true; readonly items: readonly AiConnection[] }
    | { readonly ok: false };

/**
 * Validates the body of `GET /protected/ai-connections`.
 *
 * @param params.body - Parsed JSON body (unknown shape).
 * @returns The connections, or `{ ok: false }` when the envelope is not the expected one.
 */
export function parseAiConnections({ body }: { readonly body: unknown }): ParseAiConnectionsResult {
    if (
        typeof body !== 'object' ||
        body === null ||
        !('success' in body) ||
        body.success !== true
    ) {
        return { ok: false };
    }
    const data = 'data' in body ? body.data : undefined;
    const parsed = AiConnectionListSchema.safeParse(data);
    return parsed.success ? { ok: true, items: parsed.data.items } : { ok: false };
}

/**
 * How much of the panel a visitor gets.
 *
 * - `full`: the feature is on, show how to connect plus the list.
 * - `manage-only`: the feature is off but the user still has connections, show
 *   the list so they can disconnect.
 * - `unavailable`: the feature is off and there is nothing to manage.
 */
export type AiAssistantsVisibility = 'full' | 'manage-only' | 'unavailable';

/**
 * Decides the panel visibility (owner decision, HOS-2184).
 *
 * @param params.mcpEnabled - Whether the MCP server is switched on.
 * @param params.connectionCount - How many connections the user has.
 * @returns The visibility level.
 */
export function resolveAiAssistantsVisibility({
    mcpEnabled,
    connectionCount
}: {
    readonly mcpEnabled: boolean;
    readonly connectionCount: number;
}): AiAssistantsVisibility {
    if (mcpEnabled) {
        return 'full';
    }
    return connectionCount > 0 ? 'manage-only' : 'unavailable';
}
