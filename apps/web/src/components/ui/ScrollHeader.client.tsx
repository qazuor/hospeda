import { useEffect, useRef } from 'react';

/**
 * Props for the ScrollHeader client island.
 */
export interface ScrollHeaderProps {
    /** Whether this is the homepage hero (enables transparent mode) */
    readonly isHero?: boolean;
}

/** Scroll range (px) over which the glassmorphism interpolates from 0 to 1. */
const SCROLL_RANGE = 150;

/** Scroll threshold (px) at which logo/nav swap from white to colored. */
const COLOR_SWAP_THRESHOLD = 60;

/**
 * Provides scroll-based header state with progressive glassmorphism.
 * On homepage: header starts transparent, gradually gains blur/bg/shadow as user scrolls.
 * On other pages: immediately sets fully-solid state.
 *
 * Renders nothing visible; instead manages the header element's CSS custom properties and classes.
 */
export function ScrollHeader({ isHero = false }: ScrollHeaderProps): null {
    const tickingRef = useRef(false);

    useEffect(() => {
        const header = document.querySelector<HTMLElement>('[data-scroll-header]');
        if (!header) return;

        if (!isHero) {
            /* Non-hero pages: fully solid immediately */
            header.classList.remove('header-transparent');
            header.classList.add('header-solid');
            header.style.setProperty('--header-blur', '16px');
            header.style.setProperty('--header-bg-opacity', '1');
            header.style.setProperty('--header-border-opacity', '1');
            header.style.setProperty('--header-shadow-opacity', '0.08');
            return;
        }

        /* Hero page: start transparent */
        header.classList.add('header-transparent');

        function applyScroll(): void {
            if (!header) return;
            const scrollY = window.scrollY;
            const progress = Math.min(scrollY / SCROLL_RANGE, 1);

            /* Progressive glassmorphism via CSS custom properties */
            header.style.setProperty('--header-blur', `${progress * 16}px`);
            header.style.setProperty('--header-bg-opacity', `${progress}`);
            header.style.setProperty('--header-border-opacity', `${progress}`);
            header.style.setProperty('--header-shadow-opacity', `${progress * 0.08}`);

            /* Class swap for logo/nav color change at threshold */
            const isScrolled = scrollY > COLOR_SWAP_THRESHOLD;
            if (isScrolled) {
                header.classList.remove('header-transparent');
                header.classList.add('header-solid');
            } else {
                header.classList.remove('header-solid');
                header.classList.add('header-transparent');
            }
        }

        function throttledScroll(): void {
            if (!tickingRef.current) {
                window.requestAnimationFrame(() => {
                    applyScroll();
                    tickingRef.current = false;
                });
                tickingRef.current = true;
            }
        }

        window.addEventListener('scroll', throttledScroll, { passive: true });
        applyScroll();

        return () => {
            window.removeEventListener('scroll', throttledScroll);
            header.classList.remove('header-transparent', 'header-solid');
            header.style.removeProperty('--header-blur');
            header.style.removeProperty('--header-bg-opacity');
            header.style.removeProperty('--header-border-opacity');
            header.style.removeProperty('--header-shadow-opacity');
        };
    }, [isHero]);

    return null;
}
