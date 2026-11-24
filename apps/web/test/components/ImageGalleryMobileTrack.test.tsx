import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { ImageGallery } from '@/components/ImageGallery.client';
import { dispatchPointer } from '../stubs/dispatch-pointer';

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => null,
    fetchAuthMe: async () => null,
    resetInFlightAuthMe: () => undefined
}));

const images = Array.from({ length: 10 }, (_, index) => ({
    url: `https://res.cloudinary.com/test/image/upload/photo-${index}.jpg`,
    alt: `Photo ${index + 1}`
}));
const share = {
    url: 'https://example.com/en/alojamientos/suite/',
    title: 'Suite',
    campaign: 'accommodation'
} as const;
const mobile = {};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('server-renders both detail presentations and hydrates without changing their initial state', async () => {
    const element = (
        <ImageGallery
            variant="detail"
            images={images.slice(0, 2)}
            locale="en"
            mobile={mobile}
        />
    );
    const container = document.createElement('div');
    const onRecoverableError = vi.fn();
    container.innerHTML = renderToString(element);
    const track = within(container).getByRole('region', { name: 'Image gallery' });
    const mosaic = container.querySelector('[data-count="2"]');
    expect(mosaic).not.toBeNull();
    expect(within(container).getByText('1/2')).toBeTruthy();

    expect(Array.from(track.querySelectorAll('img'), (img) => img.getAttribute('loading'))).toEqual(
        ['eager', 'lazy']
    );
    const root = hydrateRoot(container, element, { onRecoverableError });
    await act(async () => {});

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(within(container).getByText('1/2')).toBeTruthy();
    act(() => root.unmount());
});

it('keeps the existing mosaic for detail callers that have not opted in', () => {
    const { container } = render(
        <ImageGallery
            variant="detail"
            images={images}
            locale="en"
        />
    );

    expect(screen.queryByRole('region', { name: 'Image gallery' })).not.toBeInTheDocument();
    expect(container.querySelector('[data-count].mosaic')).toBeNull();
    expect(container.querySelector('[data-count]')).toBeInTheDocument();
});

it('renders no back control over the photo (owner decision, HOS-2520 smoke)', () => {
    render(
        <ImageGallery
            images={images}
            locale="pt"
            mobile={{ share }}
        />
    );

    expect(screen.queryByRole('link', { name: 'Voltar' })).not.toBeInTheDocument();
    expect(readFileSync('src/components/ImageGalleryMobileTrack.client.tsx', 'utf8')).not.toMatch(
        /backHref|history\.back|goBack/
    );
});

/** Loading attribute of every slide in the mobile track, in order. */
function slideLoading(): (string | null)[] {
    const track = screen.getByRole('region', { name: 'Image gallery' });
    return Array.from(track.querySelectorAll('img'), (img) => img.getAttribute('loading'));
}

it('keeps every slide but the first lazy until the page is idle, then preloads the next two', async () => {
    // The track and the lightbox warm-up (HOS-2520) both wait for idle.
    const idleCallbacks: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
        idleCallbacks.push(callback);
        return idleCallbacks.length;
    });
    render(
        <ImageGallery
            images={images.slice(0, 5)}
            locale="en"
            mobile={mobile}
        />
    );

    expect(slideLoading()).toEqual(['eager', 'lazy', 'lazy', 'lazy', 'lazy']);
    await act(async () => {
        for (const callback of idleCallbacks) callback();
    });
    expect(slideLoading()).toEqual(['eager', 'eager', 'eager', 'lazy', 'lazy']);
});

it('moves the preload window forward as the visitor swipes, and never back', async () => {
    let notify: IntersectionObserverCallback | undefined;
    const observer = { observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal(
        'IntersectionObserver',
        vi.fn(function (callback: IntersectionObserverCallback) {
            notify = callback;
            return observer;
        })
    );
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
        callback();
        return 1;
    });
    render(
        <ImageGallery
            images={images.slice(0, 7)}
            locale="en"
            mobile={mobile}
        />
    );
    const track = screen.getByRole('region', { name: 'Image gallery' });
    Object.defineProperty(track, 'clientWidth', { value: 390 });
    const slides = within(track).getAllByRole('button');
    const show = (index: number) =>
        act(() => {
            notify?.(
                [
                    {
                        target: slides[index],
                        intersectionRatio: 1,
                        isIntersecting: true
                    } as unknown as IntersectionObserverEntry
                ],
                observer as unknown as IntersectionObserver
            );
        });

    show(3);
    expect(slideLoading()).toEqual(['eager', 'eager', 'eager', 'eager', 'eager', 'eager', 'lazy']);
    show(1);
    expect(slideLoading()).toEqual(['eager', 'eager', 'eager', 'eager', 'eager', 'eager', 'lazy']);
});

it('preloads nothing ahead when the visitor asked to save data', async () => {
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
        callback();
        return 1;
    });
    Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: true }
    });
    try {
        render(
            <ImageGallery
                images={images.slice(0, 4)}
                locale="en"
                mobile={mobile}
            />
        );
        await act(async () => {});
        expect(slideLoading()).toEqual(['eager', 'lazy', 'lazy', 'lazy']);
    } finally {
        Reflect.deleteProperty(navigator, 'connection');
    }
});

