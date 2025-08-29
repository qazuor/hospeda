/**
 * @file TabsLayout Renderer
 *
 * Renders content in a tabbed interface using Shadcn Tabs component.
 * Supports horizontal/vertical orientation, different variants, and lazy loading.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { memo, useMemo } from 'react';
import type { LayoutRendererContext, TabsLayoutConfig } from '../../types';

/**
 * Tabs layout renderer component
 */
export const TabsLayout = memo(
    <TData = unknown>({ layout, sections, children }: LayoutRendererContext<TData>) => {
        const tabsConfig = layout as TabsLayoutConfig;

        // Sort sections by order
        const sortedSections = useMemo(
            () => [...sections].sort((a, b) => a.order - b.order),
            [sections]
        );

        // Get default tab (first section)
        const defaultTab = sortedSections[0]?.id;

        // Split children by sections (this would need to be implemented based on how children are structured)
        const sectionChildren = useMemo(() => {
            // This is a simplified implementation - in reality, you'd need to map children to sections
            // based on the section configuration and field assignments
            const childrenArray = Array.isArray(children) ? children : [children];
            const sectionsMap = new Map<string, React.ReactNode[]>();

            sortedSections.forEach((section, index) => {
                sectionsMap.set(section.id, [childrenArray[index]]);
            });

            return sectionsMap;
        }, [children, sortedSections]);

        return (
            <Tabs
                defaultValue={defaultTab}
                orientation={tabsConfig.orientation}
                className={cn('w-full', tabsConfig.orientation === 'vertical' && 'flex gap-6')}
                data-layout="tabs"
            >
                <TabsList
                    className={cn(
                        tabsConfig.variant === 'pills' && 'bg-muted p-1',
                        tabsConfig.variant === 'underline' && 'border-b bg-transparent',
                        tabsConfig.orientation === 'vertical' && 'h-fit flex-col'
                    )}
                >
                    {sortedSections.map((section) => (
                        <TabsTrigger
                            key={section.id}
                            value={section.id}
                            className={cn(
                                tabsConfig.variant === 'underline' &&
                                    'border-transparent border-b-2 data-[state=active]:border-primary',
                                tabsConfig.orientation === 'vertical' && 'w-full justify-start'
                            )}
                        >
                            {section.title}
                            {section.badge && (
                                <span
                                    className={cn(
                                        'ml-2 rounded-full px-2 py-1 text-xs',
                                        section.badge.variant === 'destructive' &&
                                            'bg-destructive text-destructive-foreground',
                                        section.badge.variant === 'secondary' &&
                                            'bg-secondary text-secondary-foreground',
                                        section.badge.variant === 'outline' &&
                                            'border border-border',
                                        !section.badge.variant &&
                                            'bg-primary text-primary-foreground'
                                    )}
                                >
                                    {section.badge.text}
                                </span>
                            )}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {sortedSections.map((section) => (
                    <TabsContent
                        key={section.id}
                        value={section.id}
                        className={cn(
                            'mt-6',
                            tabsConfig.orientation === 'vertical' && 'mt-0 flex-1'
                        )}
                        forceMount={tabsConfig.lazy ? undefined : true}
                    >
                        <div className="space-y-4">
                            {section.description && (
                                <p className="text-muted-foreground text-sm">
                                    {section.description}
                                </p>
                            )}
                            {sectionChildren.get(section.id)}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        );
    }
);

TabsLayout.displayName = 'TabsLayout';
