import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { accountClosureModel } from '../../../src/models/account-closure/account-closure.model.ts';
import { users } from '../../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../../src/types.ts';
import { closeTestPool, getTestDb, getTestPool, testData } from '../helpers.ts';

/** Drizzle wraps nothing here (raw `pg` client), but walk `cause` anyway, as `packages/db/CLAUDE.md` asks. */
function sqlState(error: unknown): string | undefined {
    let current: unknown = error;
    while (current !== null && typeof current === 'object') {
        const code = (current as { code?: unknown }).code;
        if (typeof code === 'string') return code;
        current = (current as { cause?: unknown }).cause;
    }
    return undefined;
}

class RollbackSignal extends Error {}

const createdUserIds: string[] = [];

afterEach(async () => {
    const ids = createdUserIds.splice(0);
    if (ids.length > 0) {
        await getTestPool().query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    }
});

afterAll(async () => closeTestPool());

describe('TEST:V8a:12 the account lock holds a concurrent writer (model)', () => {
    it('a second transaction cannot update the account while lockAccount holds it', async () => {
        // Arrange: a committed account, visible to both connections.
        const account = testData.user();
        createdUserIds.push(account.id);
        await getTestDb().insert(users).values(account);
        let observed: string | undefined;

        // Act
        await getTestDb()
            .transaction(async (tx) => {
                const locked = await accountClosureModel.lockAccount({
                    tx: tx as unknown as DrizzleClient,
                    userId: account.id
                });
                expect(locked?.id).toBe(account.id);
                const other = await getTestPool().connect();
                try {
                    await other.query('BEGIN');
                    await other.query("SET LOCAL lock_timeout = '200ms'");
                    await other.query("UPDATE users SET display_name = 'x' WHERE id = $1", [
                        account.id
                    ]);
                } catch (error) {
                    observed = sqlState(error);
                } finally {
                    await other.query('ROLLBACK');
                    other.release();
                }
                throw new RollbackSignal();
            })
            .catch((error: unknown) => {
                if (!(error instanceof RollbackSignal)) throw error;
            });

        // Assert
        expect(observed).toBe('55P03');
    });
});
