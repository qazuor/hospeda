import type { UserBookmarkType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { userBookmarks } from '../../schemas/user/user_bookmark.dbschema';

export class UserBookmarkModel extends BaseModel<UserBookmarkType> {
    protected table = userBookmarks;
    protected entityName = 'userBookmarks';
}
