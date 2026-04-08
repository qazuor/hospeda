/**
 * @file image-fallback.test.ts
 * @description Unit tests for the delegated image fallback system.
 * Uses DOM APIs directly (no innerHTML) for safe test setup.
 */

import { beforeEach, describe, expect, it } from 'vitest';

describe('image-fallback', () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    it('should replace src with data-fallback value on error', async () => {
        const mod = await import('../../src/scripts/image-fallback');

        const img = document.createElement('img');
        img.src = '/broken.jpg';
        img.dataset.fallback = '/placeholder.svg';
        img.alt = 'test';
        document.body.appendChild(img);

        mod.initImageFallback();

        img.dispatchEvent(new Event('error', { bubbles: false }));

        expect(img.src).toContain('/placeholder.svg');
    });

    it('should remove data-fallback after replacement to prevent loops', async () => {
        const mod = await import('../../src/scripts/image-fallback');

        const img = document.createElement('img');
        img.src = '/broken.jpg';
        img.dataset.fallback = '/placeholder.svg';
        document.body.appendChild(img);

        mod.initImageFallback();
        img.dispatchEvent(new Event('error', { bubbles: false }));

        expect(img.dataset.fallback).toBeUndefined();
    });

    it('should hide image with data-hide-on-error on error', async () => {
        const mod = await import('../../src/scripts/image-fallback');

        const img = document.createElement('img');
        img.src = '/broken.svg';
        img.setAttribute('data-hide-on-error', '');
        document.body.appendChild(img);

        mod.initImageFallback();
        img.dispatchEvent(new Event('error', { bubbles: false }));

        expect(img.style.display).toBe('none');
    });

    it('should not affect images without fallback attributes', async () => {
        const mod = await import('../../src/scripts/image-fallback');

        const img = document.createElement('img');
        img.src = '/normal.jpg';
        img.alt = 'test';
        document.body.appendChild(img);

        const originalSrc = img.src;
        mod.initImageFallback();
        img.dispatchEvent(new Event('error', { bubbles: false }));

        expect(img.src).toBe(originalSrc);
        expect(img.style.display).not.toBe('none');
    });
});
