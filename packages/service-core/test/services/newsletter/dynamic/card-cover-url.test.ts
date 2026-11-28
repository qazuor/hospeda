import { describe, expect, it } from 'vitest';
import { toCardCoverUrl } from '../../../../src/services/newsletter/dynamic/accommodation-card.loader.js';

describe('toCardCoverUrl', () => {
    it('crops a Cloudinary cover to the 4:3 card cell', () => {
        const url = 'https://res.cloudinary.com/demo/image/upload/v1/hospeda/cover.jpg';
        expect(toCardCoverUrl({ url })).toBe(
            'https://res.cloudinary.com/demo/image/upload/w_320,h_240,c_fill,g_auto,q_auto,f_auto/v1/hospeda/cover.jpg'
        );
    });

    it('passes a non-Cloudinary HTTPS cover through unchanged', () => {
        const url = 'https://images.example.com/cover.jpg';
        expect(toCardCoverUrl({ url })).toBe(url);
    });

    it.each([
        'http://res.cloudinary.com/demo/image/upload/v1/cover.jpg',
        'javascript:alert(1)',
        'not a url',
        ''
    ])('returns null for %s', (url) => {
        expect(toCardCoverUrl({ url })).toBeNull();
    });
});
