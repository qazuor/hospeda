/**
 * Integration tests: `user_permission.effect` column against real PostgreSQL (SPEC-170).
 *
 * Proves the schema change from T-004:
 * - the `effect` column defaults to `'grant'` at the DB level (existing rows
 *   and inserts that omit `effect` are backfilled automatically);
 * - a `'deny'` effect persists;
 * - the `permission_effect_enum` type rejects any value outside `grant`/`deny`.
 *
 * Uses the SPEC-061 infrastructure: globalSetup creates the
 * `hospeda_integration_test` database and pushes the current Drizzle schema
 * (including the new `effect` column), so no manual migration step is needed here.
 */
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { userPermission } from '../../src/schemas/user/r_user_permission.dbschema';
import { users } from '../../src/schemas/user/user.dbschema';
import { closeTestPool, testData, withTestTransaction } from './helpers';

/**
 * Literal value of the USER_CREATE permission. Integration tests do not import
 * `@repo/schemas` (the integration vitest config does not alias it to source),
 * so a valid `permission_enum` value is hardcoded here, matching the convention
 * of the other integration tests.
 */
const PERMISSION_USER_CREATE = 'user.create';

describe('user_permission.effect column — integration', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    it('defaults effect to "grant" when omitted on insert', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            await tx.insert(users).values(user);

            // Insert WITHOUT effect — the DB DEFAULT must apply.
            await tx.insert(userPermission).values({
                userId: user.id,
                permission: PERMISSION_USER_CREATE
            });

            const [row] = await tx
                .select()
                .from(userPermission)
                .where(eq(userPermission.userId, user.id));

            expect(row?.effect).toBe('grant');
        });
    });

    it('persists an explicit "deny" effect', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            await tx.insert(users).values(user);

            await tx.insert(userPermission).values({
                userId: user.id,
                permission: PERMISSION_USER_CREATE,
                effect: 'deny'
            });

            const [row] = await tx
                .select()
                .from(userPermission)
                .where(eq(userPermission.userId, user.id));

            expect(row?.effect).toBe('deny');
        });
    });

    it('rejects an invalid effect value at the DB enum level', async () => {
        await expect(
            withTestTransaction(async (tx) => {
                const user = testData.user();
                await tx.insert(users).values(user);

                await tx.insert(userPermission).values({
                    userId: user.id,
                    permission: PERMISSION_USER_CREATE,
                    // Bypass the compile-time enum type to exercise the DB constraint.
                    effect: 'invalid' as never
                });
            })
        ).rejects.toThrow();
    });
});
