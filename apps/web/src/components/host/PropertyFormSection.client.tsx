/**
 * @file PropertyFormSection.client.tsx
 * @description Reusable collapsible section wrapper for the host property form.
 * Each section has a header toggle button with chevron and an optional
 * completion indicator. Content is hidden via `display:none` when collapsed.
 *
 * Accessibility: header uses a `<button>` with `aria-expanded` and
 * `aria-controls` pointing to the content `<div>`. Content is wrapped in
 * a `<fieldset>` with a visually-hidden `<legend>` for screen reader context.
 */

import { useState } from 'react';
import styles from './PropertyFormSection.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the PropertyFormSection collapsible wrapper.
 */
export type PropertyFormSectionProps = {
    /** Unique key used to generate element IDs (`section-{sectionKey}`). */
    readonly sectionKey: string;
    /** Human-readable section title rendered in the header. */
    readonly title: string;
    /** When true, shows a green check badge beside the title. */
    readonly isComplete: boolean;
    /**
     * Whether the section starts in the open state.
     * @default true
     */
    readonly defaultOpen?: boolean;
    /** Section content — form fields, pickers, etc. */
    readonly children: React.ReactNode;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PropertyFormSection — collapsible section wrapper for the property form.
 *
 * Renders a toggle header and an expandable content area. When `isComplete`
 * is true, a green check badge appears beside the title. The chevron rotates
 * 180° when the section is open.
 *
 * @example
 * ```tsx
 * <PropertyFormSection
 *   sectionKey="datos-basicos"
 *   title="Datos básicos"
 *   isComplete={completedSections.has('datos-basicos')}
 *   defaultOpen={true}
 * >
 *   <input name="name" />
 * </PropertyFormSection>
 * ```
 */
export function PropertyFormSection({
    sectionKey,
    title,
    isComplete,
    defaultOpen = true,
    children
}: PropertyFormSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const contentId = `section-content-${sectionKey}`;
    const headerId = `section-header-${sectionKey}`;

    function handleToggle(): void {
        setIsOpen((prev) => !prev);
    }

    return (
        <div
            className={styles.section}
            data-section-key={sectionKey}
            data-complete={isComplete}
        >
            {/* ── Toggle button ───────────────────────────────────────── */}
            <button
                id={headerId}
                type="button"
                className={`${styles.header} ${isOpen ? styles.headerExpanded : ''}`}
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={handleToggle}
            >
                <div className={styles.titleRow}>
                    {/* Completion indicator */}
                    {isComplete ? (
                        <span
                            className={styles.completeBadge}
                            aria-hidden="true"
                            title="Sección completa"
                        >
                            ✓
                        </span>
                    ) : (
                        <span
                            className={styles.incompleteBadge}
                            aria-hidden="true"
                        />
                    )}

                    <h2 className={styles.title}>{title}</h2>
                </div>

                {/* Chevron — rotates when expanded */}
                <span
                    className={`${styles.chevron} ${isOpen ? styles.chevronExpanded : ''}`}
                    aria-hidden="true"
                >
                    {/* Simple SVG chevron — no library dependency */}
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path
                            d="M3 6l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            </button>

            {/* ── Collapsible content ─────────────────────────────────── */}
            <section
                id={contentId}
                aria-labelledby={headerId}
                className={`${styles.content} ${isOpen ? '' : styles.contentHidden}`}
            >
                {/*
                 * <fieldset> + <legend> provides semantic grouping for assistive
                 * technologies. The legend is visually hidden because the toggle
                 * button already exposes the title.
                 */}
                <fieldset className={styles.fieldset}>
                    <legend className={styles.legend}>{title}</legend>
                    {children}
                </fieldset>
            </section>
        </div>
    );
}
