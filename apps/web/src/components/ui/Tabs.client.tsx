import type React from 'react';
import { useState } from 'react';

/**
 * Interface for an individual tab item.
 */
export interface TabItem {
    readonly id: string;
    readonly label: string;
    readonly content: React.ReactNode;
}

/**
 * Props for the Tabs component.
 */
export interface TabsProps {
    /** Array of tab items to display */
    readonly tabs: ReadonlyArray<TabItem>;
    /** ID of the default active tab. Defaults to first tab if not provided */
    readonly defaultTab?: string;
    /** Optional CSS class name */
    readonly className?: string;
}

/**
 * Tabs component implementing ARIA tabs pattern with keyboard navigation.
 *
 * @example
 * ```tsx
 * const tabs = [
 *   { id: 'overview', label: 'Overview', content: <div>Overview content</div> },
 *   { id: 'details', label: 'Details', content: <div>Details content</div> },
 * ];
 *
 * <Tabs tabs={tabs} defaultTab="overview" />
 * ```
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 */
export function Tabs({ tabs, defaultTab, className = '' }: TabsProps): React.JSX.Element {
    const initialTab = defaultTab || (tabs.length > 0 ? tabs[0]?.id : undefined);
    const [activeTab, setActiveTab] = useState<string | undefined>(initialTab);

    /**
     * Handles keyboard navigation for the tab list.
     *
     * @param event - Keyboard event
     */
    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
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
        }

        if (targetIndex !== null) {
            const targetTab = tabs[targetIndex];
            if (targetTab) {
                setActiveTab(targetTab.id);
            }
        }
    };

    /**
     * Handles tab click to change active tab.
     *
     * @param tabId - ID of the clicked tab
     */
    const handleTabClick = (tabId: string): void => {
        setActiveTab(tabId);
    };

    const activeTabData = tabs.find((tab) => tab.id === activeTab);

    return (
        <div className={className}>
            {/* Tab List */}
            <div
                role="tablist"
                className="flex border-gray-200 border-b"
            >
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            aria-controls={`panel-${tab.id}`}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => handleTabClick(tab.id)}
                            onKeyDown={handleKeyDown}
                            className={`px-4 py-2 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary${
                                isActive
                                    ? 'border-primary border-b-2 text-primary'
                                    : 'border-transparent border-b-2 text-gray-600 hover:border-gray-300 hover:text-gray-800'
                            }
							`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Panels */}
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
                        {isActive && activeTabData?.content}
                    </div>
                );
            })}
        </div>
    );
}
