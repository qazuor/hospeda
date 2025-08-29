/**
 * @file ConfigurableLayout Component
 *
 * Dynamic layout component that renders different layout types based on configuration.
 * Supports grid, tabs, sidebar, accordion, flex, and custom layouts with full responsiveness.
 */

import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';
import { memo, useMemo } from 'react';
import type { LayoutConfig, LayoutRendererContext, SectionConfig } from '../types';
import { LayoutType } from '../types';
import { AccordionLayout } from './renderers/AccordionLayout';
import { FlexLayout } from './renderers/FlexLayout';
import { GridLayout } from './renderers/GridLayout';
import { SidebarLayout } from './renderers/SidebarLayout';
import { TabsLayout } from './renderers/TabsLayout';

/**
 * Props for the ConfigurableLayout component
 */
type ConfigurableLayoutProps<TData = unknown> = {
    readonly layout: LayoutConfig;
    readonly sections: readonly SectionConfig[];
    readonly formData: TData;
    readonly mode: 'view' | 'edit';
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly customRenderers?: Record<string, React.ComponentType<LayoutRendererContext<TData>>>;
};

/**
 * Default layout renderer registry
 */
const defaultLayoutRenderers = {
    [LayoutType.GRID]: GridLayout,
    [LayoutType.TABS]: TabsLayout,
    [LayoutType.SIDEBAR]: SidebarLayout,
    [LayoutType.ACCORDION]: AccordionLayout,
    [LayoutType.FLEX]: FlexLayout
} as const;

/**
 * ConfigurableLayout component that dynamically renders layouts based on configuration
 */
export const ConfigurableLayout = memo(
    <TData = unknown>({
        layout,
        sections,
        formData,
        mode,
        children,
        className,
        customRenderers = {}
    }: ConfigurableLayoutProps<TData>) => {
        /**
         * Resolve the appropriate layout renderer
         */
        const LayoutRenderer = useMemo(() => {
            // Check for custom renderer first
            if (layout.type === LayoutType.CUSTOM) {
                const customRenderer = customRenderers[layout.component];
                if (customRenderer) {
                    return customRenderer;
                }

                adminLogger.error(
                    `Custom layout renderer "${layout.component}" not found. Falling back to grid layout.`
                );
                return GridLayout;
            }

            // Use default renderer
            const renderer = defaultLayoutRenderers[layout.type];
            if (!renderer) {
                adminLogger.error(
                    `Layout renderer for type "${layout.type}" not found. Falling back to grid layout.`
                );
                return GridLayout;
            }

            return renderer;
        }, [layout, customRenderers]);

        /**
         * Create the renderer context
         */
        const context: LayoutRendererContext<TData> = useMemo(
            () => ({
                layout,
                sections,
                formData,
                mode,
                children
            }),
            [layout, sections, formData, mode, children]
        );

        return (
            <div
                className={cn(
                    'configurable-layout',
                    `layout-${layout.type}`,
                    `mode-${mode}`,
                    className
                )}
                data-layout-type={layout.type}
                data-mode={mode}
            >
                <LayoutRenderer {...context} />
            </div>
        );
    }
);

ConfigurableLayout.displayName = 'ConfigurableLayout';

/**
 * Hook to validate layout configuration
 */
export const useLayoutValidation = (layout: LayoutConfig) => {
    return useMemo(() => {
        const errors: string[] = [];

        // Validate based on layout type
        switch (layout.type) {
            case LayoutType.GRID: {
                if (!layout.columns) {
                    errors.push('Grid layout requires columns configuration');
                }
                break;
            }
            case LayoutType.SIDEBAR: {
                if (!layout.width) {
                    errors.push('Sidebar layout requires width configuration');
                }
                break;
            }
            case LayoutType.CUSTOM: {
                if (!layout.component) {
                    errors.push('Custom layout requires component name');
                }
                break;
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }, [layout]);
};

/**
 * Utility function to create responsive classes based on breakpoints
 */
export const createResponsiveClasses = (
    breakpoints: { mobile?: number; tablet?: number; desktop?: number; wide?: number },
    prefix = 'grid-cols'
) => {
    const classes: string[] = [];

    if (breakpoints.mobile) {
        classes.push(`${prefix}-${breakpoints.mobile}`);
    }
    if (breakpoints.tablet) {
        classes.push(`sm:${prefix}-${breakpoints.tablet}`);
    }
    if (breakpoints.desktop) {
        classes.push(`md:${prefix}-${breakpoints.desktop}`);
    }
    if (breakpoints.wide) {
        classes.push(`lg:${prefix}-${breakpoints.wide}`);
    }

    return classes.join(' ');
};

/**
 * Utility function to create gap classes
 */
export const createGapClasses = (gap: { x?: number; y?: number } | number) => {
    if (typeof gap === 'number') {
        return `gap-${gap}`;
    }

    const classes: string[] = [];
    if (gap.x !== undefined) {
        classes.push(`gap-x-${gap.x}`);
    }
    if (gap.y !== undefined) {
        classes.push(`gap-y-${gap.y}`);
    }

    return classes.join(' ');
};
