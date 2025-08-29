/**
 * @file SidebarLayout Renderer
 *
 * Renders content with a sidebar layout that can be positioned left or right,
 * with collapsible functionality and responsive behavior.
 */

import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped';
import { cn } from '@/lib/utils';
import { memo, useState } from 'react';
import type { LayoutRendererContext, SidebarLayoutConfig } from '../../types';

/**
 * Sidebar layout renderer component
 */
export const SidebarLayout = memo(
    <TData = unknown>({ layout, children }: LayoutRendererContext<TData>) => {
        const sidebarConfig = layout as SidebarLayoutConfig;
        const [isCollapsed, setIsCollapsed] = useState(sidebarConfig.defaultCollapsed ?? false);

        // Determine if we should show the sidebar based on breakpoint
        const shouldShowSidebar = true; // In a real implementation, this would check the breakpoint

        const toggleCollapsed = () => {
            if (sidebarConfig.collapsible) {
                setIsCollapsed(!isCollapsed);
            }
        };

        return (
            <div
                className={cn(
                    'flex w-full',
                    sidebarConfig.position === 'right' && 'flex-row-reverse'
                )}
                data-layout="sidebar"
            >
                {/* Sidebar */}
                {shouldShowSidebar && (
                    <div
                        className={cn(
                            'flex-shrink-0 border-border border-r bg-muted/30',
                            sidebarConfig.position === 'right' && 'border-r-0 border-l',
                            isCollapsed ? 'w-12' : sidebarConfig.width,
                            'transition-all duration-200 ease-in-out'
                        )}
                        style={{
                            width: isCollapsed ? '3rem' : sidebarConfig.width
                        }}
                    >
                        {/* Collapse toggle button */}
                        {sidebarConfig.collapsible && (
                            <div
                                className={cn(
                                    'flex p-2',
                                    sidebarConfig.position === 'right'
                                        ? 'justify-start'
                                        : 'justify-end'
                                )}
                            >
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleCollapsed}
                                    className="h-8 w-8 p-0"
                                >
                                    <Icon
                                        name={
                                            isCollapsed
                                                ? sidebarConfig.position === 'right'
                                                    ? 'ChevronLeft'
                                                    : 'ChevronRight'
                                                : sidebarConfig.position === 'right'
                                                  ? 'ChevronRight'
                                                  : 'ChevronLeft'
                                        }
                                        className="h-4 w-4"
                                    />
                                </Button>
                            </div>
                        )}

                        {/* Sidebar content */}
                        <div className={cn('p-4', isCollapsed && 'hidden')}>
                            {/* This would contain navigation or sidebar-specific content */}
                            <div className="text-muted-foreground text-sm">
                                Sidebar content would go here
                            </div>
                        </div>
                    </div>
                )}

                {/* Main content */}
                <div className="min-w-0 flex-1">
                    <div className="p-6">{children}</div>
                </div>
            </div>
        );
    }
);

SidebarLayout.displayName = 'SidebarLayout';
