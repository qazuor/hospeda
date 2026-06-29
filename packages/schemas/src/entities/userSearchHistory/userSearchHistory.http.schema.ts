/**
 * User Search History — HTTP schemas (SPEC-289)
 *
 * HTTP-compatible schemas for the search history protected endpoints.
 * Only the list operation is part of Phase 1 (read side); write/delete
 * and preferences schemas will be added in Phase 2.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema } from '../../api/http/base-http.schema.js';
import { UserSearchHistoryEntrySchema } from './userSearchHistory.schema.js';

// ============================================================================
// LIST QUERY SCHEMA
// ============================================================================

/**
 * Query parameters for `GET /api/v1/protected/search-history`.
 *
 * Only pagination fields are exposed; sorting is fixed to `createdAt DESC`
 * server-side (most recent first). Filtering by content is not needed because
 * the endpoint always returns the authenticated user's own history.
 *
 * @example
 * ```ts
 * const query: UserSearchHistoryListQuery = { page: 1, pageSize: 20 };
 * ```
 */
export const UserSearchHistoryListQuerySchema = BaseHttpSearchSchema.pick({
    page: true,
    pageSize: true
});

/** TypeScript type inferred from {@link UserSearchHistoryListQuerySchema}. */
export type UserSearchHistoryListQuery = z.infer<typeof UserSearchHistoryListQuerySchema>;

// ============================================================================
// LIST RESPONSE ITEM SCHEMA
// ============================================================================

/**
 * A single item in the search history list response.
 * Matches the full entity — the API layer does not need to project fields.
 */
export const UserSearchHistoryListItemSchema = UserSearchHistoryEntrySchema;

/** TypeScript type inferred from {@link UserSearchHistoryListItemSchema}. */
export type UserSearchHistoryListItem = z.infer<typeof UserSearchHistoryListItemSchema>;

// ============================================================================
// PREFERENCES PATCH SCHEMA
// ============================================================================

/**
 * Body schema for `PATCH /api/v1/protected/search-history/preferences`.
 *
 * Allows the user to toggle the opt-out flag. The `enabled` field maps to
 * `users.settings.searchHistoryEnabled`.
 *
 * @example
 * ```ts
 * const body: UserSearchHistoryPreferencesPatch = { enabled: false };
 * ```
 */
export const UserSearchHistoryPreferencesPatchSchema = z
    .object({
        /**
         * Whether to enable (`true`) or pause (`false`) search history recording.
         */
        enabled: z.boolean()
    })
    .strict();

/** TypeScript type inferred from {@link UserSearchHistoryPreferencesPatchSchema}. */
export type UserSearchHistoryPreferencesPatch = z.infer<
    typeof UserSearchHistoryPreferencesPatchSchema
>;
