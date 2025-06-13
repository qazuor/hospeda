import { AccommodationModel } from '@repo/db';
import type { TagId } from '@repo/types';
import { describe, expect, it, type vi } from 'vitest';
import type { TagGetAccommodationsByTagInput } from '../../tag/tag.schemas';
import { TagService } from '../../tag/tag.service';
import { getMockAccommodation, getMockPublicUser } from '../factories';
import { getMockTagId } from '../factories/tagFactory';

const mockAccommodation = getMockAccommodation();
const mockTagId: TagId = getMockTagId();
const publicUser = getMockPublicUser();

describe('TagService.getAccommodationsByTag', () => {
    it('returns accommodations for a valid tag', async () => {
        // Arrange
        (AccommodationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockAccommodation
        ]);
        const input: TagGetAccommodationsByTagInput = { tagId: mockTagId };
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
        const input: TagGetAccommodationsByTagInput = { tagId: mockTagId };
        const result = await TagService.getAccommodationsByTag(input, publicUser);
        expect(result.accommodations).toEqual([]);
    });

    it('supports pagination and ordering', async () => {
        (AccommodationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockAccommodation
        ]);
        const input: TagGetAccommodationsByTagInput = {
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
            TagService.getAccommodationsByTag({ tagId: getMockTagId('') as TagId }, publicUser)
        ).rejects.toThrow();
    });

    it('allows public user (no permission required)', async () => {
        (AccommodationModel.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
            mockAccommodation
        ]);
        const input: TagGetAccommodationsByTagInput = { tagId: mockTagId };
        const result = await TagService.getAccommodationsByTag(input, publicUser);
        expect(result.accommodations).toHaveLength(1);
    });
});