it('retains the featured candidates but advertises a full viewport slot for every mobile slide', () => {
    const { container } = render(
        <ImageGallery
            images={images}
            locale="en"
            mobile={mobile}
        />
    );

    const sources = screen
        .getByRole('region', { name: 'Image gallery' })
        .querySelectorAll('source');
    const featured = container.querySelector('[data-count] source');
    expect(featured).toHaveAttribute('sizes', '(max-width: 640px) 100vw, 66vw');
    expect(container.querySelector('[data-count] img')).not.toHaveAttribute('src');
    expect(container.querySelector('[data-count] img')).not.toHaveAttribute('srcset');
    expect(container.querySelector('[data-count] img')).toHaveAttribute('fetchpriority', 'high');
    expect(sources[0]?.nextElementSibling).toHaveAttribute('fetchpriority', 'high');
    expect(sources[0]?.getAttribute('srcset')).toBeTruthy();
    expect(sources[0]?.getAttribute('srcset')).toBe(featured?.getAttribute('srcset'));
    expect(sources).toHaveLength(images.length);
    for (const source of sources) {
        expect(source).toHaveAttribute('sizes', '100vw');
        expect(source).toHaveAttribute('media', '(max-width: 767px)');
    }
});

it('keeps a single dedicated photo-page link below the mobile track for five photos', () => {
    const viewAllHref = '/en/alojamientos/suite/fotos/';
    render(
        <ImageGallery
            images={images.slice(0, 5)}
            locale="en"
            mobile={mobile}
            viewAllHref={viewAllHref}
        />
    );

    const [link] = screen
        .getAllByRole('link')
        .filter((anchor) => anchor.getAttribute('href') === viewAllHref);
    const track = screen.getByRole('region', { name: 'Image gallery' });
    expect(link).toBeInTheDocument();
    expect(
        screen.getAllByRole('link').filter((anchor) => anchor.getAttribute('href') === viewAllHref)
    ).toHaveLength(1);
    expect(link).toHaveAttribute('data-astro-reload');
    expect(link).not.toHaveClass('mosaic');
    expect(
        track.compareDocumentPosition(link as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
});

it('switches at 767px and reserves a full-bleed 4:3 snap track in CSS', () => {
    const css = readFileSync('src/components/ImageGalleryMobileTrack.module.css', 'utf8');

    expect(css).toMatch(/\.mobile\s*\{\s*display:\s*none/);
    expect(css).toMatch(
        /@media \(max-width: 767px\)\s*\{\s*(?:div)?\.mosaic[^{]*\{\s*display:\s*none/
    );
    expect(css).toMatch(
        /\.mobile\s*\{\s*display:\s*block;\s*margin-inline:\s*calc\(-1 \* var\(--space-container-x\)\)/
    );
    expect(css).toMatch(/aspect-ratio:\s*4\s*\/\s*3/);
    expect(css).toMatch(/scroll-snap-type:\s*x mandatory/);
    expect(css).toMatch(/scroll-snap-align:\s*start/);
});

it('uses the legacy-compatible complement of the CSS mobile media query for every mosaic source', () => {
    const css = readFileSync('src/components/ImageGalleryMobileTrack.module.css', 'utf8');
    const mobileQuery = css.match(/@media (\(max-width: 767px\))/)?.[1];
    const { container } = render(
        <ImageGallery
            images={images}
            locale="en"
            mobile={mobile}
        />
    );

    const desktopSources = container.querySelectorAll('[data-count] source');
    expect(mobileQuery).toBeTruthy();
    expect(desktopSources).toHaveLength(4);
    for (const source of desktopSources) {
        expect(source).toHaveAttribute('media', `not all and ${mobileQuery}`);
    }
});

it('follows the snapped slide, limits dots, supports track arrows and opens the selected photo', () => {
    let notify: IntersectionObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    const observer = { observe, disconnect };
    const createObserver = vi.fn(function (callback: IntersectionObserverCallback) {
        notify = callback;
        return observer;
    });
    vi.stubGlobal('IntersectionObserver', createObserver);
    const { container, unmount } = render(
        <ImageGallery
            images={images}
            locale="en"
            mobile={mobile}
        />
    );
    const track = screen.getByRole('region', { name: 'Image gallery' });
    const slides = within(track).getAllByRole('button');
    const second = slides[1] as HTMLElement;
    const last = slides[9] as HTMLElement;
    const scrollTo = vi.fn();
    Object.defineProperties(track, { scrollTo: { value: scrollTo }, clientWidth: { value: 390 } });
    const intersect = (target: Element, intersectionRatio: number) =>
        act(() => {
            notify?.(
                [{ target, intersectionRatio, isIntersecting: true } as IntersectionObserverEntry],
                observer as unknown as IntersectionObserver
            );
        });

    intersect(second, 0.59);
    expect(screen.getByText('1/10')).toBeInTheDocument();
    intersect(second, 0.6);
    track.scrollLeft = 390;
    expect(screen.getByText('2/10')).toBeInTheDocument();
    track.focus();
    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 780 });
    fireEvent.keyDown(track, { key: 'ArrowLeft' });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 });
    intersect(last, 1);
    fireEvent.click(last);

    expect(createObserver).toHaveBeenCalledWith(expect.any(Function), {
        root: track,
        threshold: 0.6
    });
    expect(observe).toHaveBeenCalledTimes(10);
    // Track and lightbox share GalleryCounter, so both read «10/10».
    expect(screen.getAllByText('10/10')).toHaveLength(2);
    expect(container.querySelectorAll('[data-active]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
    expect(within(screen.getByRole('dialog')).getByText('10/10')).toBeInTheDocument();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
});

it('navigates with arrows after dismissing the lightbox opened by a pointer-focused slide', async () => {
    const user = userEvent.setup();
    render(
        <ImageGallery
            images={images.slice(0, 3)}
            locale="en"
            mobile={mobile}
        />
    );
    const track = screen.getByRole('region', { name: 'Image gallery' });
    const second = within(track).getByRole('button', { name: /Photo 2/ });
    const scrollTo = vi.fn();
    Object.defineProperties(track, { scrollTo: { value: scrollTo }, clientWidth: { value: 390 } });

    await user.click(second);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('2/3')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(second).toHaveFocus();

    // Keep the scroll position distinct from the button's index to detect stolen activation.
    for (const key of ['{Enter}', ' ']) {
        await user.keyboard(key);
        expect(within(screen.getByRole('dialog')).getByText('2/3')).toBeInTheDocument();
        await user.keyboard('{Escape}');
    }

    track.scrollLeft = 390;
    await user.keyboard('{ArrowRight}');
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 780 });
    expect(track).toHaveFocus();
});

it('opens the real guest favorite prompt from the keyboard and restores focus on dismissal', async () => {
    const user = userEvent.setup();
    render(
        <ImageGallery
            images={images}
            locale="en"
            mobile={{
                ...mobile,
                share,
                favorite: {
                    entityId: 'suite-id',
                    entityType: 'ACCOMMODATION',
                    variant: 'standalone'
                }
            }}
        />
    );
    const shareButton = screen.getByRole('button', { name: 'Share via device' });
    fireEvent.click(shareButton);

    expect(shareButton).toHaveTextContent(/^$/);
    expect(shareButton).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    const heart = await screen.findByRole('button', { name: /add to favorites/i });
    await user.tab();
    expect(heart).toHaveFocus();

    await user.keyboard('{Enter}');

    const prompt = await screen.findByRole('dialog');
    expect(await within(prompt).findByRole('button')).toHaveFocus();
    await user.tab();
    expect(within(prompt).getByRole('link', { name: /sign in/i })).toHaveFocus();
    expect(heart).toHaveAttribute('aria-expanded', 'true');
    expect(prompt.id).toBeTruthy();
    expect(heart).toHaveAttribute('aria-controls', prompt.id);

    await user.keyboard('{Escape}');
    expect(prompt).not.toBeInTheDocument();
    expect(heart).toHaveFocus();
    expect(heart).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard(' ');
    const reopened = await screen.findByRole('dialog');
    const close = within(reopened).getByRole('button');
    close.focus();
    await user.keyboard('{Enter}');
    expect(reopened).not.toBeInTheDocument();
    expect(heart).toHaveFocus();
});

it('swipes the lightbox horizontally while ignoring a vertical drag', () => {
    render(
        <ImageGallery
            images={images.slice(0, 2)}
            locale="en"
            mobile={mobile}
        />
    );
    const track = screen.getByRole('region', { name: 'Image gallery' });
    fireEvent.click(within(track).getAllByRole('button')[0] as HTMLElement);
    const dialog = screen.getByRole('dialog');
    const figure = within(within(dialog).getByRole('figure')).getByRole('img');

    dispatchPointer({ target: figure, type: 'pointerdown', clientX: 100 });
    dispatchPointer({ target: figure, type: 'pointerup', clientX: 50 });
    expect(within(dialog).getByText('2/2')).toBeInTheDocument();
    dispatchPointer({ target: figure, type: 'pointerdown', clientX: 100 });
    dispatchPointer({ target: figure, type: 'pointerup', clientX: 150, clientY: 70 });

    expect(within(dialog).getByText('2/2')).toBeInTheDocument();
});

it('sizes the overlay favorite like the 44px share button', () => {
    const css = readFileSync('src/components/ImageGalleryMobileTrack.module.css', 'utf8');
    const tsx = readFileSync('src/components/ImageGalleryMobileTrack.client.tsx', 'utf8');

    expect(css).toMatch(
        /\.actions \.favorite\s*\{\s*width:\s*2\.75rem;\s*height:\s*2\.75rem;\s*border:\s*0;\s*box-shadow:\s*var\(--shadow-card\)/
    );
    expect(tsx).toContain('className={styles.favorite}');
});
