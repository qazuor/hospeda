/**
 * @file GridLayout Renderer
 *
 * Renders content in a responsive CSS Grid layout with configurable columns,
 * gaps, and auto-fit capabilities.
 */

import { cn } from '@/lib/utils';
import { memo } from 'react';
import type { GridLayoutConfig, LayoutRendererContext } from '../../types';
import { createGapClasses, createResponsiveClasses } from '../ConfigurableLayout';

/**
 * Grid layout renderer component
 */
export const GridLayout = memo(
    <TData = unknown>({ layout, children }: LayoutRendererContext<TData>) => {
        const gridConfig = layout as GridLayoutConfig;

        // Create responsive column classes
        const columnClasses = createResponsiveClasses(gridConfig.columns, 'grid-cols');

        // Create gap classes
        const gapClasses = createGapClasses(gridConfig.gap);

        // Auto-fit configuration
        const autoFitStyles =
            gridConfig.autoFit && gridConfig.minColumnWidth
                ? {
                      gridTemplateColumns: `repeat(auto-fit, minmax(${gridConfig.minColumnWidth}, 1fr))`
                  }
                : {};

        return (
            <div
                className={cn('grid', columnClasses, gapClasses, 'w-full')}
                style={autoFitStyles}
                data-layout="grid"
            >
                {children}
            </div>
        );
    }
);

GridLayout.displayName = 'GridLayout';
