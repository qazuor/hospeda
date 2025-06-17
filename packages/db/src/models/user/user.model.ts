import type { UserType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { users } from '../../schemas/user/user.dbschema';

export class UserModel extends BaseModel<UserType> {
    protected table = users;
    protected entityName = 'users';
}
