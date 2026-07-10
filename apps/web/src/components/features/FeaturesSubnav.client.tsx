/**
 * @file FeaturesSubnav.client.tsx
 * @description Lightweight React island that applies `data-active="true"` to
 * the audience-subnav link matching the section currently in view. Uses
 * IntersectionObserver so no scroll listener is needed. Hydrates with
 * `client:idle` (HOS-119 T-006).
 *
 * Mirrors the pattern used by `PostTocActive.client.tsx`: the subnav `<nav>`
 * with its anchor links is rendered statically by the page; this island only
 * adds the active-state behaviour without re-rendering the navigation tree.
 * It renders no DOM of its own.
 */

import { useEffect } from 'react';

interface FeaturesSubnavProps {
    /** Ordered list of section element ids the subnav links point to (e.g. `['viajeros', 'anfitriones', ...]`). */
    readonly sectionIds: readonly string[];
}

/**
 * Observes the audience sections in the DOM and marks the corresponding
 * static subnav link (`[data-subnav-link="<id>"]`) as active. Renders
 * nothing — all work happens in the effect against the already-rendered DOM.
 */
export function FeaturesSubnav({ sectionIds }: FeaturesSubnavProps): null {
    useEffect(() => {
        if (sectionIds.length === 0) {
            return;
        }

        const updateActive = (activeId: string | null): void => {
            for (const id of sectionIds) {
                const link = document.querySelector<HTMLElement>(`[data-subnav-link="${id}"]`);
                if (!link) {
                    continue;
                }
                if (id === activeId) {
                    link.setAttribute('data-active', 'true');
                } else {
                    link.removeAttribute('data-active');
                }
            }
        };

        const sectionEls = sectionIds
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLElement => el !== null);

        if (sectionEls.length === 0) {
            return;
        }

        // Defensive guard: IntersectionObserver is near-universal but may be
        // absent in unusual hydration environments; degrade gracefully rather
        // than throwing (the static subnav still works without active-state).
        if (typeof IntersectionObserver === 'undefined') {
            return;
        }

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
                // Trigger when the section crosses the top ~15% of viewport,
                // below the sticky main header + subnav bar.
                rootMargin: '-120px 0px -75% 0px',
                threshold: 0
            }
        );

        for (const el of sectionEls) {
            observer.observe(el);
        }

        return () => {
            observer.disconnect();
        };
    }, [sectionIds]);

    return null;
}
