/**
 * @file gallery-tap-bridge.test.tsx
 * @description Pre-hydration tap feedback (owner smoke, HOS-2520). The inline
 * script in GalleryTapBridge.astro records a tap on a photo before the gallery
 * island hydrates, and the island opens the lightbox at that photo once on mount.
 *
 * The script is executed as-is (its exact `is:inline` body, read from the .astro
 * file) against server-rendered gallery markup, then the markup is hydrated.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, screen, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    consumePendingGalleryTap,
    findLoadedCellSrc,
    GALLERY_HYDRATED_ATTR,
    GALLERY_INDEX_ATTR,
    GALLERY_LOADING_ATTR,
    GALLERY_PENDING_ATTR,
    GALLERY_ROOT_ATTR
} from '@/components/gallery/gallery-hydration-bridge';
import { ImageGallery } from '@/components/ImageGallery.client';

const ASTRO_SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/gallery/GalleryTapBridge.astro'),
    'utf8'
);
const SCRIPT_BODY = ASTRO_SOURCE.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1] ?? '';

const IMAGES = Array.from({ length: 5 }, (_, index) => ({
    url: `https://res.cloudinary.com/test/image/upload/photo-${index}.jpg`,
    alt: `Photo ${index + 1}`
}));

type BridgeWindow = Window & { __hospedaGalleryTapBridge?: boolean };

/** Listeners the script adds to `document`, removed after each test. */
const added: Array<{
    type: string;
    listener: EventListenerOrEventListenerObject;
    capture: boolean;
}> = [];

function runBridgeScript(): void {
    // Executes the exact inline script body under test (test-only; the CSP guard skips tests).
    new Function(SCRIPT_BODY)();
}

beforeEach(() => {
    const original = document.addEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
        const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
        added.push({ type, listener, capture });
        original(type, listener, options);
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    for (const { type, listener, capture } of added.splice(0)) {
        document.removeEventListener(type, listener, capture);
    }
    delete (window as BridgeWindow).__hospedaGalleryTapBridge;
    document.body.innerHTML = '';
});

function serverRender(): { container: HTMLDivElement; element: JSX.Element } {
    const element = (
        <ImageGallery
            images={IMAGES}
            locale="en"
            mobile={{}}
        />
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(element);
    document.body.appendChild(container);
    return { container, element };
}

describe('GalleryTapBridge.astro inline script', () => {
    it('is a static is:inline body, so the CSP build scan hashes it', () => {
        // Assert
        expect(SCRIPT_BODY.length).toBeGreaterThan(0);
        expect(ASTRO_SOURCE).not.toMatch(/<script[^>]*set:html/);
        expect(ASTRO_SOURCE.match(/<script\b/g)).toHaveLength(1);
    });

    it('uses the attribute names the island reads', () => {
        // Assert
        for (const attr of [
            GALLERY_ROOT_ATTR,
            GALLERY_HYDRATED_ATTR,
            GALLERY_PENDING_ATTR,
            GALLERY_INDEX_ATTR,
            GALLERY_LOADING_ATTR
        ]) {
            expect(SCRIPT_BODY).toMatch(new RegExp(`['[]${attr}[\\]']`));
        }
    });

    it('marks the tapped photo loading and records its index before hydration', () => {
        // Arrange
        const { container } = serverRender();
        runBridgeScript();
        const root = container.querySelector(`[${GALLERY_ROOT_ATTR}]`) as HTMLElement;
        const slides = within(container).getAllByRole('button', { name: /Photo \d/ });

        // Act
        slides[2]?.click();
        slides[3]?.click();

        // Assert: the last tap wins and only one photo shows the spinner
        expect(root.getAttribute(GALLERY_PENDING_ATTR)).toBe('3');
        expect(slides[3]).toHaveAttribute(GALLERY_LOADING_ATTR);
        expect(slides[3]).toHaveAttribute('aria-busy', 'true');
        expect(slides[2]).not.toHaveAttribute(GALLERY_LOADING_ATTR);
    });

    it('treats the «see all photos» button as a tap on the first photo', () => {
        // Arrange
        const { container } = serverRender();
        runBridgeScript();
        const root = container.querySelector(`[${GALLERY_ROOT_ATTR}]`) as HTMLElement;
        const seeAll = within(container).getByRole('button', { name: 'See all 5 photos' });

        // Act
        seeAll.click();

        // Assert: the bridge answers the tap and the island will replay index 0
        expect(seeAll).toHaveAttribute(GALLERY_INDEX_ATTR, '0');
        expect(seeAll).toHaveAttribute(GALLERY_LOADING_ATTR);
        expect(seeAll).toHaveAttribute('aria-busy', 'true');
        expect(root.getAttribute(GALLERY_PENDING_ATTR)).toBe('0');
    });

    it('adds its listeners once even when the script runs twice', () => {
        // Act
        runBridgeScript();
        runBridgeScript();

        // Assert
        expect(added.filter(({ type }) => type === 'click')).toHaveLength(1);
        expect(added.filter(({ type }) => type === 'touchstart')).toHaveLength(1);
    });

    it('keeps the pending tap on its own gallery root', () => {
        // Arrange
        const first = serverRender().container;
        const second = serverRender().container;
        runBridgeScript();

        // Act
        within(second)
            .getAllByRole('button', { name: /Photo \d/ })[1]
            ?.click();

        // Assert
        const rootOf = (c: HTMLElement) => c.querySelector(`[${GALLERY_ROOT_ATTR}]`) as HTMLElement;
        expect(rootOf(second).getAttribute(GALLERY_PENDING_ATTR)).toBe('1');
        expect(rootOf(first).hasAttribute(GALLERY_PENDING_ATTR)).toBe(false);
        expect(first.querySelector(`[${GALLERY_LOADING_ATTR}]`)).toBeNull();
    });
});

describe('ImageGallery consumes a pre-hydration tap', () => {
    it('opens the lightbox at the tapped photo once, and clears the pending state', async () => {
        // Arrange
        const { container, element } = serverRender();
        runBridgeScript();
        within(container)
            .getAllByRole('button', { name: /Photo \d/ })[2]
            ?.click();
        const onRecoverableError = vi.fn();
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        // Act
        const reactRoot = hydrateRoot(container, element, { onRecoverableError });
        await act(async () => {});

        // Assert
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('3/5')).toBeInTheDocument();
        const root = container.querySelector(`[${GALLERY_ROOT_ATTR}]`) as HTMLElement;
        expect(root).toHaveAttribute(GALLERY_HYDRATED_ATTR);
        expect(root).not.toHaveAttribute(GALLERY_PENDING_ATTR);
        expect(container.querySelector(`[${GALLERY_LOADING_ATTR}]`)).toBeNull();
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(/hydrat/i);
        act(() => reactRoot.unmount());
    });

    it('becomes a no-op once the island has hydrated', async () => {
        // Arrange
        const { container, element } = serverRender();
        runBridgeScript();
        const reactRoot = hydrateRoot(container, element);
        await act(async () => {});
        const root = container.querySelector(`[${GALLERY_ROOT_ATTR}]`) as HTMLElement;

        // Act
        await act(async () => {
            within(container)
                .getAllByRole('button', { name: /Photo \d/ })[1]
                ?.click();
        });

        // Assert: React handled the click; the script left no trace
        expect(root).not.toHaveAttribute(GALLERY_PENDING_ATTR);
        expect(container.querySelector(`[${GALLERY_LOADING_ATTR}]`)).toBeNull();
        expect(within(screen.getByRole('dialog')).getByText('2/5')).toBeInTheDocument();
        act(() => reactRoot.unmount());
    });
});

