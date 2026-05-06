/**
 * @file ReadingProgressBar.client.tsx
 * @description Fixed top reading-progress bar that tracks scroll progress
 * over the post article element. Uses a scroll listener with requestAnimationFrame
 * throttling for smooth updates. Renders a native `<progress>` element for
 * accessibility. Hidden below 640px (mobile). Mount with `client:idle`.
 */

import { useEffect, useRef, useState } from 'react';
import styles from './ReadingProgressBar.module.css';

/**
 * Calculates what fraction (0..1) of `el` has been scrolled past.
 */
function calcProgress(el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    const totalHeight = el.offsetHeight;
    const scrolled = -rect.top;
    if (scrolled <= 0) return 0;
    if (scrolled >= totalHeight) return 1;
    return scrolled / totalHeight;
}

/**
 * Finds the `<article>` that wraps the post content. Falls back to the document
 * body so the bar is never completely broken.
 */
function findArticle(): HTMLElement {
    return document.querySelector<HTMLElement>('article.post-detail') ?? document.body;
}

/**
 * Reading progress bar mounted at the fixed top of the viewport.
 * Only visible on screens ≥640px.
 */
export function ReadingProgressBar(): React.ReactElement {
    const [progress, setProgress] = useState(0);
    const rafId = useRef<number | null>(null);

    useEffect(() => {
        const article = findArticle();

        const onScroll = (): void => {
            if (rafId.current !== null) return;
            rafId.current = requestAnimationFrame(() => {
                setProgress(calcProgress(article));
                rafId.current = null;
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        // Initial calculation
        onScroll();

        return () => {
            window.removeEventListener('scroll', onScroll);
            if (rafId.current !== null) {
                cancelAnimationFrame(rafId.current);
            }
        };
    }, []);

    const pct = Math.round(progress * 100);

    return (
        <progress
            className={styles.bar}
            value={pct}
            max={100}
            aria-label="Progreso de lectura"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
        />
    );
}
