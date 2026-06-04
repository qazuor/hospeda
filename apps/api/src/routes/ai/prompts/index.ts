/**
 * Admin AI prompts routes (SPEC-173 T-028).
 *
 * Manages versioned system prompts stored in `ai_prompt_versions`.
 * The engine reads the active prompt via `getActivePrompt` in `@repo/ai-core`
 * on every AI call; it falls back to its in-code default when no active row
 * exists (§5.6, FR-5).
 *
 * Routes:
 * - GET  /               — list all prompt versions for a feature (required query param)
 * - POST /               — create a new prompt version (optionally activating it)
 * - PUT  /{id}/activate  — promote an existing version to active
 *
 * All routes require `AI_SETTINGS_MANAGE` permission (SUPER_ADMIN-only).
 *
 * @module routes/ai/prompts
 */

import {
    activatePromptVersion,
    createPromptVersion,
    listPromptVersionsByFeature
} from '@repo/ai-core';
import {
    AiFeatureSchema,
    AiPromptVersionSchema,
    CreateAiPromptVersionSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { AiFeature } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { createRouter } from '../../../utils/create-app.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory.js';

// ---------------------------------------------------------------------------
// Query schema for list route
// ---------------------------------------------------------------------------

/** Query params for the prompt list endpoint. `feature` is required. */
const PromptListQuerySchema = z.object({
    feature: AiFeatureSchema,
    includeDeleted: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional()
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/ai/prompts?feature=<AiFeature>
 * Lists all versioned system prompts for a feature, newest version first.
 * `feature` is a required query parameter.
 */
const listPromptsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List AI prompt versions',
    description:
        'Returns all system prompt versions for a given AI feature, ordered by version descending. ' +
        'The `feature` query parameter is required. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Prompts'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestQuery: PromptListQuerySchema.shape,
    responseSchema: AiPromptVersionSchema,
    handler: async (_c, _params, _body, query) => {
        const { page, pageSize } = extractPaginationParams(query ?? {});
        const parsed = PromptListQuerySchema.parse(query ?? {});
        const { feature, includeDeleted = false } = parsed;

        const rows = await listPromptVersionsByFeature({ feature, includeDeleted });

        const total = rows.length;
        const start = (page - 1) * pageSize;
        const items = Array.from(rows).slice(start, start + pageSize);

        return {
            items,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    }
});

/**
 * POST /api/v1/admin/ai/prompts
 * Creates a new versioned prompt. When `isActive` is true (the default),
 * the previous active version for the feature is deactivated atomically.
 */
const createPromptRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create AI prompt version',
    description:
        'Creates a new versioned system prompt. ' +
        'The version number is auto-incremented (MAX + 1 for the feature). ' +
        'When `isActive` is true (default), the current active prompt is deactivated atomically. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Prompts'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestBody: CreateAiPromptVersionSchema,
    responseSchema: AiPromptVersionSchema,
    successStatusCode: 201,
    handler: async (c, _params, body) => {
        const actor = getActorFromContext(c);
        const parsed = CreateAiPromptVersionSchema.parse(body);

        const row = await createPromptVersion({
            feature: parsed.feature as AiFeature,
            content: parsed.content,
            isActive: parsed.isActive,
            actorId: actor.id
        });

        return row;
    }
});

/**
 * PUT /api/v1/admin/ai/prompts/{id}/activate
 * Promotes an existing prompt version to active.
 * All other versions for the same feature are deactivated atomically.
 */
const activatePromptRoute = createAdminRoute({
    method: 'put',
    path: '/{id}/activate',
    summary: 'Activate AI prompt version',
    description:
        'Sets the specified prompt version as the active one for its feature. ' +
        'All other versions for the same feature are deactivated atomically. ' +
        'Returns 404 when the version ID does not exist. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Prompts'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestParams: { id: z.string().uuid() },
    responseSchema: AiPromptVersionSchema,
    handler: async (_c, params) => {
        const id = params.id as string;

        const row = await activatePromptVersion({ id });

        if (!row) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Prompt version '${id}' not found`);
        }

        return row;
    }
});

// ---------------------------------------------------------------------------
// Router assembly
// ---------------------------------------------------------------------------

const app = createRouter();

app.route('/', listPromptsRoute);
app.route('/', createPromptRoute);
app.route('/', activatePromptRoute);

export { app as adminAiPromptsRoutes };
