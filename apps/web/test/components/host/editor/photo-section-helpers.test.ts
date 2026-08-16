/**
 * @file photo-section-helpers.test.ts
 * @description Unit tests for the pure helpers behind PhotoSection.client.tsx
 * (HOS-122): file validation, cap-exceeded messaging, array reordering, and
 * media-row splitting.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { describe, expect, it, vi } from 'vitest';
import {
    buildCapExceededOnSelectMessage,
    buildReorderPayload,
    mediaRowToItem,
    moveArrayItem,
    splitMediaRows,
    validatePhotoFile
} from '@/components/host/editor/photo-section-helpers';

/** Minimal translator stub: returns the fallback with params interpolated. */
const t = vi.fn((_key: string, fallback?: string, params?: Record<string, unknown>) => {
    const raw = fallback ?? _key;
    if (!params) return raw;
    return Object.keys(params).reduce(
        (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
        raw
    );
});

describe('validatePhotoFile', () => {
    it('accepts a valid JPEG under the size cap', () => {
        const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
        expect(validatePhotoFile(file, t)).toBeNull();
    });

    it('rejects an unsupported MIME type', () => {
        const file = new File(['x'], 'photo.gif', { type: 'image/gif' });
        expect(validatePhotoFile(file, t)).toContain('JPG, PNG o WebP');
    });

    it('rejects a file over the size cap', () => {
        const bytes = mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB) + 1;
        const file = new File([new Uint8Array(new ArrayBuffer(bytes))], 'big.jpg', {
            type: 'image/jpeg'
        });
        const result = validatePhotoFile(file, t);
        expect(result).toContain(String(DEFAULT_ENTITY_MAX_FILE_SIZE_MB));
    });
});

describe('buildCapExceededOnSelectMessage', () => {
    it('interpolates selected count, remaining slots, and cap', () => {
        const message = buildCapExceededOnSelectMessage({
            selectedCount: 5,
            remainingSlots: 2,
            cap: 50,
            t
        });
        expect(message).toContain('5');
        expect(message).toContain('2');
        expect(message).toContain('50');
    });

    it('clamps a negative remaining-slots count to 0', () => {
        const message = buildCapExceededOnSelectMessage({
            selectedCount: 3,
            remainingSlots: -4,
            cap: 50,
            t
        });
        expect(message).not.toContain('-4');
        expect(message).toContain('0');
    });
});

describe('moveArrayItem', () => {
    it('moves an item from a lower index to a higher index', () => {
        expect(moveArrayItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    });

    it('moves an item from a higher index to a lower index', () => {
        expect(moveArrayItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    });

    it('is a no-op copy when the indexes are equal', () => {
        const input = ['a', 'b', 'c'] as const;
        expect(moveArrayItem(input, 1, 1)).toEqual(['a', 'b', 'c']);
    });

    it('is a no-op copy when an index is out of range', () => {
        const input = ['a', 'b', 'c'];
        expect(moveArrayItem(input, 0, 5)).toEqual(['a', 'b', 'c']);
        expect(moveArrayItem(input, -1, 1)).toEqual(['a', 'b', 'c']);
    });

    it('never mutates the input array', () => {
        const input = ['a', 'b', 'c'];
        moveArrayItem(input, 0, 2);
        expect(input).toEqual(['a', 'b', 'c']);
    });
});

describe('buildReorderPayload', () => {
    it('puts the featured id first, followed by the gallery ids in order', () => {
        expect(buildReorderPayload({ featuredId: 'f1', galleryIds: ['g1', 'g2'] })).toEqual([
            'f1',
            'g1',
            'g2'
        ]);
    });

    it('omits the featured id entirely when there is no portada', () => {
        expect(buildReorderPayload({ featuredId: null, galleryIds: ['g1', 'g2'] })).toEqual([
            'g1',
            'g2'
        ]);
    });
});

describe('mediaRowToItem / splitMediaRows', () => {
    const FEATURED_ROW = {
        id: 'f1',
        url: 'https://cdn.example.com/f1.jpg',
        publicId: 'gallery/f1',
        isFeatured: true,
        sortOrder: 0,
        state: 'visible' as const,
        moderationState: 'APPROVED'
    };
    const GALLERY_ROW = {
        id: 'g1',
        url: 'https://cdn.example.com/g1.jpg',
        publicId: 'gallery/g1',
        isFeatured: false,
        sortOrder: 1,
        state: 'visible' as const,
        moderationState: 'APPROVED'
    };

    it('maps a row to a display item, defaulting publicId to an empty string', () => {
        const item = mediaRowToItem({ ...GALLERY_ROW, publicId: undefined });
        expect(item.id).toBe('g1');
        expect(item.publicId).toBe('');
    });

    it('splits the featured row out and keeps the gallery order', () => {
        const { featured, gallery } = splitMediaRows([FEATURED_ROW, GALLERY_ROW]);
        expect(featured?.id).toBe('f1');
        expect(gallery.map((g) => g.id)).toEqual(['g1']);
    });

    it('returns a null featured slot when no row is featured', () => {
        const { featured, gallery } = splitMediaRows([GALLERY_ROW]);
        expect(featured).toBeNull();
        expect(gallery).toHaveLength(1);
    });
});
