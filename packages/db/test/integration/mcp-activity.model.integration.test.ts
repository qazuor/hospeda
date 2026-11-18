/**
 * HOS-2335 §5.6 / D-13 / D-16 — the assistant activity read model and the
 * scoped retention delete, against a real database.
 *
 * - `listToolCalls` reads `mcp.tool.call` rows only, scoped by actor, and its
 *   tool, outcome, client, access and date filters combine; `total` matches a
 *   direct count (AC-C52). A row without `isWrite` counts as a write (D-12).
 * - `purgeOlderThan({ before, eventType })` deletes only that event type,
 *   batched by `limit`; `countOlderThan` counts the same set (AC-C56).
 * - The label lookups return live rows only, with their owner (AC-C47).
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AuditLogEntryModel } from '../../src/models/audit-log/auditLogEntry.model.ts';
import { McpActivityModel } from '../../src/models/audit-log/mcpActivity.model.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { auditLogEntries } from '../../src/schemas/audit-log/audit_log_entry.dbschema.ts';
import { conversations } from '../../src/schemas/conversation/conversations.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { oauthClients } from '../../src/schemas/oauth-provider/oauth-client.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const MCP = 'mcp.tool.call';
const CLAUDE = 'https://claude.ai/oauth/mcp-client-metadata';
const CHATGPT = 'chatgpt-dcr-client';
const NOW = new Date('2026-11-18T12:00:00.000Z');
const CUTOFF = new Date('2025-11-18T12:00:00.000Z');

/** Inserts one audit row with the given event type, actor, data and instant. */
async function insertRow(
    tx: DrizzleClient,
    row: {
        readonly eventType?: string;
        readonly logType?: string;
        readonly actorId: string | null;
        readonly loggedAt: Date;
        readonly data?: Record<string, unknown>;
    }
): Promise<string> {
    const [inserted] = await tx
        .insert(auditLogEntries)
        .values({
            logType: row.logType ?? 'audit',
            eventType: row.eventType ?? MCP,
            severity: 'info',
            actorId: row.actorId,
            message: 'test',
            data: row.data ?? null,
            loggedAt: row.loggedAt
        })
        .returning({ id: auditLogEntries.id });
    if (!inserted) throw new Error('insert failed');
    return inserted.id;
}

/** A tool call `data` payload as the binder writes it. */
function call(input: {
    readonly tool: string;
    readonly outcome?: 'success' | 'denied' | 'error';
    readonly clientId?: string;
    readonly isWrite?: boolean;
}): Record<string, unknown> {
    return {
        auditEvent: MCP,
        tool: input.tool,
        outcome: input.outcome ?? 'success',
        clientId: input.clientId ?? CLAUDE,
        ...(input.isWrite === undefined ? {} : { isWrite: input.isWrite })
    };
}

async function twoUsers(tx: DrizzleClient): Promise<{ a: string; b: string }> {
    const rows = await tx
        .insert(users)
        .values([testData.user(), testData.user()])
        .returning({ id: users.id });
    const [a, b] = rows;
    if (!a || !b) throw new Error('users');
    return { a: a.id, b: b.id };
}

