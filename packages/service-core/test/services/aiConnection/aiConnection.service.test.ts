/**
 * Tests for AiConnectionService (HOS-2184 T-026).
 */
import type { OauthConnectionModel, UserModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AiConnectionService,
    NO_PENDING_RESET_REVIEW_REASON
} from '../../../src/services/aiConnection/aiConnection.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectInternalError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock } from '../../utils/modelMockFactory';

describe('AiConnectionService', () => {
    const actor = createActor({ id: getMockId('user') });
    const listForUser = vi.fn();
    const revokeForUser = vi.fn();
    const findById = vi.fn();
    const update = vi.fn();
    let service: AiConnectionService;

    beforeEach(() => {
        listForUser.mockReset();
        revokeForUser.mockReset();
        findById.mockReset().mockResolvedValue({ settings: {} });
        update.mockReset().mockResolvedValue({ id: actor.id });
        service = new AiConnectionService(
            { logger: createLoggerMock() },
            { listForUser, revokeForUser } as unknown as OauthConnectionModel,
            { findById, update } as unknown as UserModel
        );
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
            expect(result.data?.pendingResetReview).toBeNull();
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
            const result = await service.revoke(actor, { clientId: '' });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(revokeForUser).not.toHaveBeenCalled();
        });
    });

    describe('password reset review', () => {
        const RESET_AT = '2026-11-10T12:00:00.000Z';
        const row = (clientId: string, connectedAt: Date | null) => ({
            clientId,
            name: clientId,
            uri: null,
            logoUri: null,
            scopes: ['mcp'],
            connectedAt,
            lastUsedAt: null
        });
        const before = new Date('2026-11-01T10:00:00Z');
        const after = new Date('2026-11-12T10:00:00Z');

        describe('list', () => {
            it('reports only the connections made before the reset', async () => {
                listForUser.mockResolvedValue([row('old', before), row('new', after)]);
                findById.mockResolvedValue({
                    settings: { aiConnectionsPasswordResetAt: RESET_AT }
                });

                const result = await service.list(actor);

                expectSuccess(result);
                expect(result.data?.items).toHaveLength(2);
                expect(result.data?.pendingResetReview?.resetAt).toEqual(new Date(RESET_AT));
                expect(
                    result.data?.pendingResetReview?.connectionsBeforeReset.map((c) => c.clientId)
                ).toEqual(['old']);
            });

            it('is null when every connection was made after the reset', async () => {
                listForUser.mockResolvedValue([row('new', after)]);
                findById.mockResolvedValue({
                    settings: { aiConnectionsPasswordResetAt: RESET_AT }
                });

                const result = await service.list(actor);

                expectSuccess(result);
                expect(result.data?.pendingResetReview).toBeNull();
            });

            it('never offers a connection without a known date', async () => {
                listForUser.mockResolvedValue([row('undated', null)]);
                findById.mockResolvedValue({
                    settings: { aiConnectionsPasswordResetAt: RESET_AT }
                });

                const result = await service.list(actor);

                expectSuccess(result);
                expect(result.data?.pendingResetReview).toBeNull();
            });

            it.each([
                [null],
                [undefined],
                ['not-a-date']
            ])('is null for the marker %s', async (marker) => {
                listForUser.mockResolvedValue([row('old', before)]);
                findById.mockResolvedValue({
                    settings: { aiConnectionsPasswordResetAt: marker }
                });

                const result = await service.list(actor);

                expectSuccess(result);
                expect(result.data?.pendingResetReview).toBeNull();
            });

            it('does not read the user when nothing is connected', async () => {
                listForUser.mockResolvedValue([]);

                await service.list(actor);

                expect(findById).not.toHaveBeenCalled();
            });
        });

        describe('resolveResetReview', () => {
            beforeEach(() => {
                findById.mockResolvedValue({
                    settings: { aiConnectionsPasswordResetAt: RESET_AT }
                });
                revokeForUser.mockResolvedValue({
                    consents: 1,
                    refreshTokens: 1,
                    accessTokens: 0
                });
            });

            it('revoke_previous disconnects exactly the pre-reset clients and clears the marker', async () => {
                listForUser.mockResolvedValue([
                    row('old-1', before),
                    row('old-2', before),
                    row('new', after)
                ]);

                const result = await service.resolveResetReview(actor, {
                    action: 'revoke_previous'
                });

                expectSuccess(result);
                expect(result.data?.revokedClientIds).toEqual(['old-1', 'old-2']);
                expect(revokeForUser).toHaveBeenCalledTimes(2);
                expect(revokeForUser).not.toHaveBeenCalledWith(
                    expect.objectContaining({ clientId: 'new' })
                );
                expect(revokeForUser).toHaveBeenCalledWith(
                    expect.objectContaining({ userId: actor.id, clientId: 'old-1' })
                );
                expect(update).toHaveBeenCalledWith(
                    { id: actor.id },
                    { settings: { aiConnectionsPasswordResetAt: null } },
                    undefined
                );
            });

            it('keep revokes nothing and clears the marker', async () => {
                listForUser.mockResolvedValue([row('old', before)]);

                const result = await service.resolveResetReview(actor, { action: 'keep' });

                expectSuccess(result);
                expect(result.data?.revokedClientIds).toEqual([]);
                expect(revokeForUser).not.toHaveBeenCalled();
                expect(update).toHaveBeenCalledTimes(1);
            });

            it('answers 409 NO_PENDING_RESET_REVIEW when nothing is pending, changing nothing', async () => {
                listForUser.mockResolvedValue([row('old', before)]);
                findById.mockResolvedValue({ settings: { aiConnectionsPasswordResetAt: null } });

                const result = await service.resolveResetReview(actor, {
                    action: 'revoke_previous'
                });

                expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
                expect(result.error?.reason).toBe(NO_PENDING_RESET_REVIEW_REASON);
                expect(revokeForUser).not.toHaveBeenCalled();
                expect(update).not.toHaveBeenCalled();
            });

            it('is idempotent: a second answer after the marker was cleared is a no-op conflict', async () => {
                listForUser.mockResolvedValue([row('old', before)]);
                await service.resolveResetReview(actor, { action: 'revoke_previous' });
                findById.mockResolvedValue({ settings: { aiConnectionsPasswordResetAt: null } });
                revokeForUser.mockClear();
                update.mockClear();

                const second = await service.resolveResetReview(actor, {
                    action: 'revoke_previous'
                });

                expect(second.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
                expect(revokeForUser).not.toHaveBeenCalled();
                expect(update).not.toHaveBeenCalled();
            });

            it('keeps the question open when a revoke fails, so a retry can finish', async () => {
                listForUser.mockResolvedValue([row('old', before)]);
                revokeForUser.mockRejectedValue(new Error('db down'));

                const result = await service.resolveResetReview(actor, {
                    action: 'revoke_previous'
                });

                expectInternalError(result);
                expect(update).not.toHaveBeenCalled();
            });

            it('rejects an unknown action before touching anything', async () => {
                const result = await service.resolveResetReview(actor, {
                    action: 'nuke' as never
                });

                expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(listForUser).not.toHaveBeenCalled();
            });
        });
    });
});
