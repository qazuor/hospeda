import type { UserBookmark } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema.ts';

export class UserBookmarkModel extends BaseModel<UserBookmark> {
    protected table = userBookmarks;
    protected entityName = 'userBookmarks';

    protected getTableName(): string {
        return 'userBookmarks';
    }
}
