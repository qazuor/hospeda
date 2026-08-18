/**
 * Unit tests for the photo-text PATCH builder (HOS-388).
 *
 * @module features/accommodations/utils/__tests__/gallery-photo-text
 */

import { describe, expect, it } from 'vitest';
import {
    buildPhotoTextPatch,
    isEmptyPatch,
    PHOTO_TEXT_FIELDS,
    toFormValues
} from '../gallery-photo-text';

const stored = {
    caption: 'Vista al mar',
    description: 'Una vista amplia desde el balcon',
    alt: 'Balcon con vista al mar'
};

describe('buildPhotoTextPatch', () => {
    it('sends nothing when nothing changed', () => {
        const patch = buildPhotoTextPatch({ stored, next: toFormValues(stored) });

        expect(patch).toEqual({});
        // The endpoint rejects an empty body as VALIDATION_ERROR, so the caller
        // has to skip the request rather than send `{}` and surface an error the
        // moderator did not cause.
        expect(isEmptyPatch(patch)).toBe(true);
    });

    it('sends only the field that changed', () => {
        const patch = buildPhotoTextPatch({
            stored,
            next: { ...toFormValues(stored), alt: 'Balcon al atardecer' }
        });

        expect(patch).toEqual({ alt: 'Balcon al atardecer' });
    });

    it('clears an emptied field with null, never an empty string', () => {
        // An empty string is a stored value: it reads as "this photo HAS an alt"
        // to anything checking presence while announcing nothing, and it
        // suppresses whatever fallback would otherwise apply.
        const patch = buildPhotoTextPatch({
            stored,
            next: { ...toFormValues(stored), alt: '' }
        });

        expect(patch).toEqual({ alt: null });
        expect(patch.alt).not.toBe('');
    });

    it('treats a whitespace-only field as cleared', () => {
        const patch = buildPhotoTextPatch({
            stored,
            next: { ...toFormValues(stored), caption: '   ' }
        });

        expect(patch).toEqual({ caption: null });
    });

    it('trims a value before sending it', () => {
        const patch = buildPhotoTextPatch({
            stored,
            next: { ...toFormValues(stored), caption: '  Nueva leyenda  ' }
        });

        expect(patch).toEqual({ caption: 'Nueva leyenda' });
    });

    it('does not resend a field whose only change is surrounding whitespace', () => {
        // Re-saving an untouched field would overwrite whatever another
        // moderator changed while this dialog was open.
        const patch = buildPhotoTextPatch({
            stored,
            next: { ...toFormValues(stored), caption: '  Vista al mar  ' }
        });

        expect(patch).toEqual({});
    });

    it('fills a field that was previously absent', () => {
        const patch = buildPhotoTextPatch({
            stored: { caption: null, description: null, alt: null },
            next: { caption: '', description: '', alt: 'Recien descripta' }
        });

        // The two that stay empty are not sent: they were already null.
        expect(patch).toEqual({ alt: 'Recien descripta' });
    });

    it('sends every field when all three changed', () => {
        const patch = buildPhotoTextPatch({
            stored,
            next: { caption: 'A', description: 'B', alt: 'C' }
        });

        expect(patch).toEqual({ caption: 'A', description: 'B', alt: 'C' });
        expect(Object.keys(patch)).toHaveLength(PHOTO_TEXT_FIELDS.length);
    });
});

describe('toFormValues', () => {
    it('turns nullish columns into empty strings a text input can hold', () => {
        expect(toFormValues({ caption: null, description: undefined, alt: 'x' })).toEqual({
            caption: '',
            description: '',
            alt: 'x'
        });
    });
});
