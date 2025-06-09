import type { TagId } from '@repo/types/common/id.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../../src/models/destination/destination.model';
import type { GetDestinationsByTagInput } from '../../../../src/services/tag/tag.schemas';
import { TagService } from '../../../../src/services/tag/tag.service';
import { getMockDestination, getMockPublicUser, getMockTagId } from '../../mockData';

vi.mock('../../../../src/models/destination/destination.model');

const mockDestination = getMockDestination();
const mockTagId: TagId = getMockTagId();
const publicUser = getMockPublicUser();

describe('TagService.getDestinationsByTag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns destinations for a valid tag', async () => {
        (DestinationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockDestination
        ]);
        const input: GetDestinationsByTagInput = { tagId: mockTagId };
        const result = await TagService.getDestinationsByTag(input, publicUser);
        expect(result.destinations).toHaveLength(1);
        expect(result.destinations[0]).toEqual(mockDestination);
        expect(DestinationModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ tagId: mockTagId })
        );
    });

    it('returns empty array if no destinations for tag', async () => {
        (DestinationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
        const input: GetDestinationsByTagInput = { tagId: mockTagId };
        const result = await TagService.getDestinationsByTag(input, publicUser);
        expect(result.destinations).toEqual([]);
    });

    it('supports pagination and ordering', async () => {
        (DestinationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockDestination
        ]);
        const input: GetDestinationsByTagInput = {
            tagId: mockTagId,
            limit: 1,
            offset: 0,
            order: 'desc',
            orderBy: 'name'
        };
        await TagService.getDestinationsByTag(input, publicUser);
        expect(DestinationModel.search).toHaveBeenCalledWith(
            expect.objectContaining({
                tagId: mockTagId,
                limit: 1,
                offset: 0,
                order: 'desc',
                orderBy: 'name'
            })
        );
    });

    it('throws on invalid input (Zod)', async () => {
        await expect(
            TagService.getDestinationsByTag({ tagId: '' as TagId }, publicUser)
        ).rejects.toThrow();
    });

    it('allows public user (no permission required)', async () => {
        (DestinationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockDestination
        ]);
        const input: GetDestinationsByTagInput = { tagId: mockTagId };
        const result = await TagService.getDestinationsByTag(input, publicUser);
        expect(result.destinations).toHaveLength(1);
    });
});
