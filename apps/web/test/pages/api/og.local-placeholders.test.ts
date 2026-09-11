// @vitest-environment node
//
// Separate from `og.test.ts` on purpose: that file calls the real `GET`, which
// downloads its fonts at runtime and therefore skips itself whenever CI has no
// egress. The branch under test here is the one that stops satori from
// fetching a Cloudinary photo server-side, and it has to be provable offline.

/**
 * @file og.local-placeholders.test.ts
 * @description Guard for the fourth interception point of the HOS-1144 CI cost
 * guard: `/api/og`.
 *
 * `parseOgParams` derives the card mode from the presence of an `image` param,
 * and satori fetches whatever `src` it is handed — from the Node process, with
 * no `<img>` tag and no browser request to audit. Dropping a remote `image`
 * makes the card fall back to BRAND mode, whose logo and hero images are
 * base64 data URIs read from local disk, so nothing is fetched at all.
 */

import { LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR } from '@repo/media';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stripRemoteOgImage } from '../../../src/pages/api/og';

const CLOUDINARY_URL = 'https://res.cloudinary.com/hospeda/image/upload/v1/cover.jpg';

let originalValue: string | undefined;

/**
 * Sets (or clears) the mode variable. The helper reads the environment on every
 * call, so there is no cache to invalidate.
 *
 * @param value - Raw string to set, or `undefined` to delete the variable.
 */
function setMode(value: string | undefined): void {
    if (value === undefined) {
        delete process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR];
    } else {
        process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR] = value;
    }
}

beforeEach(() => {
    originalValue = process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR];
});

afterEach(() => {
    setMode(originalValue);
});

describe('stripRemoteOgImage with the mode OFF (default)', () => {
    beforeEach(() => {
        setMode(undefined);
    });

    it('keeps a remote image param, so the card still renders in photo mode', () => {
        // Arrange
        const params = new URLSearchParams({ title: 'Casa', image: CLOUDINARY_URL });

        // Act
        const result = stripRemoteOgImage(params);

        // Assert
        expect(result.get('image')).toBe(CLOUDINARY_URL);
    });
});

describe('stripRemoteOgImage with the mode ON', () => {
    beforeEach(() => {
        setMode('true');
    });

    it('drops a remote image param — satori must not fetch it server-side', () => {
        // Arrange
        const params = new URLSearchParams({ title: 'Casa', image: CLOUDINARY_URL });

        // Act
        const result = stripRemoteOgImage(params);

        // Assert
        expect(result.get('image')).toBeNull();
    });

    it('leaves every OTHER param untouched — only the fetchable one goes', () => {
        // Arrange
        const params = new URLSearchParams({
            title: 'Casa',
            type: 'Alojamiento',
            rating: '4.8',
            image: CLOUDINARY_URL
        });

        // Act
        const result = stripRemoteOgImage(params);

        // Assert
        expect(result.get('title')).toBe('Casa');
        expect(result.get('type')).toBe('Alojamiento');
        expect(result.get('rating')).toBe('4.8');
    });

    it('does NOT mutate the caller-supplied params — they belong to the request', () => {
        // Arrange
        const params = new URLSearchParams({ title: 'Casa', image: CLOUDINARY_URL });

        // Act
        stripRemoteOgImage(params);

        // Assert
        expect(params.get('image')).toBe(CLOUDINARY_URL);
    });

    it('keeps a LOCAL image param — it costs nothing to render', () => {
        // Arrange
        const params = new URLSearchParams({
            title: 'Casa',
            image: '/assets/images/placeholder.svg'
        });

        // Act
        const result = stripRemoteOgImage(params);

        // Assert
        expect(result.get('image')).toBe('/assets/images/placeholder.svg');
    });

    it('returns the params unchanged when there is no image at all', () => {
        // Arrange
        const params = new URLSearchParams({ title: 'Inicio' });

        // Act
        const result = stripRemoteOgImage(params);

        // Assert
        expect(result.get('image')).toBeNull();
        expect(result.get('title')).toBe('Inicio');
    });
});
