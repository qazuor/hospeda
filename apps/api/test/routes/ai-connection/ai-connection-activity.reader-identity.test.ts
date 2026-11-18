/**
 * AC-C54 (spec HOS-2335 §6.10, decision D-14) — the owner's history calls THE
 * shared reader, `McpActivityService.list` from `@repo/service-core`, and
 * always with the `own` scope.
 *
 * The admin log route (HOS-2349) does not exist on this branch yet, so the
 * identity is asserted against the service export itself: the route's reader
 * is an instance of the exported class and its `list` IS the exported
 * prototype method, not a copy or a wrapper. The admin route's test asserts
 * the same against the same export, which makes the two identical by
 * transitivity.
 */
import { RoleEnum } from '@repo/schemas';
import { McpActivityService } from '@repo/service-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    return { ...createDbMock(), mcpActivityModel: {}, auditLogEntryModel: {} };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

const { initApp } = await import('../../../src/app.js');
const { getOwnActivityReader } = await import(
    '../../../src/routes/ai-connection/protected/activity.js'
);

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('owner history reader identity (AC-C54)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is the exported McpActivityService, with its very list method', () => {
        const reader = getOwnActivityReader();

        expect(reader).toBeInstanceOf(McpActivityService);
        expect(reader.list).toBe(McpActivityService.prototype.list);
        expect(Object.hasOwn(reader, 'list')).toBe(false);
        expect(getOwnActivityReader()).toBe(reader);
    });

    it('calls it with the own scope and the session actor, whatever the query', async () => {
        // Arrange
        const listSpy = vi
            .spyOn(McpActivityService.prototype, 'list')
            .mockResolvedValue({ data: { items: [], total: 0, skipped: 0 } });

        // Act
        const res = await initApp().request(
            '/api/v1/protected/ai-connections/activity?includeReads=true&outcome=error',
            {
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'x-mock-actor-id': USER_A,
                    'x-mock-actor-role': RoleEnum.USER,
                    'x-mock-actor-permissions': JSON.stringify([])
                }
            }
        );

        // Assert
        expect(res.status).toBe(200);
        expect(listSpy).toHaveBeenCalledTimes(1);
        const call = listSpy.mock.calls[0]?.[0];
        expect(call?.scope).toEqual({ kind: 'own' });
        expect(call?.actor.id).toBe(USER_A);
        expect(call?.filter).toEqual({ outcome: 'error' });
        expect(call?.filter).not.toHaveProperty('userId');
    });
});
