import { describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';

// Minimal mock for AccommodationService dependencies
const service = new AccommodationService();

describe('AccommodationService.generateSlug', () => {
    it('generates a basic slug when unique', async () => {
        const check = vi.fn().mockResolvedValue(false);
        const slug = await service.generateSlug('HOTEL', 'My Place', check);
        expect(slug).toBe('hotel-my-place');
        expect(check).toHaveBeenCalledWith('hotel-my-place');
    });

    it('appends -2 if slug exists once', async () => {
        const check = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const slug = await service.generateSlug('HOTEL', 'My Place', check);
        expect(slug).toBe('hotel-my-place-2');
        expect(check).toHaveBeenCalledTimes(2);
    });

    it('appends -3 if slug exists twice', async () => {
        const check = vi
            .fn()
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        const slug = await service.generateSlug('HOTEL', 'My Place', check);
        expect(slug).toBe('hotel-my-place-3');
        expect(check).toHaveBeenCalledTimes(3);
    });

    it('works with empty type', async () => {
        const check = vi.fn().mockResolvedValue(false);
        const slug = await service.generateSlug('', 'My Place', check);
        expect(slug).toBe('my-place');
    });

    it('works with empty name', async () => {
        const check = vi.fn().mockResolvedValue(false);
        const slug = await service.generateSlug('HOTEL', '', check);
        expect(slug).toBe('hotel');
    });

    it('throws if both type and name are empty', async () => {
        const check = vi.fn();
        await expect(service.generateSlug('', '', check)).rejects.toThrow();
    });

    it('does not increment if slug is unique', async () => {
        const check = vi.fn().mockResolvedValue(false);
        const slug = await service.generateSlug('CABIN', 'Unique', check);
        expect(slug).toBe('cabin-unique');
        expect(check).toHaveBeenCalledTimes(1);
    });
});
