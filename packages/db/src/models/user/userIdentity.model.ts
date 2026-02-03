import type { UserAuthIdentity } from '@repo/schemas';
import { BaseModel } from '../../base/base.model.ts';
import { userAuthIdentities } from '../../schemas/user/user_identity.dbschema.ts';

export class UserIdentityModel extends BaseModel<UserAuthIdentity> {
    protected table = userAuthIdentities;
    protected entityName = 'user_auth_identities';

    protected getTableName(): string {
        return 'user_auth_identities';
    }
}
