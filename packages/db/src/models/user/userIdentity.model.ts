import type { UserAuthIdentity } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { userAuthIdentities } from '../../schemas/user/user_identity.dbschema.ts';

export class UserIdentityModel extends BaseModelImpl<UserAuthIdentity> {
    protected table = userAuthIdentities;
    public entityName = 'user_auth_identities';

    protected getTableName(): string {
        return 'userAuthIdentities';
    }
}

/** Singleton instance of UserIdentityModel for use across the application. */
export const userIdentityModel = new UserIdentityModel();
