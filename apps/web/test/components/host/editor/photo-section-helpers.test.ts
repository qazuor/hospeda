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

/**
 * Count-aware stub. Returns the resolved KEY rather than copy, so an assertion
 * can tell `_one` from `_other` — a stub returning prose would pass whichever
 * branch was taken.
 */
const tPlural = vi.fn((key: string, count: number, params?: Record<string, unknown>) => {
    const suffixed = `${key}${count === 1 ? '_one' : '_other'}`;
    if (!params) return suffixed;
    return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
        `${suffixed}:${String(params.count ?? count)}`
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
            t,
            tPlural
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
            t,
            tPlural
        });
        expect(message).not.toContain('-4');
        expect(message).toContain('0');
    });

    it('inflects each count independently', () => {
        // Both counts appear in one sentence, so the singular and the plural
        // must be able to show up together. A single shared `_one`/`_other`
        // pair cannot express that, which is why the message composes two —
        // and this is the case that proves it.
        const message = buildCapExceededOnSelectMessage({
            selectedCount: 1,
            remainingSlots: 3,
            cap: 50,
            t,
            tPlural
        });
        expect(message).toContain('galleryCapExceededOnSelectPicked_one');
        expect(message).toContain('galleryCapExceededOnSelectRemaining_other');
        expect(message).not.toContain('Picked_other');
        expect(message).not.toContain('Remaining_one');
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

/**
 * The five form fields the metadata panel edits, all blank. Spread it and
 * override only what a case is actually about.
 */
const BLANK_VALUES = {
    alt: '',
    caption: '',
    description: '',
    photographer: '',
    creditUrl: ''
} as const;

describe('validatePhotoMetadataFields', () => {
    it('returns no errors for empty fields — clearing is always valid', () => {
        const errors = validatePhotoMetadataFields(BLANK_VALUES, t);
        expect(errors).toEqual({});
    });

    it('returns no errors for values within bounds', () => {
        const errors = validatePhotoMetadataFields(
            {
                ...BLANK_VALUES,
                alt: 'Living con sofá',
                caption: 'Vista al jardín',
                description: 'x'.repeat(10)
            },
            t
        );
        expect(errors).toEqual({});
    });

    it('rejects an alt over 200 characters', () => {
        const errors = validatePhotoMetadataFields({ ...BLANK_VALUES, alt: 'x'.repeat(201) }, t);
        expect(errors.alt).toContain('200');
    });

    it('rejects a NON-EMPTY caption under 3 characters, but allows an empty one', () => {
        const tooShort = validatePhotoMetadataFields({ ...BLANK_VALUES, caption: 'ab' }, t);
        expect(tooShort.caption).toContain('3');

        const empty = validatePhotoMetadataFields(BLANK_VALUES, t);
        expect(empty.caption).toBeUndefined();
    });

    it('rejects a caption over 100 characters', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, caption: 'x'.repeat(101) },
            t
        );
        expect(errors.caption).toContain('100');
    });

    it('rejects a NON-EMPTY description under 10 characters, but allows an empty one', () => {
        const tooShort = validatePhotoMetadataFields({ ...BLANK_VALUES, description: 'corta' }, t);
        expect(tooShort.description).toContain('10');

        const empty = validatePhotoMetadataFields(BLANK_VALUES, t);
        expect(empty.description).toBeUndefined();
    });

    it('rejects a description over 300 characters', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, description: 'x'.repeat(301) },
            t
        );
        expect(errors.description).toContain('300');
    });

    it('treats whitespace-only input the same as empty (trims before checking)', () => {
        const errors = validatePhotoMetadataFields(
            { alt: '   ', caption: '   ', description: '   ', photographer: '  ', creditUrl: ' ' },
            t
        );
        expect(errors).toEqual({});
    });
});

describe('buildPhotoMetadataUpdateBody', () => {
    it('passes non-empty values through unchanged (after trim)', () => {
        const body = buildPhotoMetadataUpdateBody({
            ...BLANK_VALUES,
            alt: '  Living con sofá  ',
            caption: 'Vista al jardín',
            description: 'Una descripción bien larga'
        });
        expect(body).toEqual({
            alt: 'Living con sofá',
            caption: 'Vista al jardín',
            description: 'Una descripción bien larga',
            attribution: null
        });
    });

    it('maps an empty field to null, never an empty string', () => {
        const body = buildPhotoMetadataUpdateBody(BLANK_VALUES);
        expect(body).toEqual({
            alt: null,
            caption: null,
            description: null,
            attribution: null
        });
        expect(body.alt).not.toBe('');
        expect(body.caption).not.toBe('');
        expect(body.description).not.toBe('');
    });

    it('maps a whitespace-only field to null', () => {
        const body = buildPhotoMetadataUpdateBody({
            alt: '   ',
            caption: '\t',
            description: '  ',
            photographer: ' ',
            creditUrl: '\t'
        });
        expect(body).toEqual({
            alt: null,
            caption: null,
            description: null,
            attribution: null
        });
    });
});

