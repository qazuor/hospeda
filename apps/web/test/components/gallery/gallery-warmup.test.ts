/**
 * @file gallery-warmup.test.ts
 * @description Background lightbox warm-up (owner request, HOS-2520): after `load`
 * and idle, the full-size URLs of the first photos (never more than 3 before any
 * interaction) and the strip thumbnails are fetched at low priority. Data saver and
 * 2G connections skip all of it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildLightboxThumbUrl,
    buildLightboxUrl
} from '@/components/gallery/gallery-image-sources';

type PreloadModule = typeof import('@/components/gallery/gallery-preload');

/** Fresh module per test: the warmed-URL sets are document-wide on purpose. */
let preload: PreloadModule;

beforeEach(async () => {
    vi.resetModules();
    preload = await import('@/components/gallery/gallery-preload');
});

const URLS = Array.from(
    { length: 8 },
    (_, index) => `https://res.cloudinary.com/test/image/upload/photo-${index}.jpg`
);
const FULL = URLS.map((url) => buildLightboxUrl({ url }).src);
const THUMBS = URLS.map((url) => buildLightboxThumbUrl({ url }).src);

function navWith(connection?: { saveData?: boolean; effectiveType?: string }): Navigator {
    return { connection } as unknown as Navigator;
}

interface FakeImage {
    src: string;
    decoding: string;
    fetchPriority: string;
}

