/**
 * @file PostTocActive.client.tsx
 * @description Lightweight React island that applies `data-active="true"` to the
 * TOC link matching the heading currently in view. Uses IntersectionObserver so no
 * scroll listener is needed. Hydrates with `client:idle`.
 *
 * The static PostTableOfContents renders the full `<nav>` with links; this island
 * only adds the active-state behaviour without re-rendering the navigation tree.
 */

import type { TocHeading } from '@/lib/extract-toc';
import { useEffect } from 'react';

interface PostTocActiveProps {
    readonly headings: readonly TocHeading[];
}

/**
 * Observes headings in the DOM and marks the corresponding TOC link as active.
 * Does not render any HTML — returns null. All DOM work happens in the effect.
 */
export function PostTocActive({ headings }: PostTocActiveProps): null {
    useEffect(() => {
        if (headings.length === 0) return;

        const ids = headings.map((h) => h.id);

        const updateActive = (activeId: string | null): void => {
            for (const id of ids) {
                const link = document.querySelector<HTMLElement>(`[data-toc-link="${id}"]`);
                if (link) {
                    if (id === activeId) {
                        link.setAttribute('data-active', 'true');
                    } else {
                        link.removeAttribute('data-active');
                    }
                }
            }
        };

        const headingEls = ids
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLElement => el !== null);

        if (headingEls.length === 0) return;

        let currentActive: string | null = null;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const id = entry.target.id;
                        if (id !== currentActive) {
                            currentActive = id;
                            updateActive(id);
                        }
                    }
                }
            },
            {
                // Trigger when the heading crosses the top 20% of viewport
                rootMargin: '0px 0px -80% 0px',
                threshold: 0
            }
        );

        for (const el of headingEls) {
            observer.observe(el);
        }

        return () => {
            observer.disconnect();
        };
    }, [headings]);

    return null;
}
