/**
 * @file EditorSectionNav.client.tsx
 * @description Sticky scrollspy navigation for the accommodation editor's card
 * sections (BETA-138). Renders an ordered list of anchor links, one per card
 * section rendered by `AccommodationEditor.client.tsx`, and highlights the
 * currently-visible section via an IntersectionObserver.
 *
 * Presentational only: it does not own any editor form state. It is hidden
 * below the two-column breakpoint via CSS in the parent
 * (`AccommodationEditor.module.css` `.navSlot`) — mobile/tablet show stacked
 * cards with natural scroll and no nav at all, per BETA-138 product decision.
 */

import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './EditorSectionNav.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single navigable editor card section. */
export interface EditorSectionNavItem {
    /** DOM id of the target `<section>` (e.g. `editor-basicInfo`). */
    readonly id: string;
    /** Pre-resolved (already translated) label for the nav link. */
    readonly label: string;
}

/** Props for EditorSectionNav. */
export interface EditorSectionNavProps {
    readonly locale: SupportedLocale;
    readonly sections: readonly EditorSectionNavItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sticky section navigation with scrollspy for the accommodation editor.
 *
 * Observes each section element (matched by `id`) with an IntersectionObserver
 * and marks the currently-visible section's link with `aria-current="true"`.
 * Clicking a link smooth-scrolls to the target section, falling back to an
 * instant jump when the user prefers reduced motion.
 */
export function EditorSectionNav({ locale, sections }: EditorSectionNavProps) {
    const { t } = createTranslations(locale);
    const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

    useEffect(() => {
        if (typeof window === 'undefined' || sections.length === 0) return;

        const elements = sections
            .map((section) => document.getElementById(section.id))
            .filter((el): el is HTMLElement => el !== null);

        if (elements.length === 0) return;

        // Tracks which observed sections are currently intersecting the
        // viewport across successive observer callbacks (IntersectionObserver
        // only reports entries whose intersection state changed since the
        // last callback, not the full set every time).
        const visibleIds = new Set<string>();

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        visibleIds.add(entry.target.id);
                    } else {
                        visibleIds.delete(entry.target.id);
                    }
                }

                if (visibleIds.size === 0) return;

                // Prefer the topmost section (in render order) that is
                // currently visible, so the nav highlights the section the
                // user is actually reading, not an arbitrary intersecting one.
                const topmostVisible = sections.find((section) => visibleIds.has(section.id));
                if (topmostVisible) {
                    setActiveId(topmostVisible.id);
                }
            },
            {
                root: null,
                // Treat a section as "current" once it clears the sticky
                // navbar/header band and before it scrolls past the midpoint.
                rootMargin: '-120px 0px -60% 0px',
                threshold: 0
            }
        );

        for (const el of elements) {
            observer.observe(el);
        }

        return () => {
            observer.disconnect();
        };
    }, [sections]);

    const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
        event.preventDefault();
        const target = document.getElementById(id);
        if (!target) return;

        const prefersReducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        target.scrollIntoView?.({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
        });
        setActiveId(id);
    };

    if (sections.length === 0) return null;

    return (
        <nav
            className={styles.nav}
            aria-label={t(
                'host.properties.editor.sectionNav.ariaLabel',
                'Navegación de secciones del formulario'
            )}
        >
            <ol className={styles.list}>
                {sections.map((section) => (
                    <li
                        key={section.id}
                        className={styles.item}
                    >
                        <a
                            href={`#${section.id}`}
                            className={styles.link}
                            aria-current={activeId === section.id ? 'true' : undefined}
                            onClick={(event) => handleLinkClick(event, section.id)}
                        >
                            {section.label}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