/** A loaded, idle-ready window whose `Image` factory records every request. */
function fakeWarmup(connection?: { saveData?: boolean; effectiveType?: string }) {
    const created: FakeImage[] = [];
    const win = {
        document: { readyState: 'complete' },
        navigator: navWith(connection),
        requestIdleCallback: (callback: () => void) => {
            callback();
            return 1;
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    } as unknown as Window;
    const createImage = () => {
        const img: FakeImage = { src: '', decoding: '', fetchPriority: '' };
        created.push(img);
        return img as unknown as HTMLImageElement;
    };
    return { win, created, createImage };
}

describe('readPreloadAllowed', () => {
    it.each([
        ['data saver on', { saveData: true, effectiveType: '4g' }, false],
        ['a 2g estimate', { effectiveType: '2g' }, false],
        ['a slow-2g estimate', { effectiveType: 'slow-2g' }, false],
        ['a 3g estimate', { effectiveType: '3g' }, true],
        ['a 4g estimate', { effectiveType: '4g' }, true],
        ['no Network Information API', undefined, true]
    ])('with %s → %s', (_label, connection, allowed) => {
        expect(preload.readPreloadAllowed({ nav: navWith(connection) })).toEqual({ allowed });
    });
});

describe('planGalleryWarmup', () => {
    it('plans at most 3 full-size photos, the first ones, plus every thumbnail', () => {
        // Act
        const plan = preload.planGalleryWarmup({
            imageUrls: URLS,
            allowed: true,
            alreadyWarmedFull: 0
        });

        // Assert
        expect(preload.GALLERY_WARMUP_FULL_LIMIT).toBe(3);
        expect(plan.full).toEqual(FULL.slice(0, 3));
        expect(plan.thumbs).toEqual(THUMBS);
    });

    it('shares the 3-photo budget with galleries that already warmed', () => {
        expect(
            preload.planGalleryWarmup({ imageUrls: URLS, allowed: true, alreadyWarmedFull: 2 }).full
        ).toEqual(FULL.slice(0, 1));
        expect(
            preload.planGalleryWarmup({ imageUrls: URLS, allowed: true, alreadyWarmedFull: 5 }).full
        ).toEqual([]);
    });

    it('warms the full size of a single photo but plans no strip thumbnails', () => {
        // Act
        const plan = preload.planGalleryWarmup({
            imageUrls: URLS.slice(0, 1),
            allowed: true,
            alreadyWarmedFull: 0
        });

        // Assert: the strip only renders with 2+ photos
        expect(plan).toEqual({ full: FULL.slice(0, 1), thumbs: [] });
    });

    it('plans nothing when preloading is not allowed', () => {
        expect(
            preload.planGalleryWarmup({ imageUrls: URLS, allowed: false, alreadyWarmedFull: 0 })
        ).toEqual({ full: [], thumbs: [] });
    });
});

describe('warmImage', () => {
    it('requests a URL once, at low priority for speculative warm-ups', () => {
        // Arrange
        const seen = new Set<string>();
        const { created, createImage } = fakeWarmup();

        // Act
        const first = preload.warmImage({ url: FULL[0] ?? '', priority: 'low', createImage, seen });
        const again = preload.warmImage({
            url: FULL[0] ?? '',
            priority: 'auto',
            createImage,
            seen
        });

        // Assert
        expect(first).toEqual({ started: true });
        expect(again).toEqual({ started: false });
        expect(created).toEqual([{ src: FULL[0], decoding: 'async', fetchPriority: 'low' }]);
    });
});

describe('warmGalleryOnIdle', () => {
    it('fetches 3 full-size photos and the thumbnails, all at low priority', () => {
        // Arrange
        const { win, created, createImage } = fakeWarmup({ effectiveType: '4g' });

        // Act
        preload.warmGalleryOnIdle({ win, imageUrls: URLS, createImage });

        // Assert
        const sources = created.map((img) => img.src);
        expect(sources.filter((src) => FULL.includes(src))).toEqual(FULL.slice(0, 3));
        expect(sources.filter((src) => THUMBS.includes(src))).toEqual(THUMBS);
        expect(created.every((img) => img.fetchPriority === 'low')).toBe(true);
    });

    it('never passes 3 full-size photos page-wide before any interaction', () => {
        // Arrange
        const { win, created, createImage } = fakeWarmup();
        const other = URLS.map((url) => url.replace('photo-', 'other-'));

        // Act: two galleries on the same page
        preload.warmGalleryOnIdle({ win, imageUrls: URLS, createImage });
        preload.warmGalleryOnIdle({ win, imageUrls: other, createImage });

        // Assert
        const fullOther = other.map((url) => buildLightboxUrl({ url }).src);
        const fullRequested = created
            .map((img) => img.src)
            .filter((src) => FULL.includes(src) || fullOther.includes(src));
        expect(fullRequested).toHaveLength(3);
    });

    it('gives every page its own 3-photo budget across a soft navigation', () => {
        // Arrange: ONE module instance (no vi.resetModules between pages), as under
        // ClientRouter, where the module survives the navigation.
        const first = fakeWarmup();
        Object.assign(first.win, { location: { pathname: '/es/alojamientos/a/' } });
        const second = fakeWarmup();
        Object.assign(second.win, { location: { pathname: '/es/alojamientos/b/' } });
        const other = URLS.map((url) => url.replace('photo-', 'other-'));
        const fullOther = other.map((url) => buildLightboxUrl({ url }).src);

        // Act: listing A warms, then the visitor soft-navigates to listing B
        preload.warmGalleryOnIdle({
            win: first.win,
            imageUrls: URLS,
            createImage: first.createImage
        });
        preload.warmGalleryOnIdle({
            win: second.win,
            imageUrls: other,
            createImage: second.createImage
        });

        // Assert
        const fullOf = (created: readonly FakeImage[], full: readonly string[]) =>
            created.map((img) => img.src).filter((src) => full.includes(src));
        expect(fullOf(first.created, FULL)).toEqual(FULL.slice(0, 3));
        expect(fullOf(second.created, fullOther)).toEqual(fullOther.slice(0, 3));
    });

    it('still shares the budget between two galleries of the same page', () => {
        // Arrange
        const { win, created, createImage } = fakeWarmup();
        Object.assign(win, { location: { pathname: '/es/alojamientos/a/' } });
        const other = URLS.map((url) => url.replace('photo-', 'other-'));
        const fullOther = other.map((url) => buildLightboxUrl({ url }).src);

        // Act
        preload.warmGalleryOnIdle({ win, imageUrls: URLS, createImage });
        preload.warmGalleryOnIdle({ win, imageUrls: other, createImage });

        // Assert
        const sources = created.map((img) => img.src);
        expect(sources.filter((src) => fullOther.includes(src))).toEqual([]);
    });

    it.each([
        ['data saver', { saveData: true }],
        ['2g', { effectiveType: '2g' }],
        ['slow-2g', { effectiveType: 'slow-2g' }]
    ])('fetches nothing on %s', (_label, connection) => {
        // Arrange
        const { win, created, createImage } = fakeWarmup(connection);

        // Act
        preload.warmGalleryOnIdle({ win, imageUrls: URLS, createImage });

        // Assert
        expect(created).toHaveLength(0);
    });

    it('waits for load before fetching anything', () => {
        // Arrange
        const { win, created, createImage } = fakeWarmup();
        Object.assign(win.document, { readyState: 'loading' });

        // Act
        preload.warmGalleryOnIdle({ win, imageUrls: URLS, createImage });

        // Assert
        expect(created).toHaveLength(0);
        expect(win.addEventListener).toHaveBeenCalledWith('load', expect.any(Function), {
            once: true
        });
    });
});
