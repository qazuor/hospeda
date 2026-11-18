import { describe, expect, it } from 'vitest';
import { readListingMedia } from '@/lib/listing/listing-editor-detail';
import { normalizeListingVideos } from '@/lib/listing/listing-videos';

describe('normalizeListingVideos (HOS-2258)', () => {
    it('keeps only APPROVED entries with a url, dropping the moderation state', () => {
        const result = normalizeListingVideos({
            raw: [
                { url: 'https://youtu.be/a', caption: 'Uno', moderationState: 'APPROVED' },
                { url: 'https://youtu.be/b', moderationState: 'PENDING' },
                { url: 'https://youtu.be/c', moderationState: 'REJECTED' },
                { url: '', moderationState: 'APPROVED' },
                'https://youtu.be/legacy',
                null
            ]
        });

        expect(result).toEqual([{ url: 'https://youtu.be/a', caption: 'Uno' }]);
    });

    it('tolerates anything that is not an array', () => {
        for (const raw of [undefined, null, 'x', 4, {}]) {
            expect(normalizeListingVideos({ raw })).toEqual([]);
        }
    });
});

describe('readListingMedia videos (HOS-2258)', () => {
    it('reads the stored videos of the owner detail, from the column or from media', () => {
        const fromColumn = readListingMedia({
            detail: {
                videos: [{ url: 'https://youtu.be/a', caption: 'Uno' }, { url: '' }]
            } as never
        });
        const fromMedia = readListingMedia({
            detail: { media: { videos: [{ url: 'https://youtu.be/b' }] } } as never
        });

        expect(fromColumn.videos).toEqual([{ url: 'https://youtu.be/a', caption: 'Uno' }]);
        expect(fromMedia.videos).toEqual([{ url: 'https://youtu.be/b' }]);
        expect(readListingMedia({ detail: {} as never }).videos).toEqual([]);
    });
});
