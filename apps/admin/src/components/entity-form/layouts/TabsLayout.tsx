import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Tab configuration
 */
export interface TabConfig {
    /** Unique tab identifier */
    id: string;
    /** Tab label */
    label: string;
    /** Tab content */
    content: React.ReactNode;
    /** Whether tab is disabled */
    disabled?: boolean;
    /** Icon for the tab */
    icon?: React.ReactNode;
    /** Badge content */
    badge?: React.ReactNode;
}

/**
 * Props for TabsLayout component
 */
export interface TabsLayoutProps {
    /** Tab configurations */
    tabs: TabConfig[];
    /** Default active tab */
    defaultValue?: string;
    /** Controlled active tab */
    value?: string;
    /** Tab change handler */
    onValueChange?: (value: string) => void;
    /** Tabs orientation */
    orientation?: 'horizontal' | 'vertical';
    /** Additional CSS classes */
    className?: string;
    /** Additional CSS classes for tabs list */
    tabsListClassName?: string;
    /** Additional CSS classes for tab content */
    tabsContentClassName?: string;
    /** Whether tabs should be full width */
    fullWidth?: boolean;
}

/**
 * TabsLayout component for organizing form sections in tabs
 * Provides tabbed interface with configurable orientation and styling
 */
export const TabsLayout = React.forwardRef<HTMLDivElement, TabsLayoutProps>(
    (
        {
            tabs,
            defaultValue,
            value,
            onValueChange,
            orientation = 'horizontal',
            className,
            tabsListClassName,
            tabsContentClassName,
            fullWidth = false,
            ...props
        },
        ref
    ) => {
        // Use first tab as default if no default specified
        const effectiveDefaultValue = defaultValue || tabs[0]?.id;

        return (
            <div
                ref={ref}
                className={cn('w-full', className)}
                {...props}
            >
                <Tabs
                    defaultValue={effectiveDefaultValue}
                    value={value}
                    onValueChange={onValueChange}
                    orientation={orientation}
                    className="w-full"
                >
                    <TabsList
                        className={cn(
                            orientation === 'vertical' && 'h-auto flex-col',
                            fullWidth && 'w-full',
                            tabsListClassName
                        )}
                    >
                        {tabs.map((tab) => (
                            <TabsTrigger
                                key={tab.id}
                                value={tab.id}
                                disabled={tab.disabled}
                                className={cn(
                                    'flex items-center gap-2',
                                    fullWidth && 'flex-1',
                                    orientation === 'vertical' && 'w-full justify-start'
                                )}
                            >
                                {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
                                <span className="truncate">{tab.label}</span>
                                {tab.badge && <span className="flex-shrink-0">{tab.badge}</span>}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {tabs.map((tab) => (
                        <TabsContent
                            key={tab.id}
                            value={tab.id}
                            className={cn(
                                'mt-4 focus-visible:outline-none',
                                orientation === 'vertical' && 'ml-4',
                                tabsContentClassName
                            )}
                        >
                            {tab.content}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        );
    }
);

TabsLayout.displayName = 'TabsLayout';
