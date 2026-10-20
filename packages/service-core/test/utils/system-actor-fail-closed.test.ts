import type { DrizzleClient } from '@repo/db';
import { AccessTokenModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { AccessTokenService } from '../../src/services/conversation/access-token.service';
import { createSystemActor } from '../../src/utils/system-actor';
import { createLoggerMock, createTypedModelMock } from './modelMockFactory';

const CONVERSATION_ID = 'aaaabbbb-cccc-4ddd-8eee-ffffffffffff';
const fakeDb = {} as DrizzleClient;
const asMock = <T>(fn: T) => fn as unknown as Mock;

describe('TEST:V5:14 — un job sin el permiso declarado falla cerrado', () => {
    let service: AccessTokenService;
    let modelMock: AccessTokenModel;

    beforeEach(() => {
        modelMock = createTypedModelMock(AccessTokenModel, ['revokeAll']);
        service = new AccessTokenService({ logger: createLoggerMock() }, modelMock);
        vi.clearAllMocks();
    });

    it('returns FORBIDDEN and does not write when CONVERSATION_VIEW_ANY is undeclared', async () => {
        const actor = createSystemActor({
            jobId: 'conversation.revoke-without-permission',
            permissions: []
        });
        const result = await service.revokeAllForConversation(
            actor,
            { conversationId: CONVERSATION_ID },
            fakeDb
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(asMock(modelMock.revokeAll)).not.toHaveBeenCalled();
    });

    it('allows the same job with CONVERSATION_VIEW_ANY declared', async () => {
        asMock(modelMock.revokeAll).mockResolvedValue(2);
        const actor = createSystemActor({
            jobId: 'conversation.revoke-with-permission',
            permissions: [PermissionEnum.CONVERSATION_VIEW_ANY]
        });
        const result = await service.revokeAllForConversation(
            actor,
            { conversationId: CONVERSATION_ID },
            fakeDb
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(2);
        expect(asMock(modelMock.revokeAll)).toHaveBeenCalledWith(CONVERSATION_ID, fakeDb);
    });
});
