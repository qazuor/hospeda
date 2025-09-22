import type { UserAuthIdentity } from '@repo/schemas';
import { BaseModel } from '../../base/base.model';
import { userAuthIdentities } from '../../schemas/user/user_identity.dbschema';

export class UserIdentityModel extends BaseModel<UserAuthIdentity> {
    protected table = userAuthIdentities;
    protected entityName = 'user_auth_identities';
}
