/**
 * @file userSearchHistory.model.ts
 *
 * Drizzle-backed model for the `user_search_history` table (SPEC-289).
 *
 * Provides the standard `BaseModelImpl` CRUD surface (findOne, findAll,
 * count, create, update, delete). The service layer is responsible for:
 *  - Enforcing append-only semantics (no update; delete is hard-delete).
 *  - Bounding history size to the user's plan limit after each insert.
 *  - Checking the `settings.searchHistoryEnabled` opt-out flag before recording.
 *
 * Reference: `userBookmark.model.ts` for the established singleton pattern.
 */
import type { UserSearchHistoryEntry } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { userSearchHistory } from '../../schemas/user/user_search_history.dbschema.ts';

/**
 * Drizzle model class for the `user_search_history` table.
 *
 * Extends {@link BaseModelImpl} with `UserSearchHistoryEntry` as the entity
 * type. `validRelationKeys` is restricted to `['user']` — the only relation
 * defined on the table.
 */
export class UserSearchHistoryModel extends BaseModelImpl<UserSearchHistoryEntry> {
    protected table = userSearchHistory;
    public entityName = 'userSearchHistory';

    protected override readonly validRelationKeys = ['user'] as const;

    protected getTableName(): string {
        return 'userSearchHistory';
    }
}

/** Singleton instance of {@link UserSearchHistoryModel} for use across the application. */
export const userSearchHistoryModel = new UserSearchHistoryModel();