describe('consumePendingGalleryTap', () => {
    function rootWith(pending: string | null): HTMLElement {
        const root = document.createElement('div');
        if (pending !== null) root.setAttribute(GALLERY_PENDING_ATTR, pending);
        return root;
    }

    it('returns the pending index and clears it', () => {
        // Arrange
        const root = rootWith('2');

        // Act
        const first = consumePendingGalleryTap({ root, count: 5 });
        const second = consumePendingGalleryTap({ root, count: 5 });

        // Assert
        expect(first).toEqual({ index: 2 });
        expect(second).toEqual({ index: null });
        expect(root).toHaveAttribute(GALLERY_HYDRATED_ATTR);
    });

    it.each([
        ['an index past the last photo', '5'],
        ['a non-numeric value', 'abc'],
        ['a negative value', '-1'],
        ['no tap at all', null]
    ])('returns null for %s', (_label, pending) => {
        expect(consumePendingGalleryTap({ root: rootWith(pending), count: 5 })).toEqual({
            index: null
        });
    });
});

describe('findLoadedCellSrc', () => {
    function cell({ loaded }: { readonly loaded: boolean }): HTMLElement {
        const root = document.createElement('div');
        root.innerHTML = `<button ${GALLERY_INDEX_ATTR}="1"><img src="https://cdn.test/cell.jpg"></button>`;
        const img = root.querySelector('img') as HTMLImageElement;
        Object.defineProperty(img, 'complete', { value: true });
        Object.defineProperty(img, 'naturalWidth', { value: loaded ? 400 : 0 });
        Object.defineProperty(img, 'currentSrc', { value: 'https://cdn.test/cell-640w.jpg' });
        return root;
    }

    it('returns the candidate the browser painted', () => {
        expect(findLoadedCellSrc({ root: cell({ loaded: true }), index: 1 })).toEqual({
            src: 'https://cdn.test/cell-640w.jpg'
        });
    });

    it('skips an image with no pixels (a cell hidden by a media query)', () => {
        expect(findLoadedCellSrc({ root: cell({ loaded: false }), index: 1 })).toEqual({
            src: undefined
        });
    });

    it('returns nothing for an index with no cell', () => {
        expect(findLoadedCellSrc({ root: cell({ loaded: true }), index: 4 })).toEqual({
            src: undefined
        });
    });
});
