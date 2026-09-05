/**
 * @file media.local-placeholders.test.ts
 * @description Guard for the web half of the HOS-1144 CI cost guard.
 *
 * `getMediaUrl` is not the only way a remote image URL reaches the page.
 * `toRenderableImageUrl` carries the RAW value for five surfaces (the two
 * author-avatar components, the post detail page, the author page and the API
 * transform layer), and `buildImageEndpointUrl` assembles the `/_image?href=`
 * URL whose server-side fetch was the single most expensive path in the
 * incident. Both had to learn the mode, and this file is what proves they did.
 *
 * Each case restores `HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS` afterwards.
 * Nothing here consults `process.env.CI`: the guard
 * is keyed on its own variable precisely so a `CI=true` production build
 * cannot switch it on.
 */

import { LOCAL_MEDIA_PLACEHOLDER, LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR } from '@repo/media';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildImageEndpointUrl, toRenderableImageUrl } from '../../src/lib/media';

const CLOUDINARY_URL = 'https://res.cloudinary.com/hospeda/image/upload/v1/avatar.webp';

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

describe('toRenderableImageUrl with the mode OFF (default)', () => {
    beforeEach(() => {
        setMode(undefined);
    });

    it('returns the remote avatar URL trimmed and otherwise untouched', () => {
        // Act
        const result = toRenderableImageUrl(`  ${CLOUDINARY_URL}  `);

        // Assert
        expect(result).toBe(CLOUDINARY_URL);
    });

    it('still rejects a value the browser could not load', () => {
        expect(toRenderableImageUrl('avatars/x.jpg')).toBeUndefined();
        expect(toRenderableImageUrl('javascript:alert(1)')).toBeUndefined();
        expect(toRenderableImageUrl(null)).toBeUndefined();
    });
});

describe('toRenderableImageUrl with the mode ON', () => {
    beforeEach(() => {
        setMode('true');
    });

    it('replaces a remote avatar URL with the local placeholder', () => {
        // Act
        const result = toRenderableImageUrl(CLOUDINARY_URL);

        // Assert
        expect(result).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('replaces a protocol-relative remote URL', () => {
        expect(toRenderableImageUrl('//res.cloudinary.com/x/a.webp')).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('leaves a root-relative path alone', () => {
        expect(toRenderableImageUrl('/assets/images/avatar.png')).toBe('/assets/images/avatar.png');
    });

    it('leaves a localhost URL alone — it costs nothing and E2E fixtures rely on it', () => {
        expect(toRenderableImageUrl('http://localhost:3001/a.png')).toBe(
            'http://localhost:3001/a.png'
        );
    });

    it('still returns undefined for a non-renderable value — the mode must not resurrect junk', () => {
        expect(toRenderableImageUrl('avatars/x.jpg')).toBeUndefined();
        expect(toRenderableImageUrl('')).toBeUndefined();
        expect(toRenderableImageUrl(42)).toBeUndefined();
    });
});

describe('buildImageEndpointUrl with the mode OFF (default)', () => {
    beforeEach(() => {
        setMode(undefined);
    });

    it('builds the /_image endpoint URL with every transform param', () => {
        // Act
        const result = buildImageEndpointUrl({
            src: CLOUDINARY_URL,
            width: 300,
            format: 'webp'
        });

        // Assert
        expect(result.startsWith('/_image/?')).toBe(true);
        expect(result).toContain('w=300');
        expect(result).toContain('f=webp');
        expect(decodeURIComponent(result)).toContain(CLOUDINARY_URL);
    });
});

describe('buildImageEndpointUrl with the mode ON', () => {
    beforeEach(() => {
        setMode('true');
    });

    it('short-circuits to the local placeholder instead of the /_image endpoint', () => {
        // Act — `/_image?href=<remote>` is the server-side fetch that produced
        // 98.5% of the incident's bandwidth. It must not even be assembled.
        const result = buildImageEndpointUrl({
            src: CLOUDINARY_URL,
            width: 300,
            format: 'webp'
        });

        // Assert
        expect(result).toBe(LOCAL_MEDIA_PLACEHOLDER);
        expect(result).not.toContain('_image');
        expect(result).not.toContain('res.cloudinary.com');
    });

    it('still routes a LOCAL source through /_image — nothing is fetched off-origin', () => {
        // Act
        const result = buildImageEndpointUrl({ src: '/assets/images/hero.jpg', width: 300 });

        // Assert
        expect(result.startsWith('/_image/?')).toBe(true);
        expect(result).toContain('w=300');
    });
});
