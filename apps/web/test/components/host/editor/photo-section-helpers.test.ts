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
    buildPhotoMetadataUpdateBody,
    buildReorderPayload,
    mediaRowToItem,
    moveArrayItem,
    splitMediaRows,
    validatePhotoFile,
    validatePhotoMetadataFields
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

    it('carries the description field through the mapping (HOS-125)', () => {
        const item = mediaRowToItem({ ...GALLERY_ROW, description: 'una descripción larga' });
        expect(item.description).toBe('una descripción larga');
    });
});

// ----------------------------------------------------------------------------
// Photo text-metadata editing (HOS-125)
// ----------------------------------------------------------------------------

describe('validatePhotoMetadataFields', () => {
    it('returns no errors for empty fields — clearing is always valid', () => {
        const errors = validatePhotoMetadataFields({ alt: '', caption: '', description: '' }, t);
        expect(errors).toEqual({});
    });

    it('returns no errors for values within bounds', () => {
        const errors = validatePhotoMetadataFields(
            { alt: 'Living con sofá', caption: 'Vista al jardín', description: 'x'.repeat(10) },
            t
        );
        expect(errors).toEqual({});
    });

    it('rejects an alt over 200 characters', () => {
        const errors = validatePhotoMetadataFields(
            { alt: 'x'.repeat(201), caption: '', description: '' },
            t
        );
        expect(errors.alt).toContain('200');
    });

    it('rejects a NON-EMPTY caption under 3 characters, but allows an empty one', () => {
        const tooShort = validatePhotoMetadataFields(
            { alt: '', caption: 'ab', description: '' },
            t
        );
        expect(tooShort.caption).toContain('3');

        const empty = validatePhotoMetadataFields({ alt: '', caption: '', description: '' }, t);
        expect(empty.caption).toBeUndefined();
    });

    it('rejects a caption over 100 characters', () => {
        const errors = validatePhotoMetadataFields(
            { alt: '', caption: 'x'.repeat(101), description: '' },
            t
        );
        expect(errors.caption).toContain('100');
    });

    it('rejects a NON-EMPTY description under 10 characters, but allows an empty one', () => {
        const tooShort = validatePhotoMetadataFields(
            { alt: '', caption: '', description: 'corta' },
            t
        );
        expect(tooShort.description).toContain('10');

        const empty = validatePhotoMetadataFields({ alt: '', caption: '', description: '' }, t);
        expect(empty.description).toBeUndefined();
    });

    it('rejects a description over 300 characters', () => {
        const errors = validatePhotoMetadataFields(
            { alt: '', caption: '', description: 'x'.repeat(301) },
            t
        );
        expect(errors.description).toContain('300');
    });

    it('treats whitespace-only input the same as empty (trims before checking)', () => {
        const errors = validatePhotoMetadataFields(
            { alt: '   ', caption: '   ', description: '   ' },
            t
        );
        expect(errors).toEqual({});
    });
});

describe('buildPhotoMetadataUpdateBody', () => {
    it('passes non-empty values through unchanged (after trim)', () => {
        const body = buildPhotoMetadataUpdateBody({
            alt: '  Living con sofá  ',
            caption: 'Vista al jardín',
            description: 'Una descripción bien larga'
        });
        expect(body).toEqual({
            alt: 'Living con sofá',
            caption: 'Vista al jardín',
            description: 'Una descripción bien larga'
        });
    });

    it('maps an empty field to null, never an empty string', () => {
        const body = buildPhotoMetadataUpdateBody({ alt: '', caption: '', description: '' });
        expect(body).toEqual({ alt: null, caption: null, description: null });
        expect(body.alt).not.toBe('');
        expect(body.caption).not.toBe('');
        expect(body.description).not.toBe('');
    });

    it('maps a whitespace-only field to null', () => {
        const body = buildPhotoMetadataUpdateBody({
            alt: '   ',
            caption: '\t',
            description: '  '
        });
        expect(body).toEqual({ alt: null, caption: null, description: null });
    });
});
