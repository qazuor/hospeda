/**
 * @file mcp-auth-lookups.ts
 * @description The two database lookups of the `/mcp` bearer middleware
 * (`mcp-auth.ts`): the grant (revocation) check and the user check. Split out
 * of `mcp-auth.ts` to keep it under the file-size limit when HOS-2562 added
 * the «real client» gate; `mcp-auth.ts` re-exports both.
 */

import { eq, getDb, users } from '@repo/db';
import { getAuth } from '../lib/auth';
import type { McpAuthDeps } from './mcp-auth';

/** Client row fields read for the grant check. */
interface OAuthClientRow {
    readonly name?: string | null;
    readonly disabled?: boolean | null;
}

/**
 * Default grant check, through the Better Auth adapter (the OAuth tables are
 * mapped there, not in `@repo/db` models).
 *
 * A grant is live when the client row exists and is not `disabled`, and an
 * `oauthConsent` row exists for `(clientId, userId)`. Every MCP client goes
 * through the consent screen (CIMD and DCR clients cannot set `skip_consent`),
 * so a missing consent means it was revoked.
 */
export const findActiveMcpGrant: McpAuthDeps['findActiveGrant'] = async ({ clientId, userId }) => {
    const { adapter } = await getAuth().$context;
    const client = await adapter.findOne<OAuthClientRow>({
        model: 'oauthClient',
        where: [{ field: 'clientId', value: clientId }]
    });
    if (!client || client.disabled === true) {
        return null;
    }
    const consent = await adapter.findOne<{ readonly id: string }>({
        model: 'oauthConsent',
        where: [
            { field: 'clientId', value: clientId },
            { field: 'userId', value: userId }
        ]
    });
    if (!consent) {
        return null;
    }
    return { clientName: typeof client.name === 'string' ? client.name : null };
};

/**
 * Default user lookup. One primary-key read of the columns the actor needs plus
 * the account-state columns. Refuses a missing, soft-deleted (H-163) or banned
 * account: a bearer token never creates a session, so neither the deletion gate
 * nor the admin plugin's ban gate on session creation would run for it.
 */
export const findMcpUser: McpAuthDeps['findUser'] = async ({ userId }) => {
    const rows = await getDb()
        .select({
            id: users.id,
            name: users.displayName,
            email: users.email,
            image: users.image,
            emailVerified: users.emailVerified,
            mustChangePassword: users.mustChangePassword,
            deletedAt: users.deletedAt,
            banned: users.banned,
            banExpires: users.banExpires
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    const row = rows[0];
    if (!row || row.deletedAt) {
        return null;
    }
    const banActive = row.banned === true && (!row.banExpires || row.banExpires > new Date());
    if (banActive) {
        return null;
    }
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        image: row.image,
        emailVerified: row.emailVerified,
        mustChangePassword: row.mustChangePassword
    };
};
