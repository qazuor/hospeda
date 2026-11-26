/**
 * @file ai-assistants.ts
 * @description Pure helpers for the "Asistentes de IA" account panel
 * (HOS-2184 T-028). Client-safe: no env access and no network.
 *
 * The panel lists the OAuth clients (AI assistants) a user connected to the MCP
 * server. `name`, `uri` and `logoUri` are declared by the client itself and are
 * untrusted: the helpers here only ever yield plain text or an https URL.
 */

import type {
    AiAssistantAccessResponse,
    AiConnection,
    AiConnectionPendingResetReview
} from '@repo/schemas';
import {
    AiAssistantAccessResponseSchema,
    AiConnectionListSchema,
    AiConnectionPendingResetReviewSchema
} from '@repo/schemas';
import type { SupportedLocale } from '@/lib/i18n';
import { PLANS_PAGE_PATH_BY_VERTICAL } from '@/lib/publish/publish-page-paths';
import { buildUrl } from '@/lib/urls';

/** Path of the protected AI connections collection. */
export const AI_CONNECTIONS_API_PATH = '/api/v1/protected/ai-connections';

/** Capabilities a connection grants, shared with the consent screen copy. */
export const AI_CAPABILITY_KEYS = [
    'read',
    'edit',
    'pause',
    'reply',
    'reviews',
    'createListings',
    'providers',
    'benefitUsages'
] as const;

/** Spanish fallbacks for the capabilities (the locale files are the source). */
export const AI_CAPABILITY_FALLBACKS: Readonly<
    Record<(typeof AI_CAPABILITY_KEYS)[number], string>
> = {
    read: 'Ver tus publicaciones y sus estadísticas',
    edit: 'Editar datos básicos (descripción, contacto, horarios, servicios)',
    pause: 'Pausar o reanudar tus publicaciones',
    reply: 'Responder consultas de tus alojamientos',
    reviews: 'Ver todas las reseñas de tus publicaciones, también las pendientes y las rechazadas',
    createListings: 'Crear borradores de publicaciones nuevas',
    providers: 'Buscar en el directorio de proveedores para anfitriones',
    benefitUsages: 'Ver tus usos de beneficios y confirmarlos o rechazarlos'
};

/**
 * The list schema with `pendingResetReview` tolerated as absent: the web and the
 * API deploy separately, and a web that is ahead of the API must still render
 * the list instead of an error.
 */
const AiConnectionListResponseSchema = AiConnectionListSchema.extend({
    pendingResetReview: AiConnectionPendingResetReviewSchema.nullish()
});

/** Path of the post-password-reset question (HOS-2184). */
export const AI_CONNECTIONS_RESET_REVIEW_API_PATH = `${AI_CONNECTIONS_API_PATH}/reset-review`;

/**
 * Builds the URL that answers the post-password-reset question.
 *
 * @param params.apiUrl - API base URL (trailing slash tolerated).
 * @returns The absolute URL.
 */
export function buildAiConnectionsResetReviewUrl({ apiUrl }: { readonly apiUrl: string }): string {
    return `${apiUrl.replace(/\/$/, '')}${AI_CONNECTIONS_RESET_REVIEW_API_PATH}`;
}

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
    | {
          readonly ok: true;
          readonly items: readonly AiConnection[];
          /** The unanswered "also disconnect the assistants from before your password reset?" question. */
          readonly pendingResetReview: AiConnectionPendingResetReview | null;
      }
    | { readonly ok: false };

/**
 * Validates the body of `GET /protected/ai-connections`.
 *
 * @param params.body - Parsed JSON body (unknown shape).
 * @returns The connections and the pending reset review, or `{ ok: false }` when the
 *   envelope is not the expected one.
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
    const parsed = AiConnectionListResponseSchema.safeParse(data);
    return parsed.success
        ? {
              ok: true,
              items: parsed.data.items,
              pendingResetReview: parsed.data.pendingResetReview ?? null
          }
        : { ok: false };
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

/** Path of the "does my plan include the AI assistant?" check (HOS-2184 T-041). */
export const AI_ASSISTANT_ACCESS_API_PATH = `${AI_CONNECTIONS_API_PATH}/access`;

/**
 * Builds the URL of the AI assistant access check.
 *
 * @param params.apiUrl - API base URL (trailing slash tolerated).
 * @returns The absolute URL.
 */
export function buildAiAssistantAccessUrl({ apiUrl }: { readonly apiUrl: string }): string {
    return `${apiUrl.replace(/\/$/, '')}${AI_ASSISTANT_ACCESS_API_PATH}`;
}

/**
 * Validates the body of `GET /protected/ai-connections/access`.
 *
 * @param params.body - Parsed JSON body (unknown shape).
 * @returns The access answer, or `null` when the envelope is not the expected one.
 */
export function parseAiAssistantAccess({
    body
}: {
    readonly body: unknown;
}): AiAssistantAccessResponse | null {
    if (
        typeof body !== 'object' ||
        body === null ||
        !('success' in body) ||
        body.success !== true
    ) {
        return null;
    }
    const data = 'data' in body ? body.data : undefined;
    const parsed = AiAssistantAccessResponseSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
}

/**
 * Localized URL of the plans page the "not included in your plan" notice links to.
 *
 * @param params.locale - Active locale.
 * @param params.vertical - Vertical reported by the API; absent falls back to accommodation.
 * @returns The plans page URL.
 */
export function buildAiAssistantPlansUrl({
    locale,
    vertical
}: {
    readonly locale: SupportedLocale;
    readonly vertical?: AiAssistantAccessResponse['vertical'];
}): string {
    return buildUrl({ locale, path: PLANS_PAGE_PATH_BY_VERTICAL[vertical ?? 'accommodation'] });
}