// ----------------------------------------------------------------------------
// Photo credit (H-125, attribution half)
// ----------------------------------------------------------------------------

describe('photo credit validation', () => {
    it('accepts a credit with a name and no link — both fields are optional', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, photographer: 'Estudio Paraná' },
            t
        );
        expect(errors).toEqual({});
    });

    it('rejects a photographer over 200 characters', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, photographer: 'x'.repeat(201) },
            t
        );
        expect(errors.photographer).toContain('200');
    });

    it('rejects a credit link that is not http or https', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, photographer: 'Mallory', creditUrl: 'javascript:alert(1)' },
            t
        );
        expect(errors.creditUrl).toBeDefined();
    });

    it('rejects a link typed without a scheme, rather than guessing one', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, photographer: 'Ana', creditUrl: 'estudioparana.com.ar' },
            t
        );
        expect(errors.creditUrl).toBeDefined();
    });

    it('accepts an https link', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, photographer: 'Ana', creditUrl: 'https://estudioparana.com.ar' },
            t
        );
        expect(errors).toEqual({});
    });

    it('flags a link left without a name — there would be nobody to credit', () => {
        const errors = validatePhotoMetadataFields(
            { ...BLANK_VALUES, creditUrl: 'https://estudioparana.com.ar' },
            t
        );
        expect(errors.photographer).toBeDefined();
    });
});

describe('buildPhotoMetadataUpdateBody — credit', () => {
    it('builds the attribution object from the two fields', () => {
        const body = buildPhotoMetadataUpdateBody({
            ...BLANK_VALUES,
            alt: 'Galería al río',
            photographer: '  Estudio Paraná  ',
            creditUrl: ' https://estudioparana.com.ar '
        });

        expect(body.attribution).toEqual({
            photographer: 'Estudio Paraná',
            sourceUrl: 'https://estudioparana.com.ar',
            provider: 'user-upload'
        });
    });

    it('omits the link when the host left it blank', () => {
        const body = buildPhotoMetadataUpdateBody({
            ...BLANK_VALUES,
            photographer: 'Ana Gómez'
        });

        expect(body.attribution).toEqual({
            photographer: 'Ana Gómez',
            provider: 'user-upload'
        });
    });

    it('clears the whole credit when the name is emptied', () => {
        const body = buildPhotoMetadataUpdateBody(
            { ...BLANK_VALUES, creditUrl: 'https://estudioparana.com.ar' },
            { photographer: 'Estudio Paraná', provider: 'user-upload' }
        );

        // A link with nobody attached credits no one — clearing the name
        // clears the credit, it does not leave a dangling URL behind.
        expect(body.attribution).toBeNull();
    });

    it('preserves the licence and provider of a stock import the host re-credits', () => {
        const body = buildPhotoMetadataUpdateBody(
            { ...BLANK_VALUES, photographer: 'John Doe (corregido)' },
            {
                photographer: 'John Doe',
                sourceUrl: 'https://unsplash.com/@johndoe',
                license: 'Unsplash License',
                provider: 'unsplash'
            }
        );

        // Overwriting provider with 'user-upload' would strip the provenance
        // Unsplash's API terms require us to keep displaying.
        expect(body.attribution).toEqual({
            photographer: 'John Doe (corregido)',
            license: 'Unsplash License',
            provider: 'unsplash'
        });
    });
});

describe('mediaRowToItem — credit', () => {
    it('carries the credit through so the panel can reopen on current values', () => {
        const item = mediaRowToItem({
            id: 'g1',
            url: 'https://cdn.example.com/g1.jpg',
            publicId: 'gallery/g1',
            isFeatured: false,
            sortOrder: 1,
            state: 'visible' as const,
            moderationState: 'APPROVED',
            attribution: { photographer: 'Ana Gómez', provider: 'user-upload' as const }
        });

        expect(item.attribution?.photographer).toBe('Ana Gómez');
    });
});
