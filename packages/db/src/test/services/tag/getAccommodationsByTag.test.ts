import type { TagId } from '@repo/types/common/id.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../../src/models/accommodation/accommodation.model';
import type { GetAccommodationsByTagInput } from '../../../../src/services/tag/tag.schemas';
import { TagService } from '../../../../src/services/tag/tag.service';
import { getMockAccommodation, getMockPublicUser, getMockTagId } from '../../mockData';

vi.mock('../../../../src/models/accommodation/accommodation.model');

const mockAccommodation = getMockAccommodation();
const mockTagId: TagId = getMockTagId();
const publicUser = getMockPublicUser();

describe('TagService.getAccommodationsByTag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns accommodations for a valid tag', async () => {
        // Arrange
        (AccommodationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockAccommodation
        ]);
        const input: GetAccommodationsByTagInput = { tagId: mockTagId };
        // Act
        const result = await TagService.getAccommodationsByTag(input, publicUser);
        // Assert
        expect(result.accommodations).toHaveLength(1);
        expect(result.accommodations[0]).toEqual(mockAccommodation);
        expect(AccommodationModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ tagId: mockTagId })
        );
    });

    it('returns empty array if no accommodations for tag', async () => {
        (AccommodationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            []
        );
        const input: GetAccommodationsByTagInput = { tagId: mockTagId };
        const result = await TagService.getAccommodationsByTag(input, publicUser);
        expect(result.accommodations).toEqual([]);
    });

    it('supports pagination and ordering', async () => {
        (AccommodationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockAccommodation
        ]);
        const input: GetAccommodationsByTagInput = {
            tagId: mockTagId,
            limit: 1,
            offset: 0,
            order: 'desc',
            orderBy: 'name'
        };
        await TagService.getAccommodationsByTag(input, publicUser);
        expect(AccommodationModel.search).toHaveBeenCalledWith(
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
            TagService.getAccommodationsByTag({ tagId: '' as TagId }, publicUser)
        ).rejects.toThrow();
    });

    it('allows public user (no permission required)', async () => {
        (AccommodationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockAccommodation
        ]);
        const input: GetAccommodationsByTagInput = { tagId: mockTagId };
        const result = await TagService.getAccommodationsByTag(input, publicUser);
        expect(result.accommodations).toHaveLength(1);
    });
});
