/**
 * @file FlexLayout Renderer
 *
 * Renders content in a flexible layout using CSS Flexbox with configurable
 * direction, wrapping, alignment, and justification.
 */

import { cn } from '@/lib/utils';
import { memo } from 'react';
import type { FlexLayoutConfig, LayoutRendererContext } from '../../types';

/**
 * Flex layout renderer component
 */
export const FlexLayout = memo(
    <TData = unknown>({ layout, children }: LayoutRendererContext<TData>) => {
        const flexConfig = layout as FlexLayoutConfig;

        return (
            <div
                className={cn(
                    'flex',
                    // Direction
                    flexConfig.direction === 'column' ? 'flex-col' : 'flex-row',
                    // Wrap
                    flexConfig.wrap && 'flex-wrap',
                    // Gap
                    `gap-${flexConfig.gap}`,
                    // Alignment
                    flexConfig.align === 'start' && 'items-start',
                    flexConfig.align === 'center' && 'items-center',
                    flexConfig.align === 'end' && 'items-end',
                    flexConfig.align === 'stretch' && 'items-stretch',
                    // Justification
                    flexConfig.justify === 'start' && 'justify-start',
                    flexConfig.justify === 'center' && 'justify-center',
                    flexConfig.justify === 'end' && 'justify-end',
                    flexConfig.justify === 'between' && 'justify-between',
                    flexConfig.justify === 'around' && 'justify-around',
                    flexConfig.justify === 'evenly' && 'justify-evenly',
                    'w-full'
                )}
                data-layout="flex"
            >
                {children}
            </div>
        );
    }
);

FlexLayout.displayName = 'FlexLayout';
