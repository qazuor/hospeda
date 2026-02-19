import { useEffect } from 'react';

/**
 * Client island that controls the sticky nav visibility.
 * Observes when the main header leaves the viewport and toggles
 * the sticky nav with a fade-in/slide-down animation.
 *
 * Renders nothing visible; manages DOM attributes on [data-sticky-nav].
 */
export function StickyNavController(): null {
    useEffect(() => {
        const mainHeader = document.getElementById('main-header');
        const stickyNav = document.querySelector<HTMLElement>('[data-sticky-nav]');

        if (!mainHeader || !stickyNav) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry) return;
                if (entry.isIntersecting) {
                    /* Main header is visible.. hide sticky nav */
                    stickyNav.setAttribute('data-visible', 'false');
                } else {
                    /* Main header left viewport.. show sticky nav */
                    stickyNav.setAttribute('data-visible', 'true');
                }
            },
            { threshold: 0 }
        );

        observer.observe(mainHeader);

        return () => {
            observer.disconnect();
        };
    }, []);

    return null;
}
