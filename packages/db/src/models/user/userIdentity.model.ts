import type { UserAuthIdentityType } from '@repo/types';
import { BaseModel } from '../../base/base.model';
import { userAuthIdentities } from '../../schemas/user/user_identity.dbschema';

export class UserIdentityModel extends BaseModel<UserAuthIdentityType> {
    protected table = userAuthIdentities;
    protected entityName = 'user_auth_identities';
}
