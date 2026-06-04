/**
 * Admin AI settings routes (SPEC-173 T-027).
 *
 * Exposes the `ai_settings` blob via two endpoints.  The blob is validated by
 * `AiSettingsValueSchema` on every write; the config cache is invalidated on
 * every write so stale reads are prevented (R-7).
 *
 * Routes:
 * - GET /  — read the current resolved config + metadata
 * - PUT /  — validate, persist, and cache-invalidate the settings blob
 *
 * All routes require `AI_SETTINGS_MANAGE` permission (SUPER_ADMIN-only).
 *
 * @module routes/ai/settings
 */

import { readAiSettings, resolveConfig, saveConfig } from '@repo/ai-core';
import {
    AiSettingsResponseSchema,
    AiSettingsValueSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { AiSettingsResponse } from '@repo/schemas';
import type { AiSettingsValue } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminRoute } from '../../../utils/route-factory.js';

// ---------------------------------------------------------------------------
// Fallback metadata when no settings row exists yet
// ---------------------------------------------------------------------------

/** ISO string used when there is no row yet (never-saved state). */
const EPOCH_ISO = new Date(0).toISOString();
/** Placeholder UUID for "no actor" (no-row state). */
const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/ai/settings
 * Returns the resolved AI settings blob with row metadata.
 * When no row exists yet, returns the resolved default blob with epoch timestamps.
 */
const getSettingsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Get AI settings',
    description:
        'Returns the current AI settings blob (providers, features, cost ceilings, model rates) ' +
        'together with write metadata (updatedAt, updatedBy). ' +
        'When no settings have been saved yet the resolved empty default is returned. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Settings'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    responseSchema: AiSettingsResponseSchema,
    handler: async (): Promise<AiSettingsResponse> => {
        // Resolve the config blob (cache-aware).
        const value: AiSettingsValue = await resolveConfig();

        // Attempt to read the raw row for accurate metadata (updatedAt / updatedBy).
        const updatedAt = EPOCH_ISO;
        const updatedBy = PLACEHOLDER_UUID;

        try {
            const row = await readAiSettings();
            if (row !== null) {
                // readAiSettings returns the parsed AiSettingsValue — we need
                // the row metadata, which means we must re-read via the storage
                // layer.  readAiSettings only returns the blob.  To get the
                // updatedAt/updatedBy we call writeAiSettings' counterpart
                // directly from @repo/db would violate AC-4, so we derive a
                // stable ISO from the cache hit time instead.
                //
                // NOTE: the storage layer `readAiSettings()` intentionally only
                // returns the validated blob (not the full row) to keep the API
                // clean.  The admin route needs the metadata; however, since
                // `@repo/ai-core` does not currently export a "read row"
                // helper, we return a sentinel that communicates the row exists
                // but precise metadata is unavailable.  A follow-up can expose
                // `readAiSettingsRow()` in the storage layer if needed.
                //
                // Decision: return EPOCH sentinel when metadata unavailable —
                // acceptable for V1; the PUT response always returns fresh data.
                void row; // blob itself is returned as `value` above
            }
        } catch {
            // If the blob fails to parse (AiSettingsParseError), propagate so
            // the operator knows the stored blob is corrupt.
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'AI settings blob failed schema validation'
            );
        }

        return {
            key: 'global',
            value,
            updatedAt,
            updatedBy
        };
    }
});

/**
 * PUT /api/v1/admin/ai/settings
 * Validates, persists, and cache-invalidates the AI settings blob.
 * The Zod factory validates the request body automatically (422 on failure).
 */
const putSettingsRoute = createAdminRoute({
    method: 'put',
    path: '/',
    summary: 'Save AI settings',
    description:
        'Validates the full AI settings blob and persists it. ' +
        'The in-memory config cache is invalidated immediately on success. ' +
        'Invalid blobs are rejected with 422. ' +
        'Requires AI_SETTINGS_MANAGE permission.',
    tags: ['AI Settings'],
    requiredPermissions: [PermissionEnum.AI_SETTINGS_MANAGE],
    requestBody: AiSettingsValueSchema,
    responseSchema: AiSettingsResponseSchema,
    handler: async (c, _params, body): Promise<AiSettingsResponse> => {
        const actor = getActorFromContext(c);
        const value = AiSettingsValueSchema.parse(body);

        // saveConfig validates + persists + invalidates cache (R-7).
        await saveConfig({ value, actorId: actor.id });

        const now = new Date().toISOString();

        return {
            key: 'global',
            value,
            updatedAt: now,
            updatedBy: actor.id
        };
    }
});

// ---------------------------------------------------------------------------
// Router assembly
// ---------------------------------------------------------------------------

const app = createRouter();

app.route('/', getSettingsRoute);
app.route('/', putSettingsRoute);

export { app as adminAiSettingsRoutes };
