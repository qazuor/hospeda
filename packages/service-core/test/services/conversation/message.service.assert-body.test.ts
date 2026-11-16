/**
 * @file message.service.assert-body.test.ts
 *
 * `MessageService.assertMessageBodyAllowed`: the dry run of the body rules
 * `createMessage` applies (length + content moderation), used to preview a
 * reply before it is confirmed. Nothing is stored.
 */

vi.mock('@repo/content-moderation', () => ({ moderateText: vi.fn() }));

vi.mock('../../../src/services/contentModeration/get-threshold-for-context.js', () => ({
    getThresholdForContext: vi.fn().mockResolvedValue({
        context: 'message',
        pending: 0.5,
        reject: 0.85,
        source: 'code-constants'
    })
}));

import * as contentModeration from '@repo/content-moderation';
import { AccommodationModel, ConversationModel, MessageModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from '../../../src/services/conversation/message.service.js';
import type { NotificationScheduleService } from '../../../src/services/conversation/notification-schedule.service.js';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory.js';

const moderateText = vi.mocked(contentModeration.moderateText);

const result = (overrides: Partial<contentModeration.ModerationResult>) =>
    ({
        score: 0,
        categories: {},
        matchedTerms: [],
        ...overrides
    }) as unknown as contentModeration.ModerationResult;

describe('MessageService.assertMessageBodyAllowed', () => {
    let service: MessageService;
    let messageModel: MessageModel;

    beforeEach(() => {
        vi.clearAllMocks();
        messageModel = createTypedModelMock(MessageModel, ['create']);
        service = new MessageService(
            { logger: createLoggerMock() },
            messageModel,
            createTypedModelMock(ConversationModel, ['findById', 'update']),
            createTypedModelMock(AccommodationModel, ['findById']),
            {} as unknown as NotificationScheduleService
        );
        moderateText.mockResolvedValue(result({}));
    });

    it('resolves for a clean body and stores nothing', async () => {
        await expect(
            service.assertMessageBodyAllowed({ body: 'Hola, sí tenemos lugar.' })
        ).resolves.toBeUndefined();
        expect(moderateText).toHaveBeenCalledWith({
            text: 'Hola, sí tenemos lugar.',
            context: 'message'
        });
        expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('rejects a blocked term with MESSAGE_CONTENT_BLOCKED', async () => {
        moderateText.mockResolvedValue(result({ score: 1, matchedTerms: ['badword'] }));

        await expect(service.assertMessageBodyAllowed({ body: 'badword' })).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'MESSAGE_CONTENT_BLOCKED'
        });
    });

    it('rejects a score at or over the reject threshold', async () => {
        moderateText.mockResolvedValue(result({ score: 0.9 }));

        await expect(service.assertMessageBodyAllowed({ body: 'x' })).rejects.toMatchObject({
            reason: 'MESSAGE_CONTENT_BLOCKED'
        });
    });

    it('rejects a body over 5000 characters with MESSAGE_TOO_LONG before moderating', async () => {
        await expect(
            service.assertMessageBodyAllowed({ body: 'a'.repeat(5001) })
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', reason: 'MESSAGE_TOO_LONG' });
        expect(moderateText).not.toHaveBeenCalled();
    });
});