describe('McpActivityModel.listToolCalls (real DB)', () => {
    const model = new McpActivityModel();

    it('reads mcp.tool.call rows of the actor only, newest first', async () => {
        await withTestTransaction(async (tx) => {
            const { a, b } = await twoUsers(tx);
            const older = await insertRow(tx, {
                actorId: a,
                loggedAt: new Date('2026-11-01T00:00:00Z'),
                data: call({ tool: 'get_listing', isWrite: false })
            });
            const newer = await insertRow(tx, {
                actorId: a,
                loggedAt: new Date('2026-11-02T00:00:00Z'),
                data: call({ tool: 'reply_inquiry', isWrite: true })
            });
            await insertRow(tx, {
                actorId: b,
                loggedAt: NOW,
                data: call({ tool: 'get_listing' })
            });
            await insertRow(tx, {
                eventType: 'mcp.connection.revoked',
                actorId: a,
                loggedAt: NOW
            });

            const page = await model.listToolCalls(
                { actorId: a, page: 1, pageSize: 20, sortDirection: 'desc' },
                tx
            );

            expect(page.total).toBe(2);
            expect(page.items.map((row) => row.id)).toEqual([newer, older]);
        });
    });

    it('filters by tool, outcome, client and access, and they combine (AC-C52)', async () => {
        await withTestTransaction(async (tx) => {
            const { a } = await twoUsers(tx);
            const at = new Date('2026-11-10T00:00:00Z');
            const legacyWrite = await insertRow(tx, {
                actorId: a,
                loggedAt: at,
                data: call({ tool: 'reply_inquiry' })
            });
            const read = await insertRow(tx, {
                actorId: a,
                loggedAt: at,
                data: call({ tool: 'get_listing', isWrite: false, clientId: CHATGPT })
            });
            const deniedWrite = await insertRow(tx, {
                actorId: a,
                loggedAt: at,
                data: call({ tool: 'reply_inquiry', isWrite: true, outcome: 'denied' })
            });

            const ids = async (filter: Parameters<McpActivityModel['listToolCalls']>[0]) => {
                const result = await model.listToolCalls(filter, tx);
                const [direct] = await tx
                    .select({ total: count() })
                    .from(auditLogEntries)
                    .where(
                        and(
                            eq(auditLogEntries.eventType, MCP),
                            eq(auditLogEntries.actorId, a),
                            ...model.buildDataConditions(filter)
                        )
                    );
                expect(result.total).toBe(direct?.total);
                return result.items.map((row) => row.id).sort();
            };
            const base = { actorId: a, page: 1, pageSize: 20, sortDirection: 'desc' } as const;

            expect(await ids({ ...base, tool: 'reply_inquiry' })).toEqual(
                [legacyWrite, deniedWrite].sort()
            );
            expect(await ids({ ...base, outcome: 'denied' })).toEqual([deniedWrite]);
            expect(await ids({ ...base, clientId: CHATGPT })).toEqual([read]);
            expect(await ids({ ...base, isWrite: false })).toEqual([read]);
            // A row with no isWrite was recorded when only writes were (D-12).
            expect(await ids({ ...base, isWrite: true })).toEqual(
                [legacyWrite, deniedWrite].sort()
            );
            expect(await ids({ ...base, tool: 'reply_inquiry', outcome: 'success' })).toEqual([
                legacyWrite
            ]);
            expect(await ids({ ...base, tool: 'get_listing', isWrite: true })).toEqual([]);
        });
    });

    it('applies the date range inclusively', async () => {
        await withTestTransaction(async (tx) => {
            const { a } = await twoUsers(tx);
            const inside = await insertRow(tx, {
                actorId: a,
                loggedAt: new Date('2026-11-05T00:00:00Z'),
                data: call({ tool: 'get_listing' })
            });
            await insertRow(tx, {
                actorId: a,
                loggedAt: new Date('2026-10-01T00:00:00Z'),
                data: call({ tool: 'get_listing' })
            });

            const result = await model.listToolCalls(
                {
                    actorId: a,
                    fromDate: new Date('2026-11-05T00:00:00Z'),
                    toDate: new Date('2026-11-30T00:00:00Z'),
                    page: 1,
                    pageSize: 20,
                    sortDirection: 'asc'
                },
                tx
            );

            expect(result.items.map((row) => row.id)).toEqual([inside]);
        });
    });
});

