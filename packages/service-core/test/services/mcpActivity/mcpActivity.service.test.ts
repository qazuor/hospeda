/**
 * HOS-2335 §5.6 — McpActivityService: the one reader of the assistant
 * activity (D-14) and its 12-month, event-scoped retention (D-13).
 *
 * - Scope: `own` forces the session actor and refuses any user filter;
 *   `all` requires the all-scope permission (AC-C45, AC-C54, R-13).
 * - Filters: tool, outcome, client, access and dates reach the model (D-16).
 * - Projection: a row without `isWrite` is a write (D-12); a lost or foreign
 *   target has no label and no link (AC-C47); items keep their allowlist.
 * - Retention: the cutoff is 12 months, the delete is scoped to
 *   `mcp.tool.call`, batched, and a dry run deletes nothing (AC-C56).
 */
import { AuditLogEntryModel, McpActivityModel } from '@repo/db';
import { McpActivityItemSchema, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    McpActivityService,
    mcpAuditRetentionCutoff
} from '../../../src/services/mcpActivity/mcpActivity.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import {
    expectForbiddenError,
    expectSuccess,
    expectValidationError
} from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const OWNER = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const LISTING = '7d3c2b1a-0f9e-4d8c-b7a6-958473625140';
const CONVERSATION = '0b1c2d3e-4f50-4617-8a9b-0c1d2e3f4a5b';
const CLAUDE = 'https://claude.ai/oauth/mcp-client-metadata';
const PAGE = { page: 1, pageSize: 20 } as const;

let rowSeq = 0;
/** An `mcp.tool.call` row as the binder persists it. */
function row(input: { readonly actorId?: string | null; readonly data: Record<string, unknown> }): {
    id: string;
    loggedAt: Date;
    actorId: string | null;
    data: Record<string, unknown>;
} {
    rowSeq += 1;
    return {
        id: `00000000-0000-4000-8000-${String(rowSeq).padStart(12, '0')}`,
        loggedAt: new Date('2026-11-10T12:00:00.000Z'),
        actorId: input.actorId === undefined ? OWNER : input.actorId,
        data: {
            auditEvent: 'mcp.tool.call',
            tool: 'get_listing',
            outcome: 'success',
            clientId: CLAUDE,
            ...input.data
        }
    };
}

