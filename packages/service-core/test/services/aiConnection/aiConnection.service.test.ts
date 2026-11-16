/**
 * Tests for AiConnectionService (HOS-2184 T-026).
 */
import type { OauthConnectionModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConnectionService } from '../../../src/services/aiConnection/aiConnection.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock } from '../../utils/modelMockFactory';

describe('AiConnectionService', () => {
    const actor = createActor({ id: getMockId('user') });
    const listForUser = vi.fn();
    const revokeForUser = vi.fn();
    let service: AiConnectionService;

    beforeEach(() => {
        listForUser.mockReset();
        revokeForUser.mockReset();
        service = new AiConnectionService({ logger: createLoggerMock() }, {
            listForUser,
            revokeForUser
        } as unknown as OauthConnectionModel);
    });

    describe('list', () => {
        it('scopes the read to the actor and maps the rows', async () => {
            const connectedAt = new Date('2026-11-01T10:00:00Z');
            listForUser.mockResolvedValue([
                {
                    clientId: 'c1',
                    name: 'Claude',
                    uri: null,
                    logoUri: 'https://x.test/l.png',
                    scopes: ['mcp'],
                    connectedAt,
                    lastUsedAt: null
                }
            ]);

            const result = await service.list(actor);

            expectSuccess(result);
            expect(listForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: actor.id }));
            expect(result.data?.items).toEqual([
                {
                    clientId: 'c1',
                    name: 'Claude',
                    uri: null,
                    logoUri: 'https://x.test/l.png',
                    scopes: ['mcp'],
                    connectedAt,
                    lastUsedAt: null
                }
            ]);
        });

        it('returns an empty list', async () => {
            listForUser.mockResolvedValue([]);

            const result = await service.list(actor);

            expectSuccess(result);
            expect(result.data?.items).toEqual([]);
        });

        it('surfaces a model failure as INTERNAL_ERROR', async () => {
            listForUser.mockRejectedValue(new Error('db down'));

            expectInternalError(await service.list(actor));
        });
    });

    describe('revoke', () => {
        it('revokes for the actor and reports what was removed', async () => {
            const removed = { consents: 1, refreshTokens: 2, accessTokens: 0 };
            revokeForUser.mockResolvedValue(removed);

            const result = await service.revoke(actor, { clientId: 'c1' });

            expectSuccess(result);
            expect(revokeForUser).toHaveBeenCalledWith(
                expect.objectContaining({ userId: actor.id, clientId: 'c1' })
            );
            expect(result.data).toEqual({ clientId: 'c1', removed });
        });

        it('treats leftover tokens without a consent as a connection', async () => {
            revokeForUser.mockResolvedValue({ consents: 0, refreshTokens: 1, accessTokens: 0 });

            expectSuccess(await service.revoke(actor, { clientId: 'c1' }));
        });

        it('answers NOT_FOUND when the actor has no connection to the client', async () => {
            revokeForUser.mockResolvedValue({ consents: 0, refreshTokens: 0, accessTokens: 0 });

            const result = await service.revoke(actor, { clientId: 'foreign' });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('rejects an empty client id before touching the model', async () => {
            const result = await service.revoke(actor, { clientId: '  ' });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(revokeForUser).not.toHaveBeenCalled();
        });
    });
});
