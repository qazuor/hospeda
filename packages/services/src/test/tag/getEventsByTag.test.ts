import { EventModel } from '@repo/db';
import type { TagId } from '@repo/types';
import { describe, expect, it, type vi } from 'vitest';
import type { TagGetEventsByTagInput } from '../../tag/tag.schemas';
import { TagService } from '../../tag/tag.service';
import { getMockEvent, getMockPublicUser } from '../factories';
import { getMockTagId } from '../factories/tagFactory';

const mockEvent = getMockEvent();
const mockTagId: TagId = getMockTagId();
const publicUser = getMockPublicUser();

describe('TagService.getEventsByTag', () => {
    it('returns events for a valid tag', async () => {
        (EventModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockEvent
        ]);
        const input: TagGetEventsByTagInput = { tagId: mockTagId };
        const result = await TagService.getEventsByTag(input, publicUser);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toEqual(mockEvent);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ tagId: mockTagId })
        );
    });

    it('returns empty array if no events for tag', async () => {
        (EventModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
        const input: TagGetEventsByTagInput = { tagId: mockTagId };
        const result = await TagService.getEventsByTag(input, publicUser);
        expect(result.events).toEqual([]);
    });

    it('supports pagination and ordering', async () => {
        (EventModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockEvent
        ]);
        const input: TagGetEventsByTagInput = {
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
        const input: TagGetEventsByTagInput = { tagId: mockTagId };
        const result = await TagService.getEventsByTag(input, publicUser);
        expect(result.events).toHaveLength(1);
    });
});
