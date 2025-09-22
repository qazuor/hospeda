import type { UserBookmark } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema';

export class UserBookmarkModel extends BaseModel<UserBookmark> {
    protected table = userBookmarks;
    protected entityName = 'userBookmarks';
}
