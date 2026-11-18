/**
 * HOS-2349 (spec HOS-2335 §6.10): the admin log rows add the user the
 * assistant acted for (id, display name, email), and the raw `errorCode`.
 *
 * - `all`: one batched user lookup per page; a live user adds name and email,
 *   a deleted (not found) one keeps only its id.
 * - `own`: the users table is never read and no item carries the user fields,
 *   so an owner's history cannot show another user's identity (R-13).
 * - The all scope needs `MCP_ACTIVITY_VIEW` (D-15); `AUDIT_LOG_VIEW` is not it.
 */
import { AuditLogEntryModel, McpActivityModel } from '@repo/db';
import { McpActivityItemSchema, PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { MCP_ACTIVITY_ALL_SCOPE_PERMISSION } from '../../../src/services/mcpActivity/mcpActivity.permissions.js';
import { McpActivityService } from '../../../src/services/mcpActivity/mcpActivity.service.js';
import type { Actor } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { expectSuccess } from '../../helpers/assertions.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';
import { asMock } from '../../utils/test-utils.js';

const ANA = '2f6e1c3a-8b9d-4a7e-b5c4-d3e2f1a0b9c8';
const GONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const STAFF = '5c4b3a29-1807-4f6e-9d5c-4b3a29180706';
const CLAUDE = 'https://claude.ai/oauth/mcp-client-metadata';
const PAGE = { page: 1, pageSize: 20 } as const;

/** An `mcp.tool.call` row of `actorId`. */
function row(input: { readonly id: number; readonly actorId: string | null }) {
    return {
        id: `00000000-0000-4000-8000-${String(input.id).padStart(12, '0')}`,
        loggedAt: new Date('2026-11-10T12:00:00.000Z'),
        actorId: input.actorId,
        data: {
            tool: 'reply_inquiry',
            outcome: 'error',
            errorCode: 'CONFIRMATION_EXPIRED',
            clientId: CLAUDE
        }
    };
}

describe('McpActivityService — the user of admin rows (HOS-2349)', () => {
    let model: McpActivityModel;
    let service: McpActivityService;
    let staff: Actor;

    beforeEach(() => {
        model = createTypedModelMock(McpActivityModel, [
            'listToolCalls',
            'findListingNames',
            'findConversationOwners',
            'findClientNames',
            'findUsers'
        ]);
        asMock(model.listToolCalls).mockResolvedValue({
            items: [
                row({ id: 1, actorId: ANA }),
                row({ id: 2, actorId: ANA }),
                row({ id: 3, actorId: GONE }),
                row({ id: 4, actorId: null })
            ],
            total: 4
        });
        asMock(model.findListingNames).mockResolvedValue([]);
        asMock(model.findConversationOwners).mockResolvedValue([]);
        asMock(model.findClientNames).mockResolvedValue([]);
        asMock(model.findUsers).mockResolvedValue([
            { id: ANA, displayName: 'Ana Host', email: 'ana@local.test' }
        ]);
        service = new McpActivityService(
            { logger: createLoggerMock() },
            {
                model,
                auditLogModel: createTypedModelMock(AuditLogEntryModel, ['purgeOlderThan'])
            }
        );
        staff = createActor({ id: STAFF, permissions: [PermissionEnum.MCP_ACTIVITY_VIEW] });
    });

    it('gates the all scope on MCP_ACTIVITY_VIEW (D-15)', () => {
        expect(MCP_ACTIVITY_ALL_SCOPE_PERMISSION).toBe(PermissionEnum.MCP_ACTIVITY_VIEW);
    });

    it('all: looks the page users up once, deduplicated', async () => {
        await service.list({ actor: staff, scope: { kind: 'all' }, ...PAGE });

        expect(model.findUsers).toHaveBeenCalledTimes(1);
        expect(asMock(model.findUsers).mock.calls[0]?.[0]).toEqual({ ids: [ANA, GONE] });
    });

    it('all: a live user adds name and email; a deleted one keeps only its id', async () => {
        const result = await service.list({ actor: staff, scope: { kind: 'all' }, ...PAGE });

        expectSuccess(result);
        const [first, , gone, anonymous] = result.data?.items ?? [];
        expect(first).toMatchObject({
            actorId: ANA,
            actorName: 'Ana Host',
            actorEmail: 'ana@local.test',
            errorCode: 'CONFIRMATION_EXPIRED'
        });
        expect(gone?.actorId).toBe(GONE);
        expect(gone).not.toHaveProperty('actorName');
        expect(gone).not.toHaveProperty('actorEmail');
        expect(anonymous).not.toHaveProperty('actorId');
        for (const item of result.data?.items ?? []) {
            expect(McpActivityItemSchema.safeParse(item).success).toBe(true);
        }
    });

    it('all: a user with no display name gets the email only', async () => {
        asMock(model.findUsers).mockResolvedValue([
            { id: ANA, displayName: null, email: 'ana@local.test' }
        ]);

        const result = await service.list({ actor: staff, scope: { kind: 'all' }, ...PAGE });

        expectSuccess(result);
        expect(result.data?.items[0]).toMatchObject({ actorEmail: 'ana@local.test' });
        expect(result.data?.items[0]).not.toHaveProperty('actorName');
    });

    it('own: never reads the users table and carries no user fields', async () => {
        const owner = createActor({ id: ANA, permissions: [] });

        const result = await service.list({ actor: owner, scope: { kind: 'own' }, ...PAGE });

        expectSuccess(result);
        expect(model.findUsers).not.toHaveBeenCalled();
        for (const item of result.data?.items ?? []) {
            expect(item).not.toHaveProperty('actorId');
            expect(item).not.toHaveProperty('actorName');
            expect(item).not.toHaveProperty('actorEmail');
        }
    });
});
