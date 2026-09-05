/**
 * @file local-media-placeholders.test.ts
 * @description Unit tests for the HOS-1144 CI cost guard: the mode flag, the
 * remote-URL predicate, the placeholder resolver, and `getMediaUrl`'s
 * behaviour with the mode both ON and OFF.
 *
 * Every case restores `HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS` to whatever the
 * process had before it ran, so no case can leak state into the next one.
 * Nothing here reads `process.env.CI`: the
 * guard is keyed on its own dedicated variable precisely so a `CI=true`
 * production build cannot switch it on, and a test that consulted `CI` would
 * quietly stop proving that.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMediaUrl } from '../get-media-url.js';
import {
    isLocalMediaPlaceholderMode,
    isRemoteMediaUrl,
    LOCAL_MEDIA_PLACEHOLDER,
    LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR,
    resolveLocalMediaPlaceholder
} from '../local-media-placeholders.js';

const CLOUDINARY_URL = 'https://res.cloudinary.com/hospeda/image/upload/v1/sample.jpg';

/** Value the variable had before this file started, restored after each case. */
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

describe('isLocalMediaPlaceholderMode', () => {
    it('is OFF when the variable is unset', () => {
        // Arrange
        setMode(undefined);

        // Act
        const result = isLocalMediaPlaceholderMode();

        // Assert
        expect(result).toBe(false);
    });

    it.each([
        'true',
        'TRUE',
        'True',
        '  true  ',
        '1'
    ])('is ON for the accepted value %o', (value) => {
        // Arrange
        setMode(value);

        // Act
        const result = isLocalMediaPlaceholderMode();

        // Assert
        expect(result).toBe(true);
    });

    it.each([
        'false',
        'FALSE',
        '0',
        '',
        '   ',
        'yes',
        'on',
        'placeholder'
    ])('is OFF for the non-accepted value %o', (value) => {
        // Arrange
        setMode(value);

        // Act
        const result = isLocalMediaPlaceholderMode();

        // Assert
        expect(result).toBe(false);
    });

    it('re-reads the environment on EVERY call, never memoising it', () => {
        // Arrange
        setMode('true');
        expect(isLocalMediaPlaceholderMode()).toBe(true);

        // Act — change the variable with no invalidation step of any kind.
        process.env[LOCAL_MEDIA_PLACEHOLDERS_ENV_VAR] = 'false';

        // Assert — the new value is observed immediately.
        //
        // This is not a style preference. A module-level memo made this module
        // wrong in practice: `packages/seed`'s vitest loads `@repo/media` twice
        // (tsconfig-paths for one import graph, the package `exports` field for
        // another), so each copy held its own cache and the copy that
        // `uploadSeedImage` used never saw the flag the test had set. Reading
        // the process-global on every call is what makes every copy agree.
        expect(isLocalMediaPlaceholderMode()).toBe(false);
    });
});

describe('isRemoteMediaUrl', () => {
    it.each([
        CLOUDINARY_URL,
        '//res.cloudinary.com/hospeda/image/upload/v1/sample.jpg',
        'https://images.unsplash.com/photo-abc',
        'http://images.pexels.com/photo.jpg',
        'https://i0.wp.com/example.com/a.png'
    ])('treats %o as remote', (url) => {
        expect(isRemoteMediaUrl(url)).toBe(true);
    });

    it.each([
        '/assets/images/placeholder.svg',
        'assets/images/placeholder.svg',
        '',
        '   ',
        'data:image/png;base64,AAAA',
        'blob:http://localhost:4321/abc',
        'http://localhost:4321/a.png',
        'https://127.0.0.1:18321/a.png',
        'http://[::1]:4321/a.png'
    ])('treats %o as NOT remote', (url) => {
        expect(isRemoteMediaUrl(url)).toBe(false);
    });
});