describe('AuditLogEntryModel scoped retention (real DB, AC-C56)', () => {
    const model = new AuditLogEntryModel();

    async function seedRetentionSet(tx: DrizzleClient) {
        const { a } = await twoUsers(tx);
        const old = new Date('2025-06-01T00:00:00Z');
        const oldMcp = [
            await insertRow(tx, { actorId: a, loggedAt: old, data: call({ tool: 'x' }) }),
            await insertRow(tx, { actorId: a, loggedAt: old, data: call({ tool: 'y' }) }),
            await insertRow(tx, { actorId: a, loggedAt: old, data: call({ tool: 'z' }) })
        ];
        const kept = [
            await insertRow(tx, { actorId: a, loggedAt: NOW, data: call({ tool: 'x' }) }),
            await insertRow(tx, { eventType: 'mcp.connection.revoked', actorId: a, loggedAt: old }),
            await insertRow(tx, { eventType: 'billing.mutation', actorId: a, loggedAt: old }),
            await insertRow(tx, {
                eventType: 'auth.login.failed',
                logType: 'security',
                actorId: null,
                loggedAt: old
            })
        ];
        return { oldMcp, kept };
    }

    async function remainingIds(tx: DrizzleClient, ids: readonly string[]): Promise<string[]> {
        const rows = await tx
            .select({ id: auditLogEntries.id })
            .from(auditLogEntries)
            .where(inArray(auditLogEntries.id, [...ids]));
        return rows.map((row) => row.id).sort();
    }

    it('counts only the old mcp.tool.call rows', async () => {
        await withTestTransaction(async (tx) => {
            await seedRetentionSet(tx);

            expect(await model.countOlderThan({ before: CUTOFF, eventType: MCP }, tx)).toBe(3);
        });
    });

    it('deletes only the old mcp.tool.call rows, in batches', async () => {
        await withTestTransaction(async (tx) => {
            const { oldMcp, kept } = await seedRetentionSet(tx);

            const first = await model.purgeOlderThan(
                { before: CUTOFF, eventType: MCP, limit: 2 },
                tx
            );
            const second = await model.purgeOlderThan(
                { before: CUTOFF, eventType: MCP, limit: 2 },
                tx
            );
            const third = await model.purgeOlderThan(
                { before: CUTOFF, eventType: MCP, limit: 2 },
                tx
            );

            expect([first, second, third]).toEqual([2, 1, 0]);
            expect(await remainingIds(tx, oldMcp)).toEqual([]);
            expect(await remainingIds(tx, kept)).toEqual([...kept].sort());
        });
    });
});

describe('McpActivityModel label lookups (real DB)', () => {
    const model = new McpActivityModel();

    it('returns live listings with their owner, live conversations and client names', async () => {
        await withTestTransaction(async (tx) => {
            const { a } = await twoUsers(tx);
            const [destination] = await tx
                .insert(destinations)
                .values(testData.destination())
                .returning({ id: destinations.id });
            if (!destination) throw new Error('destination');
            const uid = crypto.randomUUID().slice(0, 8);
            const listing = (deleted: boolean) => ({
                ownerId: a,
                destinationId: destination.id,
                publicationStatus: 'DRAFT' as const,
                inactiveSince: NOW,
                deadlinesVersion: 1,
                slug: `hos2348-${deleted ? 'gone' : 'live'}-${uid}`,
                name: deleted ? 'Gone' : 'Cabaña del río',
                summary: 'Listing for the HOS-2348 activity lookup test.',
                type: 'HOUSE' as const,
                description: 'Listing inserted for the HOS-2348 activity lookup test.',
                ...(deleted ? { deletedAt: NOW } : {})
            });
            const [live, gone] = await tx
                .insert(accommodations)
                .values([listing(false), listing(true)])
                .returning({ id: accommodations.id });
            if (!live || !gone) throw new Error('listings');
            const [conversation] = await tx
                .insert(conversations)
                .values({ accommodationId: live.id })
                .returning({ id: conversations.id });
            if (!conversation) throw new Error('conversation');
            await tx.insert(oauthClients).values({
                id: crypto.randomUUID(),
                clientId: CLAUDE,
                name: 'Claude',
                redirectUris: ['https://x.test']
            });

            const names = await model.findListingNames(
                { vertical: 'accommodation', ids: [live.id, gone.id] },
                tx
            );
            const owners = await model.findConversationOwners({ ids: [conversation.id] }, tx);
            const clients = await model.findClientNames({ clientIds: [CLAUDE, CHATGPT] }, tx);

            expect(names).toEqual([{ id: live.id, name: 'Cabaña del río', ownerId: a }]);
            expect(owners).toEqual([{ id: conversation.id, ownerId: a }]);
            expect(clients).toEqual([{ clientId: CLAUDE, name: 'Claude' }]);
        });
    });
});
