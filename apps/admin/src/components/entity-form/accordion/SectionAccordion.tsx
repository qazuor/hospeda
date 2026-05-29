import { cn } from '@/lib/utils';
import { ChevronRightIcon } from '@repo/icons';
import * as React from 'react';
import { useSectionOpenListener } from './section-navigation';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SectionAccordionContextValue {
    readonly openSections: ReadonlySet<string>;
    readonly toggleSection: (id: string) => void;
}

const SectionAccordionContext = React.createContext<SectionAccordionContextValue | undefined>(
    undefined
);

/**
 * Access the parent SectionAccordion context.
 * Throws if used outside a SectionAccordion.
 */
function useSectionAccordion(): SectionAccordionContextValue {
    const ctx = React.useContext(SectionAccordionContext);
    if (!ctx) {
        throw new Error('SectionAccordionItem must be used inside a SectionAccordion');
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// SectionAccordion (container)
// ---------------------------------------------------------------------------

/**
 * Props for the SectionAccordion container component.
 */
export interface SectionAccordionProps {
    /**
     * The sections rendered as direct children — normally a list of
     * SectionAccordionItem elements.
     */
    readonly children: React.ReactNode;
    /**
     * IDs of sections that should start open.
     * Sections whose `defaultCollapsed` is true are excluded from the default
     * open set; callers can override here by passing those IDs explicitly.
     */
    readonly defaultOpenIds?: readonly string[];
    /** Additional CSS classes applied to the container. */
    readonly className?: string;
}

/**
 * SectionAccordion — multi-open accordion shell for entity view / edit pages.
 *
 * Manages open/collapsed state for any number of child SectionAccordionItems.
 * Multiple sections can be open simultaneously (non-exclusive). Each section
 * remembers its own state; openness defaults come from `defaultOpenIds` or
 * from each item's `defaultCollapsed` prop.
 *
 * @example
 * ```tsx
 * <SectionAccordion defaultOpenIds={['general']}>
 *   <SectionAccordionItem
 *     id="general"
 *     title="Datos principales"
 *     collapsedSummary="Hotel Plaza · Hotel · Gualeguaychú"
 *   >
 *     {fields}
 *   </SectionAccordionItem>
 * </SectionAccordion>
 * ```
 */
export function SectionAccordion({ children, defaultOpenIds, className }: SectionAccordionProps) {
    // We initialise openSections lazily with an initialiser function so the
    // Set is only constructed once, not on every render.
    const [openSections, setOpenSections] = React.useState<ReadonlySet<string>>(
        () => new Set(defaultOpenIds ?? [])
    );

    const toggleSection = React.useCallback((id: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const value = React.useMemo(
        () => ({ openSections, toggleSection }),
        [openSections, toggleSection]
    );

    // Cross-tree navigation: respond to `openSection(id)` calls from siblings
    // (e.g. the QualityScore popover in the page header). We open the section
    // if it's closed and scroll its panel into view after the layout settles.
    useSectionOpenListener(
        React.useCallback((id: string) => {
            setOpenSections((prev) => {
                if (prev.has(id)) return prev;
                const next = new Set(prev);
                next.add(id);
                return next;
            });
            // Defer scroll until the panel actually mounts.
            requestAnimationFrame(() => {
                const el = document.querySelector(`[data-testid="accordion-section-${id}"]`);
                if (el && 'scrollIntoView' in el) {
                    (el as HTMLElement).scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        }, [])
    );

    return (
        <SectionAccordionContext.Provider value={value}>
            <div
                className={cn('flex flex-col gap-3', className)}
                data-testid="section-accordion"
            >
                {children}
            </div>
        </SectionAccordionContext.Provider>
    );
}

SectionAccordion.displayName = 'SectionAccordion';

// ---------------------------------------------------------------------------
// SectionAccordionItem
// ---------------------------------------------------------------------------

/**
 * Props for a single collapsible section inside a SectionAccordion.
 */
export interface SectionAccordionItemProps {
    /**
     * Stable unique identifier for this section. Used as the accordion key and
     * for the ARIA id attributes.
     */
    readonly id: string;
    /**
     * Section title shown in the header regardless of open/collapsed state.
     */
    readonly title: string;
    /**
     * Optional icon rendered to the left of the title.
     */
    readonly icon?: React.ReactNode;
    /**
     * Optional badge (e.g. status indicator) rendered to the right of the title.
     */
    readonly badge?: React.ReactNode;
    /**
     * Content shown ONLY when the section is collapsed, in the space between
     * the title and the chevron. Typically a one-line summary of the section's
     * value (e.g. "Hotel Plaza · Hotel · Gualeguaychú" for a main-data section,
     * or "8 fotos" for a gallery section, or "— sin datos" when empty).
     *
     * The caller is responsible for computing this summary; the component only
     * renders it.
     *
     * Can be a `string` or any `ReactNode` for richer rendering.
     */
    readonly collapsedSummary?: React.ReactNode;
    /**
     * Body content rendered when the section is open.
     */
    readonly children: React.ReactNode;
    /**
     * Whether this section starts collapsed.
     * The SectionAccordion will honour this when no explicit `defaultOpenIds`
     * entry overrides it. Defaults to `false` (open by default).
     */
    readonly defaultCollapsed?: boolean;
    /**
     * Additional CSS classes applied to the outermost section element.
     */
    readonly className?: string;
}

/**
 * SectionAccordionItem — one collapsible section inside a SectionAccordion.
 *
 * Renders a sticky header (chevron + optional icon + title + optional badge +
 * collapsed summary) and a collapsible body. The component is fully keyboard-
 * accessible: the header button responds to Space / Enter and exposes
 * `aria-expanded` / `aria-controls`.
 *
 * State is owned by the parent SectionAccordion; this component reads and
 * writes through context.
 */
export const SectionAccordionItem = React.memo(function SectionAccordionItemComponent({
    id,
    title,
    icon,
    badge,
    collapsedSummary,
    children,
    defaultCollapsed = false,
    className
}: SectionAccordionItemProps) {
    const { openSections, toggleSection } = useSectionAccordion();

    // Register this item's initial state with the parent on first render.
    // We do this once with a layout effect so the parent Set is updated
    // synchronously before the first paint, avoiding a flash of wrong state.
    const registeredRef = React.useRef(false);
    const toggleSectionRef = React.useRef(toggleSection);
    toggleSectionRef.current = toggleSection;

    // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount to register this item's initial open state; re-running on dep changes would fight user toggles
    React.useLayoutEffect(() => {
        if (registeredRef.current) return;
        registeredRef.current = true;

        // If this item should be open by default and the parent hasn't
        // already added it to openSections via defaultOpenIds, open it.
        if (!defaultCollapsed && !openSections.has(id)) {
            toggleSectionRef.current(id);
        }
    }, []); // intentionally empty — run once on mount only

    const isOpen = openSections.has(id);

    const headerId = `accordion-header-${id}`;
    const panelId = `accordion-panel-${id}`;

    const handleToggle = React.useCallback(
        (e: React.MouseEvent | React.KeyboardEvent) => {
            if (
                e.type === 'keydown' &&
                (e as React.KeyboardEvent).key !== 'Enter' &&
                (e as React.KeyboardEvent).key !== ' '
            ) {
                return;
            }
            if (e.type === 'keydown') {
                e.preventDefault(); // prevent page scroll on Space
            }
            toggleSection(id);
        },
        [id, toggleSection]
    );

    return (
        <div
            className={cn(
                'overflow-hidden rounded-lg border border-border bg-card shadow-sm',
                className
            )}
            data-testid={`accordion-section-${id}`}
        >
            {/* ---- Header ---- */}
            <button
                id={headerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={handleToggle}
                onKeyDown={handleToggle}
                className={cn(
                    // Layout
                    'flex w-full items-center gap-3 px-5 py-4 text-left',
                    // Typography
                    'font-heading font-semibold text-base text-foreground',
                    // Interactive
                    'cursor-pointer select-none',
                    // Focus ring (river primary, consistent with admin tokens)
                    'ring-ring/50 focus-visible:outline-none focus-visible:ring-2',
                    // Hover: subtle accent background
                    'transition-colors duration-150 hover:bg-accent/50',
                    // When open, show a bottom separator between header and body
                    isOpen && 'border-border border-b'
                )}
                data-testid={`accordion-header-${id}`}
            >
                {/* Chevron — rotates 90° when open */}
                <ChevronRightIcon
                    className={cn(
                        'h-4 w-4 flex-none text-muted-foreground transition-transform duration-200',
                        isOpen && 'rotate-90'
                    )}
                    aria-hidden="true"
                />

                {/* Optional icon */}
                {icon && (
                    <span
                        className="flex-none text-muted-foreground"
                        aria-hidden="true"
                    >
                        {icon}
                    </span>
                )}

                {/* Title */}
                <span className="flex-1 truncate">{title}</span>

                {/* Optional badge (e.g. status) — always visible */}
                {badge && <span className="ml-auto flex-none">{badge}</span>}

                {/* Collapsed summary — only visible when section is closed */}
                {!isOpen && collapsedSummary !== undefined && (
                    <span
                        className={cn(
                            'ml-auto max-w-[55%] truncate text-right',
                            'font-normal text-muted-foreground text-sm'
                        )}
                        aria-hidden="true"
                        data-testid={`accordion-summary-${id}`}
                    >
                        {collapsedSummary}
                    </span>
                )}
            </button>

            {/* ---- Body (collapsible panel) ---- */}
            {/*
             * We use conditional rendering (not CSS visibility) so that
             * hidden field components don't mount, run effects, or receive
             * focus. This matches the <details> pattern in FormSidebarLayout
             * and avoids animating a potentially large DOM subtree.
             *
             * If smooth animation becomes a requirement in the future, replace
             * this with a CSS max-height transition on a persistent wrapper.
             */}
            {isOpen && (
                <section
                    id={panelId}
                    aria-labelledby={headerId}
                    className="px-5 py-5"
                    data-testid={`accordion-panel-${id}`}
                >
                    {children}
                </section>
            )}
        </div>
    );
});

SectionAccordionItem.displayName = 'SectionAccordionItem';
