import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for GridLayout component
 */
export interface GridLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Number of columns (1-12) */
    columns?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    /** Gap between grid items */
    gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    /** Responsive breakpoints */
    responsive?: {
        sm?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
        md?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
        lg?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
        xl?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    };
    /** Whether to auto-fit columns */
    autoFit?: boolean;
    /** Minimum column width when auto-fitting */
    minColumnWidth?: string;
}

/**
 * GridLayout component for arranging form fields in a grid
 * Provides responsive grid layout with configurable columns and gaps
 */
export const GridLayout = React.forwardRef<HTMLDivElement, GridLayoutProps>(
    (
        {
            columns = 1,
            gap = 'md',
            responsive,
            autoFit = false,
            minColumnWidth = '250px',
            className,
            children,
            ...props
        },
        ref
    ) => {
        const getColumnsClass = (cols: number) => {
            const colsMap: Record<number, string> = {
                1: 'grid-cols-1',
                2: 'grid-cols-2',
                3: 'grid-cols-3',
                4: 'grid-cols-4',
                5: 'grid-cols-5',
                6: 'grid-cols-6',
                7: 'grid-cols-7',
                8: 'grid-cols-8',
                9: 'grid-cols-9',
                10: 'grid-cols-10',
                11: 'grid-cols-11',
                12: 'grid-cols-12'
            };
            return colsMap[cols];
        };

        const getGapClass = (gapSize: string) => {
            const gapMap = {
                none: 'gap-0',
                sm: 'gap-2',
                md: 'gap-4',
                lg: 'gap-6',
                xl: 'gap-8'
            };
            return gapMap[gapSize as keyof typeof gapMap] || gapMap.md;
        };

        const getResponsiveClasses = () => {
            if (!responsive) return '';

            const classes = [];
            if (responsive.sm) classes.push(`sm:${getColumnsClass(responsive.sm)}`);
            if (responsive.md) classes.push(`md:${getColumnsClass(responsive.md)}`);
            if (responsive.lg) classes.push(`lg:${getColumnsClass(responsive.lg)}`);
            if (responsive.xl) classes.push(`xl:${getColumnsClass(responsive.xl)}`);

            return classes.join(' ');
        };

        const gridStyle = autoFit
            ? {
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))`,
                  gap:
                      gap === 'none'
                          ? '0'
                          : gap === 'sm'
                            ? '0.5rem'
                            : gap === 'md'
                              ? '1rem'
                              : gap === 'lg'
                                ? '1.5rem'
                                : '2rem'
              }
            : undefined;

        return (
            <div
                ref={ref}
                className={cn(
                    'grid',
                    !autoFit && getColumnsClass(columns),
                    !autoFit && getGapClass(gap),
                    !autoFit && getResponsiveClasses(),
                    className
                )}
                style={gridStyle}
                {...props}
            >
                {children}
            </div>
        );
    }
);

GridLayout.displayName = 'GridLayout';

/**
 * GridItem component for individual grid items with span control
 */
export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Column span (1-12) */
    colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    /** Row span */
    rowSpan?: 1 | 2 | 3 | 4 | 5 | 6;
    /** Responsive column spans */
    responsive?: {
        sm?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
        md?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
        lg?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
        xl?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    };
}

export const GridItem = React.forwardRef<HTMLDivElement, GridItemProps>(
    ({ colSpan = 1, rowSpan = 1, responsive, className, children, ...props }, ref) => {
        const getColSpanClass = (span: number) => {
            const spanMap: Record<number, string> = {
                1: 'col-span-1',
                2: 'col-span-2',
                3: 'col-span-3',
                4: 'col-span-4',
                5: 'col-span-5',
                6: 'col-span-6',
                7: 'col-span-7',
                8: 'col-span-8',
                9: 'col-span-9',
                10: 'col-span-10',
                11: 'col-span-11',
                12: 'col-span-12'
            };
            return spanMap[span];
        };

        const getRowSpanClass = (span: number) => {
            const spanMap: Record<number, string> = {
                1: 'row-span-1',
                2: 'row-span-2',
                3: 'row-span-3',
                4: 'row-span-4',
                5: 'row-span-5',
                6: 'row-span-6'
            };
            return spanMap[span];
        };

        const getResponsiveClasses = () => {
            if (!responsive) return '';

            const classes = [];
            if (responsive.sm) classes.push(`sm:${getColSpanClass(responsive.sm)}`);
            if (responsive.md) classes.push(`md:${getColSpanClass(responsive.md)}`);
            if (responsive.lg) classes.push(`lg:${getColSpanClass(responsive.lg)}`);
            if (responsive.xl) classes.push(`xl:${getColSpanClass(responsive.xl)}`);

            return classes.join(' ');
        };

        return (
            <div
                ref={ref}
                className={cn(
                    getColSpanClass(colSpan),
                    rowSpan > 1 && getRowSpanClass(rowSpan),
                    getResponsiveClasses(),
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

GridItem.displayName = 'GridItem';
