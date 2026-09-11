import { EventModel } from '@repo/db';
import type { UserIdType } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { EventService } from '../../../src/services/event/event.service';
import type { ServiceLogger } from '../../../src/utils/service-logger';
import { createActor } from '../../factories/actorFactory';
import { createMockEvent } from '../../factories/eventFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectForbiddenError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createTypedModelMock, makeEventMediaModelStub } from '../../utils/modelMockFactory';

/**
 * HOS-374 §7.6.4 — the three dedicated state transitions, event twin.
 *
 * Same invariant as the post suite: each transition writes ONLY the field it
 * owns, so no permission can be sidestepped by bundling a second state change
 * into the same call.
 */
describe('EventService state transitions', () => {
    const authorId = getMockId('user', 'event-author') as UserIdType;
    const strangerId = getMockId('user', 'event-stranger') as UserIdType;

    let service: EventService;
    let modelMock: EventModel;
    let event: ReturnType<typeof createMockEvent>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(EventModel, ['findById', 'update']);
        const loggerMock = { log: vi.fn(), error: vi.fn() } as unknown as ServiceLogger;
        service = new EventService({
            model: modelMock,
            logger: loggerMock,
            eventMediaModel: makeEventMediaModelStub() as never
        });
        event = createMockEvent({
            authorId,
            visibility: VisibilityEnum.PUBLIC,
            moderationState: ModerationStatusEnum.PENDING,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        (modelMock.findById as Mock).mockResolvedValue(event);
        (modelMock.update as Mock).mockImplementation(
            async (_where: unknown, patch: Record<string, unknown>) => ({ ...event, ...patch })
        );
    });

    describe('moderate', () => {
        const moderator = () =>
            createActor({
                id: strangerId,
                roles: [RoleEnum.USER],
                permissions: [PermissionEnum.EVENT_MODERATION_CHANGE]
            });

        it('writes moderationState and nothing else', async () => {
            const result = await service.moderate({
                actor: moderator(),
                id: event.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectSuccess(result);
            expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
            expect(modelMock.update as Mock).toHaveBeenCalledWith(
                { id: event.id },
                { moderationState: ModerationStatusEnum.APPROVED },
                undefined
            );
        });

        it('is refused to an actor holding EVENT_UPDATE but not EVENT_MODERATION_CHANGE', async () => {
            const editor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_UPDATE]
            });

            const result = await service.moderate({
                actor: editor,
                id: event.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectForbiddenError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });

        it('returns NOT_FOUND when the event does not exist', async () => {
            (modelMock.findById as Mock).mockResolvedValue(null);
            const result = await service.moderate({
                actor: moderator(),
                id: event.id,
                moderationState: ModerationStatusEnum.APPROVED
            });
            expectNotFoundError(result);
        });

        it('lets a trusted author approve their own pending event (HOS-1037)', async () => {
            const trustedAuthor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_UPDATE_OWN, PermissionEnum.EVENT_PUBLISH_OWN]
            });

            const result = await service.moderate({
                actor: trustedAuthor,
                id: event.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectSuccess(result);
            expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
        });

        it('refuses a trusted author trying to REJECT their own event — approve is the only author path', async () => {
            const trustedAuthor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_PUBLISH_OWN]
            });

            const result = await service.moderate({
                actor: trustedAuthor,
                id: event.id,
                moderationState: ModerationStatusEnum.REJECTED
            });

            // The actor owns the row, so the refusal stays 403 — it is about
            // the requested state, not existence (HOS-706 rule 3).
            expectForbiddenError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });

        it('refuses a trusted author trying to send their own event back to PENDING', async () => {
            const trustedAuthor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_PUBLISH_OWN]
            });

            const result = await service.moderate({
                actor: trustedAuthor,
                id: event.id,
                moderationState: ModerationStatusEnum.PENDING
            });

            expectForbiddenError(result);
        });

        it('refuses a plain author who holds authorship but not EVENT_PUBLISH_OWN', async () => {
            // The mixed case: authorship alone is not the grant.
            const plainAuthor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_UPDATE_OWN]
            });

            const result = await service.moderate({
                actor: plainAuthor,
                id: event.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectForbiddenError(result);
        });

        it('masks a trusted editor probing an event they did not author as NOT_FOUND, not FORBIDDEN', async () => {
            // The other mixed case: holding EVENT_PUBLISH_OWN is not enough
            // without authorship. HOS-706: a foreign-row refusal must never
            // confirm the id is real.
            const stranger = createActor({
                id: strangerId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_PUBLISH_OWN]
            });

            const result = await service.moderate({
                actor: stranger,
                id: event.id,
                moderationState: ModerationStatusEnum.APPROVED
            });

            expectNotFoundError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });
    });

    describe('setPublishState', () => {
        it('writes visibility and nothing else, leaving the verdict intact', async () => {
            const admin = createActor({
                id: strangerId,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.EVENT_PUBLISH_TOGGLE]
            });

            const result = await service.setPublishState({
                actor: admin,
                id: event.id,
                visibility: VisibilityEnum.PRIVATE
            });

            expectSuccess(result);
            expect(modelMock.update as Mock).toHaveBeenCalledWith(
                { id: event.id },
                { visibility: VisibilityEnum.PRIVATE },
                undefined
            );
            expect(result.data?.moderationState).toBe(ModerationStatusEnum.PENDING);
        });

        it('lets a trusted author unpublish their own event', async () => {
            const trustedAuthor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_PUBLISH_OWN]
            });

            const result = await service.setPublishState({
                actor: trustedAuthor,
                id: event.id,
                visibility: VisibilityEnum.PRIVATE
            });

            expectSuccess(result);
        });

        it('refuses a plain author who only holds EVENT_UPDATE_OWN', async () => {
            const author = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_UPDATE_OWN]
            });

            const result = await service.setPublishState({
                actor: author,
                id: event.id,
                visibility: VisibilityEnum.PUBLIC
            });

            expectForbiddenError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });

        it('refuses EVENT_PUBLISH_OWN on an event the actor did not author', async () => {
            const stranger = createActor({
                id: strangerId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_PUBLISH_OWN]
            });

            const result = await service.setPublishState({
                actor: stranger,
                id: event.id,
                visibility: VisibilityEnum.PUBLIC
            });

            expectForbiddenError(result);
        });
    });

    describe('setLifecycleState', () => {
        it('writes lifecycleState and nothing else', async () => {
            const admin = createActor({
                id: strangerId,
                roles: [RoleEnum.ADMIN],
                permissions: [PermissionEnum.EVENT_LIFECYCLE_CHANGE]
            });

            const result = await service.setLifecycleState({
                actor: admin,
                id: event.id,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });

            expectSuccess(result);
            expect(modelMock.update as Mock).toHaveBeenCalledWith(
                { id: event.id },
                { lifecycleState: LifecycleStatusEnum.ARCHIVED },
                undefined
            );
        });

        it('is refused to an actor holding EVENT_UPDATE but not EVENT_LIFECYCLE_CHANGE', async () => {
            const editor = createActor({
                id: authorId,
                roles: [RoleEnum.EDITOR],
                permissions: [PermissionEnum.EVENT_UPDATE]
            });

            const result = await service.setLifecycleState({
                actor: editor,
                id: event.id,
                lifecycleState: LifecycleStatusEnum.ARCHIVED
            });

            expectForbiddenError(result);
            expect(modelMock.update as Mock).not.toHaveBeenCalled();
        });
    });
});
