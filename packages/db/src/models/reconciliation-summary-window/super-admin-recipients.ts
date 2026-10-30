import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import { userRole } from '../../schemas/user/r_user_role.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Selects active SUPER_ADMIN mail recipients in the database. */
export async function listSuperAdminRecipients(
    input: { readonly tx?: DrizzleClient } = {}
): Promise<readonly { userId: string; email: string }[]> {
    return (input.tx ?? getDb())
        .selectDistinct({ userId: users.id, email: users.email })
        .from(userRole)
        .innerJoin(users, eq(users.id, userRole.userId))
        .where(and(eq(userRole.role, 'SUPER_ADMIN'), isNull(users.deletedAt)))
        .orderBy(asc(users.id));
}
