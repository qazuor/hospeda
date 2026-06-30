/**
 * PATCH /api/v1/protected/search-history/preferences
 *
 * Toggles the user's search history opt-out preference
 * (`settings.searchHistoryEnabled`). Setting `enabled = false` pauses
 * recording without deleting existing entries; `enabled = true` resumes it.
 *
 * Reuses {@link UserService.patchSearchHistoryPreferences} — the same
 * read-modify-write settings pattern established by `markWhatsNewSeen` and
 * `markAdminTourSeen`. No dedicated service was created; the UserService owns
 * all user-settings mutations.
 *
 * @route PATCH /api/v1/protected/search-history/preferences
 * @module routes/search-history/protected/preferences
 */
import { UserSearchHistoryPreferencesPatchSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * PATCH /api/v1/protected/search-history/preferences
 * Toggle search history recording opt-out.
 */
export const patchSearchHistoryPreferencesRoute = createProtectedRoute({
    method: 'patch',
    path: '/preferences',
    summary: 'Update search history preferences',
    description:
        'Toggles the search history recording preference. Set `enabled: false` to pause recording; `enabled: true` to resume.',
    tags: ['Search History'],
    requestBody: UserSearchHistoryPreferencesPatchSchema,
    responseSchema: z.object({ success: z.boolean() }),
    options: {
        customRateLimit: { requests: 30, windowMs: 60000 }
    },
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        const { enabled } = body as { enabled: boolean };

        const result = await userService.patchSearchHistoryPreferences(actor, { enabled });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
