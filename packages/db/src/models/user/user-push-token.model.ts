/**
 * @file user-push-token.model.ts
 *
 * Model for the `user_push_tokens` table (SPEC-243 T-011).
 *
 * Lean model that extends BaseModelImpl but provides only the single
 * `upsertByToken` write path needed for push-token registration.  There is
 * no soft-delete, no audit columns, and no relation traversal on this table
 * — the full BaseModel CRUD surface is intentionally left unused.
 */
import { type InferSelectModel, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { userPushTokens } from '../../schemas/user/user_push_tokens.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Inferred row type for the `user_push_tokens` table. */
export type UserPushTokenRecord = InferSelectModel<typeof userPushTokens>;

/**
 * Model for the `user_push_tokens` table.
 *
 * Provides a single `upsertByToken` method that registers or re-assigns an
 * Expo push token to the calling user.  Global uniqueness on `token` ensures
 * that each install belongs to exactly one user at any given time — re-login
 * on the same device automatically migrates the token to the new user.
 */
export class UserPushTokenModel extends BaseModelImpl<UserPushTokenRecord> {
    protected table = userPushTokens;
    public entityName = 'user_push_tokens';

    protected getTableName(): string {
        return 'user_push_tokens';
    }

    /**
     * Inserts a new push-token row or updates the existing row when the token
     * already exists (global UNIQUE constraint on `token`).
     *
     * On conflict, `userId`, `platform`, and `updatedAt` are overwritten so
     * that the token always belongs to the most-recent user who registered it.
     * A user may have many rows (one per device / install).
     *
     * @param params.userId - UUID of the authenticated user registering the token.
     * @param params.token - Expo push token string (device-unique, ≤512 chars).
     * @param params.platform - Device platform: 'ios' | 'android' | 'web'.
     * @param tx - Optional transaction client.
     * @returns The upserted row.
     * @throws {Error} If the database returns no row (unexpected state).
     */
    async upsertByToken(
        params: { userId: string; token: string; platform: string },
        tx?: DrizzleClient
    ): Promise<UserPushTokenRecord> {
        const db = this.getClient(tx);
        const { userId, token, platform } = params;
        const now = new Date();

        const results = await db
            .insert(userPushTokens)
            .values({ userId, token, platform, createdAt: now, updatedAt: now })
            .onConflictDoUpdate({
                target: userPushTokens.token,
                set: {
                    userId,
                    platform,
                    updatedAt: sql`now()`
                }
            })
            .returning();

        const row = results[0];
        if (!row) {
            throw new Error('upsertByToken returned no row for token — unexpected database state');
        }
        return row;
    }
}

/** Singleton instance of UserPushTokenModel for use across the application. */
export const userPushTokenModel = new UserPushTokenModel();
