/**
 * @file gpt-action-schema.ts
 *
 * GET /api/v1/admin/social/gpt-action-schema
 *
 * Returns an OpenAPI 3.1 document describing exactly the two operations the
 * Custom GPT calls via its "Actions" config:
 *   1. getSocialCatalog  — GET  /api/v1/ai/social/catalog
 *   2. saveSocialDraft   — POST /api/v1/ai/social/drafts
 *
 * The operator pastes the response body directly into the Custom GPT's
 * Actions settings. The document is generated programmatically from the
 * canonical Zod schemas in `@repo/schemas`, ensuring enums and shapes are
 * always in sync with the source of truth.
 *
 * Implementation: a throwaway `OpenAPIHono` instance registers the two
 * operations via `app.openapi(createRoute({...}), noopHandler)` referencing
 * the imported Zod schemas. `app.getOpenAPI31Document(...)` converts those
 * registrations to a valid OpenAPI 3.1 object. The `x-hospeda-ai-key` apiKey
 * security scheme is registered on `app.openAPIRegistry` before document
 * generation so it appears in `components.securitySchemes`.
 *
 * Gate: admin session + SOCIAL_SETTINGS_MANAGE permission.
 * NOT gated on NODE_ENV — this is a safe read-only admin endpoint.
 *
 * @module routes/social/admin/gpt-action-schema
 * @see SPEC-254 T-030
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
    CreateSocialDraftResponseSchema,
    CreateSocialDraftSchema,
    SocialCatalogResponseDataSchema
} from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import { env } from '../../../utils/env';
import { createAdminRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// OpenAPI 3.1 document builder
// ---------------------------------------------------------------------------

/**
 * Builds a minimal OpenAPI 3.1 document describing the two operations the
 * Custom GPT calls. The document is derived from the canonical Zod schemas in
 * `@repo/schemas` via `@hono/zod-openapi`'s `OpenAPIHono` document generator,
 * so enum values and shapes are guaranteed to match the source of truth.
 *
 * Pure function — no side effects, no DB access.
 * Suitable for unit testing without booting the main Hono app.
 *
 * @param apiBaseUrl - The public API base URL embedded in the `servers` block.
 *   Falls back to the canonical production URL when falsy.
 * @returns A plain object that is a valid OpenAPI 3.1 document.
 */
export function buildGptActionSchema(apiBaseUrl?: string): Record<string, unknown> {
    const serverUrl = apiBaseUrl ?? 'https://api.hospeda.com.ar';

    // -----------------------------------------------------------------------
    // Throwaway OpenAPIHono — used only for document generation, never served.
    // -----------------------------------------------------------------------
    const docApp = new OpenAPIHono();

    // Register the x-hospeda-ai-key apiKey security scheme so it appears in
    // components.securitySchemes of the generated document.
    docApp.openAPIRegistry.registerComponent('securitySchemes', 'HospedaAiKey', {
        type: 'apiKey',
        in: 'header',
        name: 'x-hospeda-ai-key',
        description: 'Static API key issued to the Custom GPT operator.'
    });

    // -----------------------------------------------------------------------
    // Operation 1: GET /api/v1/ai/social/catalog  (getSocialCatalog)
    // -----------------------------------------------------------------------
    const catalogRoute = createRoute({
        method: 'get',
        path: '/api/v1/ai/social/catalog',
        operationId: 'getSocialCatalog',
        summary: 'Fetch the social automation catalog',
        description:
            'Returns the full read-only catalog (hashtags, hashtag sets, footers, ' +
            'platform formats, campaigns, batches, audiences, and operator defaults) ' +
            'the Custom GPT must fetch before drafting a post.',
        tags: ['AI - Social'],
        security: [{ HospedaAiKey: [] }],
        responses: {
            200: {
                description: 'Social catalog data.',
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.literal(true),
                            data: SocialCatalogResponseDataSchema
                        })
                    }
                }
            }
        }
    });

    // biome-ignore lint/suspicious/noExplicitAny: noop handler — never executed; cast satisfies the typed response constraint
    const _catalogNoop: any = () => {
        throw new Error('noop');
    };
    docApp.openapi(catalogRoute, _catalogNoop);

    // -----------------------------------------------------------------------
    // Operation 2: POST /api/v1/ai/social/drafts  (saveSocialDraft)
    // -----------------------------------------------------------------------
    const draftRoute = createRoute({
        method: 'post',
        path: '/api/v1/ai/social/drafts',
        operationId: 'saveSocialDraft',
        summary: 'Submit a social post draft for review',
        description:
            'Ingests a structured social post draft authored by the Custom GPT. ' +
            'The post is created in NEEDS_REVIEW / PENDING state for operator approval. ' +
            'Requires a valid operatorPin in the body.',
        tags: ['AI - Social'],
        security: [{ HospedaAiKey: [] }],
        request: {
            body: {
                required: true,
                description: 'Social draft payload',
                content: {
                    'application/json': {
                        schema: CreateSocialDraftSchema
                    }
                }
            }
        },
        responses: {
            201: {
                description: 'Draft created successfully.',
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.literal(true),
                            data: CreateSocialDraftResponseSchema
                        })
                    }
                }
            }
        }
    });

    // biome-ignore lint/suspicious/noExplicitAny: noop handler — never executed; cast satisfies the typed response constraint
    const _draftNoop: any = () => {
        throw new Error('noop');
    };
    docApp.openapi(draftRoute, _draftNoop);

    // -----------------------------------------------------------------------
    // Generate and return the OpenAPI 3.1 document.
    // -----------------------------------------------------------------------
    const document = docApp.getOpenAPI31Document({
        openapi: '3.1.0',
        info: {
            title: 'Hospeda Social Automation — Custom GPT Actions',
            version: '1.0.0',
            description:
                'Minimal OpenAPI 3.1 document describing the two endpoints the Hospeda ' +
                'Custom GPT calls. Paste the JSON body of this endpoint into the ' +
                '"Actions" configuration of your GPT.'
        },
        servers: [{ url: serverUrl, description: 'Hospeda public API' }]
    });

    return document as unknown as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/social/gpt-action-schema
 *
 * Returns the OpenAPI 3.1 Action document for the Custom GPT operator.
 * Admin + SOCIAL_SETTINGS_MANAGE permission required.
 */
export const adminGetGptActionSchemaRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Export Custom GPT action schema',
    description:
        'Returns a minimal OpenAPI 3.1 document describing the two API operations ' +
        'the Custom GPT calls (getSocialCatalog, saveSocialDraft). ' +
        'Paste the response body directly into the GPT\'s "Actions" configuration.',
    tags: ['Social Settings'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    // Free-form JSON response: the OpenAPI document is an arbitrary object.
    // z.object({}).passthrough() allows any additional properties through so
    // the full document is serialised without Zod stripping unknown keys.
    responseSchema: z.object({}).passthrough(),
    handler: async () => {
        return buildGptActionSchema(env.HOSPEDA_API_URL);
    }
});
