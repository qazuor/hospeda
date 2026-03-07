import type React from 'react';
import { useCallback, useRef, useState } from 'react';

/**
 * Represents a single tab item with its associated content panel.
 */
export interface TabItem {
    /** Unique identifier for the tab, used for ARIA attributes and state management */
    readonly id: string;
    /** Human-readable label rendered inside the tab trigger button */
    readonly label: string;
    /** Content rendered inside the tab panel when this tab is active */
    readonly content: React.ReactNode;
}

/**
 * Props for the {@link Tabs} component.
 */
export interface TabsProps {
    /** Array of tab items to display */
    readonly tabs: ReadonlyArray<TabItem>;
    /**
     * ID of the tab that should be active on first render.
     * Defaults to the first tab's ID when not provided.
     */
    readonly defaultTab?: string;
    /** Optional additional CSS class name applied to the root wrapper element */
    readonly className?: string;
}

/**
 * Accessible tabs component implementing the ARIA tabs pattern with full
 * keyboard navigation support (ArrowLeft, ArrowRight, Home, End).
 *
 * Follows the roving `tabIndex` pattern: only the active tab is in the tab
 * order (`tabIndex={0}`), all others are removed (`tabIndex={-1}`). Focus
 * moves programmatically via `button.focus()` when the user presses an arrow
 * key, matching the WAI-ARIA Authoring Practices Guide recommendation.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 *
 * @example
 * ```tsx
 * const tabs: TabItem[] = [
 *   { id: 'overview', label: 'Overview', content: <div>Overview content</div> },
 *   { id: 'details',  label: 'Details',  content: <div>Details content</div> },
 * ];
 *
 * <Tabs tabs={tabs} defaultTab="overview" />
 * ```
 */
export function Tabs({ tabs, defaultTab, className = '' }: TabsProps): React.JSX.Element {
    const initialTab = defaultTab ?? (tabs.length > 0 ? tabs[0]?.id : undefined);
    const [activeTab, setActiveTab] = useState<string | undefined>(initialTab);

    /**
     * Holds refs to every tab button so we can programmatically move focus
     * when navigating with arrow keys (roving tabIndex pattern).
     */
    const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    /**
     * Registers a button element in the tab refs map.
     * Called via the `ref` callback on each tab button.
     *
     * @param id - Tab identifier
     * @param el - The button DOM element, or null when unmounting
     */
    const registerRef = useCallback((id: string, el: HTMLButtonElement | null): void => {
        if (el) {
            tabRefs.current.set(id, el);
        } else {
            tabRefs.current.delete(id);
        }
    }, []);

    /**
     * Handles keyboard navigation for the tab list.
     * Implements the roving tabIndex pattern by moving both state and DOM focus.
     *
     * Supported keys:
     * - `ArrowLeft`  – move to the previous tab (wraps to last)
     * - `ArrowRight` – move to the next tab (wraps to first)
     * - `Home`       – jump to the first tab
     * - `End`        – jump to the last tab
     *
     * @param event - The keyboard event fired on a tab button
     */
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>): void => {
            const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
            let targetIndex: number | null = null;

            switch (event.key) {
                case 'ArrowLeft':
                    event.preventDefault();
                    targetIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    targetIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
                    break;
                case 'Home':
                    event.preventDefault();
                    targetIndex = 0;
                    break;
                case 'End':
                    event.preventDefault();
                    targetIndex = tabs.length - 1;
                    break;
                default:
                    return;
            }

            if (targetIndex !== null) {
                const targetTab = tabs[targetIndex];
                if (targetTab) {
                    setActiveTab(targetTab.id);
                    tabRefs.current.get(targetTab.id)?.focus();
                }
            }
        },
        [tabs, activeTab]
    );

    /**
     * Changes the active tab on click.
     *
     * @param tabId - Identifier of the clicked tab
     */
    const handleTabClick = useCallback((tabId: string): void => {
        setActiveTab(tabId);
    }, []);

    return (
        <div className={className}>
            {/* Tab list — the interactive strip of tab triggers */}
            <div
                role="tablist"
                aria-label="Tabs"
                className="flex border-border border-b"
            >
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            ref={(el) => registerRef(tab.id, el)}
                            id={`tab-${tab.id}`}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            aria-controls={`panel-${tab.id}`}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => handleTabClick(tab.id)}
                            onKeyDown={handleKeyDown}
                            className={[
                                'px-4 py-2 font-medium transition-colors',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
                                isActive
                                    ? 'border-primary border-b-2 text-primary'
                                    : 'border-transparent border-b-2 text-muted-foreground hover:border-border hover:text-foreground'
                            ].join(' ')}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab panels — one per tab item, hidden via the `hidden` attribute */}
            {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                return (
                    <div
                        key={tab.id}
                        id={`panel-${tab.id}`}
                        role="tabpanel"
                        aria-labelledby={`tab-${tab.id}`}
                        hidden={!isActive}
                        className="mt-4"
                    >
                        {isActive && tab.content}
                    </div>
                );
            })}
        </div>
    );
}
