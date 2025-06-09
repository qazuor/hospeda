import type { TagId } from '@repo/types/common/id.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventModel } from '../../../../src/models/event/event.model';
import type { GetEventsByTagInput } from '../../../../src/services/tag/tag.schemas';
import { TagService } from '../../../../src/services/tag/tag.service';
import { getMockEvent, getMockPublicUser, getMockTagId } from '../../mockData';

vi.mock('../../../../src/models/event/event.model');

const mockEvent = getMockEvent();
const mockTagId: TagId = getMockTagId();
const publicUser = getMockPublicUser();

describe('TagService.getEventsByTag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns events for a valid tag', async () => {
        (EventModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockEvent
        ]);
        const input: GetEventsByTagInput = { tagId: mockTagId };
        const result = await TagService.getEventsByTag(input, publicUser);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toEqual(mockEvent);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ tagId: mockTagId })
        );
    });

    it('returns empty array if no events for tag', async () => {
        (EventModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
        const input: GetEventsByTagInput = { tagId: mockTagId };
        const result = await TagService.getEventsByTag(input, publicUser);
        expect(result.events).toEqual([]);
    });

    it('supports pagination and ordering', async () => {
        (EventModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockEvent
        ]);
        const input: GetEventsByTagInput = {
            tagId: mockTagId,
            limit: 1,
            offset: 0,
            order: 'desc',
            orderBy: 'summary'
        };
        await TagService.getEventsByTag(input, publicUser);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({
                tagId: mockTagId,
                limit: 1,
                offset: 0,
                order: 'desc',
                orderBy: 'summary'
            })
        );
    });

    it('throws on invalid input (Zod)', async () => {
        await expect(
            TagService.getEventsByTag({ tagId: '' as TagId }, publicUser)
        ).rejects.toThrow();
    });

    it('allows public user (no permission required)', async () => {
        (EventModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockEvent
        ]);
        const input: GetEventsByTagInput = { tagId: mockTagId };
        const result = await TagService.getEventsByTag(input, publicUser);
        expect(result.events).toHaveLength(1);
    });
});