describe('resolveLocalMediaPlaceholder', () => {
    it('returns the module placeholder when no fallback is given', () => {
        expect(resolveLocalMediaPlaceholder()).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('honours a LOCAL caller fallback', () => {
        // Arrange
        const fallback = '/assets/images/placeholder-accommodation.svg';

        // Act
        const result = resolveLocalMediaPlaceholder({ fallback });

        // Assert
        expect(result).toBe(fallback);
    });

    it('discards a REMOTE caller fallback — swapping one remote fetch for another defeats the guard', () => {
        // Act
        const result = resolveLocalMediaPlaceholder({ fallback: CLOUDINARY_URL });

        // Assert
        expect(result).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('discards an empty or whitespace fallback', () => {
        expect(resolveLocalMediaPlaceholder({ fallback: '' })).toBe(LOCAL_MEDIA_PLACEHOLDER);
        expect(resolveLocalMediaPlaceholder({ fallback: '   ' })).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('names a placeholder path that contains the word "placeholder"', () => {
        // ~20 apps/web components gate `<Image>` optimisation on
        // `!url.includes('placeholder')`. Losing that substring would push the
        // local SVG back through `/_image`, which is the exact code path the
        // guard exists to avoid.
        expect(LOCAL_MEDIA_PLACEHOLDER).toContain('placeholder');
        expect(LOCAL_MEDIA_PLACEHOLDER.startsWith('/')).toBe(true);
    });
});

describe('getMediaUrl with the mode OFF (default)', () => {
    beforeEach(() => {
        setMode(undefined);
    });

    it('still transforms a Cloudinary URL through the preset', () => {
        // Act
        const result = getMediaUrl(CLOUDINARY_URL, { preset: 'card' });

        // Assert
        expect(result).toContain('/upload/w_400');
        expect(result).toContain('res.cloudinary.com');
    });

    it('still passes a non-Cloudinary remote URL through unchanged', () => {
        // Act
        const result = getMediaUrl('https://images.unsplash.com/photo-abc', { preset: 'card' });

        // Assert
        expect(result).toBe('https://images.unsplash.com/photo-abc');
    });
});

describe('getMediaUrl with the mode ON', () => {
    beforeEach(() => {
        setMode('true');
    });

    it('replaces a Cloudinary URL with the local placeholder', () => {
        // Act
        const result = getMediaUrl(CLOUDINARY_URL, { preset: 'card' });

        // Assert
        expect(result).toBe(LOCAL_MEDIA_PLACEHOLDER);
        expect(result).not.toContain('res.cloudinary.com');
    });

    it('replaces a Cloudinary URL that already carries a transform', () => {
        // Arrange — a pre-baked URL takes the `hasExistingTransform` early
        // return, which sits AFTER the guard; if the guard were ordered after
        // it instead, this URL would still be fetched.
        const baked =
            'https://res.cloudinary.com/hospeda/image/upload/w_800,q_auto,f_auto/v1/sample.jpg';

        // Act
        const result = getMediaUrl(baked, { preset: 'card' });

        // Assert
        expect(result).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('replaces a Cloudinary /image/fetch/ delivery URL', () => {
        // Arrange — another early return that precedes the transform logic.
        const fetchUrl = 'https://res.cloudinary.com/hospeda/image/fetch/https://x.test/a.jpg';

        // Act
        const result = getMediaUrl(fetchUrl, { preset: 'card' });

        // Assert
        expect(result).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('replaces NON-Cloudinary remote URLs too — the promise is zero outbound image requests', () => {
        expect(getMediaUrl('https://images.unsplash.com/photo-abc')).toBe(LOCAL_MEDIA_PLACEHOLDER);
        expect(getMediaUrl('https://images.pexels.com/photo.jpg')).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('honours a LOCAL options.fallback over the module placeholder', () => {
        // Arrange
        const fallback = '/assets/images/placeholder-destination.svg';

        // Act
        const result = getMediaUrl(CLOUDINARY_URL, { preset: 'card', fallback });

        // Assert
        expect(result).toBe(fallback);
    });

    it('ignores a REMOTE options.fallback', () => {
        // Act
        const result = getMediaUrl(CLOUDINARY_URL, {
            preset: 'card',
            fallback: 'https://images.unsplash.com/photo-abc'
        });

        // Assert
        expect(result).toBe(LOCAL_MEDIA_PLACEHOLDER);
    });

    it('leaves local and root-relative URLs untouched', () => {
        expect(getMediaUrl('/assets/images/hero.jpg')).toBe('/assets/images/hero.jpg');
        expect(getMediaUrl('http://localhost:4321/a.png')).toBe('http://localhost:4321/a.png');
    });

    it('still returns the module fallback for a nullish URL', () => {
        // Arrange / Act — the nullish branch runs BEFORE the guard and is
        // unchanged by it.
        const result = getMediaUrl(null);

        // Assert
        expect(result).toBe('/images/placeholder.svg');
    });
});
