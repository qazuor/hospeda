/**
 * @file SectionHeader.tsx
 * @description Decorative divider rendered inside the FilterSidebar body
 * whenever the consuming page declares a `section-header` entry in its
 * `filters` array. Produces a small-caps uppercase label with an optional
 * `@repo/icons` glyph on the left.
 *
 * Section headers do NOT carry state — they exist purely to group the next
 * run of filter groups under a common heading (e.g. "UBICACIÓN", "PRECIO Y
 * CALIDAD").
 */

import type { SupportedLocale } from '@/lib/i18n';
import { resolveIcon } from '@repo/icons';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
    readonly label: string;
    readonly icon?: string;
    /** Locale prop is unused today but kept for symmetry with sibling
     * components — future i18n of the label happens at the caller. */
    readonly locale?: SupportedLocale;
}

export function SectionHeader({ label, icon }: SectionHeaderProps) {
    const IconComponent = icon ? resolveIcon({ iconName: icon }) : undefined;
    return (
        <div
            className={styles.sectionHeader}
            role="presentation"
        >
            {IconComponent && (
                <span
                    className={styles.sectionHeaderIcon}
                    aria-hidden="true"
                >
                    <IconComponent
                        size={14}
                        weight="duotone"
                    />
                </span>
            )}
            <span className={styles.sectionHeaderLabel}>{label}</span>
        </div>
    );
}
