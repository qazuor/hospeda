import { accommodations, eq, setDb, users } from '@repo/db';
import {
    LifecycleStatusEnum,
    MessageSenderTypeEnum,
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import { ConversationService } from '../../../src/services/conversation/conversation.service';
import { MessageService } from '../../../src/services/conversation/message.service';
import { ServiceError } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('TEST:V5:30 published-only conversations and reviews (DB)', () => {
    beforeAll(() => {
        if (dbAvailable) getServiceTestDb();
    });

    afterAll(async () => {
        if (dbAvailable) await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'creates on PUBLISHED, masks DRAFT, and keeps PURGED threads readable',
        async () => {
            const db = getServiceTestDb();
            await withServiceTestTransaction(async (tx) => {
                setDb(tx);
                try {
                    const published = await seedAccommodation(tx);
                    const draft = await seedAccommodation(tx);
                    await tx
                        .update(accommodations)
                        .set({ publicationStatus: PublicationStatusEnum.PUBLISHED })
                        .where(eq(accommodations.id, published.accommodationId));
                    await tx
                        .update(accommodations)
                        .set({ publicationStatus: PublicationStatusEnum.DRAFT })
                        .where(eq(accommodations.id, draft.accommodationId));

                    const touristId = crypto.randomUUID();
                    await tx.insert(users).values({
                        id: touristId,
                        email: `tourist-${touristId}@example.com`,
                        displayName: 'Tourist',
                        emailVerified: true,
                        lifecycleState: 'ACTIVE'
                    });
                    const tourist = {
                        id: touristId,
                        roles: [RoleEnum.USER],
                        permissions: [
                            PermissionEnum.CONVERSATION_REPLY_OWN,
                            PermissionEnum.CONVERSATION_VIEW_OWN,
                            PermissionEnum.ACCOMMODATION_REVIEW_CREATE
                        ]
                    };
                    const owner = {
                        id: published.userId,
                        roles: [RoleEnum.HOST],
                        permissions: [PermissionEnum.CONVERSATION_REPLY_OWN]
                    };
                    const logger = createLoggerMock();
                    const conversations = new ConversationService(
                        { logger },
                        {
                            authSecret: 'integration-test-secret-at-least-32-characters-long',
                            siteUrl: ''
                        }
                    );
                    const messages = new MessageService({ logger });
                    const reviews = new AccommodationReviewService({ logger });

                    const opened = await conversations.initiateAuthenticated(tourist, {
                        accommodationId: published.accommodationId,
                        message: 'Hola, quisiera consultar por disponibilidad.'
                    });
                    expect(opened.error).toBeUndefined();
                    expect(opened.data?.conversationId).toBeDefined();
                    if (!opened.data) throw new Error('conversation was not created');

                    const reviewInput = {
                        userId: touristId,
                        accommodationId: published.accommodationId,
                        lifecycleState: LifecycleStatusEnum.ACTIVE,
                        title: 'Buena estadía',
                        content: 'La estadía fue excelente.',
                        rating: {
                            cleanliness: 5,
                            hospitality: 5,
                            services: 5,
                            accuracy: 5,
                            communication: 5,
                            location: 5
                        }
                    };
                    const review = await reviews.create(tourist, reviewInput, {
                        tx,
                        hookState: {}
                    });
                    expect(review.error).toBeUndefined();
                    expect(review.data?.id).toBeDefined();

                    const input = { accommodationId: draft.accommodationId, message: 'Hola' };
                    const hidden = await conversations.initiateAuthenticated(tourist, input);
                    const reviewRefusal = async () => {
                        try {
                            await reviews.create(
                                tourist,
                                {
                                    ...reviewInput,
                                    accommodationId: draft.accommodationId
                                },
                                { tx, hookState: {} }
                            );
                        } catch (error) {
                            if (error instanceof ServiceError) {
                                return {
                                    code: error.code,
                                    message: error.message,
                                    reason: error.reason
                                };
                            }
                            throw error;
                        }
                        throw new Error('expected review refusal');
                    };
                    const hiddenReview = await reviewRefusal();
                    await tx
                        .delete(accommodations)
                        .where(eq(accommodations.id, draft.accommodationId));
                    const absent = await conversations.initiateAuthenticated(tourist, input);
                    const absentReview = await reviewRefusal();
                    expect(hidden.error).toEqual(absent.error);
                    expect(hidden.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
                    expect(hiddenReview).toEqual(absentReview);
                    expect(hiddenReview.code).toBe(ServiceErrorCode.NOT_FOUND);

                    await tx
                        .update(accommodations)
                        .set({ publicationStatus: PublicationStatusEnum.PURGED })
                        .where(eq(accommodations.id, published.accommodationId));
                    const thread = await conversations.getThread(
                        tourist,
                        {
                            conversationId: opened.data.conversationId,
                            actorSide: 'GUEST'
                        },
                        []
                    );
                    expect(thread.error).toBeUndefined();
                    expect(thread.data?.messages).toHaveLength(1);

                    const refused = await messages.createMessage(tourist, {
                        conversationId: opened.data.conversationId,
                        senderType: MessageSenderTypeEnum.GUEST,
                        body: '¿Hay novedades?'
                    });
                    expect(refused.error).toMatchObject({
                        code: ServiceErrorCode.NOT_FOUND,
                        reason: 'CONVERSATION_NOT_FOUND'
                    });
                    const reply = await messages.createMessage(owner, {
                        conversationId: opened.data.conversationId,
                        senderType: MessageSenderTypeEnum.OWNER,
                        body: 'Sí, te respondo.'
                    });
                    expect(reply.error).toBeUndefined();
                    const complete = await conversations.getThread(
                        tourist,
                        {
                            conversationId: opened.data.conversationId,
                            actorSide: 'GUEST'
                        },
                        []
                    );
                    expect(complete.data?.messages).toHaveLength(2);
                } finally {
                    setDb(db);
                }
            });
        }
    );
});
