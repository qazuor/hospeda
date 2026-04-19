/**
 * Tests for SPEC-078-GAPS T-036 / GAP-078-139.
 *
 * Verifies that every route-level error code emitted by the media routes
 * has a corresponding non-empty translation in es / en / pt under the
 * `api.media.errors.{CODE}` key path. Codes are sourced from
 * `apps/api/src/routes/media/**` and kept in sync here.
 *
 * @module test/media-error-keys
 */
import { describe, expect, it } from 'vitest';
import { locales, trans } from '../src/config';

/**
 * Full list of route-level error codes used in
 * `apps/api/src/routes/media/admin/*` and `apps/api/src/routes/media/protected/*`.
 * Keep in sync with grep "code: '" apps/api/src/routes/media/.
 */
const MEDIA_ERROR_CODES = [
    'EMPTY_FILE',
    'GALLERY_LIMIT_EXCEEDED',
    'CLOUDINARY_NOT_CONFIGURED',
    'PAYLOAD_TOO_LARGE',
    'SESSION_STALE',
    'VALIDATION_ERROR',
    'ENTITY_NOT_FOUND',
    'FORBIDDEN',
    'UPSTREAM_ERROR',
    'UNPROCESSABLE_ENTITY',
    'INTERNAL_ERROR'
] as const;

describe('i18n media error keys (SPEC-078-GAPS T-036 / GAP-078-139)', () => {
    for (const locale of locales) {
        describe(`${locale} locale`, () => {
            for (const code of MEDIA_ERROR_CODES) {
                const key = `api.media.errors.${code}`;

                it(`should resolve ${key} to a non-empty string`, () => {
                    // Arrange
                    const value = trans[locale]?.[key];

                    // Assert
                    expect(value, `Missing key ${key} in locale ${locale}`).toBeTypeOf('string');
                    expect(value?.length, `Empty value for ${key} in ${locale}`).toBeGreaterThan(0);
                });
            }
        });
    }
});
