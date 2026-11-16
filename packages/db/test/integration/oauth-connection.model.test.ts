import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { oauthConnectionModel } from '../../src/models/oauth-provider/index.ts';
import { oauthClients } from '../../src/schemas/oauth-provider/oauth-client.dbschema.ts';
import { oauthConsents } from '../../src/schemas/oauth-provider/oauth-consent.dbschema.ts';
import {
    oauthAccessTokens,
    oauthRefreshTokens
} from '../../src/schemas/oauth-provider/oauth-token.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const uid = () => crypto.randomUUID();

async function seed(tx: DrizzleClient) {
    const [a, b] = await tx
        .insert(users)
        .values([testData.user(), testData.user()])
        .returning({ id: users.id });
    if (!a || !b) throw new Error('users not created');
    const shared = `client-${uid()}`;
    const other = `client-${uid()}`;
    await tx.insert(oauthClients).values([
        {
            id: uid(),
            clientId: shared,
            name: 'Shared Assistant',
            icon: 'https://example.test/logo.png',
            redirectUris: ['https://example.test/cb']
        },
        { id: uid(), clientId: other, name: null, redirectUris: ['https://example.test/cb'] }
    ]);
    const consent = (userId: string, clientId: string, createdAt: Date) => ({
        id: uid(),
        userId,
        clientId,
        scopes: ['mcp'],
        createdAt,
        updatedAt: createdAt
    });
    await tx
        .insert(oauthConsents)
        .values([
            consent(a.id, shared, new Date('2026-11-01T10:00:00Z')),
            consent(b.id, shared, new Date('2026-11-02T10:00:00Z')),
            consent(a.id, other, new Date('2026-11-03T10:00:00Z'))
        ]);
    const refresh = (userId: string, clientId: string, createdAt: Date) => ({
        id: uid(),
        token: uid(),
        userId,
        clientId,
        scopes: ['mcp'],
        createdAt
    });
    const aShared = refresh(a.id, shared, new Date('2026-11-04T10:00:00Z'));
    const aSharedNewer = refresh(a.id, shared, new Date('2026-11-05T10:00:00Z'));
    const bShared = refresh(b.id, shared, new Date('2026-11-06T10:00:00Z'));
    await tx.insert(oauthRefreshTokens).values([aShared, aSharedNewer, bShared]);
    await tx.insert(oauthAccessTokens).values([
        { id: uid(), token: uid(), userId: a.id, clientId: shared, scopes: ['mcp'] },
        { id: uid(), token: uid(), userId: b.id, clientId: shared, scopes: ['mcp'] }
    ]);
    return { a: a.id, b: b.id, shared, other };
}

describe('OauthConnectionModel', () => {
    it('lists only the user own connections, with client metadata and last use', async () => {
        await withTestTransaction(async (tx) => {
            const { a, shared, other } = await seed(tx);

            const rows = await oauthConnectionModel.listForUser({ userId: a, tx });

            expect(rows.map((r) => r.clientId)).toEqual([shared, other]);
            const first = rows[0];
            expect(first).toMatchObject({
                name: 'Shared Assistant',
                logoUri: 'https://example.test/logo.png',
                scopes: ['mcp']
            });
            expect(first?.connectedAt?.toISOString()).toBe('2026-11-01T10:00:00.000Z');
            expect(first?.lastUsedAt?.toISOString()).toBe('2026-11-05T10:00:00.000Z');
            expect(rows[1]?.lastUsedAt).toBeNull();
        });
    });

    it('leaves out a disabled client and a user with no consents', async () => {
        await withTestTransaction(async (tx) => {
            const { a, b, shared } = await seed(tx);
            await tx
                .update(oauthClients)
                .set({ disabled: true })
                .where(eq(oauthClients.clientId, shared));

            const rowsA = await oauthConnectionModel.listForUser({ userId: a, tx });
            const rowsB = await oauthConnectionModel.listForUser({ userId: b, tx });

            expect(rowsA).toHaveLength(1);
            expect(rowsB).toEqual([]);
        });
    });

    it('revokes consent, refresh and access tokens of that pair only', async () => {
        await withTestTransaction(async (tx) => {
            const { a, b, shared, other } = await seed(tx);

            const counts = await oauthConnectionModel.revokeForUser({
                userId: a,
                clientId: shared,
                tx
            });

            expect(counts).toEqual({ consents: 1, refreshTokens: 2, accessTokens: 1 });
            const listA = await oauthConnectionModel.listForUser({ userId: a, tx });
            expect(listA.map((r) => r.clientId)).toEqual([other]);
            const listB = await oauthConnectionModel.listForUser({ userId: b, tx });
            expect(listB.map((r) => r.clientId)).toEqual([shared]);
            expect(listB[0]?.lastUsedAt?.toISOString()).toBe('2026-11-06T10:00:00.000Z');
            const clients = await tx.select().from(oauthClients);
            expect(clients.map((c) => c.clientId)).toEqual(expect.arrayContaining([shared, other]));
            const remainingAccess = await tx.select().from(oauthAccessTokens);
            expect(remainingAccess.filter((t) => t.userId === a)).toHaveLength(0);
            expect(remainingAccess.filter((t) => t.userId === b)).toHaveLength(1);
        });
    });

    it('returns zeros for a client the user never connected', async () => {
        await withTestTransaction(async (tx) => {
            const { b, other } = await seed(tx);

            const counts = await oauthConnectionModel.revokeForUser({
                userId: b,
                clientId: other,
                tx
            });

            expect(counts).toEqual({ consents: 0, refreshTokens: 0, accessTokens: 0 });
        });
    });
});