describe('McpActivityService', () => {
    let model: McpActivityModel;
    let auditModel: AuditLogEntryModel;
    let service: McpActivityService;
    let owner: Actor;
    let staff: Actor;

    beforeEach(() => {
        model = createTypedModelMock(McpActivityModel, [
            'listToolCalls',
            'findListingNames',
            'findConversationOwners',
            'findClientNames'
        ]);
        auditModel = createTypedModelMock(AuditLogEntryModel, ['purgeOlderThan', 'countOlderThan']);
        asMock(model.listToolCalls).mockResolvedValue({ items: [], total: 0 });
        asMock(model.findListingNames).mockResolvedValue([]);
        asMock(model.findConversationOwners).mockResolvedValue([]);
        asMock(model.findClientNames).mockResolvedValue([]);
        service = new McpActivityService(
            { logger: createLoggerMock() },
            {
                model,
                auditLogModel: auditModel,
                buildTargetUrl: ({ target }) => `https://site.test/${target.type}/${target.id}`
            }
        );
        owner = createActor({ id: OWNER, permissions: [] });
        staff = createActor({ id: OTHER, permissions: [PermissionEnum.AUDIT_LOG_VIEW] });
    });

    /** The filter the model received on its only call. */
    const modelFilter = () => asMock(model.listToolCalls).mock.calls[0]?.[0];

    describe('scope', () => {
        it('own: reads the session actor rows', async () => {
            const result = await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });

            expectSuccess(result);
            expect(modelFilter()).toMatchObject({ actorId: OWNER });
        });

        it.each([
            ['userId', { userId: OTHER }],
            ['actorId', { actorId: OTHER }]
        ])('own: a %s filter is a validation error and nothing is read', async (_k, filter) => {
            const result = await service.list({
                actor: owner,
                scope: { kind: 'own' },
                filter,
                ...PAGE
            });

            expectValidationError(result);
            expect(model.listToolCalls).not.toHaveBeenCalled();
        });

        it('own: a staff actor still reads only its own rows', async () => {
            await service.list({ actor: staff, scope: { kind: 'own' }, ...PAGE });

            expect(modelFilter()).toMatchObject({ actorId: OTHER });
        });

        it('all: refused without the permission, before any read', async () => {
            const result = await service.list({ actor: owner, scope: { kind: 'all' }, ...PAGE });

            expectForbiddenError(result);
            expect(model.listToolCalls).not.toHaveBeenCalled();
        });

        it('all: unscoped without userId, scoped to it with one', async () => {
            await service.list({ actor: staff, scope: { kind: 'all' }, ...PAGE });
            await service.list({
                actor: staff,
                scope: { kind: 'all' },
                filter: { userId: OWNER },
                ...PAGE
            });

            const calls = asMock(model.listToolCalls).mock.calls.map(([filter]) => filter);
            expect(calls[0]).not.toHaveProperty('actorId');
            expect(calls[1]).toMatchObject({ actorId: OWNER });
        });

        it('refuses a pageSize over 100 and a limit param', async () => {
            const big = await service.list({
                actor: owner,
                scope: { kind: 'own' },
                page: 1,
                pageSize: 101
            });
            const limit = await service.list({
                actor: owner,
                scope: { kind: 'own' },
                filter: { limit: 5 },
                ...PAGE
            });

            expectValidationError(big);
            expectValidationError(limit);
        });
    });

    describe('filters', () => {
        it('passes tool, outcome, client, dates and order to the model', async () => {
            await service.list({
                actor: owner,
                scope: { kind: 'own' },
                filter: {
                    tool: 'reply_inquiry',
                    outcome: 'denied',
                    clientId: CLAUDE,
                    fromDate: '2026-11-01T00:00:00Z',
                    toDate: '2026-11-30T00:00:00Z',
                    sortDirection: 'asc'
                },
                page: 2,
                pageSize: 10
            });

            expect(modelFilter()).toEqual({
                actorId: OWNER,
                tool: 'reply_inquiry',
                outcome: 'denied',
                clientId: CLAUDE,
                fromDate: new Date('2026-11-01T00:00:00Z'),
                toDate: new Date('2026-11-30T00:00:00Z'),
                page: 2,
                pageSize: 10,
                sortDirection: 'asc'
            });
        });

        it.each([
            ['read', false],
            ['write', true]
        ] as const)('access %s maps to isWrite %s', async (access, isWrite) => {
            await service.list({
                actor: owner,
                scope: { kind: 'own' },
                filter: { access },
                ...PAGE
            });

            expect(modelFilter()).toMatchObject({ isWrite });
        });

        it('no access filter reads both, newest first', async () => {
            await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });

            expect(modelFilter()).not.toHaveProperty('isWrite');
            expect(modelFilter()).toMatchObject({ sortDirection: 'desc' });
        });
    });

    describe('projection', () => {
        it('counts a row without isWrite as a write (D-12)', async () => {
            asMock(model.listToolCalls).mockResolvedValue({
                items: [
                    row({ data: { tool: 'reply_inquiry' } }),
                    row({ data: { isWrite: false } }),
                    row({ data: { isWrite: true } })
                ],
                total: 3
            });

            const result = await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });

            expect(result.data?.items.map((item) => item.isWrite)).toEqual([true, false, true]);
            expect(result.data?.total).toBe(3);
        });

        it('labels and links a live listing the row actor owns; a lost or foreign one keeps type and id only (AC-C47)', async () => {
            const GONE = '11111111-2222-4333-8444-555555555555';
            const FOREIGN = '66666666-7777-4888-8999-aaaaaaaaaaaa';
            asMock(model.listToolCalls).mockResolvedValue({
                items: [
                    row({ data: { resourceType: 'accommodation', resourceId: LISTING } }),
                    row({ data: { resourceType: 'accommodation', resourceId: GONE } }),
                    row({ data: { resourceType: 'accommodation', resourceId: FOREIGN } })
                ],
                total: 3
            });
            asMock(model.findListingNames).mockResolvedValue([
                { id: LISTING, name: 'Cabaña del río', ownerId: OWNER },
                { id: FOREIGN, name: 'Not yours', ownerId: OTHER }
            ]);

            const result = await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });

            expect(result.data?.items.map((item) => item.target)).toEqual([
                {
                    type: 'accommodation',
                    id: LISTING,
                    label: 'Cabaña del río',
                    url: `https://site.test/accommodation/${LISTING}`
                },
                { type: 'accommodation', id: GONE },
                { type: 'accommodation', id: FOREIGN }
            ]);
            expect(model.findListingNames).toHaveBeenCalledTimes(1);
            expect(model.findListingNames).toHaveBeenCalledWith(
                { vertical: 'accommodation', ids: [LISTING, GONE, FOREIGN] },
                undefined
            );
        });

        it('links an owned conversation with no label; a foreign one stays bare', async () => {
            const FOREIGN = 'ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb';
            asMock(model.listToolCalls).mockResolvedValue({
                items: [
                    row({ data: { resourceType: 'conversation', resourceId: CONVERSATION } }),
                    row({ data: { resourceType: 'conversation', resourceId: FOREIGN } })
                ],
                total: 2
            });
            asMock(model.findConversationOwners).mockResolvedValue([
                { id: CONVERSATION, ownerId: OWNER },
                { id: FOREIGN, ownerId: OTHER }
            ]);

            const result = await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });

            expect(result.data?.items.map((item) => item.target)).toEqual([
                {
                    type: 'conversation',
                    id: CONVERSATION,
                    url: `https://site.test/conversation/${CONVERSATION}`
                },
                { type: 'conversation', id: FOREIGN }
            ]);
        });

        it('in the all scope, ownership is the row actor, not the reader', async () => {
            asMock(model.listToolCalls).mockResolvedValue({
                items: [row({ data: { resourceType: 'venue', resourceId: LISTING } })],
                total: 1
            });
            asMock(model.findListingNames).mockResolvedValue([
                { id: LISTING, name: 'Bar', ownerId: OWNER }
            ]);

            const result = await service.list({ actor: staff, scope: { kind: 'all' }, ...PAGE });

            expect(result.data?.items[0]).toMatchObject({
                actorId: OWNER,
                target: { type: 'venue', id: LISTING, label: 'Bar' }
            });
        });

        it('carries step, error code and the registered client name, and nothing else', async () => {
            asMock(model.listToolCalls).mockResolvedValue({
                items: [
                    row({
                        data: {
                            tool: 'reply_inquiry',
                            isWrite: true,
                            outcome: 'denied',
                            errorCode: 'NOT_FOUND',
                            contentLength: 120,
                            details: { step: 'preview' },
                            text: 'private reply text',
                            guestName: 'Ana'
                        }
                    })
                ],
                total: 1
            });
            asMock(model.findClientNames).mockResolvedValue([{ clientId: CLAUDE, name: 'Claude' }]);

            const result = await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });
            const item = result.data?.items[0];

            expect(item).toMatchObject({
                tool: 'reply_inquiry',
                outcome: 'denied',
                errorCode: 'NOT_FOUND',
                step: 'preview',
                client: { id: CLAUDE, name: 'Claude' }
            });
            expect(item).not.toHaveProperty('actorId');
            expect(McpActivityItemSchema.safeParse(item).success).toBe(true);
            expect(JSON.stringify(item)).not.toMatch(/private reply text|Ana|contentLength/);
        });

        it('drops a row whose data the binder never wrote', async () => {
            asMock(model.listToolCalls).mockResolvedValue({
                items: [row({ data: { outcome: 'maybe' } }), row({ data: {} })],
                total: 2
            });

            const result = await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });

            expect(result.data?.items).toHaveLength(1);
        });
    });

    describe('retention (D-13, AC-C56)', () => {
        const NOW = new Date('2026-11-18T12:00:00.000Z');
        const CUTOFF = new Date('2025-11-18T12:00:00.000Z');

        it('the cutoff is 12 calendar months before the run', () => {
            expect(mcpAuditRetentionCutoff({ now: NOW })).toEqual(CUTOFF);
        });

        it('a dry run counts mcp.tool.call rows past the cutoff and deletes nothing', async () => {
            asMock(auditModel.countOlderThan).mockResolvedValue(7);
            asMock(auditModel.purgeOlderThan).mockResolvedValue(0);

            const result = await service.purgeExpired({ now: NOW, dryRun: true });

            expect(auditModel.countOlderThan).toHaveBeenCalledWith({
                before: CUTOFF,
                eventType: 'mcp.tool.call'
            });
            expect(auditModel.purgeOlderThan).not.toHaveBeenCalled();
            expect(result).toEqual({ cutoff: CUTOFF, deleted: 0, wouldDelete: 7 });
        });

        it('deletes in batches scoped to mcp.tool.call until a batch comes back short', async () => {
            asMock(auditModel.purgeOlderThan)
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(1);

            const result = await service.purgeExpired({ now: NOW, batchSize: 2 });

            expect(auditModel.purgeOlderThan).toHaveBeenCalledTimes(3);
            for (const [args] of asMock(auditModel.purgeOlderThan).mock.calls) {
                expect(args).toEqual({ before: CUTOFF, eventType: 'mcp.tool.call', limit: 2 });
            }
            expect(result).toEqual({ cutoff: CUTOFF, deleted: 5, wouldDelete: 0 });
        });
    });
});
