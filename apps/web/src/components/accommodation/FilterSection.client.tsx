import { ChevronDownIcon } from '@repo/icons';
import type { JSX } from 'react';

/**
 * Props for the FilterSection component
 */
export interface FilterSectionProps {
    /**
     * Section title displayed in the toggle button
     */
    readonly title: string;

    /**
     * Whether the section is currently expanded
     */
    readonly isExpanded: boolean;

    /**
     * Callback to toggle section expansion
     */
    readonly onToggle: () => void;

    /**
     * Content to render inside the section when expanded
     */
    readonly children: React.ReactNode;

    /**
     * Whether to show a bottom border (default true)
     */
    readonly withBorder?: boolean;
}

/**
 * FilterSection component
 *
 * A reusable collapsible section wrapper for filter groups.
 * Renders a toggle button with a chevron icon and conditionally
 * shows its children based on the expanded state.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <FilterSection
 *   title="Tipo de alojamiento"
 *   isExpanded={expandedSections.type}
 *   onToggle={() => toggleSection('type')}
 * >
 *   <div>...</div>
 * </FilterSection>
 * ```
 */
export function FilterSection({
    title,
    isExpanded,
    onToggle,
    children,
    withBorder = true
}: FilterSectionProps): JSX.Element {
    return (
        <div className={withBorder ? 'mb-6 border-border border-b pb-6' : ''}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                className="mb-3 flex w-full items-center justify-between rounded text-left font-semibold text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
                {title}
                <ChevronDownIcon
                    size={20}
                    weight="bold"
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>
            {isExpanded && children}
        </div>
    );
}
