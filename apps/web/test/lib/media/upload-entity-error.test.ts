/**
 * @file upload-entity-error.test.ts
 * @description HOS-1218 — the typed `upload-entity` failure resolves to
 * localized copy in es/en/pt, interpolates the gallery limit, and never leaks
 * the API's English message or a raw key.
 */

import { describe, expect, it } from 'vitest';
import { createTranslations } from '../../../src/lib/i18n';
import {
    buildUploadEntityError,
    describeUploadEntityError,
    UploadEntityError
} from '../../../src/lib/media/upload-entity-error';

const ENGLISH_MESSAGES = [
    'Media upload service is not configured',
    'Internal server error',
    'Session expired or revoked. Please re-authenticate.',
    'Invalid multipart form data',
    'Invalid form fields',
    'Unsupported entity type: widget',
    'Gallery limit of 50 items reached for this entity',
    'Missing required "file" field',
    'Uploaded file is empty'
] as const;

const PAYLOADS = [
    { code: 'CLOUDINARY_NOT_CONFIGURED', message: ENGLISH_MESSAGES[0] },
    { code: 'INTERNAL_ERROR', message: ENGLISH_MESSAGES[1] },
    { code: 'SESSION_STALE', message: ENGLISH_MESSAGES[2] },
    { code: 'VALIDATION_ERROR', reason: 'INVALID_MULTIPART_DATA', message: ENGLISH_MESSAGES[3] },
    { code: 'VALIDATION_ERROR', reason: 'INVALID_FORM_FIELDS', message: ENGLISH_MESSAGES[4] },
    { code: 'VALIDATION_ERROR', reason: 'UNSUPPORTED_ENTITY_TYPE', message: ENGLISH_MESSAGES[5] },
    {
        code: 'GALLERY_LIMIT_EXCEEDED',
        message: ENGLISH_MESSAGES[6],
        details: { limit: 50, currentCount: 50 }
    },
    { code: 'VALIDATION_ERROR', reason: 'MISSING_FILE', message: ENGLISH_MESSAGES[7] },
    { code: 'EMPTY_FILE', message: ENGLISH_MESSAGES[8] }
] as const;

describe('describeUploadEntityError (HOS-1218)', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
        it(`resolves all nine API messages in ${locale} without English leaks or raw keys`, () => {
            const { t } = createTranslations(locale);
            const seen = new Set<string>();

            for (const payload of PAYLOADS) {
                const err = buildUploadEntityError({ body: { error: payload }, status: 400 });
                const text = describeUploadEntityError({ err, t, fallback: 'FALLBACK' });

                expect(text).not.toBe('FALLBACK');
                expect(text).not.toContain('common.apiError');
                expect(text).not.toContain('MISSING');
                expect(text).not.toContain('{{');
                if (locale !== 'en') expect(text).not.toBe(payload.message);
                seen.add(text);
            }

            // Nine messages, nine distinct sentences: no two collapsed to one.
            expect(seen.size).toBe(9);
        });
    }

    it('interpolates the gallery limit from details', () => {
        const { t } = createTranslations('es');
        const err = buildUploadEntityError({
            body: { error: PAYLOADS[6] },
            status: 422
        });

        expect(describeUploadEntityError({ err, t, fallback: 'x' })).toBe(
            'Llegaste al límite de 50 fotos de la galería.'
        );
    });

    it('degrades an unmapped code to the localized fallback, not the English message', () => {
        const { t } = createTranslations('es');
        const err = new UploadEntityError({ message: 'Something English', code: 'NOPE_CODE' });

        expect(describeUploadEntityError({ err, t, fallback: 'Error al subir la imagen' })).toBe(
            'Error al subir la imagen'
        );
    });

    it('keeps a plain Error message and falls back for a non-Error', () => {
        const { t } = createTranslations('es');

        expect(describeUploadEntityError({ err: new Error('boom'), t, fallback: 'fb' })).toBe(
            'boom'
        );
        expect(describeUploadEntityError({ err: 'str', t, fallback: 'fb' })).toBe('fb');
    });

    it('answers GENERIC when the response had no error body at all', () => {
        const err = buildUploadEntityError({ body: null, status: 502 });

        expect(err.code).toBe('GENERIC');
        expect(err.message).toBe('Upload failed');
    });
});
