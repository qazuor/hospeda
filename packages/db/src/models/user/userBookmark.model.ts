import type { UserBookmark } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema.ts';

export class UserBookmarkModel extends BaseModelImpl<UserBookmark> {
    protected table = userBookmarks;
    public entityName = 'userBookmarks';

    protected override readonly validRelationKeys = ['user'] as const;

    protected getTableName(): string {
        return 'userBookmarks';
    }
}

/** Singleton instance of UserBookmarkModel for use across the application. */
export const userBookmarkModel = new UserBookmarkModel();
