/**
 * @file use-integration-config.ts
 * @description TanStack Query hooks for the Integration Config Export page (HOS-67 G-6, T-007).
 *
 * Wraps two read-only admin endpoints:
 *  - `GET /api/v1/admin/social/gpt-action-schema`  — OpenAPI 3.1 document for the
 *    Custom GPT Actions config (arbitrary JSON object, shape not modeled here).
 *  - `GET /api/v1/admin/social/make-webhook-schema` — Make.com webhook config
 *    export (payload/response JSON Schemas + webhook URL + API key + header name).
 *
 * Both endpoints are gated server-side by admin session + SOCIAL_SETTINGS_MANAGE
 * (see `apps/api/src/routes/social/admin/{gpt-action-schema,make-webhook-schema}.ts`).
 * This module only fetches; there are no mutations.
 *
 * Follows the same `fetchApi` + `{ success, data }` unwrap pattern used by the
 * sibling `features/social-credentials/hooks.ts` module.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The GPT Action export is an arbitrary OpenAPI 3.1 document — there is no
 * shared Zod schema for it (it's generated on the fly from other schemas), so
 * a local `Record<string, unknown>` alias is the correct type here.
 */
export type GptActionSchemaResponse = Record<string, unknown>;

/** Outbound auth header Hospeda sends on every Make.com dispatch POST. */
export const MAKE_WEBHOOK_HEADER_NAME = 'x-make-apikey' as const;

/**
 * Response shape of `GET /api/v1/admin/social/make-webhook-schema`.
 * Mirrors the authoritative API contract in
 * `apps/api/src/routes/social/admin/make-webhook-schema.ts` — not currently a
 * shared `@repo/schemas` type, so a local interface is kept colocated here.
 */
export interface MakeWebhookSchemaResponse {
    /** Live JSON Schema of the Make.com dispatch payload. */
    readonly payloadSchema: Record<string, unknown>;
    /** Live JSON Schema of the Make.com webhook response. */
    readonly responseSchema: Record<string, unknown>;
    /** Outbound Make.com webhook URL, or `null` if unconfigured. */
    readonly webhookUrl: string | null;
    /** Value sent in the outbound auth header, or `null` if unconfigured. */
    readonly makeApiKey: string | null;
    /** The outbound auth header name. */
    readonly headerName: typeof MAKE_WEBHOOK_HEADER_NAME;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** TanStack Query keys for the integration config export page. */
export const integrationConfigQueryKeys = {
    gptActionSchema: ['social', 'integration-config', 'gpt-action-schema'] as const,
    makeWebhookSchema: ['social', 'integration-config', 'make-webhook-schema'] as const
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetch the GPT Action OpenAPI 3.1 export document.
 *
 * @returns The full OpenAPI 3.1 document as a plain JSON object.
 */
async function fetchGptActionSchema(): Promise<GptActionSchemaResponse> {
    const result = await fetchApi<{ success: boolean; data: GptActionSchemaResponse }>({
        path: '/api/v1/admin/social/gpt-action-schema'
    });
    return result.data.data;
}

/**
 * Fetch the Make.com webhook config export.
 *
 * @returns Payload/response JSON Schemas plus webhook URL, API key and header name.
 */
async function fetchMakeWebhookSchema(): Promise<MakeWebhookSchemaResponse> {
    const result = await fetchApi<{ success: boolean; data: MakeWebhookSchemaResponse }>({
        path: '/api/v1/admin/social/make-webhook-schema'
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Hook to fetch the Custom GPT Action OpenAPI 3.1 export document.
 */
export const useGptActionSchemaQuery = () => {
    return useQuery({
        queryKey: integrationConfigQueryKeys.gptActionSchema,
        queryFn: fetchGptActionSchema,
        staleTime: 2 * 60 * 1000,
        retry: 1
    });
};

/**
 * Hook to fetch the Make.com webhook config export.
 */
export const useMakeWebhookSchemaQuery = () => {
    return useQuery({
        queryKey: integrationConfigQueryKeys.makeWebhookSchema,
        queryFn: fetchMakeWebhookSchema,
        staleTime: 2 * 60 * 1000,
        retry: 1
    });
};
