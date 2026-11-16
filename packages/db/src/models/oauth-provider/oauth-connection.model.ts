/**
 * @file oauth-connection.model.ts
 *
 * Read and revoke the AI assistants (OAuth clients) a user has connected to the
 * MCP server (HOS-2184 T-026).
 *
 * There is no table of its own: a connection is the user's `oauth_consent` row
 * joined to the `oauth_client` row, and what proves it was used is the
 * `oauth_refresh_token` rows. The three tables belong to Better Auth's OAuth
 * provider plugin, which has no endpoint that does this job:
 *
 * - `POST /oauth2/delete-consent` removes the consent only. The provider's own
 *   docs say it "does not revoke tokens already issued".
 * - The refresh-token grant does not look at the consent. So deleting the
 *   consent alone would leave a client able to keep minting access tokens.
 *
 * Access tokens are stateless JWTs, so they cannot be revoked one by one. The
 * `/mcp` middleware refuses a token whose `(clientId, userId)` consent is gone,
 * which makes the consent row the actual kill switch for already-issued access
 * tokens, and the refresh tokens the one for future ones. Revoking has to
 * remove both.
 *
 * Nothing here reads a table at module level: the schema objects are only
 * touched inside methods.
 */
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../client.ts';
import { oauthClients } from '../../schemas/oauth-provider/oauth-client.dbschema.ts';
import { oauthConsents } from '../../schemas/oauth-provider/oauth-consent.dbschema.ts';
import {
    oauthAccessTokens,
    oauthRefreshTokens
} from '../../schemas/oauth-provider/oauth-token.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * One client the user has authorised, as the model reads it.
 */
export interface OauthConnectionRow {
    /** OAuth `client_id`. */
    readonly clientId: string;
    /** Client-declared name. Untrusted text. */
    readonly name: string | null;
    /** Client-declared home page. Untrusted. */
    readonly uri: string | null;
    /** Client-declared logo URL. Untrusted. */
    readonly logoUri: string | null;
    /** Union of the scopes the user granted. */
    readonly scopes: readonly string[];
    /** Earliest consent `createdAt`. */
    readonly connectedAt: Date | null;
    /** Newest refresh token issued for the pair, or `null` when none. */
    readonly lastUsedAt: Date | null;
}

/**
 * What a revoke removed. All zeros means the user had no connection to the
 * client.
 */
export interface OauthRevokeCounts {
    /** `oauth_consent` rows deleted. */
    readonly consents: number;
    /** `oauth_refresh_token` rows deleted. */
    readonly refreshTokens: number;
    /** `oauth_access_token` rows deleted (stored ones; JWTs are not stored). */
    readonly accessTokens: number;
}

/**
 * Persistence for the user's connected AI assistants.
 */
export class OauthConnectionModel {
    /**
     * Lists the clients the user has a consent for, oldest connection first.
     *
     * A disabled client is left out: `/mcp` refuses it anyway, so it is not a
     * working connection. Several consents for one client (one per reference id)
     * collapse into one entry.
     *
     * @param input.userId - The account to list for.
     * @param input.tx - Optional transaction.
     */
    async listForUser(input: {
        readonly userId: string;
        readonly tx?: DrizzleClient;
    }): Promise<readonly OauthConnectionRow[]> {
        const db = input.tx ?? getDb();
        const consents = await db
            .select({
                clientId: oauthConsents.clientId,
                scopes: oauthConsents.scopes,
                createdAt: oauthConsents.createdAt,
                name: oauthClients.name,
                uri: oauthClients.uri,
                icon: oauthClients.icon
            })
            .from(oauthConsents)
            .innerJoin(oauthClients, eq(oauthClients.clientId, oauthConsents.clientId))
            .where(
                and(
                    eq(oauthConsents.userId, input.userId),
                    or(isNull(oauthClients.disabled), eq(oauthClients.disabled, false))
                )
            )
            .orderBy(oauthConsents.createdAt);

        if (consents.length === 0) {
            return [];
        }

        const used = await db
            .select({
                clientId: oauthRefreshTokens.clientId,
                lastUsedAt: sql<Date | string | null>`max(${oauthRefreshTokens.createdAt})`
            })
            .from(oauthRefreshTokens)
            .where(eq(oauthRefreshTokens.userId, input.userId))
            .groupBy(oauthRefreshTokens.clientId);
        const lastUsedByClient = new Map<string, Date>();
        for (const row of used) {
            if (row.lastUsedAt !== null && row.lastUsedAt !== undefined) {
                lastUsedByClient.set(row.clientId, new Date(row.lastUsedAt));
            }
        }

        const byClient = new Map<string, OauthConnectionRow>();
        for (const row of consents) {
            const previous = byClient.get(row.clientId);
            byClient.set(row.clientId, {
                clientId: row.clientId,
                name: row.name,
                uri: row.uri,
                logoUri: row.icon,
                scopes: [...new Set([...(previous?.scopes ?? []), ...row.scopes])],
                connectedAt: previous?.connectedAt ?? row.createdAt,
                lastUsedAt: lastUsedByClient.get(row.clientId) ?? null
            });
        }
        return [...byClient.values()];
    }

    /**
     * Revokes one client for one user, atomically: deletes the user's consent,
     * refresh tokens and stored access tokens for that client.
     *
     * Scoped by BOTH `userId` and `clientId` on every statement, so it never
     * touches another user of the same client. The `oauth_client` row is never
     * deleted: dynamically registered clients are public and shared, and the
     * row is what other users' consents and tokens hang from (their FK cascades
     * would be triggered by deleting it).
     *
     * @param input.userId - The account revoking.
     * @param input.clientId - The OAuth client to revoke.
     * @param input.tx - Optional outer transaction.
     * @returns What was deleted. All zeros when the user had no connection.
     */
    async revokeForUser(input: {
        readonly userId: string;
        readonly clientId: string;
        readonly tx?: DrizzleClient;
    }): Promise<OauthRevokeCounts> {
        return withTransaction(async (tx) => {
            const accessTokens = await tx
                .delete(oauthAccessTokens)
                .where(
                    and(
                        eq(oauthAccessTokens.userId, input.userId),
                        eq(oauthAccessTokens.clientId, input.clientId)
                    )
                )
                .returning({ id: oauthAccessTokens.id });
            const refreshTokens = await tx
                .delete(oauthRefreshTokens)
                .where(
                    and(
                        eq(oauthRefreshTokens.userId, input.userId),
                        eq(oauthRefreshTokens.clientId, input.clientId)
                    )
                )
                .returning({ id: oauthRefreshTokens.id });
            const consents = await tx
                .delete(oauthConsents)
                .where(
                    and(
                        eq(oauthConsents.userId, input.userId),
                        eq(oauthConsents.clientId, input.clientId)
                    )
                )
                .returning({ id: oauthConsents.id });
            return {
                consents: consents.length,
                refreshTokens: refreshTokens.length,
                accessTokens: accessTokens.length
            };
        }, input.tx);
    }
}

/** Shared {@link OauthConnectionModel}. */
export const oauthConnectionModel = new OauthConnectionModel();
