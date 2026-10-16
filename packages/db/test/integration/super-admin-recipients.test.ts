import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { listSuperAdminRecipients } from '../../src/models/reconciliation-summary-window/super-admin-recipients.ts';
import { userRole } from '../../src/schemas/user/r_user_role.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, getTestDb, withTestTransaction } from './helpers.ts';

beforeAll(() => setDb(getTestDb()));
afterAll(closeTestPool);
describe('TEST:1607:13 SUPER_ADMIN recipients', () => {
    it('selects distinct active users with SUPER_ADMIN in SQL', async () => {
        await withTestTransaction(async (tx) => {
            const [admin, regular, deleted] = await tx
                .insert(users)
                .values([
                    { email: 'summary-admin@example.test' },
                    { email: 'summary-user@example.test' },
                    { email: 'summary-deleted@example.test', deletedAt: new Date() }
                ])
                .returning();
            await tx.insert(userRole).values([
                { userId: admin!.id, role: 'SUPER_ADMIN' },
                { userId: admin!.id, role: 'ADMIN' },
                { userId: regular!.id, role: 'ADMIN' },
                { userId: deleted!.id, role: 'SUPER_ADMIN' }
            ]);
            expect(await listSuperAdminRecipients({ tx })).toEqual([
                { userId: admin!.id, email: admin!.email }
            ]);
        });
    });
});
